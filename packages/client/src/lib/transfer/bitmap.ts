/**
 * Pure helpers for resume bookkeeping. Kept dependency-free (no IndexedDB) so
 * the core resume logic is trivially unit-testable.
 */

/**
 * Given the total chunk count and the set of chunk indices already received,
 * return the ascending list of indices still missing. This is exactly what the
 * receiver sends in a `resume-request` after a reconnect so the sender
 * retransmits *only* the gaps — never the whole transfer.
 */
export function computeMissingChunks(
  totalChunks: number,
  received: ReadonlySet<number>,
): number[] {
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!received.has(i)) missing.push(i);
  }
  return missing;
}

/** True when every chunk index in [0, totalChunks) has been received. */
export function isComplete(totalChunks: number, received: ReadonlySet<number>): boolean {
  if (received.size < totalChunks) return false;
  for (let i = 0; i < totalChunks; i++) {
    if (!received.has(i)) return false;
  }
  return true;
}
