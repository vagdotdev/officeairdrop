import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

/** Copy-to-clipboard button that briefly confirms the copy. */
export function CopyButton({
  value,
  label = 'Copy',
  ...props
}: { value: string; label?: string } & Omit<ButtonProps, 'onClick' | 'children'>) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable on insecure origins */
    }
  };

  return (
    <Button variant="secondary" onClick={copy} {...props}>
      {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
