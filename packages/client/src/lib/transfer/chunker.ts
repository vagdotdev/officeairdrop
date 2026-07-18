/**
 * File chunking — the streaming source for the sender.
 *
 * Multiple selected files are laid out in a single *global chunk index space*:
 * file 0 occupies indices [0, n0), file 1 occupies [n0, n0+n1), and so on. A
 * chunk never spans two files, which keeps both encryption (per-chunk IV) and
 * receiver reassembly (per-file output) simple.
 *
 * Crucially, the file is **never** fully read into memory: each chunk is read
 * on demand via `Blob.slice().arrayBuffer()`, so peak memory is ~one chunk.
 */
import { CHUNK_SIZE, type FileDescriptor } from '@beam/shared';

interface ChunkLocation {
  fileIndex: number;
  /** Byte offset of the chunk within its file. */
  byteStart: number;
  byteEnd: number;
}

export class FileChunker {
  readonly totalChunks: number;
  readonly totalBytes: number;
  /** chunkCount per file, indexed by file order. */
  private readonly fileChunkCounts: number[];
  /** Cumulative starting global chunk index per file. */
  private readonly fileChunkOffsets: number[];

  constructor(private readonly files: File[]) {
    this.fileChunkCounts = files.map((f) => Math.max(1, Math.ceil(f.size / CHUNK_SIZE)));
    // A zero-byte file still has exactly one (empty) chunk so it transfers.
    this.fileChunkOffsets = [];
    let acc = 0;
    for (const count of this.fileChunkCounts) {
      this.fileChunkOffsets.push(acc);
      acc += count;
    }
    this.totalChunks = acc;
    this.totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  }

  /** Manifest descriptors for every file in selection order. */
  buildFileDescriptors(): FileDescriptor[] {
    return this.files.map((file, i) => ({
      id: String(i),
      name: file.name,
      size: file.size,
      type: file.type,
      chunkCount: this.fileChunkCounts[i]!,
    }));
  }

  /** Resolve a global chunk index to a file + byte range. */
  private locate(globalIndex: number): ChunkLocation {
    // Linear scan is fine — file counts are tiny.
    let fileIndex = 0;
    while (
      fileIndex + 1 < this.fileChunkOffsets.length &&
      this.fileChunkOffsets[fileIndex + 1]! <= globalIndex
    ) {
      fileIndex += 1;
    }
    const localChunk = globalIndex - this.fileChunkOffsets[fileIndex]!;
    const byteStart = localChunk * CHUNK_SIZE;
    const byteEnd = Math.min(byteStart + CHUNK_SIZE, this.files[fileIndex]!.size);
    return { fileIndex, byteStart, byteEnd };
  }

  /** Read a single chunk's plaintext bytes on demand (bounded memory). */
  async readChunk(globalIndex: number): Promise<Uint8Array> {
    const { fileIndex, byteStart, byteEnd } = this.locate(globalIndex);
    const slice = this.files[fileIndex]!.slice(byteStart, byteEnd);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  }

  /** Which file (and its plaintext byte offset) a global chunk writes to. */
  chunkTarget(globalIndex: number): { fileIndex: number; byteStart: number } {
    const { fileIndex, byteStart } = this.locate(globalIndex);
    return { fileIndex, byteStart };
  }

  /** Exact plaintext byte length of a given global chunk. */
  chunkLength(globalIndex: number): number {
    const { byteStart, byteEnd } = this.locate(globalIndex);
    return byteEnd - byteStart;
  }
}
