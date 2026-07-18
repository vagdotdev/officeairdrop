import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/Reveal';
import { DEV_INFO } from '@/config/dev';

/**
 * About-the-dev — establishes that Beam is a real person's project and links
 * out to the portfolio (the primary conversion goal of this section).
 */
export function AboutDev() {
  const initials = DEV_INFO.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section id="about" className="scroll-mt-24 border-t border-white/[0.06] py-24">
      <Reveal>
        <p className="eyebrow text-[var(--color-ink-faint)]">About</p>
        <Card className="mt-8">
          <CardContent className="grid gap-8 p-7 sm:p-9 md:grid-cols-[auto_1fr] md:items-start">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] font-display text-2xl text-[var(--color-ink)]">
              {initials}
            </span>

            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="font-display text-3xl">{DEV_INFO.name}</h2>
                <p className="text-sm text-[var(--color-ink-soft)]">{DEV_INFO.tagline}</p>
              </div>

              <p className="max-w-2xl text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
                {DEV_INFO.blurb}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button asChild>
                  <a href={DEV_INFO.portfolioUrl} target="_blank" rel="noopener noreferrer">
                    Visit my portfolio <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Button>
                {DEV_INFO.socials.map((s) => (
                  <Button asChild key={s.label} variant="secondary">
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.label} <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </section>
  );
}
