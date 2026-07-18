/**
 * AES-256-GCM chunk encryption.
 *
 * ── IV construction (the important bit) ───────────────────────
 * GCM is catastrophically broken if an (key, IV) pair is ever reused. Rather
 * than rely on random IVs (birthday-bound risk across millions of chunks), we
 * derive a *deterministic, unique* 12-byte IV per chunk:
 *
 *     IV = baseNonce (8 random bytes, per session) || chunkIndex (4 bytes BE)
 *
 * Because the chunk index is unique within a session and the base nonce is
 * unique per session, every IV is unique for the lifetime of the key. The base
 * nonce is shipped in the manifest in the clear — it is not secret; only the
 * key is, and the key never leaves the browser.
 *
 * GCM appends its 128-bit auth tag to the ciphertext, so `decryptChunk` also
 * authenticates: any tampering or corruption makes `crypto.subtle.decrypt`
 * throw, which the receiver treats as a verification failure.
 */
import { IV_LENGTH, BASE_NONCE_LENGTH, GCM_TAG_BITS } from '@beam/shared';
import { asBufferSource } from './encoding.js';

const ALGORITHM = 'AES-GCM';

/** Build the 12-byte IV for a given chunk index from the session base nonce. */
export function deriveIv(baseNonce: Uint8Array, chunkIndex: number): Uint8Array {
  if (baseNonce.length !== BASE_NONCE_LENGTH) {
    throw new Error(
      `baseNonce must be ${BASE_NONCE_LENGTH} bytes, got ${baseNonce.length}`,
    );
  }
  const iv = new Uint8Array(IV_LENGTH);
  iv.set(baseNonce, 0);
  // 4-byte big-endian chunk index in the trailing bytes.
  new DataView(iv.buffer).setUint32(BASE_NONCE_LENGTH, chunkIndex, false);
  return iv;
}

/** Encrypt one chunk's plaintext. Returns ciphertext (incl. GCM tag). */
export async function encryptChunk(
  key: CryptoKey,
  baseNonce: Uint8Array,
  chunkIndex: number,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const iv = deriveIv(baseNonce, chunkIndex);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: asBufferSource(iv), tagLength: GCM_TAG_BITS },
    key,
    asBufferSource(plaintext),
  );
  return new Uint8Array(ciphertext);
}

/**
 * Decrypt + authenticate one chunk. Throws if the auth tag fails (tampering,
 * corruption, or wrong key), which callers surface as a verification error.
 */
export async function decryptChunk(
  key: CryptoKey,
  baseNonce: Uint8Array,
  chunkIndex: number,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const iv = deriveIv(baseNonce, chunkIndex);
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: asBufferSource(iv), tagLength: GCM_TAG_BITS },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}
