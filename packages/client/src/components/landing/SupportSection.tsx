import { DonationCard } from './DonationCard';
import { Reveal } from '@/components/Reveal';
import { DONATION_WALLETS } from '@/config/dev';

/** "Support the dev" — crypto donation wallets with addresses + QR codes. */
export function SupportSection() {
  return (
    <section id="support" className="scroll-mt-24 border-t border-white/[0.06] py-24">
      <Reveal>
        <p className="eyebrow text-[var(--color-ink-faint)]">Support</p>
        <h2 className="mt-4 max-w-2xl text-[2.1rem] leading-tight sm:text-[2.75rem]">
          Free and open. Tips keep it alive.
        </h2>
        <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
          No ads, no accounts, no stored files — nothing to sell. If Beam helped, a small
          crypto tip means a lot.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DONATION_WALLETS.map((wallet, i) => (
          <Reveal key={wallet.symbol} delay={i * 0.06}>
            <DonationCard wallet={wallet} />
          </Reveal>
        ))}
      </div>

      <p className="mt-6 text-sm text-[var(--color-ink-faint)]">
        Always verify the address after copying. Send only the matching asset on the correct network.
      </p>
    </section>
  );
}
