/**
 * Crypto + transfer constants shared by client and server.
 *
 * These live in @beam/shared so the sender, receiver, and (where relevant)
 * the signaling server agree on the exact same numbers. The server never
 * uses the key material — it only needs the structural constants if it ever
 * validates message shapes.
 */

/**
 * Application chunk size: the unit of encryption, hashing, Merkle-leaf
 * computation, and resume bookkeeping. A file is sliced into 4 MB chunks.
 *
 * This is deliberately decoupled from the WebRTC wire-frame size below:
 * a 4 MB encrypted chunk is fragmented into many small frames on the wire,
 * because SCTP (WebRTC DataChannel transport) cannot reliably ship 4 MB in
 * a single message.
 */
export const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

/**
 * WebRTC DataChannel wire-frame size. SCTP messages above a few hundred KB
 * are unreliable across browsers, so we fragment every encrypted chunk into
 * 16 KB frames, each carrying a small binary header (see protocol.ts).
 */
export const WIRE_FRAME_SIZE = 16 * 1024; // 16 KB

/**
 * Backpressure threshold for the DataChannel's bufferedAmount. When the
 * outgoing buffer drains below this, we resume pumping frames. Keeps memory
 * bounded and avoids overrunning the SCTP send buffer.
 */
export const BUFFERED_AMOUNT_LOW_THRESHOLD = 1 * 1024 * 1024; // 1 MB

/** AES-GCM symmetric key length in bits. */
export const AES_KEY_BITS = 256;

/** AES-GCM IV length in bytes (96-bit IV is the GCM-recommended size). */
export const IV_LENGTH = 12;

/**
 * Per-session random base nonce length in bytes. The 12-byte IV for each
 * chunk is `baseNonce (8 bytes) || chunkIndex (4 bytes, big-endian)`, which
 * guarantees a unique IV per (key, chunk) — a hard requirement for GCM.
 */
export const BASE_NONCE_LENGTH = 8;

/** GCM authentication tag length in bits. */
export const GCM_TAG_BITS = 128;

/** SHA-256 digest length in bytes (used for chunk hashes and Merkle nodes). */
export const SHA256_LENGTH = 32;
