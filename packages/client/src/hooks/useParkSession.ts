import { useCallback, useEffect, useRef, useState } from 'react';
import { MAID_URL } from '@/config/env';
import { ParkSession } from '@/lib/maid/parkSession';
import type { ParkState } from '@/lib/maid/types';
import type { TransferProgress } from '@/lib/transfer';

export function useParkSession() {
  const sessionRef = useRef<ParkSession | null>(null);
  const [state, setState] = useState<ParkState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => sessionRef.current?.close(), []);

  const start = useCallback((files: File[], accessKey: string, ttlSeconds: number) => {
    if (sessionRef.current || files.length === 0) return;
    const session = new ParkSession(MAID_URL, window.location.origin, {
      onState: setState,
      onProgress: setProgress,
      onComplete: (url, expiry) => {
        setRecoveryUrl(url);
        setExpiresAt(expiry);
      },
      onError: setError,
    });
    sessionRef.current = session;
    void session.start(files, accessKey, ttlSeconds).catch(() => undefined);
  }, []);

  return { state, progress, recoveryUrl, expiresAt, error, start };
}
