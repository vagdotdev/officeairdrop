import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Quiet scroll-reveal: a restrained fade + rise as elements enter the viewport.
 * Animates once. The easing is slow and soft to keep the premium, calm feel.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
