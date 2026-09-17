import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Exercise } from '../../lib/bodyTraining';
import { soundFx } from '../../utils/audio';

export interface WorkoutConfigValue {
  sets: number;
  target: number;
  restSeconds: number;
}

interface Props {
  exercise: Exercise;
  initial: WorkoutConfigValue;
  onStart: (config: WorkoutConfigValue) => void;
  onCancel: () => void;
}

/**
 * A stepper whose number is itself an input.
 *
 * The buttons stay for a quick nudge, but going from 10 to 30 should not cost
 * twenty taps — tapping the number opens the numeric keypad and the exact
 * figure can be typed. The field is only committed on blur or Enter, so a
 * half-typed "3" on the way to "30" is never clamped up to the minimum
 * underneath the user's finger.
 */
const Stepper: React.FC<{
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, unit, min, max, step, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // While the field is closed it simply mirrors the value, so the +/- buttons
  // and the typed value can never disagree.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const open = () => {
    setDraft(String(value));
    setEditing(true);
    // Selected on open: the common case is replacing the number, not
    // appending to it.
    window.setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);

    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10);
    // Anything that is not a sensible positive number leaves the value alone
    // rather than silently becoming zero.
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = Math.max(min, Math.min(max, parsed));
    setDraft(String(next));
    if (next !== value) {
      soundFx.playClick();
      onChange(next);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="t-sub min-w-0 flex-1">{label}</span>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            soundFx.playClick();
            onChange(Math.max(min, value - step));
          }}
          disabled={value <= min}
          aria-label={`Less ${label}`}
          className="step-btn"
        >
          <Minus className="w-4 h-4 shrink-0" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            // Numeric keypad on mobile without the spinner arrows a number
            // input drags in on desktop.
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                inputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setDraft(String(value));
                setEditing(false);
              }
            }}
            aria-label={`${label}, type a number`}
            autoFocus
            className="step-field"
          />
        ) : (
          <button
            onClick={open}
            aria-label={`${label}: ${value}${unit}. Tap to type a number.`}
            className="step-value"
          >
            <span className="t-figure tabular-nums" style={{ fontSize: 18 }}>
              {value}
            </span>
            {unit && <span className="t-meta ml-0.5">{unit}</span>}
          </button>
        )}

        <button
          onClick={() => {
            soundFx.playClick();
            onChange(Math.min(max, value + step));
          }}
          disabled={value >= max}
          aria-label={`More ${label}`}
          className="step-btn"
        >
          <Plus className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};

/**
 * Configuring a set before starting.
 *
 * The presets remain, but nothing is fixed — the previous version hardcoded
 * three sets at a difficulty-derived target, which suited nobody past their
 * first week. Ceilings exist only where a number stops being training and
 * starts being a hazard.
 */
export const WorkoutConfig: React.FC<Props> = ({
  exercise,
  initial,
  onStart,
  onCancel,
}) => {
  const [sets, setSets] = useState(initial.sets);
  const [target, setTarget] = useState(initial.target);
  const [rest, setRest] = useState(initial.restSeconds);

  const isHold = exercise.metric === 'hold';
  const totalWork = sets * target;

  return (
    <div className="space-y-4">
      <div>
        <p className="t-section">{exercise.name}</p>
        <p className="t-meta mt-0.5">{exercise.cue}</p>
      </div>

      <div className="panel-sm space-y-3.5">
        <Stepper
          label="Sets"
          value={sets}
          unit=""
          min={1}
          max={10}
          step={1}
          onChange={setSets}
        />

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <Stepper
          label={isHold ? 'Hold for' : 'Reps per set'}
          value={target}
          unit={isHold ? 's' : ''}
          min={isHold ? 5 : 1}
          max={isHold ? 300 : 100}
          step={isHold ? 5 : 1}
          onChange={setTarget}
        />

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <Stepper
          label="Rest between sets"
          value={rest}
          unit="s"
          min={0}
          max={300}
          step={15}
          onChange={setRest}
        />
      </div>

      <p className="t-meta text-center">
        {sets} × {target}
        {isHold ? 's' : ' reps'} · {totalWork}
        {isHold ? ' seconds' : ' reps'} total
      </p>

      {/* Flagged rather than blocked: the number is the user's to choose, but
          a jump of this size is worth a second look. */}
      {totalWork > 150 && !isHold && (
        <p className="t-meta eb-warn text-center">
          That is a lot in one session. Build up gradually rather than in one jump.
        </p>
      )}

      <div className="flex items-center gap-2.5">
        <button onClick={onCancel} className="btn-quiet flex-1">
          Back
        </button>
        <button
          onClick={() => onStart({ sets, target, restSeconds: rest })}
          className="btn-lg flex-1"
        >
          Start
        </button>
      </div>
    </div>
  );
};
