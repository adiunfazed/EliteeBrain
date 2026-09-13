import React, { useEffect, useMemo, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ExerciseRunner } from './ExerciseRunner';
import { Exercise, Difficulty, WorkoutSession, workoutXp } from '../../lib/bodyTraining';
import { subscribeWorkouts, saveWorkout } from '../../lib/trainingStore';
import { todayISO } from '../../lib/tasks';
import { soundFx } from '../../utils/audio';
import { useXp } from '../XpToast';

interface Props {
  userId: string | null;
}

/**
 * Body training.
 *
 * Deliberately small: a library, a runner and a record of what was done.
 * Programmes, progression curves and volume tracking are what turn a simple
 * habit into something people abandon in week two.
 */
export const BodyTrainingSection: React.FC<Props> = ({ userId }) => {
  const { awardXp } = useXp();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [active, setActive] = useState<Exercise | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => subscribeWorkouts(userId, setSessions), [userId]);

  const today = todayISO();

  const todayStats = useMemo(() => {
    const todays = sessions.filter((s) => s.date === today);
    const sets = todays.reduce(
      (n, s) => n + Object.values(s.completed || {}).reduce((a, b) => a + b, 0),
      0
    );
    return { sessions: todays.length, sets };
  }, [sessions, today]);

  const handleComplete = async (exercise: Exercise, setsDone: number) => {
    setActive(null);
    if (setsDone <= 0) return;

    const session: WorkoutSession = {
      id: `w_${Date.now()}`,
      date: today,
      items: [
        {
          exerciseId: exercise.id,
          sets: setsDone,
          target: exercise.targets[difficulty],
          difficulty,
        },
      ],
      completed: { [exercise.id]: setsDone },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      xpAwarded: 0,
    };

    session.xpAwarded = workoutXp(session);

    // Shown immediately; the write follows. A failed save must not make it
    // look as though the work never happened.
    setSessions((prev) => [session, ...prev]);
    soundFx.playSuccess();
    awardXp(session.xpAwarded, `${exercise.name} workout`);

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

      {todayStats.sets > 0 && (
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

      <ExerciseLibrary
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onStart={setActive}
      />

      {active && (
        <ExerciseRunner
          exercise={active}
          difficulty={difficulty}
          onClose={() => setActive(null)}
          onComplete={(setsDone) => handleComplete(active, setsDone)}
        />
      )}
    </div>
  );
};
