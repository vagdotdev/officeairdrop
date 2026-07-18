/**
 * Persistent office lobby connection — presence + incoming offers.
 */
import { useCallback, useEffect, useState } from 'react';
import type { IncomingTransferOfferMessage, LobbyPeer } from '@beam/shared';
import { SignalingClient } from '@/lib/signaling/signalingClient';
import { SIGNALING_URL } from '@/config/env';
import { guessDeviceLabel } from '@/lib/device';

export type LobbyStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'error';

export interface UseOfficeLobby {
  status: LobbyStatus;
  self: LobbyPeer | null;
  peers: LobbyPeer[];
  incoming: IncomingTransferOfferMessage | null;
  error: string | null;
  signaling: SignalingClient | null;
  join: (displayName: string) => void;
  leave: () => void;
  clearIncoming: () => void;
  respondToOffer: (accept: boolean) => void;
}

export function useOfficeLobby(): UseOfficeLobby {
  const [signaling, setSignaling] = useState<SignalingClient | null>(null);
  const [status, setStatus] = useState<LobbyStatus>('idle');
  const [self, setSelf] = useState<LobbyPeer | null>(null);
  const [peers, setPeers] = useState<LobbyPeer[]>([]);
  const [incoming, setIncoming] = useState<IncomingTransferOfferMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leave = useCallback(() => {
    setSignaling((prev) => {
      prev?.close();
      return null;
    });
    setStatus('idle');
    setSelf(null);
    setPeers([]);
    setIncoming(null);
  }, []);

  const join = useCallback(
    (displayName: string) => {
      const name = displayName.trim();
      if (!name) return;

      setSignaling((prev) => {
        prev?.close();
        return null;
      });

      const client = new SignalingClient(SIGNALING_URL);
      setSignaling(client);
      setStatus('connecting');
      setError(null);
      setSelf(null);
      setPeers([]);
      setIncoming(null);

      client.on('lobby-welcome', ({ self: me, peers: list }) => {
        setSelf(me);
        setPeers(list);
        setStatus('online');
      });
      client.on('peer-online', ({ peer }) => {
        setPeers((prev) => {
          if (prev.some((p) => p.peerId === peer.peerId)) {
            return prev.map((p) => (p.peerId === peer.peerId ? peer : p));
          }
          return [...prev, peer].sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
          );
        });
      });
      client.on('peer-offline', ({ peerId }) => {
        setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
      });
      client.on('peer-updated', ({ peer }) => {
        setPeers((prev) => prev.map((p) => (p.peerId === peer.peerId ? peer : p)));
        setSelf((s) => (s?.peerId === peer.peerId ? peer : s));
      });
      client.on('transfer-offer', (offer) => setIncoming(offer));
      client.on('reconnecting', () => setStatus('reconnecting'));
      client.on('error', ({ message }) => setError(message));

      client.joinLobby(name, guessDeviceLabel());
      void client.connect().catch((e: Error) => {
        setError(e.message);
        setStatus('error');
      });
    },
    [],
  );

  const clearIncoming = useCallback(() => setIncoming(null), []);

  const respondToOffer = useCallback(
    (accept: boolean) => {
      if (!incoming || !signaling) return;
      signaling.respondToOffer(incoming.offerId, incoming.from.peerId, accept);
      if (!accept) setIncoming(null);
    },
    [incoming, signaling],
  );

  useEffect(() => () => {
    signaling?.close();
  }, [signaling]);

  return {
    status,
    self,
    peers,
    incoming,
    error,
    signaling,
    join,
    leave,
    clearIncoming,
    respondToOffer,
  };
}
