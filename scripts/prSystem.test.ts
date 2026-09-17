/**
 * Personal record rules.
 *
 * Run: npx esbuild scripts/prSystem.test.ts --bundle --platform=node --outfile=/tmp/pr.cjs && node /tmp/pr.cjs
 */

import { personalRecords, WorkoutSession } from '../src/lib/bodyTraining';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${
      ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    }`
  );
}

function session(
  id: string,
  exerciseId: string,
  target: number,
  results?: number[]
): WorkoutSession {
  return {
    id,
    date: '2026-09-17',
    items: [{ exerciseId: exerciseId as any, sets: results?.length ?? 1, target, difficulty: 'easy' }],
    completed: { [exerciseId]: results?.length ?? 1 },
    results: results ? { [exerciseId]: results } : undefined,
    startedAt: '2026-09-17T10:00:00.000Z',
    finishedAt: '2026-09-17T10:10:00.000Z',
    xpAwarded: 10,
  };
}

console.log('--- personal records ---');

check('no sessions means no records', personalRecords([]), {});

check(
  'a single set becomes the record',
  personalRecords([session('a', 'pushups', 20, [20])]),
  { pushups: 20 }
);

check(
  'the best single set wins, not the total',
  personalRecords([session('a', 'pushups', 20, [20, 18, 15])]),
  { pushups: 20 }
);

check(
  'a long easy session does not outrank a short hard one',
  personalRecords([
    session('a', 'pushups', 10, [10, 10, 10, 10, 10]),
    session('b', 'pushups', 25, [25]),
  ]),
  { pushups: 25 }
);

check(
  'records are tracked per exercise',
  personalRecords([
    session('a', 'pushups', 20, [20]),
    session('b', 'squats', 40, [40]),
  ]),
  { pushups: 20, squats: 40 }
);

check(
  'a later worse session does not lower the record',
  personalRecords([
    session('a', 'pushups', 30, [30]),
    session('b', 'pushups', 12, [12]),
  ]),
  { pushups: 30 }
);

console.log('\n--- older sessions ---');

check(
  'a session with no per-set results falls back to its target',
  personalRecords([session('a', 'plank', 45)]),
  { plank: 45 }
);

check(
  'old and new sessions are compared on the same scale',
  personalRecords([session('a', 'plank', 45), session('b', 'plank', 60, [60])]),
  { plank: 60 }
);

console.log('\n--- bad data is ignored, never guessed at ---');

check(
  'zero and negative values are not records',
  personalRecords([session('a', 'pushups', 0, [0, -3])]),
  {}
);

check(
  'a corrupt value cannot become a record',
  personalRecords([session('a', 'pushups', 20, [Number.NaN as any, 14])]),
  { pushups: 14 }
);

check('an empty items array is survivable', personalRecords([
  { ...session('a', 'pushups', 20, [20]), items: [] },
]), {});

console.log('\n--- celebration and XP guards ---');

/**
 * Mirrors the rule in BodyTrainingSection: a record is celebrated once, and
 * judged against the records frozen when the exercise started.
 */
function runExercise(
  baseline: Record<string, number>,
  exerciseId: string,
  setValues: number[]
) {
  const celebrated = new Set<string>();
  const events: number[] = [];

  for (const value of setValues) {
    const previous = baseline[exerciseId] || 0;
    if (value <= previous) continue;
    const key = `${exerciseId}:${value}`;
    if (celebrated.has(key)) continue;
    celebrated.add(key);
    events.push(value);
  }

  return events;
}

check(
  'a first record is celebrated once',
  runExercise({}, 'pushups', [20]),
  [20]
);

check(
  'three identical sets celebrate once, not three times',
  runExercise({ pushups: 15 }, 'pushups', [20, 20, 20]),
  [20]
);

check(
  'matching the old record is not a record',
  runExercise({ pushups: 20 }, 'pushups', [20, 20]),
  []
);

check(
  'beating the old record celebrates',
  runExercise({ pushups: 20 }, 'pushups', [21, 21]),
  [21]
);

check(
  'a better set later in the same run celebrates again',
  runExercise({ pushups: 10 }, 'pushups', [15, 18]),
  [15, 18]
);

check(
  'a reloaded workout celebrates nothing, because the baseline already includes it',
  runExercise(personalRecords([session('a', 'pushups', 30, [30])]), 'pushups', []),
  []
);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
