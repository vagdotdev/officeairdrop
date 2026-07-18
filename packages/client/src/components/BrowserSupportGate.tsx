import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Beam needs WebRTC DataChannels and the Web Crypto API. If either is missing
 * (very old or locked-down browsers), we show a clear message instead of
 * failing deep inside a transfer.
 */
function isSupported(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof indexedDB !== 'undefined'
  );
}

export function BrowserSupportGate({ children }: { children: ReactNode }) {
  if (isSupported()) return <>{children}</>;

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-[var(--color-danger)]" />
        <h1 className="text-lg font-semibold">Browser not supported</h1>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Drop needs a modern browser with WebRTC and the Web Crypto API. Please try the latest
          Chrome, Edge, Firefox, or Safari.
        </p>
      </div>
    </div>
  );
}
