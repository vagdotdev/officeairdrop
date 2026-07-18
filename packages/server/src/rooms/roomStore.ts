/**
 * Redis-backed ephemeral room store.
 *
 * A "room" is just the rendezvous record for two peers performing a WebRTC
 * handshake. It holds membership and a creation timestamp — and absolutely no
 * file bytes or key material. Rooms auto-expire via a Redis TTL, so abandoned
 * rooms cost nothing.
 *
 * Membership is capped at two peers (a sender and a receiver). The store is
 * deliberately thin; cross-instance message relay is handled separately by the
 * pub/sub layer in `ws/signaling.ts`, which lets the server scale horizontally
 * while Redis remains the single source of truth for room lifecycle.
 */
import type { Redis } from 'ioredis';

const ROOM_PREFIX = 'beam:room:';
const MAX_MEMBERS = 2;

export interface RoomRecord {
  createdAt: number;
  members: string[];
}

export type JoinResult =
  | { ok: true; room: RoomRecord }
  | { ok: false; reason: 'room-not-found' | 'room-full' };

export class RoomStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  private key(roomId: string): string {
    return `${ROOM_PREFIX}${roomId}`;
  }

  /** Create a fresh room containing its first member (the sender). */
  async createRoom(roomId: string, peerId: string): Promise<RoomRecord> {
    const record: RoomRecord = { createdAt: Date.now(), members: [peerId] };
    await this.redis.set(
      this.key(roomId),
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
    );
    return record;
  }

  /** Fetch a room record, or null if it has expired / never existed. */
  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const raw = await this.redis.get(this.key(roomId));
    return raw ? (JSON.parse(raw) as RoomRecord) : null;
  }

  /**
   * Add a member to an existing room.
   *
   * Contention here is minimal (a room only ever has two peers), but we still
   * guard the read-modify-write against the room-full race with a WATCH/MULTI
   * optimistic transaction, retrying a few times before giving up.
   */
  async addMember(roomId: string, peerId: string): Promise<JoinResult> {
    const key = this.key(roomId);

    for (let attempt = 0; attempt < 5; attempt++) {
      await this.redis.watch(key);
      const raw = await this.redis.get(key);

      if (!raw) {
        await this.redis.unwatch();
        return { ok: false, reason: 'room-not-found' };
      }

      const record = JSON.parse(raw) as RoomRecord;

      // Idempotent re-join (e.g. reconnect with same peerId).
      if (record.members.includes(peerId)) {
        await this.redis.unwatch();
        return { ok: true, room: record };
      }

      if (record.members.length >= MAX_MEMBERS) {
        await this.redis.unwatch();
        return { ok: false, reason: 'room-full' };
      }

      record.members.push(peerId);

      const result = await this.redis
        .multi()
        .set(key, JSON.stringify(record), 'EX', this.ttlSeconds)
        .exec();

      // `exec()` returns null when the WATCHed key changed — retry.
      if (result !== null) {
        return { ok: true, room: record };
      }
    }

    return { ok: false, reason: 'room-full' };
  }

  /**
   * Remove a member. Returns the remaining members so the caller can notify
   * them of the departure. Deletes the room when it becomes empty.
   */
  async removeMember(roomId: string, peerId: string): Promise<string[]> {
    const key = this.key(roomId);
    const raw = await this.redis.get(key);
    if (!raw) return [];

    const record = JSON.parse(raw) as RoomRecord;
    record.members = record.members.filter((id) => id !== peerId);

    if (record.members.length === 0) {
      await this.redis.del(key);
    } else {
      await this.redis.set(key, JSON.stringify(record), 'EX', this.ttlSeconds);
    }
    return record.members;
  }

  /** Refresh a room's TTL on activity so live transfers don't expire. */
  async touch(roomId: string): Promise<void> {
    await this.redis.expire(this.key(roomId), this.ttlSeconds);
  }
}
