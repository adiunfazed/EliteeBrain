/**
 * Personal record rules.
 *
 * Run: npx esbuild scripts/prSystem.test.ts --bundle --platform=node --outfile=/tmp/pr.cjs && node /tmp/pr.cjs
 */

import type { WorkoutSession } from '../src/lib/bodyTraining';
import {
  RecordMap,
  beatsRecord,
  mergeRecords,
  recordValues,
  recordsFromSessions,
  suggestedTarget,
} from '../src/lib/personalRecords';

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
    date: '2026-09-18',
    items: [
      { exerciseId: exerciseId as any, sets: results?.length ?? 1, target, difficulty: 'easy' },
    ],
    completed: { [exerciseId]: results?.length ?? 1 },
    results: results ? { [exerciseId]: results } : undefined,
    startedAt: '2026-09-18T10:00:00.000Z',
    finishedAt: '2026-09-18T10:10:00.000Z',
    xpAwarded: 10,
  };
}

/** The numbers only, which is what every screen actually consumes. */
function derived(sessions: WorkoutSession[]) {
  return recordValues(recordsFromSessions(sessions));
}

function rec(exerciseId: string, value: number, achievedAt = '2026-09-18T10:00:00.000Z') {
  return { [exerciseId]: { exerciseId, value, achievedAt } };
}

console.log('--- records implied by sessions ---');

check('no sessions means no records', derived([]), {});
check('a single set becomes the record', derived([session('a', 'pushups', 20, [20])]), {
  pushups: 20,
});
check(
  'the best single set wins, not the total',
  derived([session('a', 'pushups', 20, [20, 18, 15])]),
  { pushups: 20 }
);
check(
  'a long easy session does not outrank a short hard one',
  derived([
    session('a', 'pushups', 10, [10, 10, 10, 10, 10]),
    session('b', 'pushups', 25, [25]),
  ]),
  { pushups: 25 }
);
check(
  'a later worse session does not lower the record',
  derived([session('a', 'pushups', 30, [30]), session('b', 'pushups', 12, [12])]),
  { pushups: 30 }
);
check(
  'a session with no per-set results falls back to its target',
  derived([session('a', 'plank', 45)]),
  { plank: 45 }
);
check('zero and negative values are not records', derived([session('a', 'pushups', 0, [0, -3])]), {});
check(
  'a corrupt value cannot become a record',
  derived([session('a', 'pushups', 20, [Number.NaN as any, 14])]),
  { pushups: 14 }
);
check('an empty items array is survivable', derived([{ ...session('a', 'pushups', 20, [20]), items: [] }]), {});

console.log('\n--- merging stored records with implied ones ---');

check(
  'a stored record the sessions do not know about is kept',
  recordValues(mergeRecords(rec('pushups', 30), {})),
  { pushups: 30 }
);

check(
  'an implied record with nothing stored is kept',
  recordValues(mergeRecords({}, recordsFromSessions([session('a', 'pushups', 22, [22])]))),
  { pushups: 22 }
);

// This is the case that used to lose a record: the set happened, the
// celebration fired, and then the workout write failed — so the only
// surviving evidence is the record document itself.
check(
  'a stored record survives a workout that never saved',
  recordValues(mergeRecords(rec('pushups', 31), recordsFromSessions([session('a', 'pushups', 30, [30])]))),
  { pushups: 31 }
);

check(
  'a stored record cannot drift above what the sessions show, when lower',
  recordValues(mergeRecords(rec('pushups', 12), recordsFromSessions([session('a', 'pushups', 40, [40])]))),
  { pushups: 40 }
);

check(
  'records from both sources are combined per exercise',
  recordValues(
    mergeRecords(rec('plank', 90), recordsFromSessions([session('a', 'squats', 35, [35])]))
  ),
  { plank: 90, squats: 35 }
);

check('a malformed stored record is discarded', recordValues(mergeRecords(
  { pushups: { exerciseId: 'pushups', value: Number.NaN as any, achievedAt: '' } } as RecordMap,
  recordsFromSessions([session('a', 'pushups', 15, [15])])
)), { pushups: 15 });

check('two malformed sources yield nothing rather than a guess', recordValues(mergeRecords(
  { pushups: { exerciseId: 'pushups', value: 0, achievedAt: '' } } as RecordMap,
  {}
)), {});

console.log('\n--- what counts as beating a record ---');

check('anything beats no record', beatsRecord({}, 'pushups', 1), true);
check('matching the record is not beating it', beatsRecord({ pushups: 20 }, 'pushups', 20), false);
check('one more than the record beats it', beatsRecord({ pushups: 20 }, 'pushups', 21), true);
check('less than the record does not', beatsRecord({ pushups: 20 }, 'pushups', 19), false);
check('zero never beats anything', beatsRecord({}, 'pushups', 0), false);
check('a corrupt value never beats anything', beatsRecord({}, 'pushups', Number.NaN), false);
check(
  'a record for another exercise is irrelevant',
  beatsRecord({ squats: 50 }, 'pushups', 3),
  true
);

console.log('\n--- the target offered when an exercise is opened ---');

check('a first-timer gets the gentle floor', suggestedTarget({}, 'pushups', 5), 5);
check(
  'a returning user gets one past their record',
  suggestedTarget({ pushups: 29 }, 'pushups', 5),
  30
);
check(
  'the floor still applies when the record is tiny',
  suggestedTarget({ pushups: 2 }, 'pushups', 5),
  5
);

// The target is also the ceiling for a set, so this pairing is what makes a
// personal best reachable at all without editing the number every time.
{
  const records = { pushups: 29 };
  const target = suggestedTarget(records, 'pushups', 5);
  check('the offered target beats the record', beatsRecord(records, 'pushups', target), true);
}

console.log('\n--- celebration and XP guards ---');

/**
 * Mirrors the rule in BodyTrainingSection: judged against the records frozen
 * when the exercise started, and celebrated once per record.
 */
function runExercise(
  baseline: Record<string, number>,
  exerciseId: string,
  setValues: number[]
) {
  const celebrated = new Set<string>();
  const events: number[] = [];

  for (const value of setValues) {
    if (!beatsRecord(baseline, exerciseId, value)) continue;
    const key = `${exerciseId}:${value}`;
    if (celebrated.has(key)) continue;
    celebrated.add(key);
    events.push(value);
  }

  return events;
}

check('a first record is celebrated once', runExercise({}, 'pushups', [20]), [20]);
check(
  'three identical sets celebrate once, not three times',
  runExercise({ pushups: 15 }, 'pushups', [20, 20, 20]),
  [20]
);
check('matching the old record is not a record', runExercise({ pushups: 20 }, 'pushups', [20, 20]), []);
check('beating the old record celebrates', runExercise({ pushups: 20 }, 'pushups', [21, 21]), [21]);
check(
  'a better set later in the same run celebrates again',
  runExercise({ pushups: 10 }, 'pushups', [15, 18]),
  [15, 18]
);
check(
  'a reloaded workout celebrates nothing, because the baseline already includes it',
  runExercise(derived([session('a', 'pushups', 30, [30])]), 'pushups', []),
  []
);

// A full three-set run at the offered target, from the top.
{
  const stored = rec('pushups', 29);
  const baseline = recordValues(mergeRecords(stored, {}));
  const target = suggestedTarget(baseline, 'pushups', 5);
  const events = runExercise(baseline, 'pushups', [target, target, target]);
  check('a 3-set run at the offered target celebrates exactly once', events, [30]);
  check('and the record it sets is the target', target, 30);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
