import type { FileDescriptor } from './protocol.js';

/** Public metadata for an encrypted transfer parked on a blind maid. */
export interface ParkManifest {
  version: 1;
  transferId: string;
  files: FileDescriptor[];
  chunkSize: number;
  totalChunks: number;
  totalBytes: number;
  /** Public AES-GCM nonce prefix. The encryption key is never sent to the maid. */
  baseNonce: string;
  /** SHA-256 commitments to plaintext, checked only by the recovering browser. */
  chunkHashes: string[];
  merkleRoot: string;
  /** SHA-256 commitments to ciphertext, checked by the maid before durable ACK. */
  cipherChunkHashes: string[];
  cipherMerkleRoot: string;
}

export interface CreateParkRequest {
  manifest: ParkManifest;
  ttlSeconds?: number;
}

export interface CreateParkResponse {
  parkId: string;
  /** Per-park capability. Keep this in the recovery URL fragment. */
  token: string;
  expiresAt: string;
}

export interface ParkStatusResponse {
  parkId: string;
  status: 'uploading' | 'parked';
  expiresAt: string;
  receivedChunks: number;
  totalChunks: number;
  missingChunks: number[];
  manifest: ParkManifest;
}

export interface ParkChunkReceipt {
  chunkIndex: number;
  durable: true;
  hash: string;
}

export interface CompleteParkResponse {
  parkId: string;
  status: 'parked';
  expiresAt: string;
}
