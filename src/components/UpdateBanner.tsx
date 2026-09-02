import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, watchForUpdates } from '../lib/appUpdate';

/**
 * Update prompt.
 *
 * Appears only when a new version is genuinely waiting — never on a first
 * install, never on a timer. Dismissible, because interrupting someone
 * mid-task to demand a reload is worse than letting them update later.
 */
interface Props {
  /** Hold the prompt until the app is actually on screen. */
  ready?: boolean;
}

export const UpdateBanner: React.FC<Props> = ({ ready = true }) => {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => watchForUpdates(setAvailable), []);

  // Never over the splash screen: an update prompt during loading looks like
  // an error, and there is nothing to relaunch away from yet.
  const show = ready && available && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          // Sits above the bottom navigation, clear of the home indicator.
          className="fixed left-3 right-3 z-[85] pointer-events-none"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          <div
            className="pointer-events-auto max-w-md mx-auto rounded-2xl border p-3 flex items-center gap-3"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in oklab, var(--signal) 18%, var(--surface)), var(--surface))',
              borderColor: 'color-mix(in oklab, var(--signal) 45%, var(--rule))',
              boxShadow:
                '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 16px 40px -18px color-mix(in oklab, var(--signal) 90%, transparent)',
            }}
          >
            <span
              className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--signal) 24%, transparent)' }}
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 text-[var(--signal-ink)] ${
                  applying ? 'animate-spin' : ''
                }`}
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">Update available</p>
              <p className="text-[12px] text-[#96A0B0] mt-0.5 leading-snug">
                Relaunch to get the latest version.
              </p>
            </div>

            <button
              onClick={async () => {
                setApplying(true);
                await applyUpdate();
              }}
              disabled={applying}
              className="shrink-0 min-h-[40px] px-4 rounded-xl text-[13px] font-semibold text-white transition-transform active:scale-95"
              style={{ background: 'var(--signal)' }}
            >
              {applying ? 'Updating…' : 'Relaunch'}
            </button>

            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-dim)]"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
