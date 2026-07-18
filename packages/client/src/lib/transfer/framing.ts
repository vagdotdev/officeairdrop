/**
 * Wire framing: splitting an encrypted chunk into DataChannel-sized frames and
 * reassembling them on the other side.
 *
 * A single 4 MB encrypted chunk is too large for one SCTP message, so it is
 * sent as a sequence of 16 KB frames. Each frame carries a fixed 16-byte
 * binary header (see FRAME_HEADER in @beam/shared) identifying which chunk and
 * which frame it is, plus how many frames the chunk has. The receiver buffers
 * frames per chunk until all are present, then hands the reassembled
 * ciphertext to the verify/decrypt step.
 */
import { WIRE_FRAME_SIZE, FRAME_HEADER, type FrameHeader } from '@beam/shared';

/** Split one chunk's ciphertext into framed ArrayBuffers ready to send. */
export function frameChunk(chunkIndex: number, ciphertext: Uint8Array): ArrayBuffer[] {
  const frameCount = Math.max(1, Math.ceil(ciphertext.length / WIRE_FRAME_SIZE));
  const frames: ArrayBuffer[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const start = frameIndex * WIRE_FRAME_SIZE;
    const end = Math.min(start + WIRE_FRAME_SIZE, ciphertext.length);
    const payload = ciphertext.subarray(start, end);

    const buffer = new ArrayBuffer(FRAME_HEADER.BYTES + payload.length);
    const view = new DataView(buffer);
    view.setUint32(FRAME_HEADER.OFFSET_CHUNK_INDEX, chunkIndex, false);
    view.setUint32(FRAME_HEADER.OFFSET_FRAME_INDEX, frameIndex, false);
    view.setUint32(FRAME_HEADER.OFFSET_FRAME_COUNT, frameCount, false);
    view.setUint32(FRAME_HEADER.OFFSET_PAYLOAD_LEN, payload.length, false);
    new Uint8Array(buffer, FRAME_HEADER.BYTES).set(payload);

    frames.push(buffer);
  }
  return frames;
}

/** Parse a frame's header and return the header + its payload view. */
export function parseFrame(buffer: ArrayBuffer): { header: FrameHeader; payload: Uint8Array } {
  const view = new DataView(buffer);
  const header: FrameHeader = {
    chunkIndex: view.getUint32(FRAME_HEADER.OFFSET_CHUNK_INDEX, false),
    frameIndex: view.getUint32(FRAME_HEADER.OFFSET_FRAME_INDEX, false),
    frameCount: view.getUint32(FRAME_HEADER.OFFSET_FRAME_COUNT, false),
    payloadLen: view.getUint32(FRAME_HEADER.OFFSET_PAYLOAD_LEN, false),
  };
  const payload = new Uint8Array(buffer, FRAME_HEADER.BYTES, header.payloadLen);
  return { header, payload };
}

/**
 * Reassembles frames into complete chunk ciphertexts.
 *
 * Frames are guaranteed ordered+reliable by the DataChannel, but we key by
 * (chunkIndex, frameIndex) defensively so the logic is correct regardless.
 * `push` returns the reassembled ciphertext once a chunk's final frame lands.
 */
export class ChunkReassembler {
  private readonly pending = new Map<
    number,
    { frames: (Uint8Array | undefined)[]; received: number; frameCount: number; totalLen: number }
  >();

  push(buffer: ArrayBuffer): { chunkIndex: number; ciphertext: Uint8Array } | null {
    const { header, payload } = parseFrame(buffer);
    let entry = this.pending.get(header.chunkIndex);
    if (!entry) {
      entry = {
        frames: new Array(header.frameCount),
        received: 0,
        frameCount: header.frameCount,
        totalLen: 0,
      };
      this.pending.set(header.chunkIndex, entry);
    }

    if (entry.frames[header.frameIndex] === undefined) {
      // Copy out of the (transient) channel buffer into our own storage.
      entry.frames[header.frameIndex] = payload.slice();
      entry.received += 1;
      entry.totalLen += payload.length;
    }

    if (entry.received < entry.frameCount) return null;

    // All frames present — concatenate into the full ciphertext.
    const ciphertext = new Uint8Array(entry.totalLen);
    let offset = 0;
    for (const frame of entry.frames) {
      ciphertext.set(frame!, offset);
      offset += frame!.length;
    }
    this.pending.delete(header.chunkIndex);
    return { chunkIndex: header.chunkIndex, ciphertext };
  }
}
