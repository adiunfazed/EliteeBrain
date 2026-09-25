/**
 * Custom workouts.
 *
 * The things that must hold: a user-named exercise gets one stable id so it
 * keeps one personal best; every number that reaches storage is inside its
 * range whatever was typed; and a finished session can still be read back
 * after the workout that named it is deleted.
 *
 * Run: npx esbuild scripts/workoutTemplates.test.ts --bundle --platform=node --outfile=/tmp/wt.cjs && node /tmp/wt.cjs
 */

import {
  TEMPLATE_LIMITS,
  catalogueExercises,
  clampWeight,
  normaliseSet,
  cleanName,
  customExerciseId,
  customExercisesFrom,
  exerciseNameFor,
  isCustomExercise,
  itemFromCustom,
  itemFromExercise,
  itemLine,
  metricFor,
  normaliseItem,
  normaliseTemplate,
  starterTemplate,
  summariseTemplate,
  targetRange,
  templateProblem,
} from '../src/lib/workoutTemplates';
import { exerciseById } from '../src/lib/bodyTraining';

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

function ok(name: string, condition: boolean): void {
  check(name, condition, true);
}

console.log('--- one exercise, one id, one record ---');

check(
  'a typed name becomes a readable id',
  customExerciseId('Bench press'),
  'custom_bench-press'
);

check(
  'case and spacing do not make a second exercise',
  customExerciseId('  BENCH   Press '),
  customExerciseId('Bench press')
);

check(
  'punctuation is not carried into the id',
  customExerciseId('Romanian deadlift (RDL)'),
  'custom_romanian-deadlift-rdl'
);

ok(
  'two different lifts never collide',
  customExerciseId('Squat') !== customExerciseId('Front squat')
);

ok(
  'a name with nothing sluggable still gets an id of its own',
  customExerciseId('💪').startsWith('custom_x') &&
    customExerciseId('💪') !== customExerciseId('🏋️')
);

ok('and a built-in id is never mistaken for a custom one', !isCustomExercise('pushups'));
ok('while a custom one is', isCustomExercise(customExerciseId('Bench press')));

check('names are tidied, never left ragged', cleanName('  Push   day  '), 'Push day');
check('and are cut to the limit', cleanName('x'.repeat(80)).length, TEMPLATE_LIMITS.nameMax);

console.log('\n--- every number that reaches storage is in range ---');

check(
  'a negative set count becomes the minimum',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', sets: -4 }).sets,
  TEMPLATE_LIMITS.sets.min
);

check(
  'an absurd set count is capped',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', sets: 9999 }).sets,
  TEMPLATE_LIMITS.sets.max
);

check(
  'a rep target beyond the ceiling is capped',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', target: 100000 }).target,
  TEMPLATE_LIMITS.reps.max
);

check(
  'a hold has its own, longer ceiling',
  normaliseItem({ exerciseId: 'plank', name: 'Plank', metric: 'hold', target: 100000 }).target,
  TEMPLATE_LIMITS.hold.max
);

check(
  'text where a number should be falls back rather than becoming zero',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', sets: 'lots' as any }).sets,
  3
);

check(
  'rest can be zero — supersets are a real thing',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', restSeconds: 0 }).restSeconds,
  0
);

check(
  'but not negative',
  normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', restSeconds: -30 }).restSeconds,
  0
);

check(
  'an unknown metric is treated as reps, never invented',
  normaliseItem({ exerciseId: 'x', name: 'X', metric: 'furlongs' as any }).metric,
  'reps'
);

check(
  'a nameless row still has a name',
  normaliseItem({ exerciseId: 'custom_x' }).name,
  'Exercise'
);

check(
  'a built-in id fills in its own name',
  normaliseItem({ exerciseId: 'squats' }).name,
  'Squats'
);

check('reps and holds have different ranges', targetRange('hold').min, TEMPLATE_LIMITS.hold.min);

console.log('\n--- templates ---');

check(
  'a template with no name is not saveable',
  templateProblem({ name: '   ', items: [itemFromCustom('Bench press')] }),
  'Give the workout a name.'
);

check(
  'nor is one with no exercises',
  templateProblem({ name: 'Push day', items: [] }),
  'Add at least one exercise.'
);

check(
  'a complete one has no problem',
  templateProblem({ name: 'Push day', items: [itemFromCustom('Bench press')] }),
  null
);

{
  const saved = normaliseTemplate({ name: '  Leg   day ', items: [{ exerciseId: 'squats', sets: 400 } as any] });
  check('saving tidies the name', saved.name, 'Leg day');
  check('and clamps what is inside it', saved.items[0].sets, TEMPLATE_LIMITS.sets.max);
  ok('and gives it an id', saved.id.length > 0);
  ok('and timestamps it', !!saved.createdAt && !!saved.updatedAt);
}

check(
  'an unnamed template is never saved as an empty string',
  normaliseTemplate({ items: [] }).name,
  'Untitled workout'
);

