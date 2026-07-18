/**
 * Button — minimal, premium. White primary on dark (the calm, confident
 * choice), quiet glass/ghost secondaries. Generous hit targets, ~100ms feel.
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-sans font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'rounded-full bg-[var(--color-ink)] text-white hover:bg-black',
        secondary:
          'rounded-full border border-white/70 bg-white/60 text-[var(--color-ink)] hover:bg-white/85',
        ghost:
          'rounded-full text-[var(--color-ink-soft)] hover:bg-white/50 hover:text-[var(--color-ink)]',
        outline:
          'rounded-full border border-black/10 text-[var(--color-ink)] hover:bg-white/60',
        accent:
          'rounded-full bg-[var(--color-signal)] text-white hover:brightness-110',
      },
      size: {
        sm: 'h-9 px-4 text-[0.8125rem]',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-[0.95rem]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';
