import { motion } from 'framer-motion';
import type { LobbyPeer } from '@beam/shared';
import { accentGradient, initials } from '@/lib/accents';

interface PeerOrbProps {
  peer: LobbyPeer;
  selected?: boolean;
  disabled?: boolean;
  onSelect: (peer: LobbyPeer) => void;
  index?: number;
}

export function PeerOrb({
  peer,
  selected,
  disabled,
  onSelect,
  index = 0,
}: PeerOrbProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(peer)}
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.55,
        delay: 0.04 * index,
        ease: [0.32, 0.72, 0, 1],
      }}
      whileHover={{ y: -4, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="group flex w-[104px] flex-col items-center gap-3 disabled:opacity-40"
    >
      <div className="relative">
        {selected && (
          <span className="pulse-ring absolute inset-[-10px] rounded-full border-2 border-[#007aff]" />
        )}
        <div
          className="peer-ring flex h-[76px] w-[76px] items-center justify-center rounded-full text-[1.35rem] font-semibold tracking-tight text-white transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ background: accentGradient(peer.accent) }}
        >
          {initials(peer.displayName)}
        </div>
      </div>
      <div className="text-center">
        <div className="truncate text-[0.92rem] font-semibold tracking-tight text-[var(--color-ink)]">
          {peer.displayName}
        </div>
        <div className="truncate text-[0.72rem] font-medium text-[var(--color-ink-faint)]">
          {peer.deviceLabel}
        </div>
      </div>
    </motion.button>
  );
}
