import { describe, it, expect } from 'vitest';
import { computeMissingChunks, isComplete } from './bitmap.js';

describe('resume bitmap', () => {
  it('returns all indices when nothing received', () => {
    expect(computeMissingChunks(4, new Set())).toEqual([0, 1, 2, 3]);
  });

  it('returns only the gaps after a partial transfer', () => {
    const received = new Set([0, 1, 3]); // dropped after chunk 3, missing 2 and 4..
    expect(computeMissingChunks(5, received)).toEqual([2, 4]);
  });

  it('returns empty when all received', () => {
    expect(computeMissingChunks(3, new Set([0, 1, 2]))).toEqual([]);
  });

  it('isComplete reflects full coverage only', () => {
    expect(isComplete(3, new Set([0, 1, 2]))).toBe(true);
    expect(isComplete(3, new Set([0, 2]))).toBe(false);
    expect(isComplete(3, new Set([0, 1, 2, 5]))).toBe(true); // superset still complete
  });
});
