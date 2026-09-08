import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Undo2 } from 'lucide-react';
import { UndoAction, subscribeUndo, runUndo, dismissUndo } from '../lib/undo';

/**
 * Undo prompt.
 *
 * Sits above the bottom navigation so it never covers it, and disappears on
 * its own — an undo that demands dismissal is another thing to tap.
 */
export const UndoToast: React.FC = () => {
  const [action, setAction] = useState<UndoAction | null>(null);

  useEffect(() => subscribeUndo(setAction), []);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="fixed left-3 right-3 z-[86] pointer-events-none"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          <div
            className="pointer-events-auto max-w-sm mx-auto rounded-2xl border p-3 flex items-center gap-3"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--rule)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 14px 34px -18px rgba(0,0,0,0.95)',
            }}
          >
            <span className="text-[14px] font-medium min-w-0 flex-1 truncate">{action.label}</span>

            <button
              onClick={() => runUndo()}
              className="shrink-0 min-h-[38px] px-4 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
              style={{
                background: 'color-mix(in oklab, var(--signal) 16%, transparent)',
                color: 'var(--signal-ink)',
              }}
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              Undo
            </button>

            <button
              onClick={dismissUndo}
              aria-label="Dismiss"
              className="shrink-0 w-8 h-8 rounded-lg text-[var(--ink-dim)] text-lg leading-none"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
