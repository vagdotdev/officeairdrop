/**
 * SHA-256 Merkle tree over per-chunk hashes.
 *
 * Each leaf is the SHA-256 of one plaintext chunk. The Merkle *root* is a
 * single 32-byte commitment to the entire ordered set of chunks. Shipping the
 * root in the manifest means the receiver can detect:
 *
 *   • corruption / tampering of any chunk  (leaf hash won't match)
 *   • a missing or reordered chunk         (recomputed root won't match)
 *   • a tampered manifest                  (root won't match the leaves)
 *
 * We use a duplicate-last-node tree (odd nodes are paired with themselves),
 * the most common and simplest construction.
 */
import { sha256 } from '../crypto/hash.js';
import { bytesEqual } from '../crypto/encoding.js';

/** Concatenate two 32-byte nodes and hash them into the parent node. */
async function hashPair(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return sha256(combined);
}

/**
 * Compute the Merkle root from ordered leaf hashes.
 * An empty input yields a 32-byte zero root (defined, deterministic).
 */
export async function computeMerkleRoot(leaves: Uint8Array[]): Promise<Uint8Array> {
  if (leaves.length === 0) return new Uint8Array(32);

  let level = leaves;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // duplicate last if odd
      next.push(await hashPair(left, right));
    }
    level = next;
  }
  return level[0]!;
}

/** Verify a set of leaf hashes reproduces the expected root. */
export async function verifyMerkleRoot(
  leaves: Uint8Array[],
  expectedRoot: Uint8Array,
): Promise<boolean> {
  const root = await computeMerkleRoot(leaves);
  return bytesEqual(root, expectedRoot);
}
