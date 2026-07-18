import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CHUNK_SIZE,
  type CreateParkResponse,
  type ParkManifest,
  type ParkStatusResponse,
} from '@beam/shared';
import { buildMaid, type BuiltMaid } from '../src/app.js';
import type { MaidConfig } from '../src/config.js';

const openApps: BuiltMaid[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((built) => built.close()));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('base64url');
}

function merkle(hashes: string[]): string {
  let level: Uint8Array[] = hashes.map((value) => Buffer.from(value, 'base64url'));
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(
        createHash('sha256')
          .update(Buffer.concat([level[i]!, level[i + 1] ?? level[i]!]))
          .digest(),
      );
    }
    level = next;
  }
  return Buffer.from(level[0]!).toString('base64url');
}

async function setup(): Promise<BuiltMaid> {
  const dataDir = await mkdtemp(join(tmpdir(), 'drop-maid-'));
  tempDirs.push(dataDir);
  const config: MaidConfig = {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    accessToken: 'test-access-token-at-least-24-characters',
    corsOrigins: [],
    maxParkBytes: 10 * 1024 * 1024,
    minFreeBytes: 1,
    defaultTtlSeconds: 3600,
    maxTtlSeconds: 7200,
  };
  const built = await buildMaid({ config });
  openApps.push(built);
  return built;
}

function fixture(): { manifest: ParkManifest; chunks: Buffer[] } {
  const chunks = [
    Buffer.alloc(CHUNK_SIZE + 16, 3),
    Buffer.alloc(3 + 16, 7),
  ];
  const plainHashes = [hash(Buffer.alloc(CHUNK_SIZE, 1)), hash(Buffer.alloc(3, 2))];
  const cipherHashes = chunks.map(hash);
  return {
    chunks,
    manifest: {
      version: 1,
      transferId: 'transfer-test-1',
      files: [
        {
          id: '0',
          name: 'parked.bin',
          size: CHUNK_SIZE + 3,
          type: 'application/octet-stream',
          chunkCount: 2,
        },
      ],
      chunkSize: CHUNK_SIZE,
      totalChunks: 2,
      totalBytes: CHUNK_SIZE + 3,
      baseNonce: Buffer.alloc(8, 9).toString('base64url'),
      chunkHashes: plainHashes,
      merkleRoot: merkle(plainHashes),
      cipherChunkHashes: cipherHashes,
      cipherMerkleRoot: merkle(cipherHashes),
    },
  };
}

describe('blind maid HTTP API', () => {
  it('parks, resumes, completes, retrieves, and deletes ciphertext', async () => {
    const { app } = await setup();
    const { manifest, chunks } = fixture();

    const unauthorized = await app.inject({
      method: 'POST',
      url: '/v1/parks',
      payload: { manifest },
    });
    expect(unauthorized.statusCode).toBe(401);

    const create = await app.inject({
      method: 'POST',
      url: '/v1/parks',
      headers: { 'x-maid-key': 'test-access-token-at-least-24-characters' },
      payload: { manifest, ttlSeconds: 3600 },
    });
    expect(create.statusCode).toBe(201);
    const { parkId, token } = create.json<CreateParkResponse>();
    const authorization = `Bearer ${token}`;

    const badChunk = await app.inject({
      method: 'PUT',
      url: `/v1/parks/${parkId}/chunks/0`,
      headers: { authorization, 'content-type': 'application/octet-stream' },
      payload: Buffer.alloc(CHUNK_SIZE + 16, 8),
    });
    expect(badChunk.statusCode).toBe(409);

    const first = await app.inject({
      method: 'PUT',
      url: `/v1/parks/${parkId}/chunks/0`,
      headers: { authorization, 'content-type': 'application/octet-stream' },
      payload: chunks[0],
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ chunkIndex: 0, durable: true });

    const partial = await app.inject({
      method: 'GET',
      url: `/v1/parks/${parkId}`,
      headers: { authorization },
    });
    expect(partial.json<ParkStatusResponse>().missingChunks).toEqual([1]);

    const incomplete = await app.inject({
      method: 'POST',
      url: `/v1/parks/${parkId}/complete`,
      headers: { authorization },
    });
    expect(incomplete.statusCode).toBe(409);

    await app.inject({
      method: 'PUT',
      url: `/v1/parks/${parkId}/chunks/1`,
      headers: { authorization, 'content-type': 'application/octet-stream' },
      payload: chunks[1],
    });
    const complete = await app.inject({
      method: 'POST',
      url: `/v1/parks/${parkId}/complete`,
      headers: { authorization },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json()).toMatchObject({ parkId, status: 'parked' });

    const retrieved = await app.inject({
      method: 'GET',
      url: `/v1/parks/${parkId}/chunks/1`,
      headers: { authorization },
    });
    expect(retrieved.statusCode).toBe(200);
    expect(retrieved.rawPayload).toEqual(chunks[1]);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/parks/${parkId}`,
      headers: { authorization },
    });
    expect(removed.statusCode).toBe(204);
    const gone = await app.inject({
      method: 'GET',
      url: `/v1/parks/${parkId}`,
      headers: { authorization },
    });
    expect(gone.statusCode).toBe(404);
  });
});
