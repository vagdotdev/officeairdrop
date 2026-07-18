/**
 * Maps the global chunk index space back onto files, derived purely from the
 * manifest. The sender computes this from the actual File objects (FileChunker);
 * the receiver — which has no File objects, only the manifest — uses this to
 * know which output file and byte offset each incoming chunk belongs to. Both
 * sides must agree exactly, so the layout rule lives here, once.
 */
import { CHUNK_SIZE, type FileDescriptor } from '@beam/shared';

export interface ChunkTarget {
  fileIndex: number;
  byteStart: number;
  /** Expected plaintext length of this chunk. */
  length: number;
}

export class TransferLayout {
  private readonly offsets: number[] = []; // global chunk start per file

  constructor(
    private readonly files: FileDescriptor[],
    private readonly chunkSize: number = CHUNK_SIZE,
  ) {
    let acc = 0;
    for (const f of files) {
      this.offsets.push(acc);
      acc += f.chunkCount;
    }
  }

  /** Resolve a global chunk index to its file + byte offset + length. */
  target(globalIndex: number): ChunkTarget {
    let fileIndex = 0;
    while (
      fileIndex + 1 < this.offsets.length &&
      this.offsets[fileIndex + 1]! <= globalIndex
    ) {
      fileIndex += 1;
    }
    const localChunk = globalIndex - this.offsets[fileIndex]!;
    const file = this.files[fileIndex]!;
    const byteStart = localChunk * this.chunkSize;
    const byteEnd = Math.min(byteStart + this.chunkSize, file.size);
    return { fileIndex, byteStart, length: byteEnd - byteStart };
  }
}
