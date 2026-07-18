/**
 * React binding for ReceiverSession. Auto-starts from the room id (route param)
 * and the key in the URL fragment, so scanning a QR / opening the link begins
 * the handshake immediately.
 */
import { useEffect, useRef, useState } from 'react';
import { ReceiverSession } from '@/lib/session/receiverSession';
import type { ReceiverState, TransferProgress, CompletedFile } from '@/lib/transfer';
import { SIGNALING_URL } from '@/config/env';

export interface UseReceiver {
  state: ReceiverState;
  progress: TransferProgress | null;
  files: CompletedFile[] | null;
  error: string | null;
}

export function useReceiverSession(roomId: string | undefined, keyFragment: string): UseReceiver {
  const sessionRef = useRef<ReceiverSession | null>(null);
  const [state, setState] = useState<ReceiverState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [files, setFiles] = useState<CompletedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setError('Missing room code.');
      setState('error');
      return;
    }
    if (!keyFragment) {
      setError('This link is missing its decryption key.');
      setState('error');
      return;
    }
    if (sessionRef.current) return;

    const session = new ReceiverSession(SIGNALING_URL);
    sessionRef.current = session;
    session.on('state', setState);
    session.on('progress', setProgress);
    session.on('complete', setFiles);
    session.on('error', setError);
    void session.start(roomId, keyFragment).catch((e: Error) => setError(e.message));

    return () => {
      session.close();
      sessionRef.current = null;
    };
  }, [roomId, keyFragment]);

  return { state, progress, files, error };
}
