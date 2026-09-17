/**
 * Task list grouping.
 *
 * Run: npx esbuild scripts/taskGroups.test.ts --bundle --platform=node --outfile=/tmp/tg.cjs && node /tmp/tg.cjs
 */

import { groupTasksByDate } from '../src/lib/tasks';
import type { Task } from '../src/types';

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

const TODAY = '2026-09-17';

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    priority: 'normal',
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  } as Task;
}

/** ["Label: id, id", ...] — the shape of the rendered list. */
function shape(tasks: Task[]) {
  return groupTasksByDate(tasks, TODAY).map(
    (g) => `${g.label}: ${g.tasks.map((t) => t.id).join(',')}`
  );
}

/**
 * The same, keyed by section id rather than label.
 *
 * A dated section is labelled with `toLocaleDateString`, so its text depends
 * on the reader's locale — asserting on it would only prove which machine ran
 * the test. The id is the ISO date and is stable everywhere.
 */
function shapeById(tasks: Task[], today = TODAY) {
  return groupTasksByDate(tasks, today).map(
    (g) => `${g.id}: ${g.tasks.map((t) => t.id).join(',')}`
  );
}

console.log('--- chronological grouping ---');

check('an empty list has no sections', shape([]), []);

check(
  'a task due today lands in Today',
  shape([task('a', { dueDate: TODAY })]),
  ['Today: a']
);

check(
  'a task due yesterday lands in Overdue',
  shape([task('a', { dueDate: '2026-09-16' })]),
  ['Overdue: a']
);

check(
  'a task due tomorrow lands in Tomorrow',
  shape([task('a', { dueDate: '2026-09-18' })]),
  ['Tomorrow: a']
);

check(
  'a task with no date lands in No date',
  shape([task('a')]),
  ['No date: a']
);

check(
  'sections appear in chronological order regardless of input order',
  shapeById([
    task('later', { dueDate: '2026-09-25' }),
    task('none'),
    task('today', { dueDate: TODAY }),
    task('late', { dueDate: '2026-09-10' }),
    task('tmw', { dueDate: '2026-09-18' }),
  ]),
  [
    'overdue: late',
    'today: today',
    'tomorrow: tmw',
    '2026-09-25: later',
    'anytime: none',
  ]
);

check(
  'each further date gets its own section, earliest first',
  shapeById([
    task('c', { dueDate: '2026-10-02' }),
    task('a', { dueDate: '2026-09-20' }),
    task('b', { dueDate: '2026-09-21' }),
  ]),
  ['2026-09-20: a', '2026-09-21: b', '2026-10-02: c']
);

check(
  'tasks sharing a date share a section',
  shapeById([task('a', { dueDate: '2026-09-20' }), task('b', { dueDate: '2026-09-20' })]),
  ['2026-09-20: a,b']
);

console.log('\n--- the section is a consequence of the date, not a stored field ---');

// The same task, one day later, with nothing about the task itself changed.
const t = task('a', { dueDate: '2026-09-18' });
check('on the 17th it is Tomorrow', groupTasksByDate([t], '2026-09-17')[0].label, 'Tomorrow');
check('on the 18th it is Today', groupTasksByDate([t], '2026-09-18')[0].label, 'Today');
check('on the 19th it is Overdue', groupTasksByDate([t], '2026-09-19')[0].label, 'Overdue');

console.log('\n--- overdue ---');

check(
  'overdue is the first section when it exists',
  shape([task('t', { dueDate: TODAY }), task('o', { dueDate: '2026-09-01' })])[0],
  'Overdue: o'
);

check(
  'the longest-waiting overdue task comes first',
  shape([
    task('recent', { dueDate: '2026-09-16' }),
    task('ancient', { dueDate: '2026-08-01' }),
    task('middle', { dueDate: '2026-09-10' }),
  ]),
  ['Overdue: ancient,middle,recent']
);

check(
  'overdue is the only section flagged as a warning',
  groupTasksByDate(
    [task('o', { dueDate: '2026-09-01' }), task('t', { dueDate: TODAY })],
    TODAY
  ).map((g) => `${g.id}:${g.tone ?? 'none'}`),
  ['overdue:warn', 'today:none']
);

console.log('\n--- completed tasks leave the active list, and only the list ---');

const mixed = [
  task('open', { dueDate: TODAY }),
  task('done', { dueDate: TODAY, completed: true, completedAt: '2026-09-17T08:00:00.000Z' }),
];

check('a completed task is not in any section', shape(mixed), ['Today: open']);

check(
  'the completed task is untouched in the source list',
  mixed.filter((x) => x.completed).map((x) => `${x.id}@${x.completedAt}`),
  ['done@2026-09-17T08:00:00.000Z']
);

check(
  'a completed overdue task does not keep the Overdue section alive',
  shape([task('d', { dueDate: '2026-09-01', completed: true })]),
  []
);

check(
  'completing the last task of a section removes the section',
  shape([task('a', { dueDate: '2026-09-20', completed: true }), task('b', { dueDate: TODAY })]),
  ['Today: b']
);

console.log('\n--- ordering within a section ---');

check(
  'a supplied comparator orders tasks inside a section',
  groupTasksByDate(
    [
      task('low', { dueDate: TODAY, priority: 'low' }),
      task('critical', { dueDate: TODAY, priority: 'critical' }),
      task('normal', { dueDate: TODAY, priority: 'normal' }),
    ],
    TODAY,
    (a, b) => {
      const rank = { critical: 0, high: 1, normal: 2, low: 3 } as const;
      return rank[a.priority] - rank[b.priority];
    }
  )[0].tasks.map((x) => x.id),
  ['critical', 'normal', 'low']
);

check(
  'ordering inside one section does not leak into another',
  groupTasksByDate(
    [
      task('t1', { dueDate: TODAY }),
      task('m1', { dueDate: '2026-09-18' }),
      task('t2', { dueDate: TODAY }),
      task('m2', { dueDate: '2026-09-18' }),
    ],
    TODAY,
    (a, b) => b.id.localeCompare(a.id)
  ).map((g) => `${g.id}:${g.tasks.map((x) => x.id).join(',')}`),
  ['today:t2,t1', 'tomorrow:m2,m1']
);

console.log('\n--- awkward data ---');

check(
  'a month boundary still produces Tomorrow',
  groupTasksByDate([task('a', { dueDate: '2026-10-01' })], '2026-09-30')[0].label,
  'Tomorrow'
);

check(
  'a year boundary still produces Tomorrow',
  groupTasksByDate([task('a', { dueDate: '2027-01-01' })], '2026-12-31')[0].label,
  'Tomorrow'
);

check(
  'a date in another year carries the year in its label',
  groupTasksByDate([task('a', { dueDate: '2027-03-04' })], TODAY)[0].label.includes('2027'),
  true
);

check(
  'a date in this year does not carry the year',
  groupTasksByDate([task('a', { dueDate: '2026-11-04' })], TODAY)[0].label.includes('2026'),
  false
);

check(
  'a leap day is handled',
  groupTasksByDate([task('a', { dueDate: '2028-02-29' })], '2028-02-28')[0].label,
  'Tomorrow'
);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
