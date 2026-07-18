import { describe, it, expect, vi } from 'vitest';
import { DataChannelTransport } from './dataChannel.js';

/** Minimal RTCDataChannel stand-in for backpressure tests. */
function mockChannel(initialBuffered = 0) {
  const listeners = new Map<string, Set<() => void>>();
  const channel = {
    binaryType: 'arraybuffer' as BinaryType,
    readyState: 'open' as RTCDataChannelState,
    bufferedAmount: initialBuffered,
    bufferedAmountLowThreshold: 512 * 1024,
    send: vi.fn(),
    addEventListener: (type: string, handler: () => void) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(handler);
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners.get(type)?.delete(handler);
    },
    emit(type: string) {
      for (const h of listeners.get(type) ?? []) h();
    },
  };
  return channel;
}

describe('DataChannelTransport.whenWritable', () => {
  it('resolves immediately when buffer is already low', async () => {
    const ch = mockChannel(0);
    const t = new DataChannelTransport(ch as unknown as RTCDataChannel);
    await expect(t.whenWritable()).resolves.toBeUndefined();
  });

  it('does not deadlock if buffer drains before the listener attaches', async () => {
    const ch = mockChannel(2 * 1024 * 1024);
    const t = new DataChannelTransport(ch as unknown as RTCDataChannel);

    // Simulate the race: as soon as someone listens, the buffer has already drained.
    const originalAdd = ch.addEventListener.bind(ch);
    ch.addEventListener = (type: string, handler: () => void) => {
      originalAdd(type, handler);
      ch.bufferedAmount = 0;
      // Deliberately do NOT emit bufferedamountlow — the old code would hang.
    };

    await expect(t.whenWritable()).resolves.toBeUndefined();
  });

  it('resolves via poll if bufferedamountlow never fires', async () => {
    vi.useFakeTimers();
    const ch = mockChannel(2 * 1024 * 1024);
    const t = new DataChannelTransport(ch as unknown as RTCDataChannel);
    const pending = t.whenWritable();

    // Drain without emitting the event — poll safety net must unblock us.
    ch.bufferedAmount = 0;
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
