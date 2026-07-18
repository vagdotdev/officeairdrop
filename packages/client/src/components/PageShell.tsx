import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

/** Shared chrome for link-based send/receive flows. */
export function PageShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <div className="aurora" aria-hidden />
      <div className="noise" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-6 sm:px-8">
        <Brand />
        <Link
          to="/"
          className="rounded-full bg-white/60 px-4 py-2 text-sm font-semibold text-[var(--color-ink)] backdrop-blur transition hover:bg-white/80"
        >
          Office lobby
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <div className={narrow ? 'mx-auto max-w-xl' : 'mx-auto max-w-3xl'}>{children}</div>
      </main>
    </div>
  );
}
