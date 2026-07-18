/**
 * Signaling protocol — WebSocket messages between browsers and the Drop
 * signaling server.
 *
 * The server is a blind broker:
 *   • office lobby presence (who's online)
 *   • transfer offers (tap a person → accept/decline)
 *   • ephemeral 1:1 rooms + opaque SDP/ICE relay
 *
 * It never sees file bytes. For person-to-person drops, the session key rides
 * in the offer so the receiver can decrypt without a share link. Link-based
 * drops still keep the key in the URL fragment.
 */

/** Role a client plays in a transfer room. The sender is always the offerer. */
export type PeerRole = 'sender' | 'receiver';

/** A person visible in the office lobby. */
export interface LobbyPeer {
  peerId: string;
  displayName: string;
  /** Short device hint, e.g. "MacBook Pro" / "Windows". */
  deviceLabel: string;
  /** Stable color index for avatar gradients (0–7). */
  accent: number;
  joinedAt: number;
}

/** File metadata shown in an incoming offer (no bytes). */
export interface OfferFileMeta {
  name: string;
  size: number;
  type: string;
}

// ── Client → Server ───────────────────────────────────────────

export interface LobbyJoinMessage {
  type: 'lobby-join';
  displayName: string;
  deviceLabel: string;
}

export interface LobbyUpdateMessage {
  type: 'lobby-update';
  displayName?: string;
  deviceLabel?: string;
}

/** Sender asks the server to mint a fresh transfer room. */
export interface CreateRoomMessage {
  type: 'create-room';
}

/** Receiver joins an existing transfer room by id. */
export interface JoinRoomMessage {
  type: 'join-room';
  roomId: string;
}

/**
 * Opaque signaling payload to relay to the other peer in the room.
 * `data` is an SDP offer/answer or an ICE candidate — the server does not
 * parse it.
 */
export interface SignalMessage {
  type: 'signal';
  roomId: string;
  data: SignalPayload;
}

/** Ask another lobby peer to accept a drop into a prepared room. */
export interface TransferOfferMessage {
  type: 'transfer-offer';
  toPeerId: string;
  roomId: string;
  /** AES key as base64url fragment (same format as URL hash keys). */
  keyFragment: string;
  files: OfferFileMeta[];
}

/** Accept or decline an incoming transfer offer. */
export interface TransferResponseMessage {
  type: 'transfer-response';
  offerId: string;
  /** Original offerer — required so any server instance can route the reply. */
  toPeerId: string;
  accept: boolean;
}

export type ClientToServerMessage =
  | LobbyJoinMessage
  | LobbyUpdateMessage
  | CreateRoomMessage
  | JoinRoomMessage
  | SignalMessage
  | TransferOfferMessage
  | TransferResponseMessage;

// ── Server → Client ───────────────────────────────────────────

export interface LobbyWelcomeMessage {
  type: 'lobby-welcome';
  self: LobbyPeer;
  peers: LobbyPeer[];
}

export interface PeerOnlineMessage {
  type: 'peer-online';
  peer: LobbyPeer;
}

export interface PeerOfflineMessage {
  type: 'peer-offline';
  peerId: string;
}

export interface PeerUpdatedMessage {
  type: 'peer-updated';
  peer: LobbyPeer;
}

export interface RoomCreatedMessage {
  type: 'room-created';
  roomId: string;
  role: PeerRole; // 'sender'
}

export interface RoomJoinedMessage {
  type: 'room-joined';
  roomId: string;
  role: PeerRole; // 'receiver'
}

export interface PeerJoinedMessage {
  type: 'peer-joined';
  roomId: string;
}

export interface PeerLeftMessage {
  type: 'peer-left';
  roomId: string;
}

export interface RelayedSignalMessage {
  type: 'signal';
  roomId: string;
  data: SignalPayload;
}

export interface IncomingTransferOfferMessage {
  type: 'transfer-offer';
  offerId: string;
  from: LobbyPeer;
  roomId: string;
  keyFragment: string;
  files: OfferFileMeta[];
}

export interface TransferResponseResultMessage {
  type: 'transfer-response';
  offerId: string;
  fromPeerId: string;
  accept: boolean;
}

export interface ErrorMessage {
  type: 'error';
  code: SignalingErrorCode;
  message: string;
}

export type ServerToClientMessage =
  | LobbyWelcomeMessage
  | PeerOnlineMessage
  | PeerOfflineMessage
  | PeerUpdatedMessage
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | RelayedSignalMessage
  | IncomingTransferOfferMessage
  | TransferResponseResultMessage
  | ErrorMessage;

// ── Shared payloads ───────────────────────────────────────────

export type SignalPayload =
  | { kind: 'sdp'; description: RTCSessionDescriptionInitLike }
  | { kind: 'ice'; candidate: RTCIceCandidateInitLike | null };

export interface RTCSessionDescriptionInitLike {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInitLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type SignalingErrorCode =
  | 'room-not-found'
  | 'room-full'
  | 'invalid-message'
  | 'not-in-room'
  | 'not-in-lobby'
  | 'peer-not-found'
  | 'internal-error';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfigResponse {
  iceServers: IceServerConfig[];
}
