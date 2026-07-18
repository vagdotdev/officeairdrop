import { createHash } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  statfs,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CompleteParkResponse,
  ParkChunkReceipt,
  ParkManifest,
  ParkStatusResponse,
} from '@beam/shared';
import type { MaidConfig } from './config.js';
import { expectedCiphertextLength } from './manifest.js';
import { hashToken, newCapability, tokenMatches } from './token.js';

interface StoredPark {
  parkId: string;
  tokenHash: string;
  status: 'uploading' | 'parked';
  createdAt: string;
  expiresAt: string;
  manifest: ParkManifest;
}

export class MaidError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const PARK_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const CHUNK_PATTERN = /^(\d{8})\.chunk$/;

export class ParkStore {
  private readonly parksDir: string;

  constructor(private readonly config: MaidConfig) {
    this.parksDir = join(config.dataDir, 'parks');
  }

  async init(): Promise<void> {
    await mkdir(this.parksDir, { recursive: true });
    await this.cleanupExpired();
  }

  async create(
    manifest: ParkManifest,
    ttlSeconds: number,
  ): Promise<{ parkId: string; token: string; expiresAt: string }> {
    const parkId = newCapability(18);
    const token = newCapability();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const requiredBytes = manifest.totalBytes + manifest.totalChunks * 16;
    await this.assertDiskSpace(requiredBytes);

    const dir = this.parkDir(parkId);
    await mkdir(this.chunksDir(parkId), { recursive: true });
    const meta: StoredPark = {
      parkId,
      tokenHash: hashToken(token),
      status: 'uploading',
      createdAt: new Date().toISOString(),
      expiresAt,
      manifest,
    };
    try {
      await this.writeMetadata(dir, meta);
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
    return { parkId, token, expiresAt };
  }

  async status(parkId: string, token: string): Promise<ParkStatusResponse> {
    const park = await this.authorized(parkId, token);
    const received = await this.receivedIndices(park);
    const missingChunks: number[] = [];
    for (let i = 0; i < park.manifest.totalChunks; i++) {
      if (!received.has(i)) missingChunks.push(i);
    }
    return {
      parkId,
      status: park.status,
      expiresAt: park.expiresAt,
      receivedChunks: received.size,
      totalChunks: park.manifest.totalChunks,
      missingChunks,
      manifest: park.manifest,
    };
  }

  async putChunk(
    parkId: string,
    token: string,
    chunkIndex: number,
    body: Buffer,
  ): Promise<ParkChunkReceipt> {
    const park = await this.authorized(parkId, token);
    if (park.status !== 'uploading') throw new MaidError('park is already complete', 409);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= park.manifest.totalChunks) {
      throw new MaidError('chunk index is out of range', 400);
    }
    if (body.length !== expectedCiphertextLength(park.manifest, chunkIndex)) {
      throw new MaidError('chunk has the wrong byte length', 400);
    }

    const hash = createHash('sha256').update(body).digest('base64url');
    if (hash !== park.manifest.cipherChunkHashes[chunkIndex]) {
      throw new MaidError('chunk hash does not match the manifest', 409);
    }

    const destination = this.chunkPath(parkId, chunkIndex);
    try {
      const existing = await readFile(destination);
      const existingHash = createHash('sha256').update(existing).digest('base64url');
      if (existingHash !== hash) throw new MaidError('stored chunk conflicts', 409);
      return { chunkIndex, durable: true, hash };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    await this.assertDiskSpace(body.length);
    const temp = `${destination}.${newCapability(6)}.tmp`;
    const handle = await open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(body);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temp, destination);
      await this.syncDirectory(this.chunksDir(parkId));
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
    return { chunkIndex, durable: true, hash };
  }

  async complete(
    parkId: string,
    token: string,
  ): Promise<CompleteParkResponse> {
    const park = await this.authorized(parkId, token);
    const received = await this.receivedIndices(park);
    if (received.size !== park.manifest.totalChunks) {
      throw new MaidError(
        `${park.manifest.totalChunks - received.size} chunks are still missing`,
        409,
      );
    }
    park.status = 'parked';
    await this.writeMetadata(this.parkDir(parkId), park);
    return { parkId, status: 'parked', expiresAt: park.expiresAt };
  }

  async getChunk(parkId: string, token: string, chunkIndex: number): Promise<Buffer> {
    const park = await this.authorized(parkId, token);
    if (park.status !== 'parked') throw new MaidError('park is not complete', 409);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= park.manifest.totalChunks) {
      throw new MaidError('chunk index is out of range', 400);
    }
    try {
      return await readFile(this.chunkPath(parkId, chunkIndex));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new MaidError('chunk is missing', 404);
      }
      throw error;
    }
  }

  async remove(parkId: string, token: string): Promise<void> {
    await this.authorized(parkId, token);
    await rm(this.parkDir(parkId), { recursive: true, force: true });
  }

  async cleanupExpired(): Promise<number> {
    let removed = 0;
    const entries = await readdir(this.parksDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !PARK_ID_PATTERN.test(entry.name)) continue;
      try {
        const park = await this.load(entry.name);
        if (Date.parse(park.expiresAt) <= Date.now()) {
          await rm(this.parkDir(entry.name), { recursive: true, force: true });
          removed += 1;
        }
      } catch {
        // Leave malformed directories for manual inspection instead of deleting data.
      }
    }
    return removed;
  }

  private async authorized(parkId: string, token: string): Promise<StoredPark> {
    const park = await this.load(parkId);
    if (!tokenMatches(token, park.tokenHash)) throw new MaidError('invalid park capability', 401);
    if (Date.parse(park.expiresAt) <= Date.now()) {
      await rm(this.parkDir(parkId), { recursive: true, force: true });
      throw new MaidError('park has expired', 410);
    }
    return park;
  }

  private async load(parkId: string): Promise<StoredPark> {
    if (!PARK_ID_PATTERN.test(parkId)) throw new MaidError('park not found', 404);
    try {
      return JSON.parse(await readFile(this.metadataPath(parkId), 'utf8')) as StoredPark;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new MaidError('park not found', 404);
      }
      throw error;
    }
  }

  private async receivedIndices(park: StoredPark): Promise<Set<number>> {
    const entries = await readdir(this.chunksDir(park.parkId));
    const received = new Set<number>();
    for (const entry of entries) {
      const match = CHUNK_PATTERN.exec(entry);
      if (match) received.add(Number(match[1]));
    }
    return received;
  }

  private async assertDiskSpace(bytes: number): Promise<void> {
    const stats = await statfs(this.config.dataDir);
    const available = stats.bavail * stats.bsize;
    if (available - bytes < this.config.minFreeBytes) {
      throw new MaidError('maid does not have enough free disk space', 507);
    }
  }

  private parkDir(parkId: string): string {
    return join(this.parksDir, parkId);
  }

  private chunksDir(parkId: string): string {
    return join(this.parkDir(parkId), 'chunks');
  }

  private metadataPath(parkId: string): string {
    return join(this.parkDir(parkId), 'park.json');
  }

  private chunkPath(parkId: string, chunkIndex: number): string {
    return join(this.chunksDir(parkId), `${String(chunkIndex).padStart(8, '0')}.chunk`);
  }

  private async writeMetadata(dir: string, park: StoredPark): Promise<void> {
    const destination = join(dir, 'park.json');
    const temp = `${destination}.${newCapability(6)}.tmp`;
    const handle = await open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(park)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temp, destination);
      await this.syncDirectory(dir);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
  }

  private async syncDirectory(dir: string): Promise<void> {
    const handle = await open(dir, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
}
