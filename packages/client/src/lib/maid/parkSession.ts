import { CHUNK_SIZE, type ParkManifest } from '@beam/shared';
import {
  bytesToBase64Url,
  encryptChunk,
  exportKeyToFragment,
  generateBaseNonce,
  generateSessionKey,
  sha256,
} from '../crypto/index.js';
import { FileChunker } from '../transfer/chunker.js';
import { nanoid } from '../transfer/ids.js';
import { computeMerkleRoot } from '../transfer/merkle.js';
import { ProgressTracker } from '../transfer/progress.js';
import { MaidClient } from './maidClient.js';
import { encodeRecoveryFragment, type ParkCallbacks } from './types.js';

export class ParkSession {
  private readonly abortController = new AbortController();

  constructor(
    maidUrl: string,
    private readonly appOrigin: string,
    private readonly callbacks: ParkCallbacks = {},
  ) {
    this.client = new MaidClient(maidUrl, this.abortController.signal);
  }

  private readonly client: MaidClient;

  async start(files: File[], accessKey: string, ttlSeconds = 259_200): Promise<void> {
    if (files.length === 0) throw new Error('Choose at least one file to park.');
    if (!accessKey.trim()) throw new Error('Enter the maid access key.');

    try {
      this.callbacks.onState?.('preparing');
      const key = await generateSessionKey();
      const baseNonce = generateBaseNonce();
      const chunker = new FileChunker(files);
      const manifest = await this.prepareManifest(chunker, key, baseNonce);
      const created = await this.client.createPark(
        { manifest, ttlSeconds },
        accessKey.trim(),
      );

      this.callbacks.onState?.('uploading');
      const progress = new ProgressTracker(chunker.totalBytes, chunker.totalChunks);
      for (let index = 0; index < chunker.totalChunks; index++) {
        const plaintext = await chunker.readChunk(index);
        const ciphertext = await encryptChunk(key, baseNonce, index, plaintext);
        await this.client.uploadChunk(created.parkId, created.token, index, ciphertext);
        progress.recordChunk(plaintext.length);
        this.callbacks.onProgress?.(progress.snapshot());
      }
      await this.client.complete(created.parkId, created.token);

      const keyFragment = await exportKeyToFragment(key);
      const recoveryUrl = `${this.appOrigin}/recover/${encodeURIComponent(created.parkId)}#${encodeRecoveryFragment(keyFragment, created.token)}`;
      this.callbacks.onState?.('complete');
      this.callbacks.onComplete?.(recoveryUrl, created.expiresAt);
    } catch (error) {
      if (this.abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Could not park files.';
      this.callbacks.onState?.('error');
      this.callbacks.onError?.(message);
      throw error;
    }
  }

  close(): void {
    this.abortController.abort();
  }

  private async prepareManifest(
    chunker: FileChunker,
    key: CryptoKey,
    baseNonce: Uint8Array,
  ): Promise<ParkManifest> {
    const chunkHashes: Uint8Array[] = [];
    const cipherChunkHashes: Uint8Array[] = [];

    for (let index = 0; index < chunker.totalChunks; index++) {
      const plaintext = await chunker.readChunk(index);
      const ciphertext = await encryptChunk(key, baseNonce, index, plaintext);
      chunkHashes.push(await sha256(plaintext));
      cipherChunkHashes.push(await sha256(ciphertext));
    }

    return {
      version: 1,
      transferId: nanoid(),
      files: chunker.buildFileDescriptors(),
      chunkSize: CHUNK_SIZE,
      totalChunks: chunker.totalChunks,
      totalBytes: chunker.totalBytes,
      baseNonce: bytesToBase64Url(baseNonce),
      chunkHashes: chunkHashes.map(bytesToBase64Url),
      merkleRoot: bytesToBase64Url(await computeMerkleRoot(chunkHashes)),
      cipherChunkHashes: cipherChunkHashes.map(bytesToBase64Url),
      cipherMerkleRoot: bytesToBase64Url(await computeMerkleRoot(cipherChunkHashes)),
    };
  }
}