check(
  'more exercises than the limit are cut, not accepted',
  normaliseTemplate({
    name: 'Everything',
    items: Array.from({ length: 60 }, () => ({ exerciseId: 'squats' })) as any,
  }).items.length,
  TEMPLATE_LIMITS.items
);

check(
  'rubbish in the items list is dropped rather than crashing the reader',
  normaliseTemplate({ name: 'Odd', items: [null, 'nope', { exerciseId: 'squats' }] as any }).items
    .length,
  1
);

console.log('\n--- what a workout adds up to ---');

{
  const items = [
    itemFromCustom('Bench press', 'reps', { sets: 3, target: 8, restSeconds: 90 }),
    itemFromCustom('Plank hold', 'hold', { sets: 2, target: 60, restSeconds: 60 }),
  ];
  const s = summariseTemplate(items);
  check('exercises are counted', s.exercises, 2);
  check('sets are the sum across exercises', s.sets, 5);
  check('reps exclude the seconds of a hold', s.reps, 24);
  check('and the hold seconds are their own figure', s.holdSeconds, 120);
  ok('the time estimate is a sensible number of minutes', s.minutes > 5 && s.minutes < 40);
}

check(
  'the rest after the very last set is not counted as time in the gym',
  summariseTemplate([itemFromCustom('A', 'reps', { sets: 1, target: 1, restSeconds: 600 })]).minutes,
  1
);

check('a row reads as its shape', itemLine(itemFromCustom('A', 'reps', { sets: 4, target: 12 })), '4 × 12');
check('a hold says so', itemLine(itemFromCustom('B', 'hold', { sets: 2, target: 45 })), '2 × 45s');
check('an empty workout sums to nothing', summariseTemplate([]).sets, 0);


console.log('\n--- sets are planned one at a time, with their own weight ---');

{
  const item = normaliseItem({
    exerciseId: customExerciseId('Bench press'),
    name: 'Bench press',
    plan: [
      { weight: 60, reps: 10 },
      { weight: 60, reps: 10 },
      { weight: 70, reps: 8 },
    ],
    restSeconds: 120,
  });

  check('each set keeps its own numbers', item.plan, [
    { weight: 60, reps: 10 },
    { weight: 60, reps: 10 },
    { weight: 70, reps: 8 },
  ]);
  check('the set count is derived, never contradicted', item.sets, 3);
  check('and the target is the hardest set, so an old client shows something true', item.target, 10);
  check('and the line spells the session out', itemLine(item), '10 · 10 · 8 · 60–70 kg');
}

check(
  'identical sets collapse to the way it would be written on paper',
  itemLine(
    normaliseItem({
      exerciseId: 'custom_squat',
      name: 'Squat',
      plan: [
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ],
    })
  ),
  '3 × 5 · 100 kg'
);

check(
  'a bodyweight exercise says nothing about weight',
  itemLine(normaliseItem({ exerciseId: 'pushups', sets: 3, target: 20 })),
  '3 × 20'
);

check(
  'a pyramid is written out rather than averaged',
  itemLine(
    normaliseItem({
      exerciseId: 'custom_row',
      name: 'Row',
      plan: [
        { weight: 50, reps: 12 },
        { weight: 60, reps: 10 },
        { weight: 70, reps: 8 },
      ],
    })
  ),
  '12 · 10 · 8 · 50–70 kg'
);

console.log('\n--- a workout written by an older build still opens ---');

{
  const old = normaliseItem({ exerciseId: 'squats', name: 'Squats', sets: 4, target: 12 } as any);
  check('sets and a target become that many identical sets', old.plan.length, 4);
  check('at bodyweight, because no weight was ever recorded', old.plan[0], { weight: 0, reps: 12 });
}

check(
  'an empty plan is never stored — one set is the minimum',
  normaliseItem({ exerciseId: 'squats', plan: [] as any, sets: 2, target: 9 }).plan.length,
  2
);

check(
  'rubbish inside the plan is dropped',
  normaliseItem({ exerciseId: 'squats', plan: [null, { reps: 5 }, 'x'] as any }).plan,
  [{ weight: 0, reps: 5 }]
);

console.log('\n--- weights are cleaned on the way in ---');

check('a half plate survives', clampWeight(62.5), 62.5);
check('a third of a kilo does not', clampWeight(62.3), 62.5);
check('a negative weight is bodyweight, not a negative', clampWeight(-40), 0);
check('text is bodyweight too', clampWeight('heavy' as any), 0);
check('an absurd load is capped', clampWeight(99999), TEMPLATE_LIMITS.weight.max);
check(
  'and a set carries that cleaning with it',
  normaliseSet({ weight: 62.3, reps: 8 }, 'reps'),
  { weight: 62.5, reps: 8 }
);

console.log('\n--- volume ---');

