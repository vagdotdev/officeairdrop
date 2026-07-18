import { Link } from 'react-router-dom';
import { Sparkle } from '@phosphor-icons/react';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5ac8fa] via-[#007aff] to-[#af52de] text-white shadow-md shadow-blue-500/20">
        <Sparkle weight="fill" className="h-4 w-4" />
      </span>
      <span className="font-display text-[1.35rem] font-semibold leading-none tracking-tight text-[var(--color-ink)]">
        Drop
      </span>
    </Link>
  );
}
