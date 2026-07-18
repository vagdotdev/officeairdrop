/**
 * base64url <-> bytes helpers.
 *
 * Used for small values only — the AES key (32 B), the session nonce (8 B),
 * chunk hashes (32 B) and the Merkle root (32 B). Bulk ciphertext is never
 * base64-encoded; it travels as raw binary frames over the DataChannel.
 *
 * base64url (RFC 4648 §5) is chosen because the AES key rides in a URL
 * fragment, so it must be URL-safe and padding-free.
 */

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Narrow a Uint8Array to the DOM `BufferSource` expected by Web Crypto.
 *
 * Since TypeScript 5.7 typed arrays are generic over their backing buffer
 * (`Uint8Array<ArrayBufferLike>`), and `BufferSource` is pinned to `ArrayBuffer`.
 * All of our byte arrays are genuinely ArrayBuffer-backed at runtime, so this
 * is a safe, single-point assertion rather than per-call-site noise.
 */
export function asBufferSource(u: Uint8Array): BufferSource {
  return u as unknown as BufferSource;
}

/** Constant-time comparison of two byte arrays (for hash verification). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}
