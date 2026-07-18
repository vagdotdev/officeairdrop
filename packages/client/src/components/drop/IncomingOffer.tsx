import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Files } from '@phosphor-icons/react';
import type { IncomingTransferOfferMessage } from '@beam/shared';
import { accentGradient, initials } from '@/lib/accents';
import { formatBytes } from '@/lib/utils';

interface IncomingOfferProps {
  offer: IncomingTransferOfferMessage | null;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingOffer({ offer, busy, onAccept, onDecline }: IncomingOfferProps) {
  return (
    <AnimatePresence>
      {offer && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-[#12131a]/25 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            className="glass-strong w-full max-w-md rounded-[2rem] p-6 sm:p-7"
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white peer-ring"
                style={{ background: accentGradient(offer.from.accent) }}
              >
                {initials(offer.from.displayName)}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                  Incoming Drop
                </div>
                <div className="mt-1 font-display text-xl font-semibold tracking-tight">
                  {offer.from.displayName}
                </div>
                <div className="text-sm text-[var(--color-ink-soft)]">
                  {offer.from.deviceLabel}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/55 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
                <Files weight="duotone" className="h-4 w-4 text-[#007aff]" />
                {offer.files.length} {offer.files.length === 1 ? 'file' : 'files'}
                <span className="font-medium text-[var(--color-ink-faint)]">
                  · {formatBytes(offer.files.reduce((s, f) => s + f.size, 0))}
                </span>
              </div>
              <ul className="max-h-28 space-y-1 overflow-auto text-sm text-[var(--color-ink-soft)]">
                {offer.files.slice(0, 6).map((f) => (
                  <li key={f.name + f.size} className="truncate">
                    {f.name}
                  </li>
                ))}
                {offer.files.length > 6 && (
                  <li className="text-[var(--color-ink-faint)]">
                    +{offer.files.length - 6} more
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={onDecline}
                className="flex items-center justify-center gap-2 rounded-full bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--color-ink)] transition active:scale-[0.98] disabled:opacity-50"
              >
                <X weight="bold" className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onAccept}
                className="flex items-center justify-center gap-2 rounded-full bg-[#34c759] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition active:scale-[0.98] disabled:opacity-50"
              >
                <Check weight="bold" className="h-4 w-4" />
                Accept
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
