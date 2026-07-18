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
   */
  whenWritable(): Promise<void> {
    if (this.channel.bufferedAmount <= this.channel.bufferedAmountLowThreshold) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const handler = () => {
        this.channel.removeEventListener('bufferedamountlow', handler);
        resolve();
      };
      this.channel.addEventListener('bufferedamountlow', handler);
    });
  }
}
