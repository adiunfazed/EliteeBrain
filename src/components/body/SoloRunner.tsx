import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Camera, Check, Timer, Trophy, X } from 'lucide-react';
import { PoseExerciseId, RepEvent } from '../../lib/pose/repEngine';
import { TemplateItem } from '../../lib/workoutTemplates';
import { CameraView } from './CameraView';
import { RestRing } from './RestRing';
import { LoggedSet, SetLogger } from './SetLogger';
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

/** The movements the rep engine can actually judge. */
const TRACKED = new Set<PoseExerciseId>([
  'pushups',
  'squats',
  'lunges',
  'glute-bridge',
  'calf-raises',
]);

/**
 * One exercise from Quick start.
 *
 * Two modes, kept completely apart because they are two different ways of
 * training and mixing them made both worse:
 *
 *   By hand — the set list, with a row per set and a tick. Bigger rows than
 *   the workout builder's, and no weight column, because this is bodyweight
 *   work and a kilogram cell on every row is just something to skip past.
 *
 *   With the camera — no list, no buttons, nothing to press. The preview and
 *   one enormous number, because the phone is on the floor three feet away
 *   and the only question is how many. The set logs itself at the target and
 *   the rest timer takes over.
 */
export const SoloRunner: React.FC<Props> = ({
  item,
  best = 0,
  onClose,
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

  const [rows, setRows] = useState<LoggedSet[]>(() =>
    item.plan.map((set) => ({ weight: 0, reps: isHold ? 0 : set.reps, done: false }))
  );
  const [cameraMode, setCameraMode] = useState(false);
  const [rest, setRest] = useState<{ afterIndex: number; left: number; total: number } | null>(
    null
  );
  const [timerRunning, setTimerRunning] = useState(false);
  const [feedback, setFeedback] = useState<RepEvent | null>(null);
  /** Live reps from the camera for the set in progress. */
  const [cameraReps, setCameraReps] = useState(0);

  const planned = useRef(item.plan.map((s) => s.reps));
  const verdictTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  /** Stops a camera set being logged twice as frames keep arriving. */
  const logging = useRef(false);

  const activeIndex = rows.findIndex((r) => !r.done);
  const done = activeIndex < 0;
  const goal = planned.current[activeIndex] ?? item.target;
  const loggedCount = rows.filter((r) => r.done).length;

  useEffect(
    () => () => {
      if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
    },
    []
  );

  /** Rest counts down, in both modes. */
  useEffect(() => {
    if (!rest) return;
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
   * The number recorded is whatever the row holds — the plan if it was hit,
   * the real figure if the set fell short or went over. The plan is an
   * intention; only the log gets to claim what happened.
   */
  const logSet = (index: number, value?: number) => {
    const row = rows[index];
    const reps = value ?? row?.reps ?? 0;
    if (!row || row.done || reps <= 0) return;

    const next = rows.map((r, i) => (i === index ? { ...r, reps, done: true } : r));
    setRows(next);
    setTimerRunning(false);
    setCameraReps(0);
    setFeedback(null);
    soundFx.playSuccess();

    onSetComplete?.({ value: reps, target: planned.current[index] ?? reps, weight: 0 });

    const more = next.some((r) => !r.done);
    if (more && item.restSeconds > 0) {
      setRest({ afterIndex: index, left: item.restSeconds, total: item.restSeconds });
    } else {
      setRest(null);
    }
  };

  /** A hold that reaches its planned seconds logs itself. */
  useEffect(() => {
    if (!isHold || !timerRunning || activeIndex < 0) return;
    if (goal > 0 && (rows[activeIndex]?.reps || 0) >= goal) {
      setTimerRunning(false);
      logSet(activeIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, timerRunning, activeIndex, isHold]);

  /**
   * The camera reached the target.
   *
   * Logged after a short beat so the finished number is actually seen at
   * 25/25 before the screen becomes a rest timer.
   */
  useEffect(() => {
    if (!cameraMode || activeIndex < 0 || logging.current) return;
    if (goal <= 0 || cameraReps < goal) return;

    logging.current = true;
    finishTimer.current = window.setTimeout(() => {
      logging.current = false;
      logSet(activeIndex, goal);
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReps, goal, cameraMode, activeIndex]);

  const addSet = () => {
    const last = rows[rows.length - 1];
    planned.current = [...planned.current, last?.reps || goal];
    setRows((current) => [...current, { weight: 0, reps: last?.reps || goal, done: false }]);
  };

  const results = (): SetResult[] =>
    rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.done && row.reps > 0)
      .map(({ row, index }) => ({
        value: row.reps,
        target: planned.current[index] ?? row.reps,
        weight: 0,
      }));

  const finish = () => (loggedCount > 0 ? onComplete(results()) : onClose());
  const unitFor = (n: number) => (isHold ? 's' : n === 1 ? 'rep' : 'reps');

  /* ---------------- camera mode ---------------- */

  if (cameraMode && poseId && !isHold) {
    const resting = !!rest;

    return (
      <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
        <div className="run-top">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundFx.playClick();
                setCameraMode(false);
              }}
              aria-label="Turn the camera off"
              className="icon-btn shrink-0"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="t-section truncate">{item.name}</p>
              <p className="t-meta mt-0.5 tabular-nums">
                Set {Math.min(loggedCount + 1, rows.length)} of {rows.length} · target {goal}
              </p>
            </div>

            {loggedCount > 0 && (
              <button onClick={finish} className="wk-start shrink-0">
                Finish
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto">
            {/* Nothing to press. The camera counts, the number grows, the set
                ends itself — the phone is on the floor and the user's hands
                are on the floor with it. */}
            {!done && !resting && (
              <>
                <CameraView
                  exercise={poseId}
                  target={goal}
                  active
                  resetKey={activeIndex}
                  onRep={(count) => setCameraReps(count)}
                  onFeedback={(event) => {
                    setFeedback(event);
                    if (verdictTimer.current) window.clearTimeout(verdictTimer.current);
                    verdictTimer.current = window.setTimeout(() => setFeedback(null), 2000);
                  }}
                  onManualMode={() => setCameraMode(false)}
                />

                <p className="cam-count tabular-nums" data-full={cameraReps >= goal}>
                  {cameraReps}
                </p>
                <p className="t-meta text-center">of {goal} {unitFor(goal)}</p>

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
              </>
            )}

            {resting && (
              <div className="text-center pt-6">
                <div className="flex justify-center">
                  <RestRing left={rest!.left} total={rest!.total} size={168} />
                </div>
                <p className="t-sub mt-4">
                  Rest · set {loggedCount + 1} of {rows.length} next
                </p>

                <div className="rest-presets mt-6">
                  {[60, 90, 120].map((seconds) => (
                    <button
                      key={seconds}
                      onClick={() => {
                        soundFx.playClick();
                        setRest({ ...rest!, left: seconds, total: seconds });
                      }}
                      data-active={rest!.total === seconds ? 'true' : 'false'}
                      className="rest-preset"
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>

                <button onClick={() => setRest(null)} className="btn-lg w-full mt-3">
                  Start set {loggedCount + 1}
                </button>
              </div>
            )}

            {done && (
              <div className="text-center pt-10">
                <span className="done-mark mx-auto">
                  <Check className="w-8 h-8 shrink-0" />
                </span>
                <p className="t-title mt-4">{item.name} done</p>
                <p className="t-sub mt-2">
                  {loggedCount} {loggedCount === 1 ? 'set' : 'sets'} ·{' '}
                  {rows.reduce((n, r) => n + (r.done ? r.reps : 0), 0)} reps total
                </p>
                <button onClick={finish} className="btn-lg w-full mt-8">
                  Finish
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- by hand ---------------- */

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="run-top">
        <div className="flex items-center gap-3">
          <button onClick={finish} aria-label="Stop workout" className="icon-btn shrink-0">
            <X className="w-4 h-4 shrink-0" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="t-section truncate">{item.name}</p>
            <p className="t-meta mt-0.5 flex items-center gap-2 flex-wrap dot-meta">
              <span className="tabular-nums">
                {loggedCount}/{rows.length} sets
              </span>
              {best > 0 && (
                <span className="inline-flex items-center gap-1 eb-warn">
                  <Trophy className="w-3 h-3 shrink-0" />
                  {best} {unitFor(best)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="run-bar">
          <div
            className="run-bar-fill"
            style={{
              width: `${(loggedCount / Math.max(1, rows.length)) * 100}%`,
              background: 'color-mix(in oklab, var(--signal) 70%, var(--ink))',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* The camera is the first thing on the screen, as it was, and it
              takes over completely when chosen. */}
          {poseId && !isHold && (
            <button
              onClick={() => {
                soundFx.playClick();
                setCameraMode(true);
              }}
              className="cam-open"
            >
              <Camera className="w-4 h-4 shrink-0" />
              Count reps with camera
            </button>
          )}

          {isHold && (
            <p className="t-meta text-center flex items-center justify-center gap-1.5">
              <Timer className="w-3.5 h-3.5 shrink-0" />
              Start the timer on the set you are holding.
            </p>
          )}

          <SetLogger
            metric={item.metric}
            rows={rows}
            mode="log"
            size="lg"
            showWeight={false}
            activeIndex={activeIndex}
            goals={planned.current}
            rest={rest}
            timerRunning={timerRunning}
            onChange={patchRow}
            onToggleDone={(index) =>
              rows[index].done
                ? patchRow(index, { done: false })
                : logSet(index)
            }
            onToggleTimer={() => setTimerRunning((t) => !t)}
            onAdd={addSet}
            onSkipRest={() => setRest(null)}
            onSetRest={(seconds) =>
              setRest((current) => (current ? { ...current, left: seconds, total: seconds } : current))
            }
          />

          {done && (
            <div className="text-center pt-2">
              <span className="done-mark mx-auto">
                <Check className="w-8 h-8 shrink-0" />
              </span>
              <p className="t-title mt-3">{item.name} done</p>
            </div>
          )}

          {loggedCount > 0 && (
            <button onClick={finish} className="btn-lg w-full">
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
