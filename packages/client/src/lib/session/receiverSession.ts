/**
 * ReceiverSession — receiving-side controller.
 *
 * Supports link-based joins and office accept-flow on a shared lobby socket.
 */
import { importKeyFromFragment } from '../crypto/index.js';
import { SignalingClient } from '../signaling/signalingClient.js';
import { PeerConnection, fetchIceServers } from '../webrtc/index.js';
import { FileReceiver } from '../transfer/index.js';
import type { SessionDeps } from './deps.js';
import type {
  ReceiverState,
  TransferProgress,
  CompletedFile,
} from '../transfer/index.js';
import { Emitter } from '../events.js';

type ReceiverSessionEvents = {
  state: ReceiverState;
  progress: TransferProgress;
  complete: CompletedFile[];
  error: string;
};

const CONNECT_TIMEOUT_MS = 30_000;

export interface ReceiveOptions {
  signaling?: SignalingClient;
  ownsSignaling?: boolean;
}

export class ReceiverSession {
  private readonly emitter = new Emitter<ReceiverSessionEvents>();
  private signaling: SignalingClient | null = null;
  private ownsSignaling = true;
  private receiver: FileReceiver | null = null;
  private pc: PeerConnection | null = null;
  private iceServers: RTCIceServer[] = [];
  private roomId: string | null = null;
  private done = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private channelOpened = false;
  private unsubs: Array<() => void> = [];

  readonly on = this.emitter.on.bind(this.emitter);

  constructor(
    private readonly signalingUrl: string,
    private readonly deps: SessionDeps = {},
  ) {}

  async start(
    roomId: string,
    keyFragment: string,
    options: ReceiveOptions = {},
  ): Promise<void> {
    this.roomId = roomId;
    this.ownsSignaling = options.ownsSignaling ?? !options.signaling;
    this.emitter.emit('state', 'joining');

    let key: CryptoKey;
    try {
      key = await importKeyFromFragment(keyFragment);
    } catch {
      this.emitter.emit('error', 'Invalid or missing decryption key.');
      this.emitter.emit('state', 'error');
      return;
    }

    this.receiver = new FileReceiver(key, {
      onState: (s) => this.emitter.emit('state', s),
      onProgress: (p) => this.emitter.emit('progress', p),
      onComplete: (files) => {
        this.done = true;
        this.emitter.emit('complete', files);
      },
      onError: (m) => this.emitter.emit('error', m),
    });

    this.iceServers = await (this.deps.fetchIce ?? fetchIceServers)(this.signalingUrl);
    this.signaling =
      options.signaling ??
      (this.deps.createSignaling
        ? this.deps.createSignaling(this.signalingUrl)
        : new SignalingClient(this.signalingUrl));

    if (!options.signaling) {
      await this.signaling.connect();
    }

    try {
      await this.signaling.joinRoom(roomId);
    } catch (err) {
      this.emitter.emit('error', (err as Error).message);
      this.emitter.emit('state', 'error');
      return;
    }

    this.emitter.emit('state', 'connecting');
    this.createPeer();

    this.connectTimer = setTimeout(() => {
      if (!this.channelOpened && !this.done) {
        this.emitter.emit(
          'error',
          "Couldn't connect to the sender. Ask them to try again.",
        );
        this.emitter.emit('state', 'error');
      }
    }, CONNECT_TIMEOUT_MS);

    const unsubLeft = this.signaling.on('peer-left', ({ roomId: id }) => {
      if (id !== this.roomId) return;
      if (!this.done) this.createPeer();
    });
    this.unsubs.push(unsubLeft);
  }

  private createPeer(): void {
    if (!this.signaling || !this.receiver || !this.roomId || this.done) return;
    this.pc?.close();
    const pc = this.deps.createPeer
      ? this.deps.createPeer('receiver', this.roomId, this.signaling, this.iceServers)
      : new PeerConnection('receiver', this.roomId, this.signaling, this.iceServers);
    this.pc = pc;
    pc.on('channel-open', (transport) => {
      this.channelOpened = true;
      if (this.connectTimer) clearTimeout(this.connectTimer);
      this.receiver!.attach(transport);
    });
    pc.on('failed', () => {
      if (!this.done) setTimeout(() => this.createPeer(), 500);
    });
  }

  close(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.pc?.close();
    if (this.ownsSignaling) this.signaling?.close();
    this.signaling = null;
    this.emitter.clear();
  }
}
