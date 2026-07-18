/**
 * SHA-256 over the Web Crypto API.
 *
 * Used for per-chunk integrity hashes and as the hash function of the Merkle
 * tree that commits to the whole transfer.
 */

import { asBufferSource } from './encoding.js';

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', asBufferSource(data));
  return new Uint8Array(digest);
}
