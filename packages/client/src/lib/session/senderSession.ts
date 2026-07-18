/**
 * SenderSession — sending-side controller.
 *
 * Supports:
 *   • classic share-link flow (owns its signaling socket)
 *   • office person-to-person flow (reuses a shared lobby signaling client)
 */
import {
  generateSessionKey,
  generateBaseNonce,
  exportKeyToFragment,
} from '../crypto/index.js';
import { SignalingClient } from '../signaling/signalingClient.js';
import { PeerConnection, fetchIceServers } from '../webrtc/index.js';
import { FileSender } from '../transfer/index.js';
import type { SenderState, TransferProgress } from '../transfer/index.js';
import { Emitter } from '../events.js';
import type { SessionDeps } from './deps.js';

export interface SenderRoomInfo {
  roomId: string;
  shareUrl: string;
  keyFragment: string;
}

export interface SendToPeerOptions {
  signaling: SignalingClient;
  toPeerId: string;
  /** When false, caller owns the signaling lifecycle. Default true for link flow. */
  ownsSignaling?: boolean;
}

const CONNECT_TIMEOUT_MS = 30_000;

type SenderSessionEvents = {
  state: SenderState;
  progress: TransferProgress;
  room: SenderRoomInfo;
  offered: { toPeerId: string };
  declined: void;
  error: string;
};

export class SenderSession {
  private readonly emitter = new Emitter<SenderSessionEvents>();
  private signaling: SignalingClient | null = null;
  private ownsSignaling = true;
  private sender: FileSender | null = null;
  private pc: PeerConnection | null = null;
  private iceServers: RTCIceServer[] = [];
  private roomId: string | null = null;
  private peerPresent = false;
  private unsubs: Array<() => void> = [];

  readonly on = this.emitter.on.bind(this.emitter);

  constructor(
    private readonly signalingUrl: string,
    private readonly appOrigin: string,
    private readonly deps: SessionDeps = {},
  ) {}

  /** Classic Beam flow: create room + share link. */
  async start(files: File[]): Promise<void> {
    await this.prepare(files);
    this.ownsSignaling = true;
    this.signaling = this.deps.createSignaling
      ? this.deps.createSignaling(this.signalingUrl)
      : new SignalingClient(this.signalingUrl);
    await this.signaling.connect();
    await this.createRoomAndWait();
  }

  /** Office Drop flow: offer files to a lobby peer over shared signaling. */
  async startToPeer(files: File[], options: SendToPeerOptions): Promise<void> {
    await this.prepare(files);
    this.ownsSignaling = options.ownsSignaling ?? false;
    this.signaling = options.signaling;

    const keyFragment = (await this.createRoomAndWait()).keyFragment;

    const unsubResponse = this.signaling.on('transfer-response', (msg) => {
      if (!msg.accept) {
        this.emitter.emit('declined', undefined);
        this.emitter.emit('state', 'error');
        this.emitter.emit('error', 'They declined the drop.');
      }
    });
    this.unsubs.push(unsubResponse);

    this.signaling.sendTransferOffer({
      toPeerId: options.toPeerId,
      roomId: this.roomId!,
      keyFragment,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type || '',
      })),
    });
    this.emitter.emit('offered', { toPeerId: options.toPeerId });
  }

  private async prepare(files: File[]): Promise<void> {
    const key = await generateSessionKey();
    const baseNonce = generateBaseNonce();
    this._keyFragment = await exportKeyToFragment(key);

    this.sender = new FileSender(files, key, baseNonce, {
      onState: (s) => this.emitter.emit('state', s),
      onProgress: (p) => this.emitter.emit('progress', p),
      onError: (m) => this.emitter.emit('error', m),
    });
    await this.sender.prepare();
    this.iceServers = await (this.deps.fetchIce ?? fetchIceServers)(this.signalingUrl);
  }

  private _keyFragment = '';

  private async createRoomAndWait(): Promise<SenderRoomInfo> {
    if (!this.signaling || !this.sender) throw new Error('Session not prepared');

    const { roomId } = await this.signaling.createRoom();
    this.roomId = roomId;

    const shareUrl = `${this.appOrigin}/r/${roomId}#${this._keyFragment}`;
    const info: SenderRoomInfo = {
      roomId,
      shareUrl,
      keyFragment: this._keyFragment,
    };
    this.emitter.emit('room', info);

    const unsubJoined = this.signaling.on('peer-joined', ({ roomId: id }) => {
      if (id !== this.roomId) return;
      this.peerPresent = true;
      void this.negotiate();
    });
    const unsubLeft = this.signaling.on('peer-left', ({ roomId: id }) => {
      if (id !== this.roomId) return;
      this.peerPresent = false;
      this.pc?.close();
      this.pc = null;
      this.emitter.emit('state', 'waiting');
    });
    this.unsubs.push(unsubJoined, unsubLeft);

    return info;
  }

  private async negotiate(): Promise<void> {
    if (!this.signaling || !this.sender || !this.roomId) return;

    this.pc?.close();
    const pc = this.deps.createPeer
      ? this.deps.createPeer('sender', this.roomId, this.signaling, this.iceServers)
      : new PeerConnection('sender', this.roomId, this.signaling, this.iceServers);
    this.pc = pc;

    const timeout = setTimeout(() => {
      if (this.pc === pc) {
        this.emitter.emit(
          'error',
          "Couldn't connect. Try the same Wi‑Fi, or ask them to accept again.",
        );
      }
    }, CONNECT_TIMEOUT_MS);

    pc.on('channel-open', (transport) => {
      clearTimeout(timeout);
      void this.sender!.run(transport);
    });

    const retry = () => {
      if (this.peerPresent && this.pc === pc) {
        setTimeout(() => {
          if (this.peerPresent && this.pc === pc) void this.negotiate();
        }, 800);
      }
    };
    pc.on('failed', retry);

    try {
      await pc.start();
    } catch (err) {
      this.emitter.emit('error', (err as Error).message);
    }
  }

  close(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.pc?.close();
    if (this.ownsSignaling) this.signaling?.close();
    this.signaling = null;
    this.emitter.clear();
  }
}
