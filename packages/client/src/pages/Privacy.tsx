import { LegalLayout, LegalSection } from '@/components/LegalLayout';
import { DEV_INFO } from '@/config/dev';

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 2026">
      <p className="text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
        Beam is built to collect as little as technically possible. There are no accounts, no
        tracking, and your files are never uploaded to us. This policy explains the few things the
        service does touch.
      </p>

      <LegalSection title="Your files never reach our servers">
        <p>
          Files are encrypted in your browser and sent directly to the recipient over an encrypted
          peer-to-peer (WebRTC) connection. Beam's servers never receive, store, or have access to
          your files or the encryption keys. The key lives only in the share link's URL fragment,
          which browsers never transmit to a server.
        </p>
      </LegalSection>

      <LegalSection title="What the signaling server handles">
        <p>
          To introduce two devices, our signaling server temporarily holds an ephemeral “room”
          identifier and basic presence state in memory (Redis), which expires automatically. It
          does not store file contents, keys, or persistent personal data.
        </p>
        <p>
          As with any internet service, connection metadata such as IP addresses is processed
          transiently to establish the connection (this is inherent to how WebRTC and web servers
          work). If a TURN relay is configured for difficult networks, it relays already-encrypted
          data without the ability to read it.
        </p>
      </LegalSection>

      <LegalSection title="Storage on your own device">
        <p>
          During a transfer, the receiving device may temporarily store encrypted/decrypted chunks
          in your browser's local IndexedDB so an interrupted transfer can resume. This data stays on
          your device and is cleared once the transfer completes.
        </p>
      </LegalSection>

      <LegalSection title="No cookies, no analytics, no ads">
        <p>
          Beam does not use advertising, third-party analytics, or tracking cookies. There is nothing
          to profile and nothing to sell.
        </p>
      </LegalSection>

      <LegalSection title="Donations">
        <p>
          Crypto donations are entirely optional. Blockchain addresses and transactions are public by
          nature; Beam does not collect identity information for donations.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy? Reach the developer via{' '}
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
