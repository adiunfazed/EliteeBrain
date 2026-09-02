import React from 'react';
import { motion } from 'motion/react';

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** One sentence saying what this screen is for. */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Shown under the button — a concrete example beats abstract instructions. */
  hint?: string;
}

/**
 * Empty state.
 *
 * A blank screen tells a new user nothing and is the single biggest cause of
 * day-one abandonment. Every empty list should say what it is for and offer
 * the one action that fills it.
 */
export const EmptyState: React.FC<Props> = ({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  hint,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="text-center py-12 px-6"
  >
    <span
      className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
      style={{ background: 'var(--surface-sunk)' }}
    >
      <Icon className="w-6 h-6 shrink-0 text-[var(--ink-dim)]" />
    </span>

    <h3 className="t-section mt-4">{title}</h3>
    <p className="t-sub mt-2 max-w-xs mx-auto leading-relaxed">{body}</p>

    {actionLabel && onAction && (
      <button onClick={onAction} className="btn-lg mt-6 w-full max-w-[240px] mx-auto">
        {actionLabel}
      </button>
    )}

    {hint && <p className="t-sub mt-4 text-[12px] text-[var(--ink-dim)]">{hint}</p>}
  </motion.div>
);
