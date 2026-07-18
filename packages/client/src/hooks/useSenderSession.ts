/**
 * React binding for SenderSession. Owns the session's lifecycle and surfaces
 * its events as React state. All transfer logic lives in the session/lib layers
 * — this hook is a thin adapter.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SenderSession, type SenderRoomInfo } from '@/lib/session/senderSession';
import type { SenderState, TransferProgress } from '@/lib/transfer';
import { SIGNALING_URL } from '@/config/env';

export interface UseSender {
  state: SenderState;
  progress: TransferProgress | null;
  room: SenderRoomInfo | null;
  error: string | null;
  start: (files: File[]) => void;
}

export function useSenderSession(): UseSender {
  const sessionRef = useRef<SenderSession | null>(null);
  const [state, setState] = useState<SenderState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [room, setRoom] = useState<SenderRoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => sessionRef.current?.close();
  }, []);

  const start = useCallback((files: File[]) => {
    if (sessionRef.current || files.length === 0) return;
    const session = new SenderSession(SIGNALING_URL, window.location.origin);
    sessionRef.current = session;
    session.on('state', setState);
    session.on('progress', setProgress);
    session.on('room', setRoom);
    session.on('error', (msg) => {
      setError(msg);
      setState('error');
    });
    void session.start(files).catch((e: Error) => {
      setError(e.message);
      setState('error');
    });
  }, []);

  return { state, progress, room, error, start };
}
