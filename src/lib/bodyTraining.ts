/**
 * Body training.
 *
 * Equipment-free exercises with beginner-safe targets. Reps are counted by the
 * camera where it can see the movement clearly, and by hand where it cannot —
 * detection pauses rather than guesses, because one invented rep would
 * undermine trust in every number the app shows.
 */

export type ExerciseId =
  | 'pushups'
  | 'squats'
  | 'lunges'
  | 'plank'
  | 'glute-bridge'
  | 'calf-raises';

export type Difficulty = 'easy' | 'moderate' | 'hard';

export interface Exercise {
  id: ExerciseId;
  name: string;
  /** What to do, in one or two plain sentences. */
  how: string;
  /** What to watch for, so form does not degrade. */
  cue: string;
  /** 'reps' counts repetitions; 'hold' counts seconds. */
  metric: 'reps' | 'hold';
  /** Beginner-safe targets per set. */
  targets: Record<Difficulty, number>;
  /** Seconds of rest between sets. */
  restSeconds: number;
  icon: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: 'pushups',
    name: 'Push-ups',
    how: 'Hands under your shoulders, body in a straight line. Lower until your chest is near the floor, then press back up.',
    cue: 'Keep your hips level — let them sag and your lower back takes the load.',
    metric: 'reps',
    // Deliberately low. Someone who finds the first session easy will add
    // sets; someone who finds it hard is far more likely to stop entirely.
    targets: { easy: 5, moderate: 10, hard: 15 },
    restSeconds: 60,
    icon: 'ArrowDownUp',
  },
  {
    id: 'squats',
    name: 'Squats',
    how: 'Feet shoulder-width apart. Sit back as if reaching for a chair, then drive up through your heels.',
    cue: 'Knees track over your toes, never collapsing inward.',
    metric: 'reps',
    targets: { easy: 8, moderate: 15, hard: 25 },
    restSeconds: 60,
    icon: 'PersonStanding',
  },
  {
    id: 'lunges',
    name: 'Lunges',
    how: 'Step forward and lower until both knees are near ninety degrees. Push back to standing and alternate legs.',
    cue: 'Keep your torso upright; leaning forward shifts the work off the legs.',
    metric: 'reps',
    targets: { easy: 6, moderate: 12, hard: 20 },
    restSeconds: 60,
    icon: 'Footprints',
  },
  {
    id: 'plank',
    name: 'Plank',
    how: 'Forearms under your shoulders, body straight from head to heels. Hold.',
    cue: 'Stop when your hips drop. A shorter clean hold beats a long sagging one.',
    metric: 'hold',
    targets: { easy: 20, moderate: 40, hard: 60 },
    restSeconds: 45,
    // A hold, not a movement — a stopwatch says that; a bare dash says nothing.
    icon: 'Timer',
  },
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    how: 'Lie on your back, knees bent, feet flat. Lift your hips until your body forms a straight line, then lower.',
    cue: 'Squeeze at the top rather than arching your back to go higher.',
    metric: 'reps',
    targets: { easy: 10, moderate: 15, hard: 25 },
    restSeconds: 45,
    icon: 'MoveUp',
  },
  {
    id: 'calf-raises',
    name: 'Calf raises',
    how: 'Stand tall, rise onto the balls of your feet, pause, then lower under control.',
    cue: 'Lower slowly — dropping down wastes most of the effort.',
    metric: 'reps',
    targets: { easy: 12, moderate: 20, hard: 30 },
    restSeconds: 30,
    icon: 'ArrowUp',
  },
];

export function exerciseById(id: string): Exercise | null {
  return EXERCISES.find((e) => e.id === id) || null;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

/** One exercise within a planned workout. */
export interface WorkoutItem {
  exerciseId: ExerciseId;
  sets: number;
  /** Reps, or seconds for a hold. */
  target: number;
  difficulty: Difficulty;
}

/** users/{uid}/workouts/{id} */
export interface WorkoutSession {
  id: string;
  date: string;
  items: WorkoutItem[];
  /** Sets actually completed, keyed by exercise id. */
  completed: Record<string, number>;
  startedAt: string;
  finishedAt?: string;
  xpAwarded: number;
  /**
   * What was actually achieved in each set, keyed by exercise id.
   *
   * Optional, because sessions recorded before this existed have no such
   * record and must stay readable. Where it is missing, the planned target is
   * the best evidence available of what was done.
   */
  results?: Record<string, number[]>;
  /** XP granted for personal records in this session, counted separately. */
  prXp?: number;
}

/**
 * The best single set per exercise, across every session.
 *
 * Per set rather than per session: a long easy session should never outrank a
 * genuinely harder one. Reps for rep exercises, seconds for holds.
 *
 * Sessions that predate per-set results fall back to the planned target, which
 * is what those sessions were completed against — a set only counted at all if
 * it met its target, so the target is a true floor, never an inflation.
 */
export function personalRecords(sessions: WorkoutSession[]): Record<string, number> {
  const best: Record<string, number> = {};

  for (const s of sessions || []) {
    for (const item of s.items || []) {
      const achieved = s.results?.[item.exerciseId];
      const values = achieved && achieved.length > 0 ? achieved : [item.target];

      for (const v of values) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
        if (!best[item.exerciseId] || v > best[item.exerciseId]) {
          best[item.exerciseId] = v;
        }
      }
    }
  }

  return best;
}

/**
 * XP for beating a personal record.
 *
 * Flat, and small relative to a workout: the record is its own reward, and
 * making PRs lucrative encourages exactly one bad set rather than consistency.
 */
export const PR_XP = 25;

/**
 * XP for a finished workout.
 *
 * Scaled by sets completed rather than reps, so an easy setting is not worth
 * less than a hard one for the same effort of showing up. Capped, because
 * the point is consistency and grinding sets for XP is a poor habit to build.
 */
export function workoutXp(session: WorkoutSession): number {
  const sets = Object.values(session.completed || {}).reduce((n, v) => n + v, 0);
  return Math.min(60, sets * 5);
}

/** A sensible default workout for someone who has not built one. */
export function defaultWorkout(difficulty: Difficulty = 'easy'): WorkoutItem[] {
  return (['squats', 'pushups', 'glute-bridge', 'plank'] as ExerciseId[]).map((id) => {
    const ex = exerciseById(id)!;
    return { exerciseId: id, sets: 2, target: ex.targets[difficulty], difficulty };
  });
}
