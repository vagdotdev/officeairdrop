import { useState } from 'react';
import { Archive, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { DropZone } from '@/components/DropZone';
import { FileList } from '@/components/FileList';
import { ProgressView } from '@/components/ProgressView';
import { QrCode } from '@/components/QrCode';
import { StatusStepper } from '@/components/StatusStepper';
import { useParkSession } from '@/hooks/useParkSession';
import { formatBytes } from '@/lib/utils';

const STEPS = ['Fingerprinting', 'Parking', 'Safely parked'];
const STEP_INDEX = { idle: 0, preparing: 0, uploading: 1, complete: 2, error: 0 };

export function ParkPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [accessKey, setAccessKey] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState(259_200);
  const park = useParkSession();
  const started = park.state !== 'idle';
  const total = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <PageShell narrow>
      <div className="space-y-6">
        <header className="space-y-3">
          <span className="eyebrow text-[var(--color-ink-faint)]">Encrypted maid</span>
          <h1 className="font-display text-[2.4rem] leading-tight tracking-tight">
            Park files for later
          </h1>
          <p className="text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
            Files are encrypted in this browser. The maid stores only ciphertext and cannot
            open them.
          </p>
        </header>

        {!started ? (
          <div className="space-y-5">
            <DropZone onFiles={(incoming) => setFiles((current) => [...current, ...incoming])} />
            {files.length > 0 && (
              <Card>
                <CardContent className="space-y-5">
                  <FileList
                    files={files}
                    onRemove={(index) =>
                      setFiles((current) => current.filter((_, i) => i !== index))
                    }
                  />
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--color-ink)]">
                      Maid access key
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={accessKey}
                      onChange={(event) => setAccessKey(event.target.value)}
                      placeholder="Configured on your Oracle maid"
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--color-signal)]"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--color-ink)]">
                      Delete automatically after
                    </span>
                    <select
                      value={ttlSeconds}
                      onChange={(event) => setTtlSeconds(Number(event.target.value))}
                      className="w-full rounded-xl border border-[var(--color-line)] bg-white/60 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value={86_400}>24 hours</option>
                      <option value={259_200}>3 days</option>
                      <option value={604_800}>7 days</option>
                      <option value={2_592_000}>30 days</option>
                    </select>
                  </label>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!accessKey.trim()}
                    onClick={() => park.start(files, accessKey, ttlSeconds)}
                  >
                    <Archive className="h-4 w-4" />
                    Encrypt &amp; park {formatBytes(total)}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-5">
              <StatusStepper
                steps={STEPS}
                current={STEP_INDEX[park.state]}
                failed={park.state === 'error'}
                complete={park.state === 'complete'}
              />

              {park.state === 'preparing' && (
                <p className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading, encrypting, and fingerprinting {formatBytes(total)}…
                </p>
              )}

              {park.progress && (park.state === 'uploading' || park.state === 'complete') && (
                <ProgressView progress={park.progress} />
              )}

              {park.state === 'complete' && park.recoveryUrl && (
                <div className="space-y-5">
                  <div className="flex items-start gap-2 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    Safely parked. Every chunk received a durable disk acknowledgement.
                  </div>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-3">
                      <span className="eyebrow text-[var(--color-ink-faint)]">
                        Recovery link
                      </span>
                      <code className="block truncate rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 font-mono text-xs">
                        {park.recoveryUrl}
                      </code>
                      <CopyButton value={park.recoveryUrl} label="Copy recovery link" />
                      <p className="text-xs leading-relaxed text-[var(--color-ink-faint)]">
                        Save this link outside the computer before resetting. It contains the
                        only decryption key. Expires{' '}
                        {park.expiresAt
                          ? new Date(park.expiresAt).toLocaleString()
                          : 'automatically'}
                        .
                      </p>
                    </div>
                    <QrCode value={park.recoveryUrl} size={152} />
                  </div>
                </div>
              )}

              {park.state === 'error' && (
                <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {park.error ?? 'Could not park these files.'}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-ink-faint)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          The maid sees file metadata and encrypted bytes, never the key or plaintext.
        </div>
      </div>
    </PageShell>
  );
}
