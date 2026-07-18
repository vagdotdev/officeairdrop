/**
 * Transfer protocol — messages exchanged over the established WebRTC
 * DataChannel, *peer-to-peer*. The signaling server is NOT involved here;
 * by this point it has dropped out of the conversation entirely.
 *
 * Two categories travel over the channel:
 *
 *  1. Control messages — small JSON objects (manifest, ack, resume-request,
 *     transfer-complete, error). Sent as strings.
 *
 *  2. Chunk frames — binary payloads. Each encrypted 4 MB chunk is split into
 *     16 KB frames; every frame is prefixed with a fixed-size binary header so
 *     the receiver can reassemble chunks and know when one is complete. See
 *     `FRAME_HEADER` below for the byte layout.
 *
 * Keeping control (JSON) and payload (binary) on the same channel — but
 * trivially distinguishable by the runtime type of the message event data
 * (string vs ArrayBuffer) — keeps the wire simple and ordered.
 */

import { SHA256_LENGTH } from './crypto.js';

// ── Control messages (JSON over the DataChannel) ──────────────

/** Describes one file within a transfer. */
export interface FileDescriptor {
  /** Stable id within this transfer (index-based is fine). */
  id: string;
  name: string;
  /** Plaintext size in bytes. */
  size: number;
  /** MIME type, best-effort (may be empty). */
  type: string;
  /** Number of 4 MB chunks this file occupies. */
  chunkCount: number;
}

/**
 * The manifest is the first control message the sender transmits. It lets the
 * receiver allocate bookkeeping, drive progress UI, and — crucially — verify
 * integrity: every chunk hash is listed and the Merkle root commits to all of
 * them at once.
 *
 * `baseNonce` is the per-session 8-byte random prefix used to derive each
 * chunk's AES-GCM IV. It is NOT secret (the secrecy lives entirely in the key,
 * which travels only in the URL fragment), so shipping it here is safe.
 */
export interface ManifestMessage {
  type: 'manifest';
  transferId: string;
  files: FileDescriptor[];
  chunkSize: number;
  /** Total chunk count across all files (the global chunk index space). */
  totalChunks: number;
  /** Total plaintext bytes across all files. */
  totalBytes: number;
  /** base64url-encoded 8-byte session nonce. */
  baseNonce: string;
  /** Per-chunk SHA-256 hashes, base64url-encoded, indexed by global chunk index. */
  chunkHashes: string[];
  /** base64url-encoded SHA-256 Merkle root over `chunkHashes`. */
  merkleRoot: string;
}

/** Receiver acknowledges that a chunk arrived, verified, and decrypted. */
export interface AckMessage {
  type: 'ack';
  chunkIndex: number;
}

/**
 * Sent by the receiver after a reconnect (or at the very start, when resuming
 * a previously-interrupted transfer it has persisted in IndexedDB). It reports
 * which global chunk indices are still missing so the sender retransmits only
 * those — never the whole file.
 */
export interface ResumeRequestMessage {
  type: 'resume-request';
  transferId: string;
  missingChunks: number[];
}

/** Receiver tells the sender every chunk was received and verified. */
export interface TransferCompleteMessage {
  type: 'transfer-complete';
  transferId: string;
}

/** Either peer signals a protocol-level error. */
export interface ProtocolErrorMessage {
  type: 'error';
  code: ProtocolErrorCode;
  message: string;
}

export type ProtocolErrorCode =
  | 'verification-failed'
  | 'manifest-mismatch'
  | 'unsupported'
  | 'aborted';

export type ControlMessage =
  | ManifestMessage
  | AckMessage
  | ResumeRequestMessage
  | TransferCompleteMessage
  | ProtocolErrorMessage;

// ── Binary chunk frames ───────────────────────────────────────

/**
 * Binary header prepended to every wire frame. Big-endian, fixed 16 bytes:
 *
 *   offset  size  field
 *   ------  ----  -----------------------------------------------
 *   0       4     chunkIndex   (uint32) global chunk index
 *   4       4     frameIndex   (uint32) frame number within the chunk
 *   8       4     frameCount   (uint32) total frames in this chunk
 *   12      4     payloadLen   (uint32) bytes of payload following header
 *
 * The payload that follows is a slice of the chunk's AES-GCM ciphertext
 * (ciphertext includes the GCM auth tag appended by Web Crypto).
 */
export const FRAME_HEADER = {
  BYTES: 16,
  OFFSET_CHUNK_INDEX: 0,
  OFFSET_FRAME_INDEX: 4,
  OFFSET_FRAME_COUNT: 8,
  OFFSET_PAYLOAD_LEN: 12,
} as const;

/** Parsed view of a frame header. */
export interface FrameHeader {
  chunkIndex: number;
  frameIndex: number;
  frameCount: number;
  payloadLen: number;
}

/** Re-exported for convenience at the protocol boundary. */
export const HASH_LENGTH = SHA256_LENGTH;
