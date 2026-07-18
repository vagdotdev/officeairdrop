/**
 * The narrow transport contract the transfer layer depends on.
 *
 * DataChannelTransport (the real WebRTC implementation) satisfies this, but so
 * can an in-memory paired transport in tests — which lets the entire transfer
 * protocol (encrypt → frame → send → reassemble → verify → decrypt → assemble,
 * plus resume) be exercised without a browser or a real peer connection.
 */
export type ChannelData = string | ArrayBuffer;

export interface Transport {
  readonly readyState: RTCDataChannelState;
  onMessage(handler: (data: ChannelData) => void): void;
  send(data: string | ArrayBufferView | ArrayBuffer): void;
  /** Resolves when the channel can accept more data (backpressure). */
  whenWritable(): Promise<void>;
}
