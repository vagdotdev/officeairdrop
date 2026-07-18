import * as React from 'react';
import { cn } from '@/lib/utils';

/** Frosted glass surface for light Drop chrome. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative rounded-[var(--radius-card)] border border-white/70 bg-white/55 shadow-[0_18px_50px_rgba(40,60,120,0.1)] backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 sm:p-7', className)} {...props} />;
}
