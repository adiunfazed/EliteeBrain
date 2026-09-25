import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Trophy, X } from 'lucide-react';
import { TemplateItem } from '../../lib/workoutTemplates';
import { RecordViews, recordLabel } from '../../lib/personalRecords';
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
  title: string;
  items: TemplateItem[];
  /** The bests each exercise held when the session started. */
  records?: RecordViews;
  /** True while a set's numbers would beat one of those bests. */
  isRecord?: (exerciseId: string, set: { weight: number; reps: number }) => boolean;
  /** Fires the moment a set is logged, so a record can be shown in real time. */
  onSetComplete?: (item: TemplateItem, result: SetResult) => void;
  /** The session is over. One array of results per exercise, in order. */
  onFinish: (results: SetResult[][]) => void;
  /** Nothing was done at all — nothing to file. */
  onAbort: () => void;
}

/**
 * A workout in progress: every exercise on one screen.
 *
 * Not a queue. A gym session is not linear — a squat rack is busy, a bench is
 * free, someone does their accessory work between heavy sets — so every
 * exercise is open at once and any set of any exercise can be ticked off in
 * any order. The screen is a list of set tables, which is exactly what a
 * training notebook is.
 *
 * Rest and the hold timer belong to one exercise at a time, which the state
 * below enforces rather than hopes for. Camera rep counting is not offered
 * here at all: a custom workout is barbell work typed in set by set, and a
 * camera that has to be aimed at yourself between sets is in the way. It
 * lives in Quick start, on the single exercise it was built for.
 */
