/**
 * Signaling hub — WebSocket broker for office lobby presence + WebRTC rooms.
 *
 * Responsibilities:
 *   • lobby join/leave + presence fan-out
 *   • mint/join 1:1 transfer rooms
 *   • route transfer offers/responses peer-to-peer
 *   • relay opaque SDP/ICE payloads within a room
 *
 * Never touches file bytes. Horizontal scale via Redis pub/sub.
 */
import type { WebSocket } from 'ws';
import type { Redis } from 'ioredis';
import { customAlphabet } from 'nanoid';
import type {
  ClientToServerMessage,
  LobbyPeer,
  OfferFileMeta,
  ServerToClientMessage,
  SignalingErrorCode,
  SignalPayload,
} from '@beam/shared';
import { RoomStore } from '../rooms/roomStore.js';

const makeRoomId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10);
const makePeerId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const makeOfferId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

const RELAY_CHANNEL_PREFIX = 'drop:relay:';
const LOBBY_CHANNEL = 'drop:lobby';
const PEER_CHANNEL_PREFIX = 'drop:peer:';
const LOBBY_SET_KEY = 'drop:lobby:peers';
const peerKey = (peerId: string) => `drop:lobby:peer:${peerId}`;

interface RelayEnvelope {
  exclude?: string;
  message: ServerToClientMessage;
}

interface PeerTargetEnvelope {
  toPeerId: string;
  message: ServerToClientMessage;
}

interface PeerConnection {
  peerId: string;
  socket: WebSocket;
  roomId: string | null;
  inLobby: boolean;
  profile: LobbyPeer | null;
  windowStart: number;
  msgCount: number;
}

const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 300;
const MAX_NAME = 40;
const MAX_DEVICE = 60;
const MAX_OFFER_FILES = 50;

