import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A horizontal stepper that visualises the sender/receiver state machine.
 * `steps` is the ordered list of state labels; `current` is the active index.
 * When `complete` is set, the final step shows a check (not a spinner).
 */
export function StatusStepper({
  steps,
  current,
  failed = false,
  complete = false,
}: {
  steps: string[];
  current: number;
  failed?: boolean;
  complete?: boolean;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((label, i) => {
        // When complete, the current step counts as done too.
        const done = i < current || (complete && i <= current);
        const active = i === current && !complete;
        const spinning = active && !failed;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-mono transition-colors',
                done && 'border-[var(--color-positive)] bg-[var(--color-positive)]/15 text-[var(--color-positive)]',
                active && !failed && 'border-[var(--color-signal)] bg-[var(--color-signal)]/15 text-[var(--color-signal)]',
                active && failed && 'border-[var(--color-danger)] text-[var(--color-danger)]',
                !done && !active && 'border-[var(--color-line-strong)] text-[var(--color-ink-faint)]',
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : spinning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                'eyebrow',
                done || active ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-faint)]',
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-4 bg-[var(--color-line-strong)]" />}
          </li>
        );
      })}
    </ol>
  );
}
