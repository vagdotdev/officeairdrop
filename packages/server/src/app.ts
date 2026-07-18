/**
 * Fastify application wiring.
 *
 * Exposes exactly three surfaces:
 *   • GET  /health  — liveness probe
 *   • GET  /ice     — ICE server config (STUN, plus TURN when configured)
 *   • GET  /ws      — WebSocket signaling endpoint (handled by SignalingHub)
 *
 * Everything file- or key-related is intentionally absent: this server has no
 * upload route and no storage of payload data.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './config.js';
import { buildIceConfig } from './ice/iceConfig.js';
import { SignalingHub } from './ws/signaling.js';

export interface BuiltApp {
  app: FastifyInstance;
  /** Tear down Redis connections on shutdown. */
  close: () => Promise<void>;
}

export interface BuildAppOptions {
  /** Inject a Redis instance (e.g. a mock in tests). Defaults to a real client. */
  redis?: Redis;
}

function createRedis(): Redis {
  // Single-instance deploys can skip a real Redis with REDIS_URL=memory.
  if (config.redisUrl === 'memory' || config.redisUrl === 'memory://') {
    return new RedisMock() as unknown as Redis;
  }
  return new Redis(config.redisUrl, { lazyConnect: false });
}

export async function buildApp(options: BuildAppOptions = {}): Promise<BuiltApp> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty' },
    },
  });

  // Redis publisher (the hub duplicates this for its subscriber connection).
  const redis = options.redis ?? createRedis();
  redis.on('error', (err) => app.log.error(err, 'redis error'));
  if (config.redisUrl === 'memory' || config.redisUrl === 'memory://') {
    app.log.info('using in-memory redis (single-instance mode)');
  }

  const hub = new SignalingHub(redis, config.roomTtlSeconds, app.log);

  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
  });
  await app.register(websocket);

  // The signaling server is an API, not the website. A friendly root response
  // avoids confusion when someone opens http://localhost:8787 in a browser.
  app.get('/', async () => ({
    service: 'drop-signaling',
    status: 'ok',
    note: 'Drop signaling API. The app runs on the client (default http://localhost:5173).',
    endpoints: ['/health', '/ice', '/ws'],
  }));

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // The encryption key never reaches here — clients fetch ICE config only.
  app.get('/ice', async () => buildIceConfig());

  // Reject WebSocket upgrades from disallowed browser origins. Browsers always
  // send an Origin header on WS, so this stops other websites from abusing the
  // signaling server. Non-browser clients (no Origin) are allowed through.
  const originAllowed = (origin?: string): boolean => {
    if (!origin) return true;
    if (config.corsOrigins.length === 0) return true;
    return config.corsOrigins.includes(origin);
  };

  app.get('/ws', { websocket: true }, (socket, req) => {
    if (!originAllowed(req.headers.origin)) {
      socket.close(1008, 'origin not allowed');
      return;
    }
    hub.handleConnection(socket);
  });

  const close = async (): Promise<void> => {
    await hub.close();
    await redis.quit();
  };

  return { app, close };
}
