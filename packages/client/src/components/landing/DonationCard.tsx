import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, QrCode as QrIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';
import { QrCode } from '@/components/QrCode';
import type { DonationWallet } from '@/config/dev';
import { truncateMiddle } from '@/lib/utils';

/** A single crypto donation wallet: symbol, address, copy, QR toggle, explorer. */
export function DonationCard({ wallet }: { wallet: DonationWallet }) {
  const [showQr, setShowQr] = useState(false);

  return (
    <Card className="h-full transition-colors hover:border-[var(--color-line-strong)]">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="eyebrow text-[var(--color-signal)]">{wallet.symbol}</span>
            <p className="mt-1.5 font-display text-lg leading-none text-[var(--color-ink)]">
              {wallet.label}
            </p>
          </div>
          <button
            onClick={() => setShowQr((v) => !v)}
            aria-label="Toggle QR code"
            aria-pressed={showQr}
            className={`flex h-8 w-8 items-center justify-center rounded-[3px] border transition-colors ${
              showQr
                ? 'border-[var(--color-signal)] text-[var(--color-signal)]'
                : 'border-[var(--color-line-strong)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            <QrIcon className="h-4 w-4" />
          </button>
        </div>

        {wallet.note && (
          <p className="text-xs leading-relaxed text-[var(--color-ink-faint)]">{wallet.note}</p>
        )}

        <code
          className="block break-all border-l-2 border-[var(--color-line-strong)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-ink-soft)]"
          title={wallet.address}
        >
          {truncateMiddle(wallet.address, 14, 12)}
        </code>

        <AnimatePresence initial={false}>
          {showQr && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-center overflow-hidden"
            >
              <QrCode value={wallet.uri} size={150} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-auto flex items-center gap-2">
          <CopyButton value={wallet.address} label="Copy" size="sm" className="flex-1" />
          {wallet.explorerUrl && (
            <Button asChild variant="outline" size="icon" aria-label="View on block explorer">
              <a href={wallet.explorerUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
