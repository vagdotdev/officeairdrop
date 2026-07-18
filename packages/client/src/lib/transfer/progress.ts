/**
 * Throughput + ETA estimation.
 *
 * Uses a short sliding window of (timestamp, cumulativeBytes) samples to
 * compute a smoothed speed, which is far less jittery than instantaneous
 * per-chunk timing. ETA is derived from the windowed speed and remaining bytes.
 */
import type { TransferProgress } from './types.js';

interface Sample {
  t: number;
  bytes: number;
}

export class ProgressTracker {
  private readonly window: Sample[] = [];
  private bytesTransferred = 0;
  private chunksTransferred = 0;

  constructor(
    private readonly totalBytes: number,
    private readonly totalChunks: number,
    /** Sliding window duration in milliseconds. */
    private readonly windowMs = 3000,
  ) {}

  /** Record progress of one chunk of `byteLength` plaintext bytes. */
  recordChunk(byteLength: number): void {
    this.bytesTransferred += byteLength;
    this.chunksTransferred += 1;
    const now = Date.now();
    this.window.push({ t: now, bytes: this.bytesTransferred });
    // Drop samples older than the window.
    const cutoff = now - this.windowMs;
    while (this.window.length > 2 && this.window[0]!.t < cutoff) {
      this.window.shift();
    }
  }

  /** Pre-count already-received bytes/chunks (used when resuming). */
  seed(bytes: number, chunks: number): void {
    this.bytesTransferred = bytes;
    this.chunksTransferred = chunks;
  }

  private speedBps(): number {
    if (this.window.length < 2) return 0;
    const first = this.window[0]!;
    const last = this.window[this.window.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return (last.bytes - first.bytes) / dt;
  }

  snapshot(): TransferProgress {
    const speedBps = this.speedBps();
    const remaining = Math.max(0, this.totalBytes - this.bytesTransferred);
    const etaSeconds = speedBps > 0 ? remaining / speedBps : null;
    return {
      bytesTransferred: this.bytesTransferred,
      totalBytes: this.totalBytes,
      chunksTransferred: this.chunksTransferred,
      totalChunks: this.totalChunks,
      percent: this.totalBytes === 0 ? 1 : this.bytesTransferred / this.totalBytes,
      speedBps,
      etaSeconds,
    };
  }
}
