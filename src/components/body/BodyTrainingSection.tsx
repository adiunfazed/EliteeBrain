import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, History } from 'lucide-react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ExerciseRunner, SetResult } from './ExerciseRunner';
import { WorkoutConfig, WorkoutConfigValue } from './WorkoutConfig';
import { WorkoutHistory } from './WorkoutHistory';
import { WakeChallengeSection } from '../wake/WakeChallengeSection';
import { WakeEntryCard } from '../wake/WakeEntryCard';
import {
  Exercise,
  Difficulty,
  WorkoutSession,
  workoutXp,
} from '../../lib/bodyTraining';
import { subscribeWorkouts, saveWorkout, subscribeAlarms } from '../../lib/trainingStore';
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

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [view, setView] = useState<View>('library');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [config, setConfig] = useState<WorkoutConfigValue | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Session ids already rewarded.
   *
   * A ref rather than state: it must not reset on a re-render, and it must be
   * checked synchronously before awarding, or a double invocation slips
   * through between renders.
   */
  const awarded = useRef<Set<string>>(new Set());

  useEffect(() => subscribeWorkouts(userId, setSessions), [userId]);

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

  const todayStats = useMemo(() => {
    const todays = sessions.filter((s) => s.date === today);
    const sets = todays.reduce(
      (n, s) => n + Object.values(s.completed || {}).reduce((a, b) => a + b, 0),
      0
    );
    return { sessions: todays.length, sets };
  }, [sessions, today]);

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
          target: config?.target ?? exercise.targets[difficulty],
          difficulty,
        },
      ],
      completed: { [exercise.id]: valid.length },
      startedAt: new Date(Date.now() - 60000).toISOString(),
      finishedAt: new Date().toISOString(),
      xpAwarded: 0,
    };

    session.xpAwarded = workoutXp(session);

    setSessions((prev) => [session, ...prev]);
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
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onStart={(ex) => {
              setSelected(ex);
              setConfig({
                sets: 3,
                target: ex.targets[difficulty],
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
          onCancel={() => {
            setView('library');
            setSelected(null);
          }}
          onStart={(next) => {
            setConfig(next);
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
          onClose={() => {
            setView('library');
            setSelected(null);
          }}
          onComplete={(results) => handleComplete(selected, results)}
        />
      )}
    </div>
  );
};
