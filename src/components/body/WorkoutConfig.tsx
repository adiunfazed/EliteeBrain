import React, { useState } from 'react';
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

/** A stepper rather than a free text field: fewer taps, no invalid input. */
const Stepper: React.FC<{
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, unit, min, max, step, onChange }) => (
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
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: 'var(--surface-sunk)',
          border: '1px solid var(--rule)',
          opacity: value <= min ? 0.4 : 1,
        }}
      >
        <Minus className="w-4 h-4 shrink-0" />
      </button>

      <span className="t-figure tabular-nums text-center" style={{ fontSize: 18, minWidth: 54 }}>
        {value}
        <span className="t-meta ml-0.5">{unit}</span>
      </span>

      <button
        onClick={() => {
          soundFx.playClick();
          onChange(Math.min(max, value + step));
        }}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: 'var(--surface-sunk)',
          border: '1px solid var(--rule)',
          opacity: value >= max ? 0.4 : 1,
        }}
      >
        <Plus className="w-4 h-4 shrink-0" />
      </button>
    </div>
  </div>
);

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
