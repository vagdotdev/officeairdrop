import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LobbyPeer } from '@beam/shared';
import { SIGNALING_URL } from '@/config/env';
import { accentGradient, initials } from '@/lib/accents';

/** Corner slots so orbs feel like people already in the room — not a roster. */
const SLOTS = [
  { top: '12%', left: '6%' },
  { top: '18%', right: '7%' },
  { bottom: '16%', left: '8%' },
  { bottom: '14%', right: '6%' },
  { top: '42%', left: '3%' },
  { top: '48%', right: '4%' },
  { top: '8%', left: '28%' },
  { bottom: '8%', right: '26%' },
] as const;

/** Quiet floating presence of who’s already online before you join. */
export function LobbyAtmosphere() {
  const [peers, setPeers] = useState<LobbyPeer[]>([]);

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch(`${SIGNALING_URL.replace(/\/$/, '')}/lobby`);
        if (!res.ok) return;
        const data = (await res.json()) as { peers?: LobbyPeer[] };
        if (!cancelled && Array.isArray(data.peers)) setPeers(data.peers);
      } catch {
        /* offline API — atmosphere just stays empty */
      }
    };

    void pull();
    const id = window.setInterval(() => void pull(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const shown = useMemo(() => peers.slice(0, SLOTS.length), [peers]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <AnimatePresence>
        {shown.map((peer, i) => {
          const slot = SLOTS[i]!;
          return (
            <motion.div
              key={peer.peerId}
              className="absolute flex flex-col items-center gap-1.5"
              style={slot}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{
                opacity: [0.18, 0.28, 0.18],
                y: [0, -6, 0],
                scale: 1,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                opacity: { duration: 5 + (i % 3), repeat: Infinity, ease: 'easeInOut' },
                y: {
                  duration: 6 + (i % 4) * 0.7,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.35,
                },
                scale: { duration: 0.7, ease: [0.32, 0.72, 0, 1] },
              }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-[0.7rem] font-semibold text-white blur-[0.2px] sm:h-12 sm:w-12 sm:text-xs"
                style={{
                  background: accentGradient(peer.accent),
                  boxShadow: '0 8px 24px rgba(40, 60, 120, 0.12)',
                }}
              >
                {initials(peer.displayName)}
              </div>
              <span className="max-w-[5.5rem] truncate text-[0.62rem] font-medium tracking-tight text-[var(--color-ink)]/35">
                {peer.displayName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
