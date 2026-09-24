import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Dumbbell,
  Plus,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { NumberStepper } from './NumberStepper';
import { ExercisePicker } from './ExercisePicker';
import { SetLogger } from './SetLogger';
import {
  KnownExercise,
  PlannedSet,
  TEMPLATE_LIMITS,
  TemplateItem,
  WorkoutTemplate,
  cleanName,
  normaliseItem,
  normaliseTemplate,
  summariseTemplate,
  templateProblem,
} from '../../lib/workoutTemplates';
import { RecordViews, recordLabel } from '../../lib/personalRecords';
import { soundFx } from '../../utils/audio';

interface Props {
  /** The workout being edited, or null when building a new one. */
  template: WorkoutTemplate | null;
  /** Custom exercises from every other template, for the picker. */
  known: KnownExercise[];
  records?: RecordViews;
  onSave: (template: WorkoutTemplate) => void;
  onDelete?: (templateId: string) => void;
  onCancel: () => void;
}

const TRACKED = new Set(['pushups', 'squats', 'lunges', 'glute-bridge', 'calf-raises']);

/**
 * Building a workout.
 *
 * The exercise's name, then its sets as a table: set number, weight, reps.
 * The same table the runner shows in the gym, so what is planned here is
 * literally the row that gets ticked off there — nothing to translate and
 * nothing to learn twice.
 *
 * Every row is independent, because that is how training is written: 60×10,
 * 60×10, 70×8 is one exercise with three different sets, and a single "reps"
 * figure per exercise cannot express it.
 *
 * Nothing is written until Save. The draft lives here, so backing out of a
 * half-built workout cannot damage the saved one — which matters most when
 * editing an existing template rather than making a new one.
 */
