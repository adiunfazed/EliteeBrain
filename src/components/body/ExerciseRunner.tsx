import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, Camera, Check, SkipForward, Trophy, X } from 'lucide-react';
import { PoseExerciseId, RepEvent } from '../../lib/pose/repEngine';
import { TemplateItem } from '../../lib/workoutTemplates';
import { RecordView, recordLabel } from '../../lib/personalRecords';
import { CameraView } from './CameraView';
import { LoggedSet, SetLogger } from './SetLogger';
import { soundFx } from '../../utils/audio';

export interface SetResult {
  /** Reps achieved, or seconds held. */
  value: number;
  /** What the set was planned as. */
  target: number;
  /** Kilograms. 0 means bodyweight. */
  weight: number;
}

interface Props {
  /** The exercise being run, with its own planned sets. */
  item: TemplateItem;
  /** Where this sits in the session: {index: 0, total: 4} is "1 of 4". */
  position?: { index: number; total: number };
  /** The exercise after this one, named so the user can pace themselves. */
  nextName?: string | null;
  /** The bests this exercise held when the session started. */
  best?: RecordView;
  /** True while a set's numbers would beat one of those bests. */
  isRecord?: (set: { weight: number; reps: number }) => boolean;
  /** Ends the whole session, keeping everything already finished. */
  onAbort: () => void;
  /** This exercise is finished (or skipped) — the parent moves on. */
  onComplete: (results: SetResult[]) => void;
  /** Fires the moment a set is logged, so a record can be shown in real time. */
  onSetComplete?: (result: SetResult) => void;
}

/** The movements the rep engine can actually judge. Nothing else is guessed. */
const TRACKED = new Set<PoseExerciseId>([
  'pushups',
  'squats',
  'lunges',
  'glute-bridge',
  'calf-raises',
]);

/**
 * Running one exercise.
 *
 * The screen is the set log: a row per set with its weight, its reps and a
 * tick. Everything writes into that one table — typed by hand for a barbell
 * lift, counted by the camera for the movements the rep engine understands,
 * timed by the stopwatch for a hold — so there is one place to look for what
 * has been done and one place to correct it.
 *
 * Rest runs as a strip under the set it follows rather than a screen of its
 * own, because the next set's numbers are exactly what someone wants to see
 * and adjust while they are resting.
 */
