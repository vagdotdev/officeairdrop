import { describe, it, expect } from 'vitest';
import { FileChunker } from './chunker.js';
import { CHUNK_SIZE } from '@beam/shared';

/** Build a File of `size` bytes with deterministic content. */
function makeFile(name: string, size: number): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = i % 256;
  return new File([bytes], name, { type: 'application/octet-stream' });
}

describe('FileChunker', () => {
  it('lays out multiple files in a global chunk index space', () => {
    const a = makeFile('a.bin', CHUNK_SIZE + 10); // 2 chunks
    const b = makeFile('b.bin', 5); // 1 chunk
    const chunker = new FileChunker([a, b]);

    expect(chunker.totalChunks).toBe(3);
    expect(chunker.totalBytes).toBe(CHUNK_SIZE + 15);

    // chunk 0,1 -> file 0; chunk 2 -> file 1
    expect(chunker.chunkTarget(0).fileIndex).toBe(0);
    expect(chunker.chunkTarget(1).fileIndex).toBe(0);
    expect(chunker.chunkTarget(2).fileIndex).toBe(1);
    expect(chunker.chunkTarget(2).byteStart).toBe(0);
  });

  it('reads exact chunk bytes without overlap', async () => {
    const file = makeFile('a.bin', CHUNK_SIZE + 7);
    const chunker = new FileChunker([file]);

    const first = await chunker.readChunk(0);
    const second = await chunker.readChunk(1);
    expect(first.length).toBe(CHUNK_SIZE);
    expect(second.length).toBe(7);
    expect(chunker.chunkLength(1)).toBe(7);

    // second chunk continues the deterministic pattern
    expect(second[0]).toBe(CHUNK_SIZE % 256);
  });

  it('gives a zero-byte file exactly one empty chunk', () => {
    const chunker = new FileChunker([makeFile('empty.bin', 0)]);
    expect(chunker.totalChunks).toBe(1);
    expect(chunker.chunkLength(0)).toBe(0);
  });
});
