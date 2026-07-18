import { describe, it, expect } from 'vitest';
import { frameChunk, ChunkReassembler } from './framing.js';

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = i % 256;
  return b;
}

describe('wire framing', () => {
  it('splits a large chunk into frames and reassembles it exactly', () => {
    const original = randomBytes(40 * 1024 + 123); // spans several 16KB frames
    const frames = frameChunk(7, original);
    expect(frames.length).toBeGreaterThan(1);

    const reassembler = new ChunkReassembler();
    let result: { chunkIndex: number; ciphertext: Uint8Array } | null = null;
    for (const frame of frames) {
      result = reassembler.push(frame) ?? result;
    }

    expect(result).not.toBeNull();
    expect(result!.chunkIndex).toBe(7);
    expect(Array.from(result!.ciphertext)).toEqual(Array.from(original));
  });

  it('handles a single-frame chunk', () => {
    const original = randomBytes(100);
    const [frame] = frameChunk(0, original);
    const reassembler = new ChunkReassembler();
    const result = reassembler.push(frame!);
    expect(result).not.toBeNull();
    expect(Array.from(result!.ciphertext)).toEqual(Array.from(original));
  });

  it('interleaves frames from two chunks correctly', () => {
    const a = randomBytes(20 * 1024);
    const b = randomBytes(20 * 1024);
    const fa = frameChunk(1, a);
    const fb = frameChunk(2, b);
    const reassembler = new ChunkReassembler();

    // interleave
    const results: Record<number, Uint8Array> = {};
    const max = Math.max(fa.length, fb.length);
    for (let i = 0; i < max; i++) {
      if (fa[i]) {
        const r = reassembler.push(fa[i]!);
        if (r) results[r.chunkIndex] = r.ciphertext;
      }
      if (fb[i]) {
        const r = reassembler.push(fb[i]!);
        if (r) results[r.chunkIndex] = r.ciphertext;
      }
    }

    expect(Array.from(results[1]!)).toEqual(Array.from(a));
    expect(Array.from(results[2]!)).toEqual(Array.from(b));
  });
});
