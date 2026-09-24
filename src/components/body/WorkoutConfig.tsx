import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Exercise } from '../../lib/bodyTraining';
import { NumberStepper } from './NumberStepper';

export interface WorkoutConfigValue {
  sets: number;
  target: number;
  restSeconds: number;
}

interface Props {
  exercise: Exercise;
  initial: WorkoutConfigValue;
  /** The user's best single set, 0 when there is none yet. */
  best?: number;
  onStart: (config: WorkoutConfigValue) => void;
  onCancel: () => void;
}

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
  best = 0,
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

        {/* The number to beat, stated plainly, so the target below has some
            meaning before it is changed. */}
        {best > 0 && (
          <p className="t-meta mt-2 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 shrink-0 eb-warn" />
            <span>
              Your best is{' '}
              <strong style={{ color: 'var(--ink)' }}>
                {best} {isHold ? 'seconds' : 'reps'}
              </strong>{' '}
              in one set.
              {target > best && ' This beats it.'}
            </span>
          </p>
        )}
      </div>

      <div className="panel-sm space-y-3.5">
        <NumberStepper
          label="Sets"
          value={sets}
          unit=""
          min={1}
          max={10}
          step={1}
          onChange={setSets}
        />

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <NumberStepper
          label={isHold ? 'Hold for' : 'Reps per set'}
          value={target}
          unit={isHold ? 's' : ''}
          min={isHold ? 5 : 1}
          max={isHold ? 300 : 100}
          step={isHold ? 5 : 1}
          onChange={setTarget}
        />

        <div className="h-px" style={{ background: 'var(--rule)' }} />

        <NumberStepper
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
