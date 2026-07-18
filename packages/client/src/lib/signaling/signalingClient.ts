/**
 * Typed WebSocket signaling client for Drop.
 *
 * Handles lobby presence, transfer offers, room create/join, and SDP/ICE
 * relay — with automatic reconnect.
 */
import type {
  ClientToServerMessage,
  IncomingTransferOfferMessage,
  LobbyPeer,
  OfferFileMeta,
  PeerRole,
  ServerToClientMessage,
  SignalPayload,
} from '@beam/shared';
import { Emitter } from '../events.js';

type SignalingEvents = {
  open: void;
  close: void;
  reconnecting: { attempt: number };
  'lobby-welcome': { self: LobbyPeer; peers: LobbyPeer[] };
  'peer-online': { peer: LobbyPeer };
  'peer-offline': { peerId: string };
  'peer-updated': { peer: LobbyPeer };
  'peer-joined': { roomId: string };
  'peer-left': { roomId: string };
  signal: { roomId: string; data: SignalPayload };
  'transfer-offer': IncomingTransferOfferMessage;
  'transfer-response': {
    offerId: string;
    fromPeerId: string;
    accept: boolean;
  };
  error: { code: string; message: string };
};

export class SignalingClient {
  private ws: WebSocket | null = null;
  private readonly emitter = new Emitter<SignalingEvents>();
  private shouldReconnect = true;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lobbyCredentials: {
    displayName: string;
    deviceLabel: string;
  } | null = null;

  private pendingCreate: {
    resolve: (roomId: string) => void;
    reject: (err: Error) => void;
  } | null = null;
  private pendingJoin: {
    resolve: (roomId: string) => void;
    reject: (err: Error) => void;
  } | null = null;

  constructor(private readonly url: string) {}

  readonly on = this.emitter.on.bind(this.emitter);

  connect(): Promise<void> {
    this.shouldReconnect = true;
    return new Promise((resolve, reject) => {
      try {
        this.openSocket(resolve, reject);
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private openSocket(onOpen?: () => void, onError?: (e: Error) => void): void {
    const wsUrl = this.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emitter.emit('open', undefined);
      if (this.lobbyCredentials) {
        this.send({
          type: 'lobby-join',
          displayName: this.lobbyCredentials.displayName,
          deviceLabel: this.lobbyCredentials.deviceLabel,
        });
      }
      onOpen?.();
    };

    ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    ws.onerror = () => {
      onError?.(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      this.emitter.emit('close', undefined);
      if (this.shouldReconnect) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(10_000, 2 ** this.reconnectAttempt * 250);
    const jitter = Math.random() * 250;
    this.emitter.emit('reconnecting', { attempt: this.reconnectAttempt });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay + jitter);
  }

  private handleMessage(raw: string): void {
    let msg: ServerToClientMessage;
    try {
      msg = JSON.parse(raw) as ServerToClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'lobby-welcome':
        this.emitter.emit('lobby-welcome', { self: msg.self, peers: msg.peers });
        break;
      case 'peer-online':
        this.emitter.emit('peer-online', { peer: msg.peer });
        break;
      case 'peer-offline':
        this.emitter.emit('peer-offline', { peerId: msg.peerId });
        break;
      case 'peer-updated':
        this.emitter.emit('peer-updated', { peer: msg.peer });
        break;
      case 'room-created':
        this.pendingCreate?.resolve(msg.roomId);
        this.pendingCreate = null;
        break;
      case 'room-joined':
        this.pendingJoin?.resolve(msg.roomId);
        this.pendingJoin = null;
        break;
      case 'peer-joined':
        this.emitter.emit('peer-joined', { roomId: msg.roomId });
        break;
      case 'peer-left':
        this.emitter.emit('peer-left', { roomId: msg.roomId });
        break;
      case 'signal':
        this.emitter.emit('signal', { roomId: msg.roomId, data: msg.data });
        break;
      case 'transfer-offer':
        this.emitter.emit('transfer-offer', msg);
        break;
      case 'transfer-response':
        this.emitter.emit('transfer-response', {
          offerId: msg.offerId,
          fromPeerId: msg.fromPeerId,
          accept: msg.accept,
        });
        break;
      case 'error':
        if (this.pendingJoin) {
          this.pendingJoin.reject(new Error(msg.message));
          this.pendingJoin = null;
        }
        if (this.pendingCreate) {
          this.pendingCreate.reject(new Error(msg.message));
          this.pendingCreate = null;
        }
        this.emitter.emit('error', { code: msg.code, message: msg.message });
        break;
    }
  }

  private send(message: ClientToServerMessage): void {
    this.ws?.send(JSON.stringify(message));
  }

  /** Join (or re-join after reconnect) the office lobby. */
  joinLobby(displayName: string, deviceLabel: string): void {
    this.lobbyCredentials = { displayName, deviceLabel };
    if (this.connected) {
      this.send({ type: 'lobby-join', displayName, deviceLabel });
    }
  }

  updateLobby(displayName?: string, deviceLabel?: string): void {
    if (this.lobbyCredentials) {
      if (displayName) this.lobbyCredentials.displayName = displayName;
      if (deviceLabel) this.lobbyCredentials.deviceLabel = deviceLabel;
    }
    this.send({ type: 'lobby-update', displayName, deviceLabel });
  }

  createRoom(): Promise<{ roomId: string; role: PeerRole }> {
    return new Promise((resolve, reject) => {
      this.pendingCreate = {
        resolve: (roomId) => resolve({ roomId, role: 'sender' }),
        reject,
      };
      this.send({ type: 'create-room' });
    });
  }

  joinRoom(roomId: string): Promise<{ roomId: string; role: PeerRole }> {
    return new Promise((resolve, reject) => {
      this.pendingJoin = {
        resolve: (id) => resolve({ roomId: id, role: 'receiver' }),
        reject,
      };
      this.send({ type: 'join-room', roomId });
    });
  }

  sendSignal(roomId: string, data: SignalPayload): void {
    this.send({ type: 'signal', roomId, data });
  }

  sendTransferOffer(input: {
    toPeerId: string;
    roomId: string;
    keyFragment: string;
    files: OfferFileMeta[];
  }): void {
    this.send({ type: 'transfer-offer', ...input });
  }

  respondToOffer(offerId: string, toPeerId: string, accept: boolean): void {
    this.send({ type: 'transfer-response', offerId, toPeerId, accept });
  }

  /** Close permanently. Pass `{ keepLobby: true }` is unused — always full close. */
  close(): void {
    this.shouldReconnect = false;
    this.lobbyCredentials = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.emitter.clear();
  }
}
