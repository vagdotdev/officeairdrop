import type { ReactNode } from 'react';
import { PageShell } from './PageShell';

/** Shared layout for legal/long-form pages: title, updated date, prose body. */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PageShell narrow>
      <article className="legal">
        <p className="eyebrow text-[var(--color-ink-faint)]">Legal</p>
        <h1 className="mt-4 font-display text-[2.4rem] leading-tight tracking-tight sm:text-[3.2rem]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-faint)]">Last updated: {updated}</p>
        <hr className="rule my-10" />
        <div className="space-y-8">{children}</div>
      </article>
    </PageShell>
  );
}

/** A titled section within a legal page. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-[var(--color-ink)]">{title}</h2>
      <div className="space-y-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
        {children}
      </div>
    </section>
  );
}