export const ExerciseRunner: React.FC<Props> = ({
  item,
  position,
  nextName,
  best,
  isRecord,
  onAbort,
  onComplete,
  onSetComplete,
}) => {
  const isHold = item.metric === 'hold';

  const poseId = useMemo(
    () =>
      TRACKED.has(item.exerciseId as PoseExerciseId)
        ? (item.exerciseId as PoseExerciseId)
        : null,
    [item.exerciseId]
  );

  /**
   * The rows start pre-filled with the plan, so a set that went exactly as
   * written is one tap — which is the common case for a barbell lift.
   *
   * The exceptions are the rows something else fills: a hold counts up from
   * zero to its goal, and a camera-counted set starts at zero and is filled
   * rep by rep. Pre-filling those would show work as done before any of it
   * had happened, and a hold would be over the instant the timer started.
   */
  const [rows, setRows] = useState<LoggedSet[]>(() => {
    const filledByApp =
      item.metric === 'hold' || TRACKED.has(item.exerciseId as PoseExerciseId);
    return item.plan.map((set) => ({
      weight: set.weight,
      reps: filledByApp ? 0 : set.reps,
      done: false,
    }));
  });
  const [finished, setFinished] = useState(false);
  const [manual, setManual] = useState(false);
  const [rest, setRest] = useState<{ afterIndex: number; left: number } | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  /** The last verdict from the camera, shown as a small live status. */
  const [feedback, setFeedback] = useState<RepEvent | null>(null);

  /** What each set was planned as, so a short set can still be spotted. */
  const planned = useRef(item.plan.map((s) => s.reps));
  const verdictTimer = useRef<number | null>(null);

  const activeIndex = rows.findIndex((r) => !r.done);
  const active = activeIndex >= 0 ? rows[activeIndex] : null;

  // The camera is only offered for movements the engine understands, and only
  // for rep work: a weighted barbell lift is typed in, because a camera that
  // does not understand the movement would either count nothing or count
  // wrongly, and a wrong rep count poisons every number downstream of it.
  const useCamera = !!poseId && !isHold && !manual && activeIndex >= 0;

  useEffect(
    () => () => {
      if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
    },
    []
  );

  /** Rest counts down under the set it follows. */
  useEffect(() => {
    if (!rest || rest.left <= 0) return;

    const id = window.setInterval(() => {
      setRest((current) => {
        if (!current) return null;
        if (current.left <= 1) {
          soundFx.playClick();
          return null;
        }
        return { ...current, left: current.left - 1 };
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [rest]);

  /** A hold counts seconds into its own row. */
  useEffect(() => {
    if (!timerRunning || activeIndex < 0) return;

    const id = window.setInterval(() => {
      setRows((current) =>
        current.map((row, i) => (i === activeIndex ? { ...row, reps: row.reps + 1 } : row))
      );
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning, activeIndex]);

  const patchRow = (index: number, patch: Partial<LoggedSet>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /**
   * Log one set.
   *
   * The number recorded is whatever is in the row — the planned figure if it
   * was hit, the real one if the set fell short or went over. A set is never
   * rewritten to match the plan: the plan is an intention, the log is a
   * record, and only the log is allowed to claim what happened.
   */
  const logSet = (index: number) => {
    const row = rows[index];
    if (!row || row.reps <= 0 || row.done) return;

    const next = rows.map((r, i) => (i === index ? { ...r, done: true } : r));
    setRows(next);
    setTimerRunning(false);
    setFeedback(null);
    soundFx.playSuccess();

    onSetComplete?.({
      value: row.reps,
      target: planned.current[index] ?? row.reps,
      weight: row.weight,
    });

    const more = next.some((r) => !r.done);
    if (more && item.restSeconds > 0) setRest({ afterIndex: index, left: item.restSeconds });
    else setRest(null);

    if (!more) setFinished(true);
  };

  /** A hold that reaches its planned seconds logs itself. */
  useEffect(() => {
    if (!isHold || !timerRunning || activeIndex < 0) return;
    const goal = planned.current[activeIndex] || 0;
    if (goal > 0 && (rows[activeIndex]?.reps || 0) >= goal) {
      setTimerRunning(false);
      logSet(activeIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, timerRunning, activeIndex, isHold]);

  const undoSet = (index: number) => {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, done: false } : r)));
    setFinished(false);
  };

  const addSet = () => {
    // A new set copies the last one, which is what a fourth set almost always
    // is. Its planned figure grows with it, so a short set can still be told
    // apart from a completed one.
    const last = rows[rows.length - 1];
    planned.current = [...planned.current, last?.reps || 0];
    setRows((current) => [
      ...current,
      { weight: last?.weight || 0, reps: last?.reps || 0, done: false },
    ]);
    setFinished(false);
  };

  /** Everything ticked, in the order it was done. */
  const results = (): SetResult[] =>
    rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.done && row.reps > 0)
      .map(({ row, index }) => ({
        value: row.reps,
        target: planned.current[index] ?? row.reps,
        weight: row.weight,
      }));

  const loggedCount = rows.filter((r) => r.done).length;
  const progress = Math.min(1, loggedCount / Math.max(1, rows.length));
  const multi = (position?.total || 1) > 1;
  const bestLabel = recordLabel(best, item.metric);

  const prRows = rows.map((row) =>
    isRecord ? isRecord({ weight: row.weight, reps: row.reps }) : false
  );

  const finishButton = (
    <button onClick={() => onComplete(results())} className="btn-lg w-full">
      {nextName ? (
        <>
          Next: {nextName}
          <ArrowRight className="w-4 h-4 shrink-0" />
        </>
      ) : (
        'Finish workout'
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="run-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Sets already logged are real work: they are handed back, not
              // thrown away, or a record set in set one would be celebrated
              // and then vanish on the next reload.
              if (loggedCount > 0) onComplete(results());
              else onAbort();
            }}
            aria-label="End workout"
            className="icon-btn shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="t-section truncate">{item.name}</p>
            <p className="t-meta mt-0.5 flex items-center gap-2 flex-wrap dot-meta">
              {multi && position && (
                <span className="tabular-nums">
                  Exercise {position.index + 1}/{position.total}
                </span>
              )}
              <span className="tabular-nums">
                {loggedCount}/{rows.length} sets
              </span>
              {bestLabel && (
                <span className="inline-flex items-center gap-1 eb-warn">
                  <Trophy className="w-3 h-3 shrink-0" />
                  {bestLabel}
                </span>
              )}
            </p>
          </div>

          {!finished && (
            <button
              onClick={() => {
                soundFx.playClick();
                onComplete(results());
              }}
              className="btn-text shrink-0"
              aria-label={loggedCount > 0 ? 'Finish this exercise' : 'Skip this exercise'}
            >
              <SkipForward className="w-3.5 h-3.5 shrink-0" />
              {loggedCount > 0 ? 'Done' : 'Skip'}
            </button>
          )}
        </div>

        <div className="run-bar">
          <div
            className="run-bar-fill"
            style={{
              width: `${progress * 100}%`,
              background: 'color-mix(in oklab, var(--signal) 70%, var(--ink))',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-3">
          {finished && (
            <div className="text-center pt-2 pb-1">
              <motion.span
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 20 }}
                className="done-mark mx-auto"
              >
                <Check className="w-8 h-8 shrink-0" />
              </motion.span>

              <p className="t-title mt-3">{item.name} done</p>
              <p className="t-sub mt-1">
                {loggedCount} {loggedCount === 1 ? 'set' : 'sets'} ·{' '}
                {rows.filter((r) => r.done).reduce((n, r) => n + r.reps, 0)}{' '}
                {isHold ? 'seconds' : 'reps'} total
              </p>
            </div>
          )}

          {/* The camera sits above the log and fills the active row. It stays
              mounted between sets: unmounting dropped the stream and the
              model, so every set after the first asked for the camera again
              and reloaded several megabytes of pose model. */}
          {useCamera && (
            <div>
              <CameraView
                exercise={poseId as PoseExerciseId}
                target={planned.current[activeIndex] || 0}
                active={!rest}
                resetKey={activeIndex}
                onRep={(count) => patchRow(activeIndex, { reps: count })}
                onFeedback={(event) => {
                  setFeedback(event);
                  // Cleared on a timer so the strip shows the last movement
                  // rather than lingering as a permanent label.
                  if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
                  verdictTimer.current = window.setTimeout(() => setFeedback(null), 2200);
                }}
                onManualMode={() => setManual(true)}
              />

              {feedback && (
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
            </div>
          )}

          <SetLogger
            metric={item.metric}
            rows={rows}
            mode="log"
            activeIndex={activeIndex}
            prRows={prRows}
            goals={planned.current}
            rest={rest}
            timerRunning={timerRunning}
            onChange={patchRow}
            onToggleDone={(index) => (rows[index].done ? undoSet(index) : logSet(index))}
            onToggleTimer={() => setTimerRunning((t) => !t)}
            onAdd={addSet}
            onSkipRest={() => setRest(null)}
          />

          {active && !finished && (
            <p className="t-meta text-center">
              {isHold
                ? timerRunning
                  ? 'Holding — the timer is filling the row.'
                  : `Set ${activeIndex + 1}: start the timer, or type the seconds you held.`
                : useCamera
                  ? `Set ${activeIndex + 1}: the camera fills the reps. Correct it if it misses one.`
                  : `Set ${activeIndex + 1}: type the weight and reps, then tick it off.`}
            </p>
          )}

          {!isHold && poseId && manual && (
            <p className="t-meta text-center">Camera off. Type the reps as you go.</p>
          )}

          {/* Said once, on the first set, and then never again: after that it
              is just a line of text between the user and the tick. */}
          {!poseId && !isHold && !finished && loggedCount === 0 && (
            <p className="t-meta text-center flex items-center justify-center gap-1.5">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              Counted by hand — the camera only judges the moves it was built for.
            </p>
          )}

          {(loggedCount > 0 || finished) && <div className="pt-1">{finishButton}</div>}
        </div>
      </div>
    </div>
  );
};
