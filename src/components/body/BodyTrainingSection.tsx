import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, Flame, History, Trophy, Zap } from 'lucide-react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ExerciseRunner, SetResult } from './ExerciseRunner';
import { WorkoutConfig, WorkoutConfigValue } from './WorkoutConfig';
import { WorkoutHistory } from './WorkoutHistory';
import { WorkoutList } from './WorkoutList';
import { TemplateBuilder } from './TemplateBuilder';
import { SessionSummary, SummaryLine } from './SessionSummary';
import { PrCelebration, PrRecord } from './PrCelebration';
import { WakeChallengeSection } from '../wake/WakeChallengeSection';
import { WakeEntryCard } from '../wake/WakeEntryCard';
import {
  Difficulty,
  Exercise,
  PR_XP,
  WorkoutItem,
  WorkoutSession,
  workoutXp,
} from '../../lib/bodyTraining';
import {
  TemplateItem,
  WorkoutTemplate,
  customExercisesFrom,
  itemFromExercise,
  normaliseItem,
} from '../../lib/workoutTemplates';
import {
  EMPTY_VIEW,
  RecordMap,
  RecordViews,
  judgeSet,
  mergeRecords,
  recordValues,
  recordViews,
  recordsFromSessions,
  suggestedTarget,
} from '../../lib/personalRecords';
import {
  subscribeWorkouts,
  saveWorkout,
  subscribeAlarms,
  subscribeRecords,
  subscribeTemplates,
  saveTemplate,
  removeTemplate,
  saveRecord,
} from '../../lib/trainingStore';
import { todayISO } from '../../lib/tasks';
import { soundFx } from '../../utils/audio';
import { useXp } from '../XpToast';
import { resolveEntitlement } from '../../lib/entitlement';

interface Props {
  userId: string | null;
  /** The user's profile, for the shared entitlement check. */
  profile?: any;
  onUpgrade?: () => void;
}

type View = 'home' | 'config' | 'running' | 'summary' | 'builder' | 'wake';

/**
 * A session in progress.
 *
 * One shape for both ways in — a single exercise picked from the library is a
 * session of one item, a custom workout is a session of several — so the
 * runner, the personal records and the saved history have exactly one code
 * path and cannot drift apart.
 */
interface Run {
  templateId?: string;
  templateName?: string;
  items: TemplateItem[];
  index: number;
  /** Sets finished, per item, in the order they were done. */
  done: SetResult[][];
  startedAt: string;
}

/**
 * Body training.
 *
 * Two ways to train: a built-in exercise straight from the library, or a
 * workout the user built themselves. XP is awarded exactly once per session
 * id, which matters because the alternative — awarding on a render or a retry
 * — inflates numbers the whole progression system depends on.
 */
