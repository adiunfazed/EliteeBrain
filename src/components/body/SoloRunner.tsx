import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Check,
  Minus,
  Pause,
  Play,
  Plus,
  Trophy,
  X,
} from 'lucide-react';
import { PoseExerciseId, RepEvent } from '../../lib/pose/repEngine';
import { TemplateItem } from '../../lib/workoutTemplates';
import { CameraView } from './CameraView';
import { RestRing } from './RestRing';
import { SetResult } from './SessionScreen';
import { soundFx } from '../../utils/audio';

interface Props {
  /** One exercise, run set by set. */
  item: TemplateItem;
  /** The user's best single set for this exercise, 0 when there is none. */
  best?: number;
  onClose: () => void;
  /** Every set that was finished. */
  onComplete: (results: SetResult[]) => void;
  /** Fires the moment a set ends, so a record can be shown in real time. */
  onSetComplete?: (result: SetResult) => void;
}

type Phase = 'working' | 'resting' | 'done';

/** The movements the rep engine can actually judge. */
const TRACKED = new Set<PoseExerciseId>([
  'pushups',
  'squats',
  'lunges',
  'glute-bridge',
  'calf-raises',
]);

/**
 * One exercise, counted.
 *
 * Deliberately not the set-log table: a bodyweight set from Quick start is
 * counted live — by the camera where it can see the movement, by the big
 * button where it cannot — so the screen is one number, one button and a
 * rest timer. There is no weight column, because there is no weight, and no
 * grid of cells to fill in while doing push-ups.
 *
 * The set table belongs to custom workouts, where the numbers are decided in
 * advance and typed in as they happen. These are two genuinely different jobs
 * and one screen cannot do both without being worse at each.
 */
