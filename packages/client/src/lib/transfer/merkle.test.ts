import { describe, it, expect } from 'vitest';
import { computeMerkleRoot, verifyMerkleRoot } from './merkle.js';
import { sha256 } from '../crypto/hash.js';

const leaf = (s: string) => sha256(new TextEncoder().encode(s));

describe('merkle tree', () => {
  it('is deterministic for the same leaves', async () => {
    const leaves = await Promise.all(['a', 'b', 'c', 'd'].map(leaf));
    const r1 = await computeMerkleRoot(leaves);
    const r2 = await computeMerkleRoot(leaves);
    expect(Array.from(r1)).toEqual(Array.from(r2));
    expect(r1).toHaveLength(32);
  });

  it('detects a tampered leaf', async () => {
    const leaves = await Promise.all(['a', 'b', 'c', 'd'].map(leaf));
    const root = await computeMerkleRoot(leaves);

    const tampered = [...leaves];
    tampered[2] = await leaf('c-tampered');
    expect(await verifyMerkleRoot(tampered, root)).toBe(false);
    expect(await verifyMerkleRoot(leaves, root)).toBe(true);
  });

  it('detects reordering', async () => {
    const leaves = await Promise.all(['a', 'b', 'c'].map(leaf));
    const root = await computeMerkleRoot(leaves);
    const reordered = [leaves[1]!, leaves[0]!, leaves[2]!];
    expect(await verifyMerkleRoot(reordered, root)).toBe(false);
  });

  it('handles odd leaf counts (duplicate-last)', async () => {
    const leaves = await Promise.all(['a', 'b', 'c'].map(leaf));
    const root = await computeMerkleRoot(leaves);
    expect(root).toHaveLength(32);
    expect(await verifyMerkleRoot(leaves, root)).toBe(true);
  });
});
