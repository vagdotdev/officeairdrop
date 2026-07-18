import { motion } from 'framer-motion';
import type { TransferProgress } from '@/lib/transfer';
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils';

export function DropProgress({
  progress,
  label,
}: {
  progress: TransferProgress;
  label: string;
}) {
  const pct = Math.round(progress.percent * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            {label}
          </div>
          <div className="mt-1 font-display text-5xl font-semibold tabular-nums tracking-tight">
            {pct}
            <span className="text-2xl text-[var(--color-ink-faint)]">%</span>
          </div>
        </div>
        <div className="text-right text-sm tabular-nums text-[var(--color-ink-soft)]">
          {formatBytes(progress.bytesTransferred)}
          <span className="text-[var(--color-ink-faint)]"> / {formatBytes(progress.totalBytes)}</span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#5ac8fa] via-[#007aff] to-[#af52de]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Speed" value={formatSpeed(progress.speedBps)} />
        <Stat label="ETA" value={formatDuration(progress.etaSeconds)} />
        <Stat
          label="Chunks"
          value={`${Math.min(progress.chunksTransferred + 1, progress.totalChunks)}/${progress.totalChunks}`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/50 px-3 py-3">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}
