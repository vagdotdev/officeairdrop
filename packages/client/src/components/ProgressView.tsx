import { motion } from 'framer-motion';
import type { TransferProgress } from '@/lib/transfer';
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils';

/**
 * The live transfer dashboard: a big percentage + animated bar, plus the
 * detail line (bytes, speed, ETA, current chunk) the spec calls for.
 */
export function ProgressView({ progress }: { progress: TransferProgress }) {
  const pct = Math.round(progress.percent * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <span className="font-display text-5xl font-semibold tabular-nums text-[var(--color-ink)]">
          {pct}
          <span className="text-2xl text-[var(--color-ink-faint)]">%</span>
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--color-ink-soft)]">
          {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-paper-2)]">
        <motion.div
          className="h-full rounded-full bg-[var(--color-signal)]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--color-line)] border-y border-[var(--color-line)]">
        <Stat label="Speed" value={formatSpeed(progress.speedBps)} />
        <Stat label="Time left" value={formatDuration(progress.etaSeconds)} />
        <Stat
          label="Chunk"
          value={`${Math.min(progress.chunksTransferred + 1, progress.totalChunks)}/${progress.totalChunks}`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 first:pl-0">
      <div className="eyebrow text-[var(--color-ink-faint)]">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
