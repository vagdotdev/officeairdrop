import { describe, it, expect } from 'vitest';
import {
  generateSessionKey,
  exportKeyToFragment,
  importKeyFromFragment,
} from './keys.js';
import { encryptChunk, decryptChunk } from './cipher.js';
import { generateBaseNonce } from './keys.js';

describe('session key fragment export/import', () => {
  it('exports to a URL-safe string and re-imports to a working key', async () => {
    const key = await generateSessionKey();
    const fragment = await exportKeyToFragment(key);

    // URL-safe: no +, /, or = padding.
    expect(fragment).not.toMatch(/[+/=]/);

    const reimported = await importKeyFromFragment(fragment);
    const nonce = generateBaseNonce();
    const ct = await encryptChunk(key, nonce, 0, new TextEncoder().encode('hi'));
    const pt = await decryptChunk(reimported, nonce, 0, ct);
    expect(new TextDecoder().decode(pt)).toBe('hi');
  });
});
