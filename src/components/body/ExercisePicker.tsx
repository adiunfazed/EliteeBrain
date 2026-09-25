import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Plus, Search, Timer, X } from 'lucide-react';
import {
  KnownExercise,
  MUSCLE_GROUPS,
  MuscleGroup,
  catalogueExercises,
  cleanName,
  customExerciseId,
  presetExercises,
} from '../../lib/workoutTemplates';
import { useBackGuard } from '../../lib/backStack';
import { soundFx } from '../../utils/audio';

interface Props {
  open: boolean;
  /** Custom exercises this account has used before. */
  known: KnownExercise[];
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

  // Back closes the sheet, not the screen behind it.
  useBackGuard(open, onClose);

  const [section, setSection] = useState<'all' | MuscleGroup>('all');

  /** Everything this account can add, in one list, deduplicated by id. */
  const everything = useMemo(() => {
    const catalogue = [...catalogueExercises(), ...presetExercises()];
    // An exercise the user has already used is the same exercise as the one
    // in the catalogue — same id, same name — so it inherits the body part
    // rather than falling out of every section but "All".
    const knownBy = new Map(catalogue.map((e) => [e.id, e]));

    const out: KnownExercise[] = [];
    const seen = new Set<string>();

    for (const exercise of [...known, ...catalogue]) {
      if (seen.has(exercise.id)) continue;
      seen.add(exercise.id);
      const reference = knownBy.get(exercise.id);
      out.push({
        ...exercise,
        group: exercise.group || reference?.group,
        targets: exercise.targets || reference?.targets,
      });
    }

    return out;
  }, [known]);

  /** Only the sections that actually hold something. */
  const sections = useMemo(() => {
    const present = new Set(everything.map((e) => e.group).filter(Boolean));
    return [
      { key: 'all' as const, label: 'All' },
      ...MUSCLE_GROUPS.filter((g) => present.has(g)).map((g) => ({ key: g, label: g })),
    ];
  }, [everything, known]);

  const rows = useMemo(() => {
    const q = typed.toLowerCase();
    const mine = new Set(known.map((e) => e.id));

    return everything
      .filter((e) => (section === 'all' ? true : e.group === section))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      // Inside a section, the account's own exercises come first: they are
      // the likeliest pick. Everything else keeps the catalogue's order,
      // which is grouped by movement rather than alphabet.
      .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  }, [everything, known, section, typed]);

  const total = rows.length;

  // Only offered when it is genuinely new — otherwise the list already has
  // it, and creating it again would produce the same id and do nothing.
  const canCreate =
    typed.length > 0 &&
    !everything.some((e) => e.name.toLowerCase() === typed.toLowerCase());

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

              {/* Body parts as a scrolling row of sections. A dropdown would
                  hide them behind a tap; on a phone this is one swipe. */}
              <div className="pick-tabs" role="tablist" aria-label="Body part">
                {sections.map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={section === tab.key}
                    onClick={() => setSection(tab.key)}
                    className="pick-tab"
                    data-active={section === tab.key ? 'true' : 'false'}
                  >
                    {tab.label}
                  </button>
                ))}
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

              {rows.map((exercise) => {
                const inWorkout = counts[exercise.id] || 0;
                const added = (justAdded[exercise.id] || 0) > 0;

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
                      {/* What it works, rather than what you once lifted on
                          it: this list is for choosing an exercise, and a
                          personal best is a reason to look somewhere else. */}
                      <span className="t-meta mt-0.5 flex items-center gap-2 flex-wrap">
                        {exercise.targets && <span>{exercise.targets}</span>}
                        {exercise.metric === 'hold' && (
                          <span className="inline-flex items-center gap-1">
                            <Timer className="w-3 h-3 shrink-0" />
                            timed
                          </span>
                        )}
                        {inWorkout > 0 && (
                          <span style={{ color: 'var(--done)' }}>{inWorkout} added</span>
                        )}
                      </span>
                    </span>

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

            <button onClick={onClose} className="btn-lg w-full mt-3">
              {addedTotal > 0 ? `Done · ${addedTotal} added` : 'Done'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
