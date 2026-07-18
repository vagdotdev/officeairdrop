import { Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressView } from '@/components/ProgressView';
import { StatusStepper } from '@/components/StatusStepper';
import { useRecoverSession } from '@/hooks/useRecoverSession';
import { formatBytes } from '@/lib/utils';

const STEPS = ['Connecting', 'Recovering', 'Verifying', 'Ready'];
const STEP_INDEX = {
  idle: 0,
  connecting: 0,
  downloading: 1,
  verifying: 2,
  complete: 3,
  deleted: 3,
  error: 0,
};

export function RecoverPage() {
  const { parkId } = useParams<{ parkId: string }>();
  const fragment = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '');
  const recovery = useRecoverSession(parkId, fragment);
  const complete = recovery.state === 'complete' || recovery.state === 'deleted';

  return (
    <PageShell narrow>
      <div className="space-y-6">
        <header className="space-y-3">
          <span className="eyebrow text-[var(--color-ink-faint)]">Encrypted maid</span>
          <h1 className="font-display text-[2.4rem] leading-tight tracking-tight">
            Recover parked files
          </h1>
          <p className="text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            Encrypted chunks are downloaded, authenticated, and decrypted only in this browser.
          </p>
        </header>

        <Card>
          <CardContent className="space-y-5">
            <StatusStepper
              steps={STEPS}
              current={STEP_INDEX[recovery.state]}
              failed={recovery.state === 'error'}
              complete={complete}
            />

            {(recovery.state === 'connecting' || recovery.state === 'idle') && (
              <p className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening the encrypted park…
              </p>
            )}

            {recovery.progress &&
              (recovery.state === 'downloading' ||
                recovery.state === 'verifying' ||
                complete) && <ProgressView progress={recovery.progress} />}

            {recovery.state === 'verifying' && (
              <p className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <ShieldCheck className="h-4 w-4" />
                Verifying and assembling files…
              </p>
            )}

            {complete && recovery.files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
                  <ShieldCheck className="h-4 w-4" />
                  Recovery verified. Save every file before deleting the cloud copy.
                </div>
                <ul className="space-y-2">
                  {recovery.files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                    >
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                      <span className="text-xs text-[var(--color-ink-faint)]">
                        {formatBytes(file.size)}
                      </span>
                      <Button size="sm" onClick={() => void file.save()}>
                        <Download className="h-4 w-4" />
                        Save
                      </Button>
                    </li>
                  ))}
                </ul>
                {recovery.state === 'complete' ? (
                  <div className="space-y-2 border-t border-[var(--color-line)] pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void recovery.deletePark()}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete encrypted cloud copy
                    </Button>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      It otherwise expires automatically
                      {recovery.expiresAt
                        ? ` on ${new Date(recovery.expiresAt).toLocaleString()}`
                        : ''}
                      .
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-success)]">
                    Encrypted cloud copy deleted.
                  </p>
                )}
              </div>
            )}

            {recovery.state === 'error' && (
              <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {recovery.error ?? 'Could not recover this park.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
