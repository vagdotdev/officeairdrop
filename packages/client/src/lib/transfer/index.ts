/**
 * Transfer protocol layer public API.
 *
 * Composes the encryption layer (crypto) and transport layer (webrtc) into the
 * end-to-end chunked, verified, resumable transfer — but depends on them only
 * through their narrow public APIs, never their internals.
 */
export { FileSender } from './sender.js';
export type { FileSenderCallbacks } from './sender.js';
export { FileReceiver } from './receiver.js';
export type { FileReceiverCallbacks } from './receiver.js';
export { FileChunker } from './chunker.js';
export { TransferLayout } from './layout.js';
export { computeMerkleRoot, verifyMerkleRoot } from './merkle.js';
export { computeMissingChunks, isComplete } from './bitmap.js';
export { frameChunk, parseFrame, ChunkReassembler } from './framing.js';
export { ProgressTracker } from './progress.js';
export { ResumeStore } from './resumeStore.js';
export type {
  SenderState,
  ReceiverState,
  TransferProgress,
  CompletedFile,
} from './types.js';
