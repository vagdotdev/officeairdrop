import type { ManifestMessage, ParkManifest } from '@beam/shared';
import {
  base64UrlToBytes,
  bytesEqual,
  decryptChunk,
  importKeyFromFragment,
  sha256,
} from '../crypto/index.js';
import { isComplete } from '../transfer/bitmap.js';
import { buildReceivedFiles } from '../transfer/fileSink.js';
import { TransferLayout } from '../transfer/layout.js';
import { computeMerkleRoot } from '../transfer/merkle.js';
import { ProgressTracker } from '../transfer/progress.js';
import { ResumeStore } from '../transfer/resumeStore.js';
import type { CompletedFile } from '../transfer/types.js';
import { MaidClient } from './maidClient.js';
import {
  decodeRecoveryFragment,
  type RecoverCallbacks,
} from './types.js';

export class RecoverSession {
  private readonly abortController = new AbortController();
  private readonly client: MaidClient;
  private token = '';

  constructor(
    maidUrl: string,
    private readonly parkId: string,
    private readonly fragment: string,
    private readonly callbacks: RecoverCallbacks = {},
  ) {
    this.client = new MaidClient(maidUrl, this.abortController.signal);
  }

  async start(): Promise<void> {
    try {
      this.callbacks.onState?.('connecting');
      const credentials = decodeRecoveryFragment(this.fragment);
      this.token = credentials.token;
      const key = await importKeyFromFragment(credentials.keyFragment);
      const status = await this.client.status(this.parkId, this.token);
      if (status.status !== 'parked') {
        throw new Error('This park was never completed safely.');
      }
      await this.verifyManifest(status.manifest);

      const store = new ResumeStore();
      await store.clearOthers(status.manifest.transferId);
      const manifest = this.asTransferManifest(status.manifest);
      await store.saveManifest(manifest.transferId, manifest);
      const received = await store.getReceivedIndices(manifest.transferId);
      const layout = new TransferLayout(manifest.files, manifest.chunkSize);
      const baseNonce = base64UrlToBytes(manifest.baseNonce);
      const progress = new ProgressTracker(manifest.totalBytes, manifest.totalChunks);
      let receivedBytes = 0;
      for (const index of received) {
        if (index >= 0 && index < manifest.totalChunks) {
          receivedBytes += layout.target(index).length;
        }
      }
      progress.seed(receivedBytes, received.size);
      this.callbacks.onProgress?.(progress.snapshot());
      this.callbacks.onState?.('downloading');

      for (let index = 0; index < manifest.totalChunks; index++) {
        if (received.has(index)) continue;
        const ciphertext = await this.client.downloadChunk(this.parkId, this.token, index);
        const cipherHash = await sha256(ciphertext);
        if (
          !bytesEqual(
            cipherHash,
            base64UrlToBytes(status.manifest.cipherChunkHashes[index]!),
          )
        ) {
          throw new Error(`Ciphertext chunk ${index} failed verification.`);
        }
        const plaintext = await decryptChunk(key, baseNonce, index, ciphertext);
        const plainHash = await sha256(plaintext);
        if (!bytesEqual(plainHash, base64UrlToBytes(manifest.chunkHashes[index]!))) {
          throw new Error(`Plaintext chunk ${index} failed verification.`);
        }
        const target = layout.target(index);
        await store.putChunk({
          transferId: manifest.transferId,
          chunkIndex: index,
          fileIndex: target.fileIndex,
          byteStart: target.byteStart,
          data: plaintext.buffer.slice(
            plaintext.byteOffset,
            plaintext.byteOffset + plaintext.byteLength,
          ) as ArrayBuffer,
        });
        received.add(index);
        progress.recordChunk(plaintext.length);
        this.callbacks.onProgress?.(progress.snapshot());
      }

      if (!isComplete(manifest.totalChunks, received)) {
        throw new Error('Recovery finished with missing chunks.');
      }
      this.callbacks.onState?.('verifying');
      const files: CompletedFile[] = buildReceivedFiles(store, manifest);
      this.callbacks.onState?.('complete');
      this.callbacks.onComplete?.(files, status.expiresAt);
    } catch (error) {
      if (this.abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Could not recover files.';
      this.callbacks.onState?.('error');
      this.callbacks.onError?.(message);
      throw error;
    }
  }

  async deletePark(): Promise<void> {
    if (!this.token) throw new Error('Recovery has not started.');
    await this.client.remove(this.parkId, this.token);
    this.callbacks.onState?.('deleted');
  }

  close(): void {
    this.abortController.abort();
  }

  private async verifyManifest(manifest: ParkManifest): Promise<void> {
    const plainRoot = await computeMerkleRoot(
      manifest.chunkHashes.map(base64UrlToBytes),
    );
    if (!bytesEqual(plainRoot, base64UrlToBytes(manifest.merkleRoot))) {
      throw new Error('Plaintext manifest failed Merkle verification.');
    }
    const cipherRoot = await computeMerkleRoot(
      manifest.cipherChunkHashes.map(base64UrlToBytes),
    );
    if (!bytesEqual(cipherRoot, base64UrlToBytes(manifest.cipherMerkleRoot))) {
      throw new Error('Ciphertext manifest failed Merkle verification.');
    }
  }

  private asTransferManifest(manifest: ParkManifest): ManifestMessage {
    return {
      type: 'manifest',
      transferId: manifest.transferId,
      files: manifest.files,
      chunkSize: manifest.chunkSize,
      totalChunks: manifest.totalChunks,
      totalBytes: manifest.totalBytes,
      baseNonce: manifest.baseNonce,
      chunkHashes: manifest.chunkHashes,
      merkleRoot: manifest.merkleRoot,
    };
  }
}
