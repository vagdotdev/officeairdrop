import { describe, it, expect, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import type { AddressInfo } from 'node:net';
import { buildApp, type BuiltApp } from '../app.js';
import type { ServerToClientMessage } from '@beam/shared';

/**
 * Full signaling handshake over real WebSockets against the Fastify app,
 * backed by an in-memory Redis mock. Verifies room creation, presence
 * broadcast, and blind signal relay between two peers — the entire job of the
 * signaling server, without needing a live Redis.
 *
 * Uses Node's built-in global WebSocket client (Node 22+).
 */

let built: BuiltApp | null = null;

afterEach(async () => {
  await built?.app.close();
  await built?.close();
  built = null;
});

/** Resolve the next message from a socket as a parsed server message. */
function nextMessage(ws: WebSocket): Promise<ServerToClientMessage> {
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      ws.removeEventListener('message', onMsg);
      resolve(JSON.parse(e.data as string) as ServerToClientMessage);
    };
    ws.addEventListener('message', onMsg);
    ws.addEventListener('error', () => reject(new Error('ws error')), { once: true });
  });
}

function open(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', () => reject(new Error('open failed')), { once: true });
  });
}

describe('signaling handshake (integration)', () => {
  it('relays presence and signals between two peers', async () => {
    const redis = new RedisMock() as unknown as Redis;
    built = await buildApp({ redis });
    await built.app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = built.app.server.address() as AddressInfo;
    const url = `ws://127.0.0.1:${port}/ws`;

    // Sender creates a room.
    const sender = new WebSocket(url);
    await open(sender);
    sender.send(JSON.stringify({ type: 'create-room' }));
    const created = await nextMessage(sender);
    expect(created.type).toBe('room-created');
    if (created.type !== 'room-created') return;
    const roomId = created.roomId;
    expect(created.role).toBe('sender');

    // Receiver joins; sender should be told a peer joined.
    const receiver = new WebSocket(url);
    await open(receiver);
    const senderPeerJoined = nextMessage(sender);
    receiver.send(JSON.stringify({ type: 'join-room', roomId }));

    const joined = await nextMessage(receiver);
    expect(joined.type).toBe('room-joined');
    const presence = await senderPeerJoined;
    expect(presence.type).toBe('peer-joined');

    // Sender relays an SDP offer; receiver should get it verbatim.
    const receiverGetsSignal = nextMessage(receiver);
    sender.send(
      JSON.stringify({
        type: 'signal',
        roomId,
        data: { kind: 'sdp', description: { type: 'offer', sdp: 'v=0...' } },
      }),
    );
    const relayed = await receiverGetsSignal;
    expect(relayed.type).toBe('signal');
    if (relayed.type === 'signal' && relayed.data.kind === 'sdp') {
      expect(relayed.data.description.sdp).toBe('v=0...');
    }

    // Receiver leaves; sender should be notified.
    const senderPeerLeft = nextMessage(sender);
    receiver.close();
    const left = await senderPeerLeft;
    expect(left.type).toBe('peer-left');

    sender.close();
  });
});