export const BodyTrainingSection: React.FC<Props> = ({ userId, profile, onUpgrade }) => {
  // Display only. The server re-checks on every alarm call, so editing this
  // in devtools reveals the UI and nothing more.
  const entitlement = useMemo(() => resolveEntitlement(profile || {}), [profile]);
  const { awardXp } = useXp();

  const [view, setView] = useState<View>('home');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [config, setConfig] = useState<WorkoutConfigValue | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [summary, setSummary] = useState<{ title: string; lines: SummaryLine[]; xp: number; prXp: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** A record set during THIS session, so reloads never re-celebrate. */
  const [newRecord, setNewRecord] = useState<PrRecord | null>(null);
  /** Records as their own documents, independent of the workout history. */
  const [storedRecords, setStoredRecords] = useState<RecordMap>({});

  /**
   * Records as they stood when the session started.
   *
   * Frozen for the duration of a run: comparing against a live value would
   * mean the second set had to beat the first to be a record, which is not
   * what a personal best means — and the first set's own record would then
   * suppress the celebration for a better second set.
   */
  const recordsAtStart = useRef<RecordMap>({});
  /** PRs already celebrated and paid for, keyed by exercise and value. */
  const celebrated = useRef<Set<string>>(new Set());

  /**
   * Session ids already rewarded.
   *
   * A ref rather than state: it must not reset on a re-render, and it must be
   * checked synchronously before awarding, or a double invocation slips
   * through between renders.
   */
  const awarded = useRef<Set<string>>(new Set());

  useEffect(() => subscribeWorkouts(userId, setSessions), [userId]);
  useEffect(() => subscribeRecords(userId, setStoredRecords), [userId]);
  useEffect(() => subscribeTemplates(userId, setTemplates), [userId]);

  // Read only for the entry card's summary line. The full screen subscribes
  // separately for the list it manages.
  const [alarms, setAlarms] = useState<any[]>([]);
  useEffect(() => subscribeAlarms(userId, setAlarms), [userId]);

  const nextAlarmTime = useMemo(() => {
    const enabled = alarms.filter((a) => a.enabled);
    if (enabled.length === 0) return null;
    return enabled.map((a) => a.time).sort()[0];
  }, [alarms]);

  const today = todayISO();

  /**
   * The one answer to "what is my best?".
   *
   * Stored records and the records the sessions imply, merged with the higher
   * value winning — so a record cannot be lost by a failed workout write, and
   * cannot drift above the work that actually earned it either.
   */
  const allRecords = useMemo(
    () => mergeRecords(storedRecords, recordsFromSessions(sessions)),
    [storedRecords, sessions]
  );

  /** Both bests per exercise: the bodyweight one and the loaded one. */
  const records: RecordViews = useMemo(() => recordViews(allRecords), [allRecords]);

  /** Bodyweight reps alone, for the quick-start screen's suggested target. */
  const repRecords = useMemo(() => recordValues(allRecords), [allRecords]);

  /** Every exercise the user has invented, for the builder's picker. */
  const knownCustom = useMemo(() => customExercisesFrom(templates), [templates]);

  const stats = useMemo(() => {
    const todays = sessions.filter((s) => s.date === today);
    const sets = todays.reduce(
      (n, s) => n + Object.values(s.completed || {}).reduce((a, b) => a + b, 0),
      0
    );

    // A training week, counted from dates that actually exist rather than a
    // rolling estimate: seven distinct days back from today, inclusive.
    const weekStart = new Date(`${today}T00:00:00`);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekISO = weekStart.toISOString().slice(0, 10);
    const week = new Set(
      sessions.filter((s) => s.date >= weekISO && s.date <= today).map((s) => s.date)
    ).size;

    return { sets, sessions: todays.length, week, records: Object.keys(records).length };
  }, [sessions, today, records]);

  /* ---------------- personal records ---------------- */

  /**
   * A single set just ended.
   *
   * Records are judged here rather than at the end of the exercise, so the
   * celebration lands while the user is still catching their breath from the
   * set that earned it. It works identically for a user-named exercise: the
   * record is keyed by the exercise id, and a custom id is as good a key as a
   * built-in one.
   */
  const handleSetComplete = async (item: TemplateItem, result: SetResult) => {
    // Judged against the records frozen when the session started, and judged
    // per dimension: a loaded set is measured against the loaded best by
    // estimated one-rep max, a bodyweight set against the bodyweight best by
    // reps. Adding a dumbbell can therefore never erase a bodyweight record,
    // and a light set can never pretend to be one.
    const beat = judgeSet(
      recordsAtStart.current,
      item.exerciseId,
      { weight: result.weight, reps: result.value },
      { name: item.name, metric: item.metric }
    );
    if (!beat) return;

    const key = `${item.exerciseId}:${beat.kind}:${result.weight}x${result.value}`;

    // The same record is never celebrated — or paid for — twice.
    if (celebrated.current.has(key)) return;
    celebrated.current.add(key);

    // Persisted first, and on its own. This is what makes a record stick: it
    // no longer depends on the workout document saving later, so a refused or
    // failed workout write cannot erase a best the user just set. The store
    // publishes locally before touching the network, so the number on screen
    // is already correct by the time this resolves.
    try {
      await saveRecord(userId, beat.record);
      setSaveError(null);
    } catch (err) {
      console.error('Could not sync the personal record:', err);
      setSaveError('Record saved on this device. It will sync when you reconnect.');
    }

    setNewRecord({
      exerciseId: item.exerciseId,
      exerciseName: item.name,
      value: beat.kind === 'weight' ? result.weight : result.value,
      unit:
        beat.kind === 'weight'
          ? `kg × ${result.value}`
          : item.metric === 'hold'
            ? 'seconds'
            : 'reps',
      previous: beat.previous > 0 ? beat.previous : undefined,
      previousText: beat.previousLabel || undefined,
    });

    // Awarded against the same guard as the celebration, so a record cannot
    // be farmed by repeating the set that set it.
    awardXp(PR_XP, `${item.name} personal record`);
  };

  /* ---------------- running a session ---------------- */

  const beginRun = (items: TemplateItem[], meta: { id?: string; name?: string } = {}) => {
    const rows = items.map(normaliseItem).slice(0, 24);
    if (rows.length === 0) return;

    // The bar to beat is fixed now, before a single rep is done. Comparing
    // against a live value would mean set two had to beat set one to count,
    // and set one's own record would then suppress a better set two.
    recordsAtStart.current = { ...allRecords };
    celebrated.current = new Set();

    setRun({
      templateId: meta.id,
      templateName: meta.name,
      items: rows,
      index: 0,
      done: rows.map(() => []),
      startedAt: new Date().toISOString(),
    });
    setView('running');
  };

  /**
   * One exercise in the session finished, or was skipped.
   *
   * Written against the live `run` rather than inside a state updater: saving
   * a workout is a side effect, and an updater can be invoked more than once
   * for the same change, which would file the same session twice.
   */
  const handleExerciseDone = (results: SetResult[]) => {
    if (!run) return;

    const done = run.done.map((rows, i) => (i === run.index ? results : rows));
    const nextIndex = run.index + 1;

    if (nextIndex < run.items.length) {
      setRun({ ...run, index: nextIndex, done });
      return;
    }

    setRun(null);
    finishSession({ ...run, done });
  };

  /** The whole session ended early. Everything already finished is kept. */
  const handleAbort = () => {
    if (!run) {
      setView('home');
      return;
    }

    const anything = run.done.some((rows) => rows.length > 0);
    setRun(null);
    if (anything) finishSession(run);
    else setView('home');
  };

  const finishSession = async (state: Run) => {
    const lines: SummaryLine[] = state.items.map((item, i) => {
      const sets = (state.done[i] || []).map((r) => ({ weight: r.weight, reps: r.value }));
      const completedSets = (state.done[i] || []).filter((r) => r.value >= r.target).length;

      // A record is claimed only where one of the two bests was actually
      // beaten, judged by the same rule the live celebration used.
      const record = sets.some(
        (set) =>
          !!judgeSet(recordsAtStart.current, item.exerciseId, set, {
            name: item.name,
            metric: item.metric,
          })
      );

      return { item, sets, completedSets, record };
    });

    const anyWork = lines.some((l) => l.sets.length > 0);
    if (!anyWork) {
      setView('home');
      return;
    }

    const title = state.templateName || state.items[0]?.name || 'Workout';
    const sessionId = `w_${Date.now()}`;

    // Sets are accumulated by exercise id, so the same movement appearing
    // twice in one workout reads as one exercise with the total rather than
    // silently overwriting itself.
    const items: WorkoutItem[] = [];
    const completed: Record<string, number> = {};
    const results: Record<string, number[]> = {};
    const setLog: Record<string, { weight: number; reps: number }[]> = {};

    for (const line of lines) {
      if (line.sets.length === 0) continue;
      const id = line.item.exerciseId;
      const heaviest = line.sets.reduce((n, set) => Math.max(n, set.weight), 0);

      completed[id] = (completed[id] || 0) + line.completedSets;
      // Reps alone, kept for every reader written before weights existed.
      results[id] = [...(results[id] || []), ...line.sets.map((set) => set.reps)];
      // The full log, which is what a weighted personal best is recomputed
      // from if the record document is ever lost.
      setLog[id] = [...(setLog[id] || []), ...line.sets];

      const existing = items.find((i) => i.exerciseId === id);
      if (existing) {
        existing.sets += line.completedSets;
        existing.target = Math.max(existing.target, line.item.target);
        existing.weight = Math.max(existing.weight || 0, heaviest);
      } else {
        items.push({
          exerciseId: id,
          sets: line.completedSets,
          target: line.item.target,
          // Retained because older sessions carry it and the type is shared;
          // nothing in the interface sets it any more.
          difficulty: 'easy' as Difficulty,
          name: line.item.name,
          metric: line.item.metric,
          restSeconds: line.item.restSeconds,
          ...(heaviest > 0 ? { weight: heaviest } : {}),
        });
      }
    }

    const session: WorkoutSession = {
      id: sessionId,
      date: today,
      items,
      completed,
      // What was actually achieved, set by set. Without this a personal record
      // could only ever be inferred from the planned target, and would not
      // survive a reload as the real number.
      results,
      sets: setLog,
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString(),
      xpAwarded: 0,
      ...(state.templateId ? { templateId: state.templateId } : {}),
      ...(state.templateName ? { templateName: state.templateName } : {}),
    };

    session.xpAwarded = workoutXp(session);

    const prCount = lines.filter((l) => l.record).length;
    // Recorded on the session so the two XP sources stay distinguishable in
    // history rather than being silently merged into one number.
    if (prCount > 0) session.prXp = prCount * PR_XP;

    soundFx.playSuccess();

    // Guarded so a repeated call, a retry or a re-render cannot award twice.
    if (!awarded.current.has(sessionId) && session.xpAwarded > 0) {
      awarded.current.add(sessionId);
      awardXp(session.xpAwarded, `${title} workout`);
    }

    setSummary({ title, lines, xp: session.xpAwarded, prXp: session.prXp || 0 });
    setView('summary');

    try {
      await saveWorkout(userId, session);
      setSaveError(null);
    } catch (err) {
      console.error('Could not save workout:', err);
      setSaveError('Saved on this device. It will sync when you reconnect.');
    }

    // The template's own counters, updated only when a session built from it
    // actually produced work.
    if (state.templateId) {
      const template = templates.find((t) => t.id === state.templateId);
      if (template) {
        try {
          await saveTemplate(userId, {
            ...template,
            lastUsedAt: new Date().toISOString(),
            uses: (template.uses || 0) + 1,
          });
        } catch (err) {
          console.error('Could not update the workout:', err);
        }
      }
    }
  };

  /* ---------------- templates ---------------- */

  const handleSaveTemplate = async (template: WorkoutTemplate) => {
    setView('home');
    setEditingTemplate(null);
    try {
      await saveTemplate(userId, template);
      setSaveError(null);
    } catch (err) {
      console.error('Could not save the workout:', err);
      setSaveError('Workout saved on this device. It will sync when you reconnect.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setView('home');
    setEditingTemplate(null);
    try {
      await removeTemplate(userId, templateId);
      setSaveError(null);
    } catch (err) {
      console.error('Could not delete the workout:', err);
      setSaveError('Deleted on this device. It will sync when you reconnect.');
    }
  };

  /* ---------------- render ---------------- */

  const runItem = run ? run.items[run.index] : null;
  const nextName = run && run.index + 1 < run.items.length ? run.items[run.index + 1].name : null;

  return (
    <div className="space-y-4">
      {view !== 'wake' && view !== 'builder' && (
        <div className="flex items-start gap-3">
          <span className="sec-icon">
            <Dumbbell className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-section">Body training</h2>
            <p className="t-meta mt-0.5">Build a workout. Train it. Beat it.</p>
          </div>
        </div>
      )}

      {saveError && <p className="t-meta eb-warn">{saveError}</p>}

      {view === 'home' && (
        <>
          {(stats.sets > 0 || stats.week > 0 || stats.records > 0) && (
            <div className="stat-strip grid-cols-3">
              <div>
                <span className="eb-label block">Sets today</span>
                <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
                  {stats.sets}
                </span>
              </div>
              <div>
                <span className="eb-label block">This week</span>
                <span className="t-figure block mt-1.5 flex items-center gap-1" style={{ fontSize: 22 }}>
                  {stats.week > 0 && (
                    <Flame className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warn)' }} />
                  )}
                  {stats.week}
                </span>
              </div>
              <div>
                <span className="eb-label block">Records</span>
                <span className="t-figure block mt-1.5 flex items-center gap-1" style={{ fontSize: 22 }}>
                  {stats.records > 0 && (
                    <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warn)' }} />
                  )}
                  {stats.records}
                </span>
              </div>
            </div>
          )}

          {/* The user's own workouts come first: someone who has built one is
              here to run it, not to browse the six built-in exercises. */}
          <div className="pt-1">
            <div className="sec-rule">
              <span className="sec-rule-icon">
                <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>
              <span className="panel-title">Your workouts</span>
              <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
            </div>

            <WorkoutList
              templates={templates}
              onStart={(template) =>
                beginRun(template.items, { id: template.id, name: template.name })
              }
              onEdit={(template) => {
                setEditingTemplate(template);
                setView('builder');
              }}
              onCreate={() => {
                setEditingTemplate(null);
                setView('builder');
              }}
            />
          </div>

          <div className="pt-1">
            <div className="sec-rule">
              <span className="sec-rule-icon">
                <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>
              <span className="panel-title">Quick start</span>
              <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
            </div>

            <ExerciseLibrary
              records={records}
              onStart={(ex) => {
                setSelected(ex);
                setConfig({
                  sets: 3,
                  target: suggestedTarget(repRecords, ex.id, ex.targets.easy),
                  restSeconds: ex.restSeconds,
                });
                setView('config');
              }}
            />
          </div>

          <div className="pt-1">
            <div className="sec-rule">
              <span className="sec-rule-icon">
                <History className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>
              <span className="panel-title">Your history</span>
              <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
            </div>

            <WorkoutHistory sessions={sessions} templates={templates} records={records} />
          </div>

          <WakeEntryCard
            alarmCount={alarms.length}
            nextTime={nextAlarmTime}
            isPro={entitlement.isPro}
            onOpen={() => setView('wake')}
          />
        </>
      )}

      {view === 'builder' && (
        <TemplateBuilder
          template={editingTemplate}
          known={knownCustom}
          records={records}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onCancel={() => {
            setEditingTemplate(null);
            setView('home');
          }}
        />
      )}

      {view === 'wake' && (
        <WakeChallengeSection
          userId={userId}
          isPro={entitlement.isPro}
          entitlementStatus={entitlement.status}
          onUpgrade={onUpgrade}
          onBack={() => setView('home')}
        />
      )}

      {view === 'config' && selected && config && (
        <WorkoutConfig
          exercise={selected}
          initial={config}
          best={records[selected.id]?.reps || 0}
          onCancel={() => {
            setView('home');
            setSelected(null);
          }}
          onStart={(next) => {
            setConfig(next);
            beginRun([
              itemFromExercise(selected, {
                sets: next.sets,
                target: next.target,
                restSeconds: next.restSeconds,
              }),
            ]);
          }}
        />
      )}

      {view === 'summary' && summary && (
        <SessionSummary
          title={summary.title}
          lines={summary.lines}
          xp={summary.xp}
          prXp={summary.prXp}
          onDone={() => {
            setSummary(null);
            setSelected(null);
            setView('home');
          }}
        />
      )}

      {view === 'running' && run && runItem && (
        <ExerciseRunner
          // Keyed by position so every exercise starts the runner cleanly,
          // rather than inheriting the previous exercise's set count.
          key={`${run.startedAt}:${run.index}`}
          item={runItem}
          position={{ index: run.index, total: run.items.length }}
          nextName={nextName}
          best={recordViews(recordsAtStart.current)[runItem.exerciseId] || EMPTY_VIEW}
          isRecord={(set) =>
            !!judgeSet(recordsAtStart.current, runItem.exerciseId, set, {
              name: runItem.name,
              metric: runItem.metric,
            })
          }
          onAbort={handleAbort}
          onSetComplete={(result) => handleSetComplete(runItem, result)}
          onComplete={handleExerciseDone}
        />
      )}

      {/* Sits above the runner, so a record is seen the moment it happens. */}
      <PrCelebration record={newRecord} onDismiss={() => setNewRecord(null)} />
    </div>
  );
};
