import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { RoomStore } from './roomStore.js';

/**
 * Exercises the Redis-backed room lifecycle against an in-memory Redis mock:
 * creation, the two-peer cap, idempotent re-join, and cleanup on empty.
 */
describe('RoomStore', () => {
  let store: RoomStore;

  beforeEach(() => {
    const redis = new RedisMock() as unknown as Redis;
    store = new RoomStore(redis, 3600);
  });

  it('creates a room with its first member', async () => {
    await store.createRoom('room1', 'peerA');
    const room = await store.getRoom('room1');
    expect(room?.members).toEqual(['peerA']);
  });

  it('lets a second peer join', async () => {
    await store.createRoom('room1', 'peerA');
    const result = await store.addMember('room1', 'peerB');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.room.members).toEqual(['peerA', 'peerB']);
  });

  it('rejects a third peer (room is full at two)', async () => {
    await store.createRoom('room1', 'peerA');
    await store.addMember('room1', 'peerB');
    const result = await store.addMember('room1', 'peerC');
    expect(result).toEqual({ ok: false, reason: 'room-full' });
  });

  it('rejects joining a non-existent room', async () => {
    const result = await store.addMember('ghost', 'peerB');
    expect(result).toEqual({ ok: false, reason: 'room-not-found' });
  });

  it('treats re-join by the same peer as idempotent', async () => {
    await store.createRoom('room1', 'peerA');
    await store.addMember('room1', 'peerB');
    const again = await store.addMember('room1', 'peerB');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room.members).toEqual(['peerA', 'peerB']);
  });

  it('removes members and deletes the room when empty', async () => {
    await store.createRoom('room1', 'peerA');
    await store.addMember('room1', 'peerB');

    const remaining = await store.removeMember('room1', 'peerA');
    expect(remaining).toEqual(['peerB']);

    const afterLast = await store.removeMember('room1', 'peerB');
    expect(afterLast).toEqual([]);
    expect(await store.getRoom('room1')).toBeNull();
  });
});
