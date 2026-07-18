import { describe, it, expect } from 'vitest';
import { encryptChunk, decryptChunk, deriveIv } from './cipher.js';
import { generateSessionKey, generateBaseNonce } from './keys.js';

const text = (s: string) => new TextEncoder().encode(s);

describe('AES-256-GCM chunk cipher', () => {
  it('round-trips plaintext', async () => {
    const key = await generateSessionKey();
    const nonce = generateBaseNonce();
    const plaintext = text('the quick brown fox jumps over the lazy dog');

    const ct = await encryptChunk(key, nonce, 0, plaintext);
    const pt = await decryptChunk(key, nonce, 0, ct);

    expect(new TextDecoder().decode(pt)).toBe(
      'the quick brown fox jumps over the lazy dog',
    );
  });

  it('produces a unique IV per chunk index', () => {
    const nonce = generateBaseNonce();
    const iv0 = deriveIv(nonce, 0);
    const iv1 = deriveIv(nonce, 1);
    const iv256 = deriveIv(nonce, 256);
    expect(iv0).toHaveLength(12);
    expect(Array.from(iv0)).not.toEqual(Array.from(iv1));
    expect(Array.from(iv1)).not.toEqual(Array.from(iv256));
    // base nonce prefix is preserved
    expect(Array.from(iv0.slice(0, 8))).toEqual(Array.from(nonce));
  });

  it('fails authentication when ciphertext is tampered', async () => {
    const key = await generateSessionKey();
    const nonce = generateBaseNonce();
    const ct = await encryptChunk(key, nonce, 5, text('secret payload'));
    ct[0]! ^= 0xff; // flip a bit

    await expect(decryptChunk(key, nonce, 5, ct)).rejects.toThrow();
  });

  it('fails when decrypting with the wrong chunk index (IV mismatch)', async () => {
    const key = await generateSessionKey();
    const nonce = generateBaseNonce();
    const ct = await encryptChunk(key, nonce, 3, text('hello'));
    await expect(decryptChunk(key, nonce, 4, ct)).rejects.toThrow();
  });
});
