import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, History } from 'lucide-react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ExerciseRunner, SetResult } from './ExerciseRunner';
import { WorkoutConfig, WorkoutConfigValue } from './WorkoutConfig';
import { WorkoutHistory } from './WorkoutHistory';
import { PrCelebration, PrRecord } from './PrCelebration';
import { WakeChallengeSection } from '../wake/WakeChallengeSection';
import { WakeEntryCard } from '../wake/WakeEntryCard';
import {
  Exercise,
  Difficulty,
  PR_XP,
  WorkoutSession,
  workoutXp,
} from '../../lib/bodyTraining';
import {
  RecordMap,
  beatsRecord,
  mergeRecords,
  recordValues,
  recordsFromSessions,
  suggestedTarget,
} from '../../lib/personalRecords';
import {
  subscribeWorkouts,
  saveWorkout,
  subscribeAlarms,
  subscribeRecords,
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

type View = 'library' | 'config' | 'running' | 'wake';

/**
 * Body training.
 *
 * Library → configure → run → complete. XP is awarded exactly once per
 * session id, which matters because the alternative — awarding on a render
 * or a retry — inflates numbers that the whole progression system depends on.
 */
export const BodyTrainingSection: React.FC<Props> = ({ userId, profile, onUpgrade }) => {
  // Display only. The server re-checks on every alarm call, so editing this
  // in devtools reveals the UI and nothing more.
  const entitlement = useMemo(() => resolveEntitlement(profile || {}), [profile]);
  const { awardXp } = useXp();

  const [view, setView] = useState<View>('library');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [config, setConfig] = useState<WorkoutConfigValue | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** A record set during THIS session, so reloads never re-celebrate. */
  const [newRecord, setNewRecord] = useState<PrRecord | null>(null);
  /** Records as their own documents, independent of the workout history. */
  const [storedRecords, setStoredRecords] = useState<RecordMap>({});

  /**
   * Records as they stood when the current exercise started.
   *
   * Frozen for the duration of a run: comparing against a live value would
   * mean the second set of a session had to beat the first to be a record,
   * which is not what a personal best means — and the first set's own record
   * would then suppress the celebration for a better second set.
   */
  const recordsAtStart = useRef<Record<string, number>>({});
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
  const records = useMemo(
    () => recordValues(mergeRecords(storedRecords, recordsFromSessions(sessions))),
    [storedRecords, sessions]
  );

  const todayStats = useMemo(() => {
    const todays = sessions.filter((s) => s.date === today);
    const sets = todays.reduce(
      (n, s) => n + Object.values(s.completed || {}).reduce((a, b) => a + b, 0),
      0
    );
    return { sessions: todays.length, sets };
  }, [sessions, today]);

  /**
   * A single set just ended.
   *
   * Personal records are judged here rather than at the end of the exercise,
   * so the celebration lands while the user is still catching their breath
   * from the set that earned it.
   */
  const handleSetComplete = async (exercise: Exercise, result: SetResult) => {
    // Judged against the records frozen when the exercise started, not the
    // live value — otherwise set two would have to beat set one to count, and
    // set one's own record would suppress a better set two.
    const baseline = recordsAtStart.current;
    if (!beatsRecord(baseline, exercise.id, result.value)) return;

    const previous = baseline[exercise.id] || 0;
    const key = `${exercise.id}:${result.value}`;

    // The same record is never celebrated — or paid for — twice.
    if (celebrated.current.has(key)) return;
    celebrated.current.add(key);

    // Persisted first, and on its own. This is the change that makes a record
    // stick: it no longer depends on the workout document saving later, so a
    // refused or failed workout write cannot erase a best the user just set.
    // The store publishes locally before touching the network, so the number
    // on screen is already correct by the time this resolves.
    try {
      await saveRecord(userId, {
        exerciseId: exercise.id,
        value: result.value,
        achievedAt: new Date().toISOString(),
      });
      setSaveError(null);
    } catch (err) {
      console.error('Could not sync the personal record:', err);
      setSaveError('Record saved on this device. It will sync when you reconnect.');
    }

    setNewRecord({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      value: result.value,
      unit: exercise.metric === 'hold' ? 'seconds' : 'reps',
      previous: previous > 0 ? previous : undefined,
    });

    // Awarded against the same guard as the celebration, so a record cannot
    // be farmed by repeating the set that set it.
    awardXp(PR_XP, `${exercise.name} personal record`);
  };

  const handleComplete = async (exercise: Exercise, results: SetResult[]) => {
    setView('library');
    setSelected(null);

    // Only sets that genuinely met their target count toward anything.
    const valid = results.filter((r) => r.value >= r.target);
    if (valid.length === 0) return;

    const sessionId = `w_${Date.now()}`;

    const session: WorkoutSession = {
      id: sessionId,
      date: today,
      items: [
        {
          exerciseId: exercise.id,
          sets: valid.length,
          target: config?.target ?? exercise.targets.easy,
          // Retained on the record because older sessions carry it and the
          // type is shared; nothing in the interface sets it any more.
          difficulty: 'easy' as Difficulty,
        },
      ],
      completed: { [exercise.id]: valid.length },
      // What was actually achieved, set by set. Without this a personal
      // record could only ever be inferred from the planned target, and would
      // not survive a reload as the real number.
      results: { [exercise.id]: valid.map((r) => r.value) },
      startedAt: new Date(Date.now() - 60000).toISOString(),
      finishedAt: new Date().toISOString(),
      xpAwarded: 0,
    };

    session.xpAwarded = workoutXp(session);

    // Recorded on the session so the two XP sources stay distinguishable in
    // history rather than being silently merged into one number.
    const bestThisRun = Math.max(...valid.map((r) => r.value));
    if (bestThisRun > (recordsAtStart.current[exercise.id] || 0)) {
      session.prXp = PR_XP;
    }

    soundFx.playSuccess();

    // Guarded so a repeated call, a retry or a re-render cannot award twice.
    if (!awarded.current.has(sessionId) && session.xpAwarded > 0) {
      awarded.current.add(sessionId);
      awardXp(session.xpAwarded, `${exercise.name} workout`);
    }

    try {
      await saveWorkout(userId, session);
      setSaveError(null);
    } catch (err) {
      console.error('Could not save workout:', err);
      setSaveError('Saved on this device. It will sync when you reconnect.');
    }
  };

  return (
    <div className="space-y-4">
      {view !== 'wake' && (
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--signal) 16%, transparent)' }}
          >
            <Dumbbell className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-section">Body training</h2>
            <p className="t-meta mt-0.5">Simple movement. Consistent progress.</p>
          </div>
        </div>
      )}

      {todayStats.sets > 0 && view === 'library' && (
        <div className="panel-sm">
          <div className="panel-head">
            <span className="panel-title">Today</span>
          </div>
          <p className="t-sub">
            {todayStats.sets} {todayStats.sets === 1 ? 'set' : 'sets'} across{' '}
            {todayStats.sessions} {todayStats.sessions === 1 ? 'session' : 'sessions'}.
          </p>
        </div>
      )}

      {saveError && <p className="t-meta eb-warn">{saveError}</p>}

      {view === 'library' && (
        <>
          {/* Exercises first: they work today, and they are the reason to
              open this tab. Wake Challenge sits below until it ships. */}
          <div className="pt-1">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                style={{ background: 'var(--surface-sunk)' }}
              >
                <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>
              <span className="panel-title">Exercises</span>
              <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
            </div>

          <ExerciseLibrary
            records={records}
            onStart={(ex) => {
              setSelected(ex);
              setConfig({
                sets: 3,
                target: suggestedTarget(records, ex.id, ex.targets.easy),
                restSeconds: ex.restSeconds,
              });
              setView('config');
            }}
          />

          </div>

          <div className="pt-1">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                style={{ background: 'var(--surface-sunk)' }}
              >
                <History className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>
              <span className="panel-title">Your history</span>
              <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
            </div>

            <WorkoutHistory sessions={sessions} />
          </div>

          <WakeEntryCard
            alarmCount={alarms.length}
            nextTime={nextAlarmTime}
            isPro={entitlement.isPro}
            onOpen={() => setView('wake')}
          />
        </>
      )}

      {view === 'wake' && (
        <WakeChallengeSection
          userId={userId}
          isPro={entitlement.isPro}
          entitlementStatus={entitlement.status}
          onUpgrade={onUpgrade}
          onBack={() => setView('library')}
        />
      )}

      {view === 'config' && selected && config && (
        <WorkoutConfig
          exercise={selected}
          initial={config}
          best={records[selected.id] || 0}
          onCancel={() => {
            setView('library');
            setSelected(null);
          }}
          onStart={(next) => {
            setConfig(next);
            // The bar to beat is fixed now, before a single rep is done.
            recordsAtStart.current = { ...records };
            celebrated.current = new Set();
            setView('running');
          }}
        />
      )}

      {view === 'running' && selected && config && (
        <ExerciseRunner
          exercise={selected}
          sets={config.sets}
          target={config.target}
          restSeconds={config.restSeconds}
          best={recordsAtStart.current[selected.id] || 0}
          onClose={() => {
            setView('library');
            setSelected(null);
          }}
          onSetComplete={(result) => handleSetComplete(selected, result)}
          onComplete={(results) => handleComplete(selected, results)}
        />
      )}

      {/* Sits above the runner, so a record is seen the moment it happens. */}
      <PrCelebration record={newRecord} onDismiss={() => setNewRecord(null)} />
    </div>
  );
};
