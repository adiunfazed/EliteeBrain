import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Bottom sheet for creating things.
 *
 * Composers used to sit above their lists, pushing the actual content below
 * the fold — you opened Tasks and saw a form instead of your tasks. Moving
 * creation into a sheet means the list is visible immediately and the form
 * appears only when asked for.
 *
 * Bottom-anchored because that is where thumbs are, and because a sheet
 * rising from the button that summoned it reads as connected to it.
 */
export const ComposerSheet: React.FC<Props> = ({ open, title, onClose, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the sheet so typing starts immediately.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const input = panelRef.current?.querySelector('input, textarea') as HTMLElement | null;
    // Delayed so it does not fight the entry animation on mobile.
    const focusTimer = window.setTimeout(() => input?.focus(), 220);

    // Lock the page behind the sheet so scrolling does not chain through.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[88] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed left-0 right-0 bottom-0 z-[89] max-h-[88vh] overflow-y-auto overscroll-contain"
            style={{
              background: 'var(--surface)',
              borderTop: '1px solid var(--rule)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              boxShadow: '0 -20px 60px -20px rgba(0,0,0,0.7)',
              paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
            }}
          >
            {/* Grab handle — signals the sheet is dismissable. */}
            <div className="flex justify-center pt-3 pb-1">
              <span
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--rule-strong)' }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-1">
              <h2 className="t-section">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ color: 'var(--ink-dim)' }}
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <div className="px-5 pt-3">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
