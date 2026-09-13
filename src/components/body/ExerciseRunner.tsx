import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Check, Pause, Play } from 'lucide-react';
import { Exercise } from '../../lib/bodyTraining';
import { PoseExerciseId } from '../../lib/pose/repEngine';
import { CameraView } from './CameraView';
import { soundFx } from '../../utils/audio';

export interface SetResult {
  /** Reps achieved, or seconds held. */
  value: number;
  target: number;
}

interface Props {
  exercise: Exercise;
  sets: number;
  target: number;
  restSeconds: number;
  onClose: () => void;
  /** Only fires when every set has genuinely been completed. */
  onComplete: (results: SetResult[]) => void;
}

type Phase = 'ready' | 'working' | 'resting' | 'done';

/**
 * Running one exercise for a number of sets.
 *
 * A set cannot be completed below its target. The previous version allowed
 * "Set done" at zero reps, which meant XP could be collected for nothing —
 * the single most damaging thing a training app can get wrong, because every
 * number after it becomes meaningless.
 */
export const ExerciseRunner: React.FC<Props> = ({
  exercise,
  sets,
  target,
  restSeconds,
  onClose,
  onComplete,
}) => {
  const isHold = exercise.metric === 'hold';

  const [phase, setPhase] = useState<Phase>('ready');
  const [setIndex, setSetIndex] = useState(0);
  const [results, setResults] = useState<SetResult[]>([]);
  const [value, setValue] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);

  /** Reps counted by the camera, so manual taps can be added on top. */
  const cameraBase = useRef(0);
  const manualExtra = useRef(0);

  /** Hold exercises count seconds. */
  useEffect(() => {
    if (phase !== 'working' || !isHold || paused) return;

    const id = window.setInterval(() => {
      setValue((v) => {
        const next = v + 1;
        if (next >= target) {
          soundFx.playSuccess();
          window.setTimeout(() => completeSet(next), 0);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isHold, paused, target]);

  /** Rest countdown. */
  useEffect(() => {
    if (phase !== 'resting' || paused) return;

    const id = window.setInterval(() => {
      setRestLeft((s) => {
        if (s <= 1) {
          soundFx.playClick();
          setPhase('working');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase, paused]);

  const completeSet = (achieved: number) => {
    const next = [...results, { value: achieved, target }];
    setResults(next);
    setValue(0);
    cameraBase.current = 0;
    manualExtra.current = 0;

    if (next.length >= sets) {
      setPhase('done');
      soundFx.playSuccess();
      return;
    }

    setSetIndex((i) => i + 1);
    setRestLeft(restSeconds);
    setPhase('resting');
  };

  // The gate that makes the numbers mean something.
  const targetReached = value >= target;
  const progress = Math.min(1, value / Math.max(1, target));

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="flex items-center gap-3 p-3 border-b border-[var(--rule)]">
        <button onClick={onClose} aria-label="Stop workout" className="icon-btn shrink-0">
          <X className="w-4 h-4 shrink-0" />
        </button>
        <p className="t-section min-w-0 flex-1 truncate">{exercise.name}</p>
        <span className="t-meta shrink-0 tabular-nums">
          Set {Math.min(setIndex + 1, sets)} / {sets}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {phase === 'ready' && (
          <div className="max-w-md mx-auto text-center">
            <p className="t-sub leading-relaxed">{exercise.how}</p>
            <p className="t-meta mt-3 leading-relaxed">{exercise.cue}</p>

            <p className="t-figure mt-7" style={{ fontSize: 40 }}>
              {sets} × {target}
            </p>
            <p className="t-meta mt-1">
              {isHold ? 'seconds per set' : 'reps per set'} · {restSeconds}s rest
            </p>

            <button onClick={() => setPhase('working')} className="btn-lg w-full mt-7">
              Start
            </button>
            <button onClick={onClose} className="btn-text mt-3">
              Not now
            </button>
          </div>
        )}

        {phase === 'working' && (
          <div className="max-w-md mx-auto">
            {/* Camera, unless the user chose manual or it failed. */}
            {!isHold && !manual && (
              <CameraView
                exercise={exercise.id as PoseExerciseId}
                onRep={(count) => {
                  cameraBase.current = count;
                  setValue(count + manualExtra.current);
                }}
                onManualMode={() => setManual(true)}
              />
            )}

            <div className="text-center mt-5">
              <p className="t-figure" style={{ fontSize: 68, lineHeight: 1 }}>
                {isHold ? Math.max(0, target - value) : value}
              </p>
              <p className="t-meta mt-2">
                {isHold ? 'seconds left' : `of ${target} reps`}
              </p>
            </div>

            <div
              className="h-2 rounded-full overflow-hidden mt-4"
              style={{ background: 'var(--surface-sunk)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${progress * 100}%`,
                  background: targetReached ? 'var(--done)' : 'var(--signal)',
                }}
              />
            </div>

            {!isHold && (
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    manualExtra.current = Math.max(
                      -cameraBase.current,
                      manualExtra.current - 1
                    );
                    setValue(Math.max(0, cameraBase.current + manualExtra.current));
                  }}
                  aria-label="One fewer"
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
                >
                  <Minus className="w-5 h-5 shrink-0" />
                </button>

                <button
                  onClick={() => {
                    soundFx.playClick();
                    manualExtra.current += 1;
                    setValue(cameraBase.current + manualExtra.current);
                  }}
                  className="flex-1 h-14 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: 'color-mix(in oklab, var(--signal) 20%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                    color: 'var(--signal-ink)',
                  }}
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  Count one
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setPaused((p) => !p)}
                className="btn-quiet shrink-0"
                aria-label={paused ? 'Resume' : 'Pause'}
              >
                {paused ? (
                  <Play className="w-4 h-4 shrink-0" />
                ) : (
                  <Pause className="w-4 h-4 shrink-0" />
                )}
              </button>

              {/* Disabled until the target is genuinely met. */}
              <button
                onClick={() => completeSet(value)}
                disabled={!targetReached}
                className="btn-lg flex-1"
                style={!targetReached ? { opacity: 0.4 } : undefined}
              >
                <Check className="w-4 h-4 shrink-0 inline mr-1.5" />
                {targetReached ? 'Set done' : `${Math.max(0, target - value)} to go`}
              </button>
            </div>
          </div>
        )}

        {phase === 'resting' && (
          <div className="max-w-md mx-auto text-center pt-10">
            <p className="t-meta">Rest</p>
            <p className="t-figure mt-2" style={{ fontSize: 68, lineHeight: 1 }}>
              {restLeft}
            </p>
            <p className="t-meta mt-2">
              seconds · set {setIndex + 1} of {sets} next
            </p>

            <button onClick={() => setPhase('working')} className="btn-quiet w-full mt-8">
              Skip rest
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="max-w-md mx-auto text-center pt-10">
            <Check className="w-12 h-12 shrink-0 mx-auto" style={{ color: 'var(--done)' }} />
            <p className="t-title mt-4">Exercise complete</p>
            <p className="t-sub mt-2">
              {results.length} sets · {results.reduce((n, r) => n + r.value, 0)}{' '}
              {isHold ? 'seconds' : 'reps'} total
            </p>

            <button onClick={() => onComplete(results)} className="btn-lg w-full mt-8">
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
