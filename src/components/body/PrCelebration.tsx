import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

export interface PrRecord {
  exerciseId: string;
  exerciseName: string;
  /** Reps, seconds for a hold, or kilograms for a loaded set. */
  value: number;
  /** "reps", "seconds", or "kg × 8" for a weighted best. */
  unit: string;
  /** What it beat. Absent when this is the first record for the exercise. */
  previous?: number;
  /** The old best written out, e.g. "65 kg × 8". Preferred over `previous`. */
  previousText?: string;
}

interface Props {
  record: PrRecord | null;
  onDismiss: () => void;
}

/**
 * A new personal record, shown the moment the set that earned it ends.
 *
 * Only ever rendered for a record set in this session — a reloaded workout is
 * history, and celebrating it again would make the celebration meaningless.
 * That decision is made by the caller, which knows what was just completed;
 * this component only draws what it is handed.
 */
export const PrCelebration: React.FC<Props> = ({ record, onDismiss }) => {
  // Clears itself: it sits over the rest screen between sets, and having to
  // dismiss it before carrying on would be in the way.
  //
  // Keyed on the record rather than on the callback. `onDismiss` is an inline
  // arrow in the parent, so it is a new function on every render — depending
  // on it restarted this timer continuously while reps were coming in, and
  // the celebration could sit on screen indefinitely.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!record) return;
    const id = window.setTimeout(() => dismissRef.current(), 5000);
    return () => window.clearTimeout(id);
  }, [record?.exerciseId, record?.value]);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key={`${record.exerciseId}-${record.value}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
          className="fixed inset-0 z-[97] flex items-center justify-center p-6"
          style={{ background: 'rgba(7, 6, 11, 0.86)' }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="w-full max-w-xs text-center rounded-2xl px-6 py-8 pr-card"
          >
            <motion.span
              initial={{ scale: 0.4, rotate: -14 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.06 }}
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center pr-badge"
            >
              <Trophy className="w-8 h-8 shrink-0" style={{ color: '#FFD479' }} />
            </motion.span>

            <p className="eb-label mt-5" style={{ color: 'var(--signal-ink)' }}>
              New personal record
            </p>

            <p className="t-title mt-1.5">{record.exerciseName}</p>

            <p className="t-figure mt-3" style={{ fontSize: 52, lineHeight: 1 }}>
              {record.value}
              <span className="t-meta ml-1.5" style={{ fontSize: 15 }}>
                {record.unit}
              </span>
            </p>

            {record.previousText || record.previous ? (
              <p className="t-meta mt-3">
                {/* The old best in its own words. Pairing the previous weight
                    with this set's reps would describe a set nobody did. */}
                Beat your previous best of{' '}
                {record.previousText || `${record.previous} ${record.unit}`}.
              </p>
            ) : (
              <p className="t-meta mt-3">Your first record for this exercise.</p>
            )}

            <button onClick={onDismiss} className="btn-lg w-full mt-6">
              Keep going
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