export const TemplateBuilder: React.FC<Props> = ({
  template,
  known,
  records = {},
  onSave,
  onDelete,
  onCancel,
}) => {
  const [name, setName] = useState(template?.name || '');
  const [items, setItems] = useState<TemplateItem[]>((template?.items || []).map(normaliseItem));
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touched, setTouched] = useState(false);

  const editing = !!template;
  const summary = useMemo(() => summariseTemplate(items), [items]);
  const problem = templateProblem({ name, items });
  const full = items.length >= TEMPLATE_LIMITS.items;

  const patch = (index: number, changes: Partial<TemplateItem>) => {
    setItems((rows) =>
      rows.map((row, i) => (i === index ? normaliseItem({ ...row, ...changes }) : row))
    );
  };

  /**
   * One cell of one set.
   *
   * Deliberately not normalised on every keystroke: clamping a half-typed
   * "6" up to a minimum while the finger is still on its way to "60" is the
   * one thing that makes a numeric field unusable. The whole template is
   * normalised on save instead.
   */
  const patchSet = (index: number, setIndex: number, changes: Partial<PlannedSet>) => {
    setItems((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const plan = row.plan.map((set, s) => (s === setIndex ? { ...set, ...changes } : set));
        return { ...row, plan, sets: plan.length };
      })
    );
  };

  const addSet = (index: number) => {
    soundFx.playClick();
    setItems((rows) =>
      rows.map((row, i) => {
        if (i !== index || row.plan.length >= TEMPLATE_LIMITS.sets.max) return row;
        // A new set copies the last one — a fourth set is almost always the
        // third one again — and stays editable from there.
        const last = row.plan[row.plan.length - 1] || { weight: 0, reps: 10 };
        return { ...row, plan: [...row.plan, { ...last }], sets: row.plan.length + 1 };
      })
    );
  };

  const removeSet = (index: number, setIndex: number) => {
    soundFx.playClick();
    setItems((rows) =>
      rows.map((row, i) => {
        if (i !== index || row.plan.length <= 1) return row;
        const plan = row.plan.filter((_, s) => s !== setIndex);
        return { ...row, plan, sets: plan.length };
      })
    );
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    soundFx.playClick();
    setItems((rows) => {
      const next = [...rows];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const remove = (index: number) => {
    soundFx.playClick();
    setItems((rows) => rows.filter((_, i) => i !== index));
  };

  const add = (exercise: KnownExercise) => {
    // The same exercise twice in one session is legitimate — a push day can
    // open and close with the same movement — so this adds rather than
    // refusing.
    const row = normaliseItem({
      exerciseId: exercise.id,
      name: exercise.name,
      metric: exercise.metric,
      sets: 3,
      target: exercise.metric === 'hold' ? 30 : 10,
      restSeconds: exercise.restSeconds || 60,
    });
    setItems((rows) => (rows.length >= TEMPLATE_LIMITS.items ? rows : [...rows, row]));
  };

  const save = () => {
    setTouched(true);
    if (problem) return;
    soundFx.playSuccess();
    onSave(normaliseTemplate({ ...(template || {}), name: cleanName(name), items }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} aria-label="Back" className="icon-btn shrink-0">
          <X className="w-4 h-4 shrink-0" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="t-section truncate">{editing ? 'Edit workout' : 'New workout'}</h2>
          <p className="t-meta mt-0.5">
            {editing ? 'Changes apply next time you run it.' : 'Saved to your account.'}
          </p>
        </div>
      </div>

      <div className="field-wrap">
        <Dumbbell className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, TEMPLATE_LIMITS.nameMax))}
          placeholder="Workout name, e.g. Push day"
          aria-label="Workout name"
          className="field-input"
          style={{ fontSize: 15, fontWeight: 600 }}
        />
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const best = recordLabel(records[item.exerciseId], item.metric);

            return (
              <motion.div
                key={`${item.exerciseId}:${index}`}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.18 }}
                className="build-block"
              >
                <div className="build-block-head">
                  <span className="build-index">{index + 1}</span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-bold truncate">{item.name}</span>
                    <span className="t-meta mt-0.5 flex items-center gap-2 flex-wrap dot-meta">
                      {TRACKED.has(item.exerciseId) ? (
                        <span className="inline-flex items-center gap-1">
                          <Camera className="w-3 h-3 shrink-0" />
                          camera counts it
                        </span>
                      ) : item.metric === 'hold' ? (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="w-3 h-3 shrink-0" />
                          timed hold
                        </span>
                      ) : (
                        <span>typed in</span>
                      )}
                      {best && (
                        <span className="inline-flex items-center gap-1 eb-warn">
                          <Trophy className="w-3 h-3 shrink-0" />
                          {best}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${item.name} up`}
                      className="step-btn step-btn-sm"
                    >
                      <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Move ${item.name} down`}
                      className="step-btn step-btn-sm"
                    >
                      <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                    </button>
                    <button
                      onClick={() => remove(index)}
                      aria-label={`Remove ${item.name}`}
                      className="step-btn step-btn-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </span>
                </div>

                <SetLogger
                  metric={item.metric}
                  rows={item.plan.map((set) => ({ ...set, done: false }))}
                  mode="plan"
                  onChange={(setIndex, changes) => patchSet(index, setIndex, changes)}
                  onAdd={() => addSet(index)}
                  onRemove={(setIndex) => removeSet(index, setIndex)}
                  max={TEMPLATE_LIMITS.sets.max}
                />

                <div className="build-block-foot">
                  <NumberStepper
                    label="Rest between sets"
                    value={item.restSeconds}
                    unit="s"
                    min={TEMPLATE_LIMITS.rest.min}
                    max={TEMPLATE_LIMITS.rest.max}
                    step={15}
                    compact
                    onChange={(v) => patch(index, { restSeconds: v })}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <button
          onClick={() => {
            soundFx.playClick();
            setPicking(true);
          }}
          disabled={full}
          className="add-row"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {items.length === 0 ? 'Add your first exercise' : 'Add exercise'}
        </button>

        {full && (
          <p className="t-meta text-center">
            That is {TEMPLATE_LIMITS.items} exercises — plenty for one session.
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="stat-strip grid-cols-3">
          <div>
            <span className="eb-label block">Sets</span>
            <span className="t-figure block mt-1.5" style={{ fontSize: 20 }}>
              {summary.sets}
            </span>
          </div>
          <div>
            <span className="eb-label block">Volume</span>
            <span className="t-figure block mt-1.5" style={{ fontSize: 20 }}>
              {summary.volume > 0 ? summary.volume.toLocaleString() : '—'}
              {summary.volume > 0 && <span className="t-meta ml-1">kg</span>}
            </span>
          </div>
          <div>
            <span className="eb-label block">Rough time</span>
            <span className="t-figure block mt-1.5" style={{ fontSize: 20 }}>
              {summary.minutes}
              <span className="t-meta ml-1">min</span>
            </span>
          </div>
        </div>
      )}

      {/* Shown only once Save has been pressed: telling someone what is wrong
          with a workout they have not finished building yet is nagging. */}
      {touched && problem && <p className="t-meta eb-warn text-center">{problem}</p>}

      <div className="flex items-center gap-2.5">
        <button onClick={onCancel} className="btn-quiet flex-1">
          Cancel
        </button>
        <button onClick={save} className="btn-lg flex-1" disabled={!!problem && touched}>
          {editing ? 'Save changes' : 'Save workout'}
        </button>
      </div>

      {editing && onDelete && (
        <div className="pt-1">
          {confirmDelete ? (
            <div className="panel-sm">
              <p className="t-sub">Delete “{template?.name}”? Your finished sessions stay.</p>
              <div className="flex items-center gap-2.5 mt-3">
                <button onClick={() => setConfirmDelete(false)} className="btn-quiet flex-1">
                  Keep it
                </button>
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onDelete(template!.id);
                  }}
                  className="btn-quiet flex-1 eb-danger"
                  style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, var(--rule))' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button onClick={() => setConfirmDelete(true)} className="btn-text eb-danger">
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                Delete this workout
              </button>
            </div>
          )}
        </div>
      )}

      <ExercisePicker
        open={picking}
        known={known}
        records={records}
        chosen={items.map((i) => i.exerciseId)}
        onPick={add}
        onClose={() => setPicking(false)}
      />
    </div>
  );
};
