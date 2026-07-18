/**
 * Compact, URL-safe random ids generated from the Web Crypto RNG. Used for
 * transfer ids. Avoids a runtime dependency for something this small.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function nanoid(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}
