import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Check, Trophy, Activity } from 'lucide-react';
import { Exercise } from '../../lib/bodyTraining';
import { PoseExerciseId, RepEvent } from '../../lib/pose/repEngine';
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
  /** The user's best single set for this exercise, 0 when there is none. */
  best?: number;
  onClose: () => void;
  /** Only fires when every set has genuinely been completed. */
  onComplete: (results: SetResult[]) => void;
  /** Fires the moment a set is finished, so a PR can be shown in real time. */
  onSetComplete?: (result: SetResult) => void;
}

type Phase = 'working' | 'resting' | 'done';

/**
 * Running one exercise for a number of sets.
 *
 * A set cannot be completed below its target, and cannot run past it either:
 * the count locks at the target the instant it is reached, so a 30-rep set
 * always reads 30/30 rather than drifting to 31 on the follow-through. The
 * previous version allowed "Set done" at zero reps, which meant XP could be
 * collected for nothing — the single most damaging thing a training app can
 * get wrong, because every number after it becomes meaningless.
 */
export const ExerciseRunner: React.FC<Props> = ({
  exercise,
  sets,
  target,
  restSeconds,
  best = 0,
  onClose,
  onComplete,
  onSetComplete,
}) => {
  const isHold = exercise.metric === 'hold';

  // Starts working immediately: the configuration screen before this one
  // already served as the ready state.
  const [phase, setPhase] = useState<Phase>('working');
  const [setIndex, setSetIndex] = useState(0);
  const [results, setResults] = useState<SetResult[]>([]);
  const [value, setValue] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [manual, setManual] = useState(false);
  /** The last verdict from the camera, shown as a small live status. */
  const [feedback, setFeedback] = useState<RepEvent | null>(null);
  /** Bumps the counter once per accepted rep. */
  const [bump, setBump] = useState(0);

  /** Reps counted by the camera, so manual taps can be added on top. */
  const cameraBase = useRef(0);
  const manualExtra = useRef(0);
  /**
   * Guards the automatic finish.
   *
   * Reaching the target fires from a render, and without this a second frame
   * arriving before the state settles would complete the same set twice.
   */
  const finishing = useRef(false);
  const finishTimer = useRef<number | null>(null);
  const verdictTimer = useRef<number | null>(null);

  /** Never above the target, never below zero. */
  const clamp = (n: number) => Math.max(0, Math.min(target, n));

  /** Hold exercises count seconds. */
  useEffect(() => {
    if (phase !== 'working' || !isHold) return;

    const id = window.setInterval(() => {
      setValue((v) => Math.min(target, v + 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase, isHold, target]);

  /**
   * The target is the finish line, for reps and holds alike.
   *
   * One place decides it, so the camera, the manual buttons and the hold
   * timer cannot disagree about when a set is over.
   */
  useEffect(() => {
    if (phase !== 'working' || value < target || finishing.current) return;

    finishing.current = true;
    soundFx.playSuccess();

    // A short beat so the completed number is actually seen at 30/30 before
    // the screen moves on.
    //
    // Deliberately NOT cancelled by this effect's cleanup: any re-render
    // while the count sits at the target would clear the pending timer, and
    // the guard above would then refuse to schedule a new one — leaving the
    // set stuck at 30/30 forever. It is cleared on unmount instead.
    finishTimer.current = window.setTimeout(() => completeSet(target), 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, target, phase]);

  /** Leaving mid-set must not fire a completion afterwards. */
  useEffect(
    () => () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
    },
    []
  );

  /** Rest countdown. */
  useEffect(() => {
    if (phase !== 'resting') return;

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
  }, [phase]);

  const completeSet = (achieved: number) => {
    const result = { value: achieved, target };
    const next = [...results, result];

    setResults(next);
    setValue(0);
    setFeedback(null);
    cameraBase.current = 0;
    manualExtra.current = 0;
    finishing.current = false;
    finishTimer.current = null;

    // Reported immediately, so a personal record is celebrated as it happens
    // rather than after the whole exercise is finished.
    onSetComplete?.(result);

    if (next.length >= sets) {
      setPhase('done');
      return;
    }

    setSetIndex((i) => i + 1);
    setRestLeft(restSeconds);
    setPhase('resting');
  };

  const targetReached = value >= target;
  const progress = Math.min(1, value / Math.max(1, target));
  /** Sets banked, plus how far through the current one. */
  const sessionProgress = Math.min(1, (results.length + progress) / Math.max(1, sets));
  /** This set has already beaten the previous best for the exercise. */
  const onPrPace = best > 0 && value > best;
  const unit = isHold ? 's' : 'reps';

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="p-3 border-b border-[var(--rule)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Sets already finished are real work and are saved, not
              // thrown away — otherwise a record set in set one would be
              // celebrated and then vanish on the next reload.
              if (results.length > 0) onComplete(results);
              else onClose();
            }}
            aria-label="Stop workout"
            className="icon-btn shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="t-section truncate">{exercise.name}</p>
            {best > 0 && (
              <p className="t-meta mt-0.5 flex items-center gap-1">
                <Trophy className="w-3 h-3 shrink-0 eb-warn" />
                Best: {best} {unit}
              </p>
            )}
          </div>

          <span className="t-meta shrink-0 tabular-nums">
            Set {Math.min(setIndex + 1, sets)} / {sets}
          </span>
        </div>

        {/* Session progress across every set, not just this one. */}
        <div
          className="h-1 rounded-full overflow-hidden mt-2.5"
          style={{ background: 'var(--surface-sunk)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${sessionProgress * 100}%`,
              background: 'color-mix(in oklab, var(--signal) 70%, var(--ink))',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* The camera lives outside the phase switch and is only hidden
            between sets. Unmounting it dropped the stream and the model, so
            every set after the first asked for the camera again and reloaded
            several megabytes of pose model to show the same thing. */}
        {!isHold && !manual && phase !== 'done' && (
          <div
            className="max-w-md mx-auto"
            style={{ display: phase === 'working' ? 'block' : 'none' }}
          >
            <CameraView
              exercise={exercise.id as PoseExerciseId}
              target={target}
              active={phase === 'working'}
              resetKey={results.length}
              onRep={(count) => {
                cameraBase.current = count;
                setValue(clamp(count + manualExtra.current));
                setBump((n) => n + 1);
              }}
              onFeedback={(event) => {
                setFeedback(event);
                // Cleared on a timer so the strip shows the last movement
                // rather than lingering as a permanent label.
                if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
                verdictTimer.current = window.setTimeout(() => setFeedback(null), 2200);
              }}
              onManualMode={() => setManual(true)}
            />
          </div>
        )}

        {phase === 'working' && (
          <div className="max-w-md mx-auto">
            {/* The live verdict, repeated below the frame so it is readable
                without watching the preview. Only ever real engine output,
                and it clears itself rather than sitting there stale. */}
            {!isHold && !manual && feedback && (
              <div
                key={`${feedback.kind}-${feedback.count}-${feedback.reason ?? ''}`}
                className="rep-verdict"
                data-tone={feedback.kind === 'rep' ? 'good' : 'bad'}
              >
                {feedback.kind === 'rep' ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <Activity className="w-4 h-4 shrink-0" />
                )}
                {feedback.kind === 'rep'
                  ? 'Good rep'
                  : feedback.reason || 'That one did not count'}
              </div>
            )}

            <div className="text-center mt-5">
              <p
                key={bump}
                className={`t-figure ${bump > 0 ? 'rep-bump' : ''}`}
                style={{
                  fontSize: 68,
                  lineHeight: 1,
                  color: targetReached ? 'var(--done)' : undefined,
                }}
              >
                {isHold ? Math.max(0, target - value) : value}
              </p>
              <p className="t-meta mt-2">
                {isHold ? 'seconds left' : `of ${target} reps`}
              </p>

              {onPrPace && !isHold && (
                <span
                  className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-lg text-[12px] font-bold"
                  style={{
                    background: 'color-mix(in oklab, var(--warn) 16%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--warn) 40%, var(--rule))',
                    color: 'var(--warn)',
                  }}
                >
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  Personal record pace
                </span>
              )}
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
                    soundFx.playClick();
                    manualExtra.current = Math.max(
                      -cameraBase.current,
                      manualExtra.current - 1
                    );
                    setValue(clamp(cameraBase.current + manualExtra.current));
                  }}
                  disabled={value <= 0}
                  aria-label="One fewer"
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--rule)',
                    opacity: value <= 0 ? 0.4 : 1,
                  }}
                >
                  <Minus className="w-5 h-5 shrink-0" />
                </button>

                <button
                  onClick={() => {
                    soundFx.playClick();
                    manualExtra.current += 1;
                    setValue(clamp(cameraBase.current + manualExtra.current));
                    setBump((n) => n + 1);
                  }}
                  disabled={targetReached}
                  className="flex-1 h-14 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                  style={{
                    background: 'color-mix(in oklab, var(--signal) 20%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                    color: 'var(--signal-ink)',
                    opacity: targetReached ? 0.4 : 1,
                  }}
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  Count one
                </button>
              </div>
            )}

            <p className="t-meta text-center mt-4">
              {targetReached
                ? 'Set complete'
                : `${Math.max(0, target - value)} ${unit} to go`}
            </p>
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
