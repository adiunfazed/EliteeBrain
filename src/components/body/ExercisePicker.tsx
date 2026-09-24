import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Icons from 'lucide-react';
import { Camera, Check, Plus, Search, Timer, Trophy, X } from 'lucide-react';
import { EXERCISES } from '../../lib/bodyTraining';
import {
  KnownExercise,
  cleanName,
  customExerciseId,
  presetExercises,
} from '../../lib/workoutTemplates';
import { RecordViews, recordLabel } from '../../lib/personalRecords';
import { soundFx } from '../../utils/audio';

interface Props {
  open: boolean;
  /** Custom exercises this account has used before. */
  known: KnownExercise[];
  /** Both bests per exercise, so a familiar lift shows its number. */
  records?: RecordViews;
  /** Ids already in the workout being built, shown as added. */
  chosen?: string[];
  onPick: (exercise: KnownExercise) => void;
  onClose: () => void;
}

const ICON_FOR: Record<string, string> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e.icon])
);

/**
 * Choosing what goes into a workout.
 *
 * Three sources in one list: the built-in exercises the camera can count, the
 * exercises this account has invented before, and whatever the user is typing
 * right now. The third is the important one — a gym session is barbell work
 * the camera has no business judging, so typing a name has to be as quick as
 * picking one.
 *
 * Which exercises the camera can count is stated on the row rather than
 * discovered later, so nobody sets up a bench press and then wonders why the
 * phone is not counting.
 */
export const ExercisePicker: React.FC<Props> = ({
  open,
  known,
  records = {},
  chosen = [],
  onPick,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [metric, setMetric] = useState<'reps' | 'hold'>('reps');
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = cleanName(query);
  const chosenSet = useMemo(() => new Set(chosen), [chosen]);

  const matches = useMemo(() => {
    const all = [...presetExercises(), ...known];
    const q = typed.toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.name.toLowerCase().includes(q));
  }, [known, typed]);

  // Labelled only when the whole list is shown. While searching, the results
  // are few and a heading over each one is noise.
  const showGroups = !typed && known.length > 0;

  // Only offered when it is genuinely new — otherwise the list already has it,
  // and creating it again would produce the same id and quietly do nothing.
  const canCreate =
    typed.length > 0 &&
    !matches.some((e) => e.name.toLowerCase() === typed.toLowerCase()) &&
    !known.some((e) => e.id === customExerciseId(typed));

  const pick = (exercise: KnownExercise) => {
    soundFx.playClick();
    onPick(exercise);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[96] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'rgba(3,3,6,0.72)', backdropFilter: 'blur(3px)' }}
          />

          <motion.div
            className="sheet"
            initial={{ y: 40, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            role="dialog"
            aria-label="Add an exercise"
          >
            <div className="sheet-grip" aria-hidden="true" />

            <div className="flex items-center gap-2.5 px-1">
              <span className="t-section min-w-0 flex-1">Add an exercise</span>
              <button onClick={onClose} aria-label="Close" className="icon-btn shrink-0">
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            <div className="field-wrap mt-3">
              <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 40))}
                placeholder="Search, or type any exercise name"
                aria-label="Exercise name"
                className="field-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canCreate) {
                    pick({
                      id: customExerciseId(typed),
                      name: typed,
                      metric,
                      custom: true,
                      restSeconds: 60,
                      tracked: false,
                    });
                  }
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear" className="icon-btn shrink-0">
                  <X className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>

            <div className="sheet-scroll mt-3">
              {canCreate && (
                <div className="create-row">
                  <button
                    onClick={() =>
                      pick({
                        id: customExerciseId(typed),
                        name: typed,
                        metric,
                        custom: true,
                        restSeconds: 60,
                        tracked: false,
                      })
                    }
                    className="create-main"
                  >
                    <span
                      className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                      style={{
                        background: 'color-mix(in oklab, var(--signal) 20%, var(--surface-sunk))',
                        border: '1px solid color-mix(in oklab, var(--signal) 40%, transparent)',
                      }}
                    >
                      <Plus className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[15px] font-bold truncate">Add “{typed}”</span>
                      <span className="t-meta block mt-0.5">
                        Your own exercise, counted by hand
                      </span>
                    </span>
                  </button>

                  {/* Reps or a hold, decided before it is created: the choice
                      changes what the runner counts, and changing it later
                      would leave earlier sets measured in another unit.
                      On its own line, so a long exercise name is never
                      truncated to make room for a switch. */}
                  <div className="create-metric">
                    <span className="eb-label">Counted in</span>
                    <div className="segmented" role="group" aria-label="How it is counted">
                      <button
                        onClick={() => setMetric('reps')}
                        data-active={metric === 'reps'}
                        className="chip"
                      >
                        Reps
                      </button>
                      <button
                        onClick={() => setMetric('hold')}
                        data-active={metric === 'hold'}
                        className="chip"
                      >
                        <Timer className="w-3 h-3 shrink-0" />
                        Seconds
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {matches.length === 0 && !canCreate && (
                <p className="t-sub py-3 text-center">Type a name to add your own exercise.</p>
              )}

              {matches.map((exercise, index) => {
                const Icon = (Icons as any)[ICON_FOR[exercise.id]] || Icons.Dumbbell;
                const best = recordLabel(records[exercise.id], exercise.metric);
                const added = chosenSet.has(exercise.id);

                const heading =
                  showGroups && index === 0
                    ? 'Built in'
                    : showGroups && exercise.custom && !matches[index - 1]?.custom
                      ? 'Your exercises'
                      : null;

                return (
                  <React.Fragment key={exercise.id}>
                    {heading && <p className="pick-group">{heading}</p>}
                  <button
                    key={exercise.id}
                    onClick={() => pick(exercise)}
                    className="pick-row"
                    data-added={added ? 'true' : 'false'}
                  >
                    <span className="pick-icon">
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={2.1} />
                    </span>

                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[14.5px] font-semibold truncate">
                        {exercise.name}
                      </span>
                      <span className="t-meta mt-0.5 flex items-center gap-2 flex-wrap">
                        {exercise.tracked ? (
                          <span className="inline-flex items-center gap-1">
                            <Camera className="w-3 h-3 shrink-0" />
                            Camera counts it
                          </span>
                        ) : (
                          <span>{exercise.metric === 'hold' ? 'Timed hold' : 'Counted by hand'}</span>
                        )}
                        {best && (
                          <span className="inline-flex items-center gap-1 eb-warn">
                            <Trophy className="w-3 h-3 shrink-0" />
                            {best}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="shrink-0" style={{ color: added ? 'var(--done)' : 'var(--ink-dim)' }}>
                      {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </span>
                  </button>
                  </React.Fragment>
                );
              })}
            </div>

            <button onClick={onClose} className="btn-quiet w-full mt-3">
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
