/**
 * High-level WebRTC peer connection.
 *
 * Encapsulates the offer/answer + ICE choreography against a SignalingClient
 * and surfaces a single clean event: `channel-open`, delivering a ready
 * DataChannelTransport. Roles are fixed and deterministic — the sender is the
 * offerer and owns the DataChannel; the receiver answers and adopts the
 * channel the sender created. Fixed roles sidestep negotiation glare entirely.
 *
 * Once `channel-open` fires, the signaling server has done its job and the
 * bulk transfer proceeds peer-to-peer with no further server involvement.
 */
import type { PeerRole, SignalPayload } from '@beam/shared';
import { Emitter } from '../events.js';
import { DataChannelTransport } from './dataChannel.js';
import type { SignalingClient } from '../signaling/signalingClient.js';

type ConnectionEvents = {
  'channel-open': DataChannelTransport;
  state: RTCPeerConnectionState;
  connected: void;
  disconnected: void;
  failed: void;
};

const DATA_CHANNEL_LABEL = 'beam';

export class PeerConnection {
  private readonly pc: RTCPeerConnection;
  private readonly emitter = new Emitter<ConnectionEvents>();
  /** ICE candidates that arrive before the remote description is set. */
  private readonly pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private unsubscribeSignal: (() => void) | null = null;

  readonly on = this.emitter.on.bind(this.emitter);

  constructor(
    private readonly role: PeerRole,
    private readonly roomId: string,
    private readonly signaling: SignalingClient,
    iceServers: RTCIceServer[],
  ) {
    this.pc = new RTCPeerConnection({ iceServers });

    // Trickle our ICE candidates to the other peer as they're discovered.
    this.pc.onicecandidate = (event) => {
      this.signaling.sendSignal(this.roomId, {
        kind: 'ice',
        candidate: event.candidate ? event.candidate.toJSON() : null,
      });
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      this.emitter.emit('state', state);
      if (state === 'connected') this.emitter.emit('connected', undefined);
      else if (state === 'failed') this.emitter.emit('failed', undefined);
      else if (state === 'disconnected' || state === 'closed')
        this.emitter.emit('disconnected', undefined);
    };

    // The receiver adopts the channel the sender opens.
    this.pc.ondatachannel = (event) => {
      this.adoptChannel(event.channel);
    };

    this.unsubscribeSignal = this.signaling.on('signal', ({ data }) => {
      void this.onSignal(data);
    });
  }

  /**
   * Sender-only: create the DataChannel and kick off the offer. Call this once
   * the receiver is known to be present (i.e. after `peer-joined`).
   */
  async start(): Promise<void> {
    if (this.role !== 'sender') return;
    const channel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true, // reliable + ordered: the transfer layer relies on order
    });
    this.adoptChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signaling.sendSignal(this.roomId, {
      kind: 'sdp',
      description: { type: offer.type, ...(offer.sdp ? { sdp: offer.sdp } : {}) },
    });
  }

  private adoptChannel(channel: RTCDataChannel): void {
    const transport = new DataChannelTransport(channel);
    if (channel.readyState === 'open') {
      this.emitter.emit('channel-open', transport);
    } else {
      channel.onopen = () => this.emitter.emit('channel-open', transport);
    }
  }

  private async onSignal(payload: SignalPayload): Promise<void> {
    if (payload.kind === 'sdp') {
      await this.pc.setRemoteDescription(
        payload.description as RTCSessionDescriptionInit,
      );
      this.remoteDescriptionSet = true;
      await this.flushPendingCandidates();

      // Receiver answers an incoming offer.
      if (payload.description.type === 'offer') {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.signaling.sendSignal(this.roomId, {
          kind: 'sdp',
          description: {
            type: answer.type,
            ...(answer.sdp ? { sdp: answer.sdp } : {}),
          },
        });
      }
    } else if (payload.kind === 'ice') {
      if (!payload.candidate) return; // end-of-candidates sentinel
      if (this.remoteDescriptionSet) {
        await this.pc.addIceCandidate(payload.candidate);
      } else {
        this.pendingCandidates.push(payload.candidate);
      }
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift()!;
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        // A stale/duplicate candidate is non-fatal.
      }
    }
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  close(): void {
    this.unsubscribeSignal?.();
    this.unsubscribeSignal = null;
    this.pc.close();
    this.emitter.clear();
  }
}
