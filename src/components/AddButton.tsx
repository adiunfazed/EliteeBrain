import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';

interface Props {
  label: string;
  onClick: () => void;
}

/**
 * Floating add button.
 *
 * Sits above the bottom navigation, thumb-reachable, and stays put while the
 * list scrolls — so the primary action is always one tap away regardless of
 * how far down someone is.
 */
export const AddButton: React.FC<Props> = ({ label, onClick }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    whileTap={{ scale: 0.94 }}
    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    onClick={onClick}
    aria-label={label}
    className="fixed right-4 z-[70] flex items-center gap-2 pl-4 pr-5 rounded-2xl font-semibold text-white"
    style={{
      bottom: 'calc(5.25rem + env(safe-area-inset-bottom))',
      minHeight: 52,
      background: 'linear-gradient(160deg, #8F73FF, var(--signal))',
      boxShadow:
        '0 1px 0 0 rgba(255,255,255,0.22) inset, 0 12px 28px -10px color-mix(in oklab, var(--signal) 85%, transparent)',
    }}
  >
    <Plus className="w-5 h-5 shrink-0" strokeWidth={2.6} />
    <span className="text-[14px]">{label}</span>
  </motion.button>
);