function clampText(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

function accentFromId(peerId: string): number {
  let h = 0;
  for (let i = 0; i < peerId.length; i++) h = (h * 31 + peerId.charCodeAt(i)) >>> 0;
  return h % 8;
}

export class SignalingHub {
  private readonly rooms: RoomStore;
  private readonly subscriber: Redis;
  private readonly localRooms = new Map<string, Map<string, WebSocket>>();
  private readonly localPeers = new Map<string, PeerConnection>();

  constructor(
    private readonly publisher: Redis,
    private readonly ttlSeconds: number,
    private readonly log: { error: (msg: unknown, ...args: unknown[]) => void },
  ) {
    this.rooms = new RoomStore(publisher, ttlSeconds);
    this.subscriber = publisher.duplicate();
    this.subscriber.on('message', (channel: string, payload: string) =>
      this.onPubSubMessage(channel, payload),
    );
    void this.subscriber.subscribe(LOBBY_CHANNEL);
  }

  handleConnection(socket: WebSocket): void {
    const peer: PeerConnection = {
      peerId: makePeerId(),
      socket,
      roomId: null,
      inLobby: false,
      profile: null,
      windowStart: Date.now(),
      msgCount: 0,
    };

    this.localPeers.set(peer.peerId, peer);
    void this.subscriber.subscribe(PEER_CHANNEL_PREFIX + peer.peerId);

    socket.on('message', (raw: Buffer) => {
      void this.onClientMessage(peer, raw);
    });
    socket.on('close', () => {
      void this.onClose(peer);
    });
    socket.on('error', () => {
      void this.onClose(peer);
    });
  }

  private isRateLimited(peer: PeerConnection): boolean {
    const now = Date.now();
    if (now - peer.windowStart > RATE_WINDOW_MS) {
      peer.windowStart = now;
      peer.msgCount = 0;
    }
    peer.msgCount += 1;
    return peer.msgCount > RATE_MAX_MESSAGES;
  }

  private async onClientMessage(peer: PeerConnection, raw: Buffer): Promise<void> {
    if (this.isRateLimited(peer)) {
      this.sendError(peer, 'internal-error', 'Rate limit exceeded.');
      peer.socket.close(1008, 'rate limit');
      return;
    }

    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientToServerMessage;
    } catch {
      return this.sendError(peer, 'invalid-message', 'Malformed JSON.');
    }

    // Keep lobby presence alive while the tab stays connected.
    if (peer.inLobby && peer.profile) {
      void this.publisher.expire(peerKey(peer.peerId), this.ttlSeconds);
    }

    try {
      switch (msg.type) {
        case 'lobby-join':
          return await this.onLobbyJoin(peer, msg.displayName, msg.deviceLabel);
        case 'lobby-update':
          return await this.onLobbyUpdate(peer, msg.displayName, msg.deviceLabel);
        case 'create-room':
          return await this.onCreateRoom(peer);
        case 'join-room':
          return await this.onJoinRoom(peer, msg.roomId);
        case 'signal':
          return await this.onSignal(peer, msg.roomId, msg.data);
        case 'transfer-offer':
          return await this.onTransferOffer(peer, msg);
        case 'transfer-response':
          return await this.onTransferResponse(
            peer,
            msg.offerId,
            msg.toPeerId,
            msg.accept,
          );
        default:
          return this.sendError(peer, 'invalid-message', 'Unknown message type.');
      }
    } catch (err) {
      this.log.error(err, 'signaling handler failed');
      return this.sendError(peer, 'internal-error', 'Server error.');
    }
  }

  private async onLobbyJoin(
    peer: PeerConnection,
    displayName: string,
    deviceLabel: string,
  ): Promise<void> {
    const profile: LobbyPeer = {
      peerId: peer.peerId,
      displayName: clampText(displayName, MAX_NAME, 'Guest'),
      deviceLabel: clampText(deviceLabel, MAX_DEVICE, 'Device'),
      accent: accentFromId(peer.peerId),
      joinedAt: Date.now(),
    };
    peer.profile = profile;
    peer.inLobby = true;

    await this.publisher.set(
      peerKey(peer.peerId),
      JSON.stringify(profile),
      'EX',
      this.ttlSeconds,
    );
    await this.publisher.sadd(LOBBY_SET_KEY, peer.peerId);

    const peers = await this.listLobbyPeers(peer.peerId);
    this.send(peer.socket, { type: 'lobby-welcome', self: profile, peers });

    await this.broadcastLobby({
      exclude: peer.peerId,
      message: { type: 'peer-online', peer: profile },
    });
  }

  private async onLobbyUpdate(
    peer: PeerConnection,
    displayName?: string,
    deviceLabel?: string,
  ): Promise<void> {
    if (!peer.inLobby || !peer.profile) {
      return this.sendError(peer, 'not-in-lobby', 'Join the lobby first.');
    }
    if (displayName !== undefined) {
      peer.profile.displayName = clampText(displayName, MAX_NAME, peer.profile.displayName);
    }
    if (deviceLabel !== undefined) {
      peer.profile.deviceLabel = clampText(deviceLabel, MAX_DEVICE, peer.profile.deviceLabel);
    }
    await this.publisher.set(
      peerKey(peer.peerId),
      JSON.stringify(peer.profile),
      'EX',
      this.ttlSeconds,
    );
    await this.broadcastLobby({
      message: { type: 'peer-updated', peer: peer.profile },
    });
  }

  /** Public snapshot for the pre-join “who’s already here” atmosphere. */
  async getLobbySnapshot(): Promise<LobbyPeer[]> {
    return this.listLobbyPeers('');
  }

  private async listLobbyPeers(excludePeerId: string): Promise<LobbyPeer[]> {
    const ids = await this.publisher.smembers(LOBBY_SET_KEY);
    const peers: LobbyPeer[] = [];
    for (const id of ids) {
      if (excludePeerId && id === excludePeerId) continue;
      const raw = await this.publisher.get(peerKey(id));
      if (!raw) {
        await this.publisher.srem(LOBBY_SET_KEY, id);
        continue;
      }
      try {
        peers.push(JSON.parse(raw) as LobbyPeer);
      } catch {
        await this.publisher.srem(LOBBY_SET_KEY, id);
      }
    }
    peers.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return peers;
  }

  private async onCreateRoom(peer: PeerConnection): Promise<void> {
    if (peer.roomId) {
      this.detachLocal(peer.roomId, peer);
      await this.rooms.removeMember(peer.roomId, peer.peerId);
      peer.roomId = null;
    }
    const roomId = makeRoomId();
    await this.rooms.createRoom(roomId, peer.peerId);
    this.attachLocal(roomId, peer);
    this.send(peer.socket, { type: 'room-created', roomId, role: 'sender' });
  }

  private async onJoinRoom(peer: PeerConnection, roomId: string): Promise<void> {
    if (peer.roomId && peer.roomId !== roomId) {
      this.detachLocal(peer.roomId, peer);
      const remaining = await this.rooms.removeMember(peer.roomId, peer.peerId);
      if (remaining.length > 0) {
        await this.relay(peer.roomId, {
          exclude: peer.peerId,
          message: { type: 'peer-left', roomId: peer.roomId },
        });
      }
      peer.roomId = null;
    }

    const result = await this.rooms.addMember(roomId, peer.peerId);
    if (!result.ok) {
      const code: SignalingErrorCode =
        result.reason === 'room-full' ? 'room-full' : 'room-not-found';
      return this.sendError(peer, code, `Cannot join room: ${result.reason}.`);
    }

    this.attachLocal(roomId, peer);
    this.send(peer.socket, { type: 'room-joined', roomId, role: 'receiver' });
    await this.relay(roomId, {
      exclude: peer.peerId,
      message: { type: 'peer-joined', roomId },
    });
  }

  private async onSignal(
    peer: PeerConnection,
    roomId: string,
    data: SignalPayload,
  ): Promise<void> {
    if (peer.roomId !== roomId) {
      return this.sendError(peer, 'not-in-room', 'You are not in that room.');
    }
    await this.rooms.touch(roomId);
    await this.relay(roomId, {
      exclude: peer.peerId,
      message: { type: 'signal', roomId, data },
    });
  }

  private async onTransferOffer(
    peer: PeerConnection,
    msg: {
      toPeerId: string;
      roomId: string;
      keyFragment: string;
      files: OfferFileMeta[];
    },
  ): Promise<void> {
    if (!peer.inLobby || !peer.profile) {
      return this.sendError(peer, 'not-in-lobby', 'Join the lobby first.');
    }
    if (peer.roomId !== msg.roomId) {
      return this.sendError(peer, 'not-in-room', 'Create the transfer room first.');
    }
    if (typeof msg.toPeerId !== 'string' || !msg.toPeerId) {
      return this.sendError(peer, 'invalid-message', 'Missing recipient.');
    }
    if (msg.toPeerId === peer.peerId) {
      return this.sendError(peer, 'invalid-message', 'Cannot send to yourself.');
    }
    if (typeof msg.keyFragment !== 'string' || msg.keyFragment.length < 16) {
      return this.sendError(peer, 'invalid-message', 'Invalid session key.');
    }
    if (!Array.isArray(msg.files) || msg.files.length === 0 || msg.files.length > MAX_OFFER_FILES) {
      return this.sendError(peer, 'invalid-message', 'Invalid file list.');
    }

    const targetRaw = await this.publisher.get(peerKey(msg.toPeerId));
    if (!targetRaw) {
      return this.sendError(peer, 'peer-not-found', 'That person is no longer online.');
    }

    const files = msg.files.map((f) => ({
      name: clampText(f?.name, 180, 'file'),
      size: typeof f?.size === 'number' && f.size >= 0 ? f.size : 0,
      type: clampText(f?.type, 120, ''),
    }));

    const offerId = makeOfferId();

    await this.sendToPeer(msg.toPeerId, {
      type: 'transfer-offer',
      offerId,
      from: peer.profile,
      roomId: msg.roomId,
      keyFragment: msg.keyFragment,
      files,
    });
  }

  private async onTransferResponse(
    peer: PeerConnection,
    offerId: string,
    toPeerId: string,
    accept: boolean,
  ): Promise<void> {
    if (typeof offerId !== 'string' || !offerId) {
      return this.sendError(peer, 'invalid-message', 'Missing offer id.');
    }
    if (typeof toPeerId !== 'string' || !toPeerId) {
      return this.sendError(peer, 'invalid-message', 'Missing offer sender.');
    }

    await this.sendToPeer(toPeerId, {
      type: 'transfer-response',
      offerId,
      fromPeerId: peer.peerId,
      accept: Boolean(accept),
    });
  }

  private async onClose(peer: PeerConnection): Promise<void> {
    if (!this.localPeers.has(peer.peerId)) return;
    this.localPeers.delete(peer.peerId);
    void this.subscriber.unsubscribe(PEER_CHANNEL_PREFIX + peer.peerId);

    if (peer.inLobby) {
      peer.inLobby = false;
      await this.publisher.srem(LOBBY_SET_KEY, peer.peerId);
      await this.publisher.del(peerKey(peer.peerId));
      await this.broadcastLobby({
        exclude: peer.peerId,
        message: { type: 'peer-offline', peerId: peer.peerId },
      });
    }

    const roomId = peer.roomId;
    if (!roomId) return;

    this.detachLocal(roomId, peer);
    const remaining = await this.rooms.removeMember(roomId, peer.peerId);
    if (remaining.length > 0) {
      await this.relay(roomId, {
        exclude: peer.peerId,
        message: { type: 'peer-left', roomId },
      });
    }
  }

  private attachLocal(roomId: string, peer: PeerConnection): void {
    peer.roomId = roomId;
    let members = this.localRooms.get(roomId);
    if (!members) {
      members = new Map();
      this.localRooms.set(roomId, members);
      void this.subscriber.subscribe(RELAY_CHANNEL_PREFIX + roomId);
    }
    members.set(peer.peerId, peer.socket);
  }

  private detachLocal(roomId: string, peer: PeerConnection): void {
    const members = this.localRooms.get(roomId);
    if (!members) return;
    members.delete(peer.peerId);
    if (members.size === 0) {
      this.localRooms.delete(roomId);
      void this.subscriber.unsubscribe(RELAY_CHANNEL_PREFIX + roomId);
    }
  }

  private async relay(roomId: string, envelope: RelayEnvelope): Promise<void> {
    await this.publisher.publish(
      RELAY_CHANNEL_PREFIX + roomId,
      JSON.stringify(envelope),
    );
  }

  private async broadcastLobby(envelope: RelayEnvelope): Promise<void> {
    await this.publisher.publish(LOBBY_CHANNEL, JSON.stringify(envelope));
  }

  private async sendToPeer(
    toPeerId: string,
    message: ServerToClientMessage,
  ): Promise<void> {
    const local = this.localPeers.get(toPeerId);
    if (local) {
      this.send(local.socket, message);
      return;
    }
    const envelope: PeerTargetEnvelope = { toPeerId, message };
    await this.publisher.publish(
      PEER_CHANNEL_PREFIX + toPeerId,
      JSON.stringify(envelope),
    );
  }

  private onPubSubMessage(channel: string, payload: string): void {
    if (channel === LOBBY_CHANNEL) {
      let envelope: RelayEnvelope;
      try {
        envelope = JSON.parse(payload) as RelayEnvelope;
      } catch {
        return;
      }
      for (const peer of this.localPeers.values()) {
        if (!peer.inLobby) continue;
        if (envelope.exclude && peer.peerId === envelope.exclude) continue;
        this.send(peer.socket, envelope.message);
      }
      return;
    }

    if (channel.startsWith(PEER_CHANNEL_PREFIX)) {
      let envelope: PeerTargetEnvelope;
      try {
        envelope = JSON.parse(payload) as PeerTargetEnvelope;
      } catch {
        return;
      }
      const peer = this.localPeers.get(envelope.toPeerId);
      if (peer) this.send(peer.socket, envelope.message);
      return;
    }

    if (!channel.startsWith(RELAY_CHANNEL_PREFIX)) return;
    const roomId = channel.slice(RELAY_CHANNEL_PREFIX.length);
    const members = this.localRooms.get(roomId);
    if (!members) return;

    let envelope: RelayEnvelope;
    try {
      envelope = JSON.parse(payload) as RelayEnvelope;
    } catch {
      return;
    }

    for (const [peerId, socket] of members) {
      if (envelope.exclude && peerId === envelope.exclude) continue;
      this.send(socket, envelope.message);
    }
  }

  private send(socket: WebSocket, message: ServerToClientMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private sendError(
    peer: PeerConnection,
    code: SignalingErrorCode,
    message: string,
  ): void {
    this.send(peer.socket, { type: 'error', code, message });
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
  }
}