export const SessionScreen: React.FC<Props> = ({
  title,
  items,
  records = {},
  isRecord,
  onSetComplete,
  onFinish,
  onAbort,
}) => {
  /** One set of rows per exercise, keyed by its position in the workout. */
  const [rows, setRows] = useState<LoggedSet[][]>(() =>
    items.map((item) => {
      // Rows start pre-filled with the plan, so a set that went exactly as
      // written is one tap. The exceptions are rows something else fills: a
      // hold counts up from zero, and a camera-counted set is filled rep by
      // rep — pre-filling those would show work as done before it happened.
      // A hold counts up from zero to its goal; everything else starts
      // pre-filled with the plan, so a set that went as written is one tap.
      return item.plan.map((set) => ({
        weight: set.weight,
        reps: item.metric === 'hold' ? 0 : set.reps,
        done: false,
      }));
    })
  );

  /** What each set was planned as, so a short set can still be spotted. */
  const planned = useRef(items.map((item) => item.plan.map((s) => s.reps)));

  const [rest, setRest] = useState<{
    exercise: number;
    afterIndex: number;
    left: number;
    total: number;
  } | null>(null);
  /** The exercise whose hold timer is running, if any. */
  const [timerOn, setTimerOn] = useState<number | null>(null);
  /** Rest counts down under the set it follows. */
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

  const activeIndexOf = (exercise: number) => rows[exercise].findIndex((r) => !r.done);

  /** A hold counts seconds into its own row. */
  useEffect(() => {
    if (timerOn === null) return;
    const id = window.setInterval(() => {
      setRows((current) =>
        current.map((list, e) => {
          if (e !== timerOn) return list;
          const active = list.findIndex((r) => !r.done);
          if (active < 0) return list;
          return list.map((row, i) => (i === active ? { ...row, reps: row.reps + 1 } : row));
        })
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerOn]);

  const patchRow = (exercise: number, index: number, patch: Partial<LoggedSet>) => {
    setRows((current) =>
      current.map((list, e) =>
        e === exercise ? list.map((row, i) => (i === index ? { ...row, ...patch } : row)) : list
      )
    );
  };

  /**
   * Log one set.
   *
   * What is recorded is whatever is in the row — the planned figure if it was
   * hit, the real one if the set fell short or went over. A set is never
   * rewritten to match the plan: the plan is an intention, the log is a
   * record, and only the log gets to claim what happened.
   */
  const logSet = (exercise: number, index: number) => {
    const row = rows[exercise][index];
    const item = items[exercise];
    if (!row || row.done || row.reps <= 0) return;

    const next = rows.map((list, e) =>
      e === exercise ? list.map((r, i) => (i === index ? { ...r, done: true } : r)) : list
    );
    setRows(next);
    if (timerOn === exercise) setTimerOn(null);
    soundFx.playSuccess();

    onSetComplete?.(item, {
      value: row.reps,
      target: planned.current[exercise]?.[index] ?? row.reps,
      weight: row.weight,
    });

    const more = next[exercise].some((r) => !r.done);
    if (more && item.restSeconds > 0) {
      setRest({
        exercise,
        afterIndex: index,
        left: item.restSeconds,
        total: item.restSeconds,
      });
    } else if (rest?.exercise === exercise) {
      setRest(null);
    }
  };

  /**
   * A hold that reaches its planned seconds logs itself.
   *
   * Placed after `logSet` so it calls the same path a tap does — a hold that
   * completed itself and a hold ticked by hand must produce the same record,
   * or the two would drift apart.
   */
  useEffect(() => {
    if (timerOn === null) return;
    const item = items[timerOn];
    if (!item || item.metric !== 'hold') return;

    const active = rows[timerOn].findIndex((r) => !r.done);
    if (active < 0) return;

    const goal = planned.current[timerOn]?.[active] || 0;
    if (goal > 0 && (rows[timerOn][active]?.reps || 0) >= goal) {
      setTimerOn(null);
      logSet(timerOn, active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, timerOn]);

  const undoSet = (exercise: number, index: number) => {
    setRows((current) =>
      current.map((list, e) =>
        e === exercise ? list.map((r, i) => (i === index ? { ...r, done: false } : r)) : list
      )
    );
  };

  const addSet = (exercise: number) => {
    const list = rows[exercise];
    const last = list[list.length - 1];
    planned.current[exercise] = [...(planned.current[exercise] || []), last?.reps || 0];
    setRows((current) =>
      current.map((rowsFor, e) =>
        e === exercise
          ? [...rowsFor, { weight: last?.weight || 0, reps: last?.reps || 0, done: false }]
          : rowsFor
      )
    );
  };

  const results = (): SetResult[][] =>
    rows.map((list, exercise) =>
      list
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.done && row.reps > 0)
        .map(({ row, index }) => ({
          value: row.reps,
          target: planned.current[exercise]?.[index] ?? row.reps,
          weight: row.weight,
        }))
    );

  const totals = useMemo(() => {
    let done = 0;
    let all = 0;
    let volume = 0;
    for (const list of rows) {
      all += list.length;
      for (const row of list) {
        if (!row.done) continue;
        done++;
        volume += row.weight * row.reps;
      }
    }
    return { done, all, volume: Math.round(volume) };
  }, [rows]);

  const anyWork = totals.done > 0;

  const hasRecord = (exerciseId: string) => {
    const view = records[exerciseId];
    return !!view && (view.reps > 0 || view.e1rm > 0);
  };

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="run-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (anyWork ? onFinish(results()) : onAbort())}
            aria-label="End workout"
            className="icon-btn shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="t-section truncate">{title}</p>
            <p className="t-meta mt-0.5 flex items-center gap-2 flex-wrap dot-meta">
              <span className="tabular-nums">
                {totals.done}/{totals.all} sets
              </span>
              {totals.volume > 0 && (
                <span className="tabular-nums">{totals.volume.toLocaleString()} kg</span>
              )}
            </p>
          </div>

          {/* Only offered once there is something to file. Before that the
              X is the way out, and a bright button saying "Close" next to it
              is two controls for one action. */}
          {anyWork && (
            <button
              onClick={() => {
                soundFx.playClick();
                onFinish(results());
              }}
              className="wk-start shrink-0"
            >
              Finish
            </button>
          )}
        </div>

        <div className="run-bar">
          <div
            className="run-bar-fill"
            style={{
              width: `${(totals.done / Math.max(1, totals.all)) * 100}%`,
              background: 'color-mix(in oklab, var(--signal) 70%, var(--ink))',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-3 pb-6">
          {items.map((item, exercise) => {
            const list = rows[exercise];
            const doneCount = list.filter((r) => r.done).length;
            const complete = doneCount === list.length;
            const activeIndex = activeIndexOf(exercise);
            const best = recordLabel(records[item.exerciseId], item.metric);

            return (
              <div
                key={`${item.exerciseId}:${exercise}`}
                className="run-card"
                data-complete={complete ? 'true' : 'false'}
              >
                <div className="run-card-head">
                  <span className="run-card-mark" data-complete={complete ? 'true' : 'false'}>
                    {complete ? <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" /> : exercise + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15.5px] font-bold truncate">{item.name}</span>
                    <span className="t-meta mt-0.5 flex items-center gap-2 flex-wrap dot-meta">
                      <span className="tabular-nums">
                        {doneCount}/{list.length} sets
                      </span>
                      {best && (
                        <span className="inline-flex items-center gap-1 eb-warn">
                          <Trophy className="w-3 h-3 shrink-0" />
                          {best}
                        </span>
                      )}
                    </span>
                  </span>
                </div>

                <SetLogger
                  metric={item.metric}
                  rows={list}
                  mode="log"
                  activeIndex={activeIndex}
                  goals={planned.current[exercise]}
                  // Flagged only where a best already exists to beat. With no
                  // record yet, every row would carry a trophy, which says
                  // nothing about the row.
                  prRows={list.map((row) =>
                    isRecord && hasRecord(item.exerciseId)
                      ? isRecord(item.exerciseId, { weight: row.weight, reps: row.reps })
                      : false
                  )}
                  rest={rest && rest.exercise === exercise ? rest : null}
                  timerRunning={timerOn === exercise}
                  onChange={(index, patchValue) => patchRow(exercise, index, patchValue)}
                  onToggleDone={(index) =>
                    list[index].done ? undoSet(exercise, index) : logSet(exercise, index)
                  }
                  onToggleTimer={() => setTimerOn(timerOn === exercise ? null : exercise)}
                  onAdd={() => addSet(exercise)}
                  onSkipRest={() => setRest(null)}
                  onSetRest={(seconds) =>
                    setRest((current) =>
                      current && current.exercise === exercise
                        ? { ...current, left: seconds, total: seconds }
                        : current
                    )
                  }
                />
              </div>
            );
          })}

          <button
            onClick={() => {
              soundFx.playClick();
              anyWork ? onFinish(results()) : onAbort();
            }}
            className="btn-lg w-full"
          >
            {anyWork ? 'Finish workout' : 'Close without logging'}
          </button>
        </div>
      </div>
    </div>
  );
};
