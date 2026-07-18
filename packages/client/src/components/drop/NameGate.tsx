import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';

interface NameGateProps {
  initialName?: string;
  busy?: boolean;
  onJoin: (name: string) => void;
}

export function NameGate({ initialName = '', busy, onJoin }: NameGateProps) {
  const [name, setName] = useState(initialName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
      className="mx-auto w-full max-w-md"
    >
      <div className="glass-strong rounded-[2rem] p-8 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5ac8fa] via-[#007aff] to-[#af52de] text-white shadow-lg shadow-blue-500/25">
            <Sparkle weight="fill" className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">Drop</div>
            <div className="text-sm text-[var(--color-ink-soft)]">Office AirDrop</div>
          </div>
        </div>

        <h1 className="font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight">
          Who are you?
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
          Pick a name your teammates will recognize. Then you’ll see everyone who’s online.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onJoin(name.trim());
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Priya · Design"
            className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-[1.05rem] outline-none ring-0 transition duration-300 placeholder:text-[var(--color-ink-faint)] focus:border-[#007aff]/50 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)]"
          />
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="group flex w-full items-center justify-between rounded-full bg-[#12131a] px-2 py-2 pl-6 text-white transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black active:scale-[0.98] disabled:opacity-40"
          >
            <span className="text-[0.95rem] font-semibold tracking-tight">
              {busy ? 'Joining…' : 'Enter the office'}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition duration-500 group-hover:translate-x-0.5 group-hover:bg-white/25">
              <ArrowRight weight="bold" className="h-4 w-4" />
            </span>
          </button>
        </form>
      </div>
    </motion.div>
  );
}
