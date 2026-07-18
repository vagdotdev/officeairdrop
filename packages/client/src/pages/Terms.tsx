import { LegalLayout, LegalSection } from '@/components/LegalLayout';
import { DEV_INFO } from '@/config/dev';

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 2026">
      <p className="text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
        By using Beam you agree to these terms. Beam is a free tool for transferring files directly
        between devices. Please use it responsibly.
      </p>

      <LegalSection title="The service">
        <p>
          Beam helps two devices establish a direct, end-to-end encrypted connection to transfer
          files. Both the sender and receiver must be online with the share link for a transfer to
          occur. Beam does not store your files and cannot recover or resend them.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You are solely responsible for the files you transfer and for ensuring you have the right
          to share them. Do not use Beam to transfer unlawful material or to infringe anyone's
          rights. Do not attempt to disrupt, overload, or abuse the signaling service.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          Beam is provided “as is”, without warranties of any kind. Peer-to-peer connections depend
          on both networks and may not always succeed. We do not guarantee availability, delivery,
          speed, or uninterrupted operation.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, the developer is not liable for any loss or damage
          arising from your use of Beam, including failed transfers, lost data, or interrupted
          connections.
        </p>
      </LegalSection>

      <LegalSection title="Donations">
        <p>
          Crypto donations are voluntary, non-refundable, and grant no special rights, support
          guarantees, or ownership. They simply help fund continued development.
        </p>
      </LegalSection>

      <LegalSection title="Changes & contact">
        <p>
          These terms may be updated over time; continued use means you accept the current version.
          Questions? Reach the developer via{' '}
          <a
            href={DEV_INFO.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-ul text-[var(--color-ink)]"
          >
            {DEV_INFO.portfolioUrl.replace(/^https?:\/\//, '')}
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
