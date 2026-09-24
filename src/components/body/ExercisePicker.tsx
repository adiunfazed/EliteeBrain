import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Plus, Search, Timer, Trophy, X } from 'lucide-react';
import {
  KnownExercise,
  catalogueExercises,
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
  /** How many of each exercise the workout already holds. */
  counts?: Record<string, number>;
  onPick: (exercise: KnownExercise) => void;
  onClose: () => void;
}

/**
 * Choosing what goes into a workout.
 *
 * Four sources in one list: the lifts this account has used before, a
 * catalogue of common gym exercises, the bodyweight basics, and whatever the
 * user is typing right now. The last one matters most — a real session is
 * full of movements no catalogue has, so typing a name has to be as quick as
 * picking one.
 *
 * Built for a thumb. Full-width rows, a proper tap target on each one, a
 * search field that stays put while the list scrolls under it, and an
 * unmistakable "added" state — because the first version gave no feedback at
 * all, so a tap that had worked looked exactly like a tap that had not, and
 * people added the same exercise three times over.
 */
export const ExercisePicker: React.FC<Props> = ({
  open,
  known,
  records = {},
  counts = {},
  onPick,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [metric, setMetric] = useState<'reps' | 'hold'>('reps');
  /** Ids added while this sheet has been open, for the confirmation state. */
  const [justAdded, setJustAdded] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  /** Swallows a jittery double-tap on the same row. */
  const lastTap = useRef<{ id: string; at: number }>({ id: '', at: 0 });

  const typed = cleanName(query);

  const groups = useMemo(() => {
    const q = typed.toLowerCase();
    const match = (list: KnownExercise[]) =>
      q ? list.filter((e) => e.name.toLowerCase().includes(q)) : list;

    // Anything already in a workout of the user's own comes first: it is the
    // likeliest pick, and it carries their personal best.
    const mine = match(known);
    const mineIds = new Set(mine.map((e) => e.id));
    const catalogue = match(catalogueExercises()).filter((e) => !mineIds.has(e.id));
    const basics = match(presetExercises()).filter((e) => !mineIds.has(e.id));

    return [
      { label: 'Your exercises', rows: mine },
      { label: 'Common lifts', rows: catalogue },
      { label: 'Bodyweight', rows: basics },
    ].filter((group) => group.rows.length > 0);
  }, [known, typed]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  // Only offered when it is genuinely new — otherwise the list already has
  // it, and creating it again would produce the same id and do nothing.
  const canCreate =
    typed.length > 0 &&
    !groups.some((g) => g.rows.some((e) => e.name.toLowerCase() === typed.toLowerCase()));

  const pick = (exercise: KnownExercise) => {
    const now = Date.now();
    if (lastTap.current.id === exercise.id && now - lastTap.current.at < 400) return;
    lastTap.current = { id: exercise.id, at: now };

    soundFx.playClick();
    onPick(exercise);
    setJustAdded((current) => ({ ...current, [exercise.id]: (current[exercise.id] || 0) + 1 }));
    setQuery('');
  };

  const addedTotal = Object.values(justAdded).reduce((n, v) => n + v, 0);

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
            style={{ background: 'rgba(3,3,6,0.74)', backdropFilter: 'blur(3px)' }}
          />

          <motion.div
            className="sheet sheet-tall"
            initial={{ y: 40, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            role="dialog"
            aria-label="Add exercises"
          >
            <div className="sheet-grip" aria-hidden="true" />

            <div className="sheet-top">
              <div className="flex items-center gap-2.5">
                <span className="t-section min-w-0 flex-1">Add exercises</span>
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
                  placeholder="Search or type any exercise"
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
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear"
                    className="icon-btn shrink-0"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>
            </div>

            <div className="sheet-scroll">
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
                    <span className="pick-icon">
                      <Plus className="w-4 h-4 shrink-0" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[15px] font-bold truncate">Add “{typed}”</span>
                      <span className="t-meta block mt-0.5">Your own exercise</span>
                    </span>
                  </button>

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

              {total === 0 && !canCreate && (
                <p className="t-sub py-4 text-center">Type a name to add your own exercise.</p>
              )}

              {groups.map((group) => (
                <div key={group.label} className="pick-group-block">
                  <p className="pick-group">{group.label}</p>

                  {group.rows.map((exercise) => {
                    // The workout's own count is the truth — it already
                    // includes anything added from this sheet. Adding the
                    // local tally on top counted every new row twice.
                    const inWorkout = counts[exercise.id] || 0;
                    const added = (justAdded[exercise.id] || 0) > 0;
                    const best = recordLabel(records[exercise.id], exercise.metric);

                    return (
                      <button
                        key={exercise.id}
                        onClick={() => pick(exercise)}
                        className="pick-row"
                        data-added={added ? 'true' : 'false'}
                      >
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block text-[15px] font-semibold truncate">
                            {exercise.name}
                          </span>
                          <span className="t-meta mt-0.5 flex items-center gap-2.5 flex-wrap">
                            {exercise.metric === 'hold' && (
                              <span className="inline-flex items-center gap-1">
                                <Timer className="w-3 h-3 shrink-0" />
                                timed
                              </span>
                            )}
                            {best && (
                              <span className="inline-flex items-center gap-1 eb-warn">
                                <Trophy className="w-3 h-3 shrink-0" />
                                {best}
                              </span>
                            )}
                            {inWorkout > 0 && (
                              <span style={{ color: 'var(--done)' }}>
                                {inWorkout} in this workout
                              </span>
                            )}
                          </span>
                        </span>

                        {/* A full pill rather than a bare icon: this is the
                            thing being tapped, so it has to look like it. */}
                        <span className="pick-add" data-added={added ? 'true' : 'false'}>
                          {added ? (
                            <>
                              <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 shrink-0" />
                              Add
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <button onClick={onClose} className="btn-lg w-full mt-3">
              {addedTotal > 0 ? `Done · ${addedTotal} added` : 'Done'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
