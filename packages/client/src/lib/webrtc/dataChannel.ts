/**
 * A thin wrapper around RTCDataChannel that the transfer layer talks to.
 *
 * It adds the two things the raw channel lacks for high-throughput file
 * transfer:
 *
 *   1. A typed message surface (string control messages vs binary frames).
 *   2. Backpressure: `whenWritable()` resolves once the channel's outgoing
 *      buffer has drained below the low-water mark, so the sender can pace
 *      itself instead of queueing gigabytes in memory and stalling SCTP.
 *
 * The wrapper is transport-only — it has no notion of chunks, encryption, or
 * files. The transfer layer composes those concepts on top.
 */
import { BUFFERED_AMOUNT_LOW_THRESHOLD } from '@beam/shared';
import type { Transport, ChannelData } from './transport.js';

export type ChannelMessage = ChannelData;

export class DataChannelTransport implements Transport {
  constructor(private readonly channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;
  }

  get readyState(): RTCDataChannelState {
    return this.channel.readyState;
  }

  get bufferedAmount(): number {
    return this.channel.bufferedAmount;
  }

  onMessage(handler: (data: ChannelMessage) => void): void {
    this.channel.onmessage = (event) => handler(event.data as ChannelMessage);
  }

  onClose(handler: () => void): void {
    this.channel.onclose = () => handler();
  }

  send(data: string | ArrayBufferView | ArrayBuffer): void {
    // Overloads of RTCDataChannel.send accept all of these; cast to satisfy TS.
    this.channel.send(data as ArrayBuffer);
  }

  /**
   * Resolve once the channel can accept more data (buffer drained below the
   * low-water mark). If we're already below it, resolve immediately.
   *
   * Important: `bufferedamountlow` can fire between the threshold check and
   * `addEventListener`, which used to leave senders hung forever mid-transfer
   * (often around tens of MB in). Re-check after subscribe + poll as a safety net.
   */
  whenWritable(): Promise<void> {
    if (this.isWritable()) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.channel.removeEventListener('bufferedamountlow', onLow);
        window.clearInterval(poll);
        resolve();
      };

      const onLow = () => {
        if (this.isWritable()) finish();
      };

      this.channel.addEventListener('bufferedamountlow', onLow);

      // Race fix: buffer may have already drained before the listener attached.
      if (this.isWritable()) {
        finish();
        return;
      }

      // Safety net — some browsers are flaky about bufferedamountlow under load.
      const poll = window.setInterval(() => {
        if (this.channel.readyState !== 'open' || this.isWritable()) finish();
      }, 50);
    });
  }

  private isWritable(): boolean {
    return (
      this.channel.readyState !== 'open' ||
      this.channel.bufferedAmount <= this.channel.bufferedAmountLowThreshold
    );
  }
}
