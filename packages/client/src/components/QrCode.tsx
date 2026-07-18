import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders a value as a QR code data-URL image. On mobile, the receiver scans
 * this to open the share link (which already contains the encryption key in
 * its fragment) and auto-join the room.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#0b0b10', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => setDataUrl(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div
      className="max-w-full shrink-0 overflow-hidden rounded-xl bg-white p-3 shadow-lg"
      style={{ width: size + 24 }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR code for the share link"
          width={size}
          height={size}
          className="block h-auto w-full"
        />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded bg-zinc-200" />
      )}
    </div>
  );
}