{
  const s = summariseTemplate([
    normaliseItem({
      exerciseId: 'custom_bench',
      name: 'Bench',
      plan: [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
      ],
      restSeconds: 90,
    }),
    normaliseItem({ exerciseId: 'pushups', name: 'Push-ups', sets: 2, target: 20 }),
  ]);
  check('kilograms moved are weight times reps, summed', s.volume, 1200);
  check('bodyweight sets add reps but no volume', s.reps, 60);
  check('and the set count spans both exercises', s.sets, 4);
}

check(
  'a workout with no weights has no volume, rather than a zero pretending to be one',
  summariseTemplate([normaliseItem({ exerciseId: 'pushups', sets: 3, target: 10 })]).volume,
  0
);

console.log('\n--- names survive the template being deleted ---');

const bench = itemFromCustom('Bench press');
const template = normaliseTemplate({ id: 't1', name: 'Push day', items: [bench] });

check(
  'a name is found in the template that holds it',
  exerciseNameFor(bench.exerciseId, { templates: [template] }),
  'Bench press'
);

check(
  'a built-in id always wins, wherever it is asked about',
  exerciseNameFor('pushups', { templates: [template] }),
  'Push-ups'
);

check(
  'with no template left, the id still reads as the words it was made from',
  exerciseNameFor('custom_romanian-deadlift'),
  'Romanian deadlift'
);

check(
  'a name recorded on the session beats the slug',
  exerciseNameFor('custom_rdl', { names: { custom_rdl: 'Romanian deadlift' } }),
  'Romanian deadlift'
);

check(
  'a hold keeps its unit after the template is gone',
  metricFor('custom_plank', { metrics: { custom_plank: 'hold' } }),
  'hold'
);

check(
  'and an unknown exercise is assumed to be reps rather than seconds',
  metricFor('custom_mystery'),
  'reps'
);

console.log('\n--- the exercises you have invented ---');

{
  const a = normaliseTemplate({ name: 'Push', items: [itemFromCustom('Bench press'), itemFromExercise(exerciseById('pushups')!)] });
  const b = normaliseTemplate({ name: 'Pull', items: [itemFromCustom('Barbell row'), itemFromCustom('Bench press')] });
  const known = customExercisesFrom([a, b]);

  check('built-in exercises are not listed as custom', known.length, 2);
  check('and each one appears once, in name order', known.map((e) => e.name), ['Barbell row', 'Bench press']);
  ok('each carries its own id', known.every((e) => isCustomExercise(e.id)));
  ok('and none claims the camera can count it', known.every((e) => !e.tracked));
}

check('no templates means no custom exercises', customExercisesFrom([]), []);
check('and a broken template does not break the list', customExercisesFrom([null as any]), []);


console.log('\n--- the gym catalogue ---');

{
  const catalogue = catalogueExercises();
  ok('there are plenty to pick from', catalogue.length >= 80);
  ok('every one has a name', catalogue.every((e) => e.name.trim().length > 0));
  ok('every one is a custom exercise, id and all', catalogue.every((e) => isCustomExercise(e.id)));
  ok('none of them claims the camera can count it', catalogue.every((e) => !e.tracked));
  ok(
    'each has a rest worth having',
    catalogue.every((e) => e.restSeconds >= 30 && e.restSeconds <= 300)
  );

  const ids = catalogue.map((e) => e.id);
  check('no two entries share an id', new Set(ids).size, ids.length);

  ok('every one is filed under a body part', catalogue.every((e) => !!e.group));
  ok('and says what it works', catalogue.every((e) => (e.targets || '').length >= 3));

  const chest = catalogue.filter((e) => e.group === 'Chest').map((e) => e.name);
  ok('the chest section holds the presses', chest.includes('Bench press'));
  ok('and the flies', chest.includes('Dumbbell fly'));
  ok(
    'curls are filed under biceps, not arms-in-general',
    catalogue.filter((e) => e.group === 'Biceps').every((e) => /curl/i.test(e.name))
  );
  ok(
    'pulldowns and pull-ups are under lats',
    catalogue.filter((e) => e.group === 'Lats').length >= 5
  );
  check(
    'a squat is a leg exercise and says which muscles',
    catalogue.find((e) => e.name === 'Back squat')?.targets,
    'Quads · Glutes · Core'
  );

  const bench = catalogue.find((e) => e.name === 'Bench press')!;
  check(
    'picking a lift and typing its name are the same exercise',
    bench.id,
    customExerciseId('bench press')
  );

  check(
    'a carry is timed rather than counted in reps',
    catalogue.find((e) => e.name === 'Farmer carry')?.metric,
    'hold'
  );
}

console.log('\n--- the starter workout ---');

{
  const starter = starterTemplate();
  ok('has exercises', starter.items.length > 0);
  ok('all of them real', starter.items.every((i) => !!exerciseById(i.exerciseId)));
  check('and no problem stopping it being saved', templateProblem(starter), null);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
