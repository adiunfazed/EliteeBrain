/**
 * Habit grouping.
 *
 * Run: npx esbuild scripts/habitGroups.test.ts --bundle --platform=node --outfile=/tmp/hg.cjs && node /tmp/hg.cjs
 */

import { groupHabitsForDay, nextScheduledDate } from '../src/lib/habits';
import type { Habit, HabitLog } from '../src/types';

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

// 2026-09-20 is a Sunday (day 0). Monday is the 21st, Saturday the 26th.
const TODAY = '2026-09-20';

function habit(id: string, over: Partial<Habit> = {}): Habit {
  return {
    id,
    title: id,
    cadence: 'daily',
    metric: 'yes_no',
    targetValue: 1,
    status: 'active',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  } as Habit;
}

function log(habitId: string, date: string, value: number): HabitLog {
  return { id: `${date}__${habitId}`, habitId, date, value, updatedAt: '' };
}

/** ["Label: id,id", ...] — the shape of the rendered list. */
const shape = (habits: Habit[], logs: HabitLog[] = []) =>
  groupHabitsForDay(habits, logs, TODAY).map(
    (g) => `${g.label}: ${g.habits.map((h) => h.id).join(',')}`
  );

console.log('--- only what today asks for ---');

check('nothing at all produces no sections', shape([]), []);

check('a daily habit is due today', shape([habit('Read')]), ['Today: Read']);

check(
  "a habit set for Monday is not in today's list on a Sunday",
  shape([habit('Gym', { cadence: 'selected_days', weekdays: [1] })]),
  ['Other days: Gym']
);

check(
  'a habit set for Sunday is due on a Sunday',
  shape([habit('Rest walk', { cadence: 'selected_days', weekdays: [0] })]),
  ['Today: Rest walk']
);

check(
  'a weekly quota habit is available every day until it is met',
  shape([habit('Long run', { cadence: 'weekly', timesPerWeek: 2 })]),
  ['Today: Long run']
);

check(
  "today's habits and other days' never mix in one section",
  shape([
    habit('Daily thing'),
    habit('Saturday thing', { cadence: 'selected_days', weekdays: [6] }),
    habit('Sunday thing', { cadence: 'selected_days', weekdays: [0] }),
  ]),
  ['Today: Daily thing,Sunday thing', 'Other days: Saturday thing']
);

console.log('\n--- done today ---');

check(
  'a completed habit moves to its own section',
  shape([habit('Read')], [log('Read', TODAY, 1)]),
  ['Done today: Read']
);

check(
  'a partly done counted habit is still due',
  shape([habit('Pages', { metric: 'count', targetValue: 10 })], [log('Pages', TODAY, 4)]),
  ['Today: Pages']
);

check(
  'reaching the target moves it across',
  shape([habit('Pages', { metric: 'count', targetValue: 10 })], [log('Pages', TODAY, 10)]),
  ['Done today: Pages']
);

check(
  'overshooting the target still counts as done',
  shape([habit('Pages', { metric: 'count', targetValue: 10 })], [log('Pages', TODAY, 14)]),
  ['Done today: Pages']
);

check(
  "yesterday's log does not complete today",
  shape([habit('Read')], [log('Read', '2026-09-19', 1)]),
  ['Today: Read']
);

check(
  'sections come in reading order: due, done, other',
  shape(
    [
      habit('Later', { cadence: 'selected_days', weekdays: [6] }),
      habit('Finished'),
      habit('Open'),
    ],
    [log('Finished', TODAY, 1)]
  ),
  ['Today: Open', 'Done today: Finished', 'Other days: Later']
);

console.log('\n--- archived habits are in no section at all ---');

check(
  'an archived habit is never listed',
  shape([habit('Old', { status: 'archived' }), habit('Current')]),
  ['Today: Current']
);

check(
  'an archived habit is not even in other days',
  shape([habit('Old', { status: 'archived', cadence: 'selected_days', weekdays: [6] })]),
  []
);

console.log('\n--- when the other-day habits come round ---');

check(
  'a Monday habit, seen on Sunday, is next tomorrow',
  nextScheduledDate(habit('Gym', { cadence: 'selected_days', weekdays: [1] }), TODAY),
  '2026-09-21'
);

check(
  'a Saturday habit is next on the Saturday',
  nextScheduledDate(habit('Long run', { cadence: 'selected_days', weekdays: [6] }), TODAY),
  '2026-09-26'
);

check(
  'a habit scheduled for no day at all has no next date',
  nextScheduledDate(habit('Never', { cadence: 'selected_days', weekdays: [] }), TODAY),
  null
);

console.log('\n--- awkward data ---');

check(
  'a missing weekday list is treated as no days, never as every day',
  shape([habit('Vague', { cadence: 'selected_days' })]),
  ['Other days: Vague']
);

check('a null in the list is survivable', shape([null as any, habit('Real')]), ['Today: Real']);

check(
  'a zero target still completes on one log',
  shape([habit('Odd', { targetValue: 0 })], [log('Odd', TODAY, 1)]),
  ['Done today: Odd']
);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