export const SoloRunner: React.FC<Props> = ({
  item,
  best = 0,
  onClose,
  onComplete,
  onSetComplete,
}) => {
  const isHold = item.metric === 'hold';
  const sets = item.plan.length;
  const target = item.plan[0]?.reps || item.target;
  const restSeconds = item.restSeconds;

  const poseId = useMemo(
    () =>
      TRACKED.has(item.exerciseId as PoseExerciseId)
        ? (item.exerciseId as PoseExerciseId)
        : null,
    [item.exerciseId]
  );

  const [phase, setPhase] = useState<Phase>('working');
  const [setIndex, setSetIndex] = useState(0);
  const [results, setResults] = useState<SetResult[]>([]);
  const [value, setValue] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(restSeconds);
  const [manual, setManual] = useState(false);
  const [paused, setPaused] = useState(false);
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

  const useCamera = !!poseId && !isHold && !manual;

  /** Never above the target, never below zero. */
  const clamp = (n: number) => Math.max(0, Math.min(target, n));

  /** A hold counts seconds, and can be paused mid-hold. */
  useEffect(() => {
    if (phase !== 'working' || !isHold || paused) return;
    const id = window.setInterval(() => setValue((v) => Math.min(target, v + 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase, isHold, target, paused]);

  /**
   * The target is the finish line, for reps and holds alike.
   *
   * One place decides it, so the camera, the manual button and the hold timer
   * cannot disagree about when a set is over.
   */
  useEffect(() => {
    if (phase !== 'working' || value < target || finishing.current) return;

    finishing.current = true;
    soundFx.playSuccess();

    // A short beat so the finished number is actually seen at 30/30 before
    // the screen moves on. Deliberately NOT cleared by this effect's
    // cleanup: a re-render while the count sits at the target would cancel
    // the pending timer and the guard above would refuse to schedule
    // another, leaving the set stuck. It is cleared on unmount instead.
    finishTimer.current = window.setTimeout(() => completeSet(target), 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, target, phase]);

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
    const result: SetResult = { value: achieved, target, weight: 0 };
    const next = [...results, result];

    setResults(next);
    setValue(0);
    setFeedback(null);
    setPaused(false);
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
    setRestTotal(restSeconds || 60);
    setRestLeft(restSeconds);
    setPhase(restSeconds > 0 ? 'resting' : 'working');
  };

  /**
   * Bank a set that fell short of its target.
   *
   * Failing a set is part of training — eight of a planned ten is real work
   * and the honest number to record. It is never counted as completing the
   * set: only sets that met their target count toward XP.
   */
  const bankShortSet = () => {
    if (value <= 0) return;
    soundFx.playClick();
    completeSet(value);
  };

  const targetReached = value >= target;
  const progress = Math.min(1, value / Math.max(1, target));
  const sessionProgress = Math.min(1, (results.length + progress) / Math.max(1, sets));
  const onPrPace = best > 0 && value > best;
  const unitFor = (n: number) => (isHold ? 's' : n === 1 ? 'rep' : 'reps');

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="run-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Sets already finished are real work and are kept, or a record
              // set in set one would be celebrated and then vanish.
              if (results.length > 0) onComplete(results);
              else onClose();
            }}
            aria-label="Stop workout"
            className="icon-btn shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="t-section truncate">{item.name}</p>
            {best > 0 && (
              <p className="t-meta mt-0.5 flex items-center gap-1 eb-warn">
                <Trophy className="w-3 h-3 shrink-0" />
                Best {best} {unitFor(best)}
              </p>
            )}
          </div>

          <span className="t-meta shrink-0 tabular-nums">
            Set {Math.min(setIndex + 1, sets)} / {sets}
          </span>
        </div>

        <div className="run-bar">
          <div
            className="run-bar-fill"
            style={{
              width: `${sessionProgress * 100}%`,
              background: 'color-mix(in oklab, var(--signal) 70%, var(--ink))',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* The camera stays mounted between sets. Unmounting dropped the
            stream and the model, so every set after the first asked for the
            camera again and reloaded several megabytes of pose model. */}
        {useCamera && phase !== 'done' && (
          <div
            className="max-w-md mx-auto"
            style={{ display: phase === 'working' ? 'block' : 'none' }}
          >
            <CameraView
              exercise={poseId as PoseExerciseId}
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
                if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
                verdictTimer.current = window.setTimeout(() => setFeedback(null), 2200);
              }}
              onManualMode={() => setManual(true)}
            />
          </div>
        )}

        {phase === 'working' && (
          <div className={`max-w-md mx-auto ${useCamera ? '' : 'run-stage'}`}>
            {/* The live verdict, repeated below the frame so it is readable
                without watching the preview. Only ever real engine output,
                and it clears itself rather than sitting there stale. */}
            {useCamera && feedback && (
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
                {feedback.kind === 'rep' ? 'Good rep' : feedback.reason || 'That one did not count'}
              </div>
            )}

            <div className="text-center mt-5">
              <p
                key={bump}
                className={`t-figure ${bump > 0 ? 'rep-bump' : ''}`}
                style={{
                  fontSize: 76,
                  lineHeight: 1,
                  color: targetReached ? 'var(--done)' : undefined,
                }}
              >
                {isHold ? Math.max(0, target - value) : value}
              </p>
              <p className="t-meta mt-2">{isHold ? 'seconds left' : `of ${target} reps`}</p>

              <AnimatePresence>
                {onPrPace && !isHold && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="pr-pace"
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    Personal record pace
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <div className="run-progress">
              <div
                className="run-progress-fill"
                style={{
                  width: `${progress * 100}%`,
                  background: targetReached ? 'var(--done)' : 'var(--signal)',
                }}
              />
            </div>

            {!useCamera && <div className="run-fill" />}

            {!isHold && (
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    manualExtra.current = Math.max(-cameraBase.current, manualExtra.current - 1);
                    setValue(clamp(cameraBase.current + manualExtra.current));
                  }}
                  disabled={value <= 0}
                  aria-label="One fewer"
                  className="count-minus"
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
                  className="count-plus"
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  Count one
                </button>
              </div>
            )}

            {isHold && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setPaused((p) => !p);
                }}
                className="btn-quiet w-full mt-6"
              >
                {paused ? (
                  <>
                    <Play className="w-4 h-4 shrink-0" />
                    Resume hold
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 shrink-0" />
                    Pause
                  </>
                )}
              </button>
            )}

            <p className="t-meta text-center mt-4">
              {targetReached
                ? 'Set complete'
                : `${Math.max(0, target - value)} ${unitFor(Math.max(0, target - value))} to go`}
            </p>

            {/* An honest way out of a set that is not going to happen. Only
                offered once something has actually been done. */}
            {value > 0 && !targetReached && (
              <button onClick={bankShortSet} className="btn-text mx-auto mt-2">
                Stop set at {value} {unitFor(value)}
              </button>
            )}
          </div>
        )}

        {phase === 'resting' && (
          <div className="max-w-md mx-auto text-center pt-8">
            <div className="flex justify-center">
              <RestRing left={restLeft} total={restTotal} size={168} />
            </div>

            <p className="t-sub mt-4">
              Rest · set {setIndex + 1} of {sets} next
            </p>

            <div className="rest-presets mt-6">
              {[60, 90, 120].map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => {
                    soundFx.playClick();
                    setRestTotal(seconds);
                    setRestLeft(seconds);
                  }}
                  data-active={restTotal === seconds ? 'true' : 'false'}
                  className="rest-preset"
                >
                  {seconds}s
                </button>
              ))}
            </div>

            <button onClick={() => setPhase('working')} className="btn-lg w-full mt-3">
              Start set {setIndex + 1}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="max-w-md mx-auto text-center pt-10">
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 340, damping: 20 }}
              className="done-mark mx-auto"
            >
              <Check className="w-8 h-8 shrink-0" />
            </motion.span>

            <p className="t-title mt-4">{item.name} done</p>
            <p className="t-sub mt-2">
              {results.length} {results.length === 1 ? 'set' : 'sets'} ·{' '}
              {results.reduce((n, r) => n + r.value, 0)} {isHold ? 'seconds' : 'reps'} total
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
