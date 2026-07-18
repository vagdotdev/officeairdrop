import { useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadSimple } from '@phosphor-icons/react';
import { formatBytes } from '@/lib/utils';
import type { CompletedFile } from '@/lib/transfer';

interface SaveFileButtonProps {
  file: CompletedFile;
}

/** Big, bouncy “Save File” CTA so receivers know exactly what to click. */
export function SaveFileButton({ file }: SaveFileButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await file.save();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={() => void onSave()}
      disabled={saving}
      initial={{ scale: 0.96, opacity: 0, y: 8 }}
      animate={
        saved
          ? { scale: 1, opacity: 1, y: 0 }
          : {
              scale: [1, 1.045, 1],
              y: [0, -5, 0],
              opacity: 1,
            }
      }
      transition={
        saved
          ? { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
          : {
              duration: 1.35,
              ease: [0.32, 0.72, 0, 1],
              repeat: Infinity,
              repeatDelay: 0.55,
            }
      }
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-[#007aff] px-4 py-3.5 text-left text-white shadow-[0_12px_28px_rgba(0,122,255,0.35)] transition disabled:opacity-70"
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition group-hover:opacity-100" />
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <DownloadSimple weight="bold" className="h-5 w-5" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/80">
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save File'}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold">{file.name}</span>
      </span>
      <span className="relative shrink-0 text-xs font-medium tabular-nums text-white/75">
        {formatBytes(file.size)}
      </span>
    </motion.button>
  );
}
