import { useCallback, useEffect, useRef, useState } from 'react';
import { MAID_URL } from '@/config/env';
import { RecoverSession } from '@/lib/maid/recoverSession';
import type { RecoverState } from '@/lib/maid/types';
import type { CompletedFile, TransferProgress } from '@/lib/transfer';

export function useRecoverSession(parkId: string | undefined, fragment: string) {
  const sessionRef = useRef<RecoverSession | null>(null);
  const [state, setState] = useState<RecoverState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [files, setFiles] = useState<CompletedFile[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parkId || !fragment) {
      setState('error');
      setError('This recovery link is incomplete.');
      return;
    }
    const session = new RecoverSession(MAID_URL, parkId, fragment, {
      onState: setState,
      onProgress: setProgress,
      onComplete: (completed, expiry) => {
        setFiles(completed);
        setExpiresAt(expiry);
      },
      onError: setError,
    });
    sessionRef.current = session;
    void session.start().catch(() => undefined);
    return () => session.close();
  }, [parkId, fragment]);

  const deletePark = useCallback(async () => {
    try {
      await sessionRef.current?.deletePark();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the park.');
    }
  }, []);

  return { state, progress, files, expiresAt, error, deletePark };
}
