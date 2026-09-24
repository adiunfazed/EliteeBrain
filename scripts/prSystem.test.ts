/**
 * Personal record rules.
 *
 * Run: npx esbuild scripts/prSystem.test.ts --bundle --platform=node --outfile=/tmp/pr.cjs && node /tmp/pr.cjs
 */

import type { WorkoutSession } from '../src/lib/bodyTraining';
import {
  RecordMap,
  beatsRecord,
  epley,
  judgeSet,
  mergeRecord,
  recordLabel,
  recordView,
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

function ok(name: string, condition: boolean): void {
  check(name, condition, true);
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


console.log('\n--- weight and reps, ranked together ---');

check('a single is its own one-rep max', epley(100, 1), 103.3);
check('more reps at the same weight rank higher', epley(100, 5) > epley(100, 3), true);
check('more weight at the same reps ranks higher', epley(110, 5) > epley(100, 5), true);
check('bodyweight has no one-rep max to estimate', epley(0, 20), 0);
check('nor does a set of nothing', epley(100, 0), 0);
check('and rubbish is not turned into a number', epley(Number.NaN, 5), 0);

{
  // 60 × 10 and 70 × 8 are close; the formula is what decides, not the
  // heavier plate alone.
  const held = { bench: judgeSet({}, 'bench', { weight: 60, reps: 10 })!.record };

  ok('the first loaded set is always a record', !!judgeSet({}, 'bench', { weight: 60, reps: 10 }));
  ok('the same set again is not', !judgeSet(held, 'bench', { weight: 60, reps: 10 }));
  ok('one more rep at the same weight is', !!judgeSet(held, 'bench', { weight: 60, reps: 11 }));
  ok('a heavier set for fewer reps is judged, not assumed', !!judgeSet(held, 'bench', { weight: 70, reps: 8 }));
  ok('a much lighter set for a few more reps is not', !judgeSet(held, 'bench', { weight: 40, reps: 12 }));
  ok('and a warm-up set is never a record', !judgeSet(held, 'bench', { weight: 20, reps: 5 }));
}

console.log('\n--- the two bests never overwrite each other ---');

{
  const bodyweight = judgeSet({}, 'dips', { weight: 0, reps: 20 })!.record;
  const both = mergeRecord(bodyweight, judgeSet({ dips: bodyweight }, 'dips', { weight: 30, reps: 8 })!.record)!;

  check('the bodyweight best survives the loaded one', both.value, 20);
  check('and the loaded one is stored beside it', both.weight, 30);

  ok(
    'adding a dumbbell cannot beat the bodyweight record',
    !judgeSet({ dips: both }, 'dips', { weight: 30, reps: 9 })?.kind.includes('reps')
  );
  check(
    'a bodyweight set is still judged on reps alone',
    judgeSet({ dips: both }, 'dips', { weight: 0, reps: 21 })?.kind,
    'reps'
  );
  ok(
    'and 20 bodyweight reps no longer count, because 20 was the record',
    !judgeSet({ dips: both }, 'dips', { weight: 0, reps: 20 })
  );
}

console.log('\n--- what a record reads as ---');

check(
  'a loaded best leads with the load',
  recordLabel(recordView({ exerciseId: 'b', value: 12, achievedAt: '', weight: 80, weightReps: 5, e1rm: epley(80, 5) })),
  '80 kg × 5'
);

check(
  'a bodyweight best reads in reps',
  recordLabel(recordView({ exerciseId: 'p', value: 24, achievedAt: '' })),
  '24 reps'
);

check(
  'a hold reads in seconds',
  recordLabel(recordView({ exerciseId: 'plank', value: 90, achievedAt: '' }), 'hold'),
  '90s'
);

check('nothing at all reads as nothing', recordLabel(undefined), '');

console.log('\n--- a weighted session rebuilds its own records ---');

{
  const session: WorkoutSession = {
    id: 'w1',
    date: '2026-09-24',
    items: [{ exerciseId: 'custom_bench', name: 'Bench press', metric: 'reps', sets: 3, target: 10, difficulty: 'easy' }],
    completed: { custom_bench: 3 },
    results: { custom_bench: [10, 10, 8] },
    sets: {
      custom_bench: [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
        { weight: 70, reps: 8 },
      ],
    },
    startedAt: '2026-09-24T10:00:00.000Z',
    finishedAt: '2026-09-24T10:40:00.000Z',
    xpAwarded: 30,
  };

  const derived = recordsFromSessions([session]);
  check('the best set is found from the log', derived.custom_bench.weight, 70);
  check('with the reps that earned it', derived.custom_bench.weightReps, 8);
  check('and no bodyweight best is invented from a loaded session', derived.custom_bench.value, 0);
  check('the name travels with it', derived.custom_bench.name, 'Bench press');
}

{
  // A session from before weights existed: reps only, and it must still work.
  const old: WorkoutSession = {
    id: 'w0',
    date: '2026-01-01',
    items: [{ exerciseId: 'pushups', sets: 2, target: 15, difficulty: 'easy' }],
    completed: { pushups: 2 },
    results: { pushups: [15, 18] },
    startedAt: '',
    xpAwarded: 10,
  };
  const derived = recordsFromSessions([old]);
  check('an old session still yields its bodyweight best', derived.pushups.value, 18);
  check('and claims no weight it never recorded', derived.pushups.weight, undefined);
}

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
