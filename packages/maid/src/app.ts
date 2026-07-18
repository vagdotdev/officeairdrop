import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { CHUNK_SIZE, type CreateParkRequest } from '@beam/shared';
import { loadConfig, type MaidConfig } from './config.js';
import { parseManifest } from './manifest.js';
import { MaidError, ParkStore } from './store.js';
import { secretMatches } from './token.js';

export interface BuildMaidOptions {
  config?: MaidConfig;
}

export interface BuiltMaid {
  app: FastifyInstance;
  store: ParkStore;
  close: () => Promise<void>;
}

function bearer(value: string | undefined): string {
  if (!value?.startsWith('Bearer ')) throw new MaidError('missing park capability', 401);
  const token = value.slice('Bearer '.length);
  if (!token) throw new MaidError('missing park capability', 401);
  return token;
}

export async function buildMaid(options: BuildMaidOptions = {}): Promise<BuiltMaid> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    bodyLimit: 8 * 1024 * 1024,
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty' },
    },
  });
  const store = new ParkStore(config);
  await store.init();

  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'x-maid-key'],
  });

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: CHUNK_SIZE + 1024 },
    (_request, body, done) => done(null, body),
  );

  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof MaidError) {
      void reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number') {
      const message = error instanceof Error ? error.message : 'request failed';
      void reply.status(statusCode).send({ error: message });
      return;
    }
    app.log.error(error);
    void reply.status(500).send({ error: 'internal maid error' });
  });

  app.get('/', async () => ({
    service: 'drop-maid',
    status: 'ok',
    note: 'Blind encrypted temporary storage. The maid never receives file keys.',
  }));
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.post<{ Body: CreateParkRequest }>('/v1/parks', async (request, reply) => {
    const accessToken = request.headers['x-maid-key'];
    if (
      typeof accessToken !== 'string' ||
      !secretMatches(accessToken, config.accessToken)
    ) {
      throw new MaidError('invalid maid access key', 401);
    }
    const manifest = parseManifest(request.body?.manifest, config.maxParkBytes);
    const requestedTtl = request.body?.ttlSeconds ?? config.defaultTtlSeconds;
    if (!Number.isSafeInteger(requestedTtl) || requestedTtl <= 0) {
      throw new MaidError('ttlSeconds must be a positive integer', 400);
    }
    const ttlSeconds = Math.min(requestedTtl, config.maxTtlSeconds);
    const created = await store.create(manifest, ttlSeconds);
    return reply.status(201).send(created);
  });

  app.get<{ Params: { parkId: string } }>('/v1/parks/:parkId', async (request) => {
    return store.status(request.params.parkId, bearer(request.headers.authorization));
  });

  app.put<{ Params: { parkId: string; index: string }; Body: Buffer }>(
    '/v1/parks/:parkId/chunks/:index',
    async (request) => {
      if (!Buffer.isBuffer(request.body)) throw new MaidError('binary chunk body required', 400);
      return store.putChunk(
        request.params.parkId,
        bearer(request.headers.authorization),
        Number(request.params.index),
        request.body,
      );
    },
  );

  app.get<{ Params: { parkId: string; index: string } }>(
    '/v1/parks/:parkId/chunks/:index',
    async (request, reply) => {
      const chunk = await store.getChunk(
        request.params.parkId,
        bearer(request.headers.authorization),
        Number(request.params.index),
      );
      return reply.type('application/octet-stream').send(chunk);
    },
  );

  app.post<{ Params: { parkId: string } }>(
    '/v1/parks/:parkId/complete',
    async (request) => {
      return store.complete(request.params.parkId, bearer(request.headers.authorization));
    },
  );

  app.delete<{ Params: { parkId: string } }>(
    '/v1/parks/:parkId',
    async (request, reply) => {
      await store.remove(request.params.parkId, bearer(request.headers.authorization));
      return reply.status(204).send();
    },
  );

  const cleanupTimer = setInterval(
    () => void store.cleanupExpired().catch((error) => app.log.error(error)),
    15 * 60 * 1000,
  );
  cleanupTimer.unref();

  return {
    app,
    store,
    close: async () => {
      clearInterval(cleanupTimer);
      await app.close();
    },
  };
}
