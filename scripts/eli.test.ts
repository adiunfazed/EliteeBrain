/**
 * ELI's context engine.
 *
 * The engine's only job is to be trustworthy: to speak when there is
 * something real to say, to stay quiet otherwise, and never to state a number
 * it cannot see. These checks are all about that.
 *
 * Run: npx esbuild scripts/eli.test.ts --bundle --platform=node --outfile=/tmp/eli.cjs && node /tmp/eli.cjs
 */

import {
  EliContext,
  EliMemory,
  buildSuggestions,
  eliMemoryKey,
  pickSuggestion,
  suppressSuggestion,
} from '../src/lib/eli';
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

function ok(name: string, condition: boolean): void {
  check(name, condition, true);
}

/** 18 Sept 2026 at a chosen hour, local. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 18, hour, minute, 0, 0);
}

const TODAY = '2026-09-18';
const YESTERDAY = '2026-09-17';

function ctx(over: Partial<EliContext> = {}): EliContext {
  return {
    tasks: [],
    habits: [],
    habitLogs: [],
    focusSessions: [],
    routineBlocks: [],
    routineLogs: [],
    goals: [],
    workouts: [],
    records: {},
    profile: {},
    now: at(14),
    ...over,
  };
}

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

const kinds = (c: EliContext) => buildSuggestions(c).map((s) => s.kind);
const pickKind = (c: EliContext, m: EliMemory = {}) => pickSuggestion(c, m, at(14).getTime())?.kind ?? null;
const message = (c: EliContext) => pickSuggestion(c, {}, at(14).getTime())?.message ?? null;

console.log('--- quiet by default ---');

check('an account with nothing in it at all gets the first-steps line', pickKind(ctx()), 'first-steps');

check(
  'an ordinary day with nothing notable says nothing',
  pickKind(
    ctx({
      tasks: [task('a', { dueDate: '2026-09-25' })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  null
);

check(
  'a task due today is mentioned from the morning, as what is left',
  pickKind(
    ctx({
      tasks: [task('a', { dueDate: TODAY, priority: 'high' })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  'tasks-left'
);

console.log('\n--- what is left today (the launch briefing) ---');

check(
  'one task left is named',
  message(
    ctx({
      tasks: [task('Edit videos', { dueDate: TODAY })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  '1 task left today: "Edit videos".'
);

check(
  'several are counted, and the most important is named first',
  message(
    ctx({
      tasks: [
        task('Low thing', { dueDate: TODAY, priority: 'low' }),
        task('Big thing', { dueDate: TODAY, priority: 'critical' }),
        task('Mid thing', { dueDate: TODAY }),
      ],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  '3 tasks left today, starting with "Big thing".'
);

check(
  'completed tasks are not counted as left',
  message(
    ctx({
      tasks: [
        task('Done', { dueDate: TODAY, completed: true, completedAt: `${TODAY}T08:00:00.000Z` }),
        task('Open', { dueDate: TODAY }),
      ],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  '1 task left today: "Open".'
);

check(
  'tomorrow\'s tasks are not "left today"',
  kinds(ctx({ tasks: [task('a', { dueDate: '2026-09-19' })], now: at(9) })).includes('tasks-left'),
  false
);

check(
  'an overdue task still outranks the list of what is left',
  pickKind(
    ctx({
      tasks: [
        task('Late', { dueDate: YESTERDAY, priority: 'high' }),
        task('Today', { dueDate: TODAY }),
      ],
    })
  ),
  'overdue-priority'
);

console.log('\n--- overdue and postponed ---');

check(
  'a high-priority overdue task wins',
  pickKind(ctx({ tasks: [task('a', { dueDate: YESTERDAY, priority: 'high' })] })),
  'overdue-priority'
);

check(
  'and it says how late it is, from the date itself',
  message(ctx({ tasks: [task('Physics DPP', { dueDate: YESTERDAY, priority: 'high' })] })),
  '"Physics DPP" was due yesterday and is still open. What is holding it up?'
);

check(
  'several days late is counted, not rounded to "a while"',
  message(ctx({ tasks: [task('Chem revision', { dueDate: '2026-09-14', priority: 'critical' })] })),
  '"Chem revision" was due 4 days ago and is still open. What is holding it up?'
);

check(
  'a repeatedly postponed task is named with its real count',
  message(
    ctx({
      tasks: [task('Call the bank', { dueDate: TODAY, postponeCount: 3, estimatedMinutes: 20 })],
    })
  ),
  '"Call the bank" has been pushed back 3 times. Block 20 minutes for it?'
);

check(
  'two postponements is the floor, one is not a pattern',
  kinds(ctx({ tasks: [task('a', { dueDate: TODAY, postponeCount: 1 })], now: at(9) })).includes('postponed'),
  false
);

check(
  'a completed task is never the subject of a nudge',
  pickKind(
    ctx({
      tasks: [task('a', { dueDate: YESTERDAY, priority: 'high', completed: true, completedAt: `${TODAY}T09:00:00.000Z` })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(9),
    })
  ),
  null
);

console.log('\n--- the suggestion disappears when it stops being true ---');

// The case the brief calls out: finish the thing, and the line about it is
// not dismissed or expired — it is simply never generated again.
{
  const open = ctx({ tasks: [task('Workout plan', { dueDate: YESTERDAY, priority: 'high' })] });
  check('while open, ELI mentions it', pickKind(open), 'overdue-priority');

  const done = ctx({
    tasks: [
      task('Workout plan', {
        dueDate: YESTERDAY,
        priority: 'high',
        completed: true,
        completedAt: `${TODAY}T14:00:00.000Z`,
      }),
    ],
    profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
  });
  check('once completed, that suggestion no longer exists', kinds(done).includes('overdue-priority'), false);
}

console.log('\n--- training ---');

check(
  'a record set today is reported with the real figure',
  message(
    ctx({
      workouts: [
        {
          id: 'w1',
          date: TODAY,
          items: [{ exerciseId: 'pushups' as any, sets: 3, target: 30, difficulty: 'easy' }],
          completed: { pushups: 3 },
          results: { pushups: [30, 30, 30] },
          startedAt: `${TODAY}T10:00:00.000Z`,
          finishedAt: `${TODAY}T10:20:00.000Z`,
          xpAwarded: 15,
          prXp: 25,
        },
      ],
      records: { pushups: 30 },
    })
  ),
  'You set a personal record today: 30 in one set.'
);

check(
  'a record with no figure available is not claimed at all',
  kinds(
    ctx({
      workouts: [
        {
          id: 'w1',
          date: TODAY,
          items: [{ exerciseId: 'pushups' as any, sets: 1, target: 30, difficulty: 'easy' }],
          completed: { pushups: 1 },
          results: { pushups: [30] },
          startedAt: `${TODAY}T10:00:00.000Z`,
          xpAwarded: 5,
          prXp: 25,
        },
      ],
      // The record map is empty, so there is no number to state.
      records: {},
    })
  ).includes('new-record'),
  false
);

check(
  'a plain workout is acknowledged by its real set count',
  message(
    ctx({
      workouts: [
        {
          id: 'w1',
          date: TODAY,
          items: [{ exerciseId: 'squats' as any, sets: 3, target: 20, difficulty: 'easy' }],
          completed: { squats: 3 },
          startedAt: `${TODAY}T10:00:00.000Z`,
          xpAwarded: 15,
        },
      ],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
    })
  ),
  '3 sets done today. That is training logged.'
);

check(
  "yesterday's workout is not described as today's",
  kinds(
    ctx({
      workouts: [
        {
          id: 'w1',
          date: YESTERDAY,
          items: [{ exerciseId: 'squats' as any, sets: 3, target: 20, difficulty: 'easy' }],
          completed: { squats: 3 },
          startedAt: `${YESTERDAY}T10:00:00.000Z`,
          xpAwarded: 15,
        },
      ],
    })
  ).includes('workout-done'),
  false
);

console.log('\n--- focus ---');

const focusSession = (endedAt: string, completed = true) => ({
  id: endedAt,
  taskTitle: 'x',
  plannedMinutes: 25,
  focusedSeconds: 1500,
  startedAt: endedAt,
  endedAt,
  completed,
});

check(
  'two finished focus sessions today are counted exactly',
  message(
    ctx({
      focusSessions: [
        focusSession(`${TODAY}T09:00:00.000Z`),
        focusSession(`${TODAY}T11:00:00.000Z`),
      ],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
    })
  ),
  '2 focus sessions finished today. Good run.'
);

check(
  'an abandoned session does not count toward that',
  kinds(
    ctx({
      focusSessions: [
        focusSession(`${TODAY}T09:00:00.000Z`),
        focusSession(`${TODAY}T11:00:00.000Z`, false),
      ],
    })
  ).includes('focus-progress'),
  false
);

console.log('\n--- goals ---');

const goal = (over: any = {}) => ({
  id: 'g1',
  title: 'Ship v2',
  metric: 'completion',
  status: 'active',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

check(
  'a goal due today is flagged with its open task count',
  message(
    ctx({
      goals: [goal({ deadline: TODAY })] as any,
      tasks: [task('t1', { goalId: 'g1' }), task('t2', { goalId: 'g1' })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
    })
  ),
  '"Ship v2" is due today with 2 tasks still open.'
);

check(
  'a goal far in the future is not mentioned',
  kinds(ctx({ goals: [goal({ deadline: '2027-01-01' })] as any })).includes('goal-deadline'),
  false
);

check(
  'a completed goal is not mentioned',
  kinds(ctx({ goals: [goal({ deadline: TODAY, status: 'completed' })] as any })).includes('goal-deadline'),
  false
);

console.log('\n--- end of day ---');

check(
  'an evening summary uses real counts',
  message(
    ctx({
      tasks: [
        task('a', { completed: true, completedAt: `${TODAY}T10:00:00.000Z` }),
        task('b', { completed: true, completedAt: `${TODAY}T11:00:00.000Z` }),
        task('c', { dueDate: TODAY }),
      ],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(21),
    })
  ),
  '2 of 3 planned today. 1 task left.'
);

check(
  'a clean sweep reads as one',
  message(
    ctx({
      tasks: [task('a', { completed: true, completedAt: `${TODAY}T10:00:00.000Z` })],
      profile: { questLog: { date: TODAY, id: 'q', title: 'q', xp: 10 } } as any,
      now: at(21),
    })
  ),
  '1 of 1 planned today, all done.'
);

check(
  'no summary before the evening',
  kinds(
    ctx({
      tasks: [task('a', { completed: true, completedAt: `${TODAY}T10:00:00.000Z` })],
      now: at(15),
    })
  ).includes('day-summary'),
  false
);

console.log('\n--- one at a time, highest relevance first ---');

{
  const busy = ctx({
    tasks: [
      task('Late thing', { dueDate: YESTERDAY, priority: 'critical' }),
      task('Pushed thing', { dueDate: TODAY, postponeCount: 4 }),
    ],
    goals: [goal({ deadline: TODAY })] as any,
    now: at(21),
  });

  ok('several rules fire at once', buildSuggestions(busy).length >= 3);
  check('but only one is surfaced', pickSuggestion(busy, {}, at(21).getTime()) !== null, true);
  check('and it is the most pressing', pickKind(busy), 'overdue-priority');
}

console.log('\n--- dismissal and cooldown ---');

{
  const c = ctx({
    tasks: [
      task('Late thing', { dueDate: YESTERDAY, priority: 'critical' }),
      task('Pushed thing', { dueDate: TODAY, postponeCount: 4 }),
    ],
  });

  const first = pickSuggestion(c, {}, at(14).getTime())!;
  check('the first pick is the overdue task', first.kind, 'overdue-priority');

  const memory = suppressSuggestion({}, first.id, first.snoozeMinutes, at(14).getTime());
  const second = pickSuggestion(c, memory, at(14).getTime())!;
  check('after dismissing it, the next most relevant appears', second.kind, 'postponed');
  check('and the dismissed one does not come straight back', second.id === first.id, false);

  // Still suppressed an hour later, back once the window passes.
  const hourLater = at(15).getTime();
  check(
    'it stays suppressed inside its window',
    pickSuggestion(c, memory, hourLater)!.kind,
    'postponed'
  );
  const wellLater = at(14).getTime() + (first.snoozeMinutes + 1) * 60_000;
  check('and returns afterwards', pickSuggestion(c, memory, wellLater)!.kind, 'overdue-priority');
}

check(
  'dismissing every candidate leaves ELI silent',
  (() => {
    const c = ctx({ tasks: [task('a', { dueDate: YESTERDAY, priority: 'high' })] });
    let memory: EliMemory = {};
    for (const s of buildSuggestions(c)) {
      memory = suppressSuggestion(memory, s.id, s.snoozeMinutes, at(14).getTime());
    }
    return pickSuggestion(c, memory, at(14).getTime());
  })(),
  null
);

console.log('\n--- stable, and never guessing ---');

{
  const c = ctx({ tasks: [task('a', { dueDate: YESTERDAY, priority: 'high' })] });
  const a = pickSuggestion(c, {}, at(14).getTime());
  const b = pickSuggestion(c, {}, at(14).getTime());
  check('the same data always gives the same answer', a?.id, b?.id);
}

check(
  'every suggestion carries at least one real action',
  buildSuggestions(
    ctx({
      tasks: [task('a', { dueDate: YESTERDAY, priority: 'high' }), task('b', { postponeCount: 3 })],
      goals: [goal({ deadline: TODAY })] as any,
      now: at(21),
    })
  ).every((s) => s.actions.length > 0),
  true
);

check(
  'messages stay short',
  buildSuggestions(
    ctx({
      tasks: [task('a', { dueDate: YESTERDAY, priority: 'high' }), task('b', { postponeCount: 3 })],
      goals: [goal({ deadline: TODAY })] as any,
      now: at(21),
    })
  ).every((s) => s.message.length <= 160),
  true
);

console.log('\n--- missing and broken data ---');

ok(
  'an entirely empty context does not throw',
  Array.isArray(
    buildSuggestions({
      tasks: [],
      habits: [],
      habitLogs: [],
      focusSessions: [],
      routineBlocks: [],
      routineLogs: [],
      goals: [],
      workouts: [],
    })
  )
);

ok(
  'undefined collections do not throw',
  Array.isArray(buildSuggestions({} as unknown as EliContext))
);

ok(
  'a task with no date is never called overdue',
  !kinds(ctx({ tasks: [task('a')] })).includes('overdue-priority')
);

ok(
  'a corrupt due date is not turned into a day count',
  !kinds(ctx({ tasks: [task('a', { dueDate: 'not-a-date' })] })).some((k) =>
    k.startsWith('overdue')
  )
);


console.log('\n--- habits that keep slipping ---');

const hb = (id: string, over: any = {}) => ({
  id,
  title: id,
  cadence: 'daily',
  metric: 'yes_no',
  targetValue: 1,
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over,
});
const hlog = (habitId: string, date: string) => ({ id: `${date}__${habitId}`, habitId, date, value: 1, updatedAt: '' });
const pastDays = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(2026, 8, 18 - (i + 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

{
  const c = ctx({ habits: [hb('Meditate')] as any, habitLogs: [hlog('Meditate', pastDays(7)[2])] as any });
  const s = buildSuggestions(c).find((x) => x.kind === 'habit-slipping');
  ok('a daily habit done once in seven days is flagged', !!s);
  check(
    'with the real count, and a question',
    s?.message,
    '"Meditate" was done 1 of the last 7 times it was due. What\'s getting in the way?'
  );
  ok('and it offers to talk it through', !!s?.actions.some((a) => a.id === 'ask'));
}

check(
  'never done at all is said plainly',
  buildSuggestions(ctx({ habits: [hb('Stretch')] as any })).find((x) => x.kind === 'habit-slipping')?.message,
  '"Stretch" was due 7 times this past week and wasn\'t done once. What\'s getting in the way?'
);

ok(
  'a habit done most days is left alone',
  !kinds(ctx({ habits: [hb('Read')] as any, habitLogs: pastDays(6).map((d) => hlog('Read', d)) as any })).includes('habit-slipping')
);

ok(
  'a habit made two days ago is not judged on days before it existed',
  !kinds(ctx({ habits: [hb('New', { createdAt: '2026-09-16T08:00:00.000Z' })] as any })).includes('habit-slipping')
);

ok(
  'an archived habit is never flagged',
  !kinds(ctx({ habits: [hb('Old', { status: 'archived' })] as any })).some((k) => k.startsWith('habit'))
);

{
  // Done every day but yesterday: not slipping, but yesterday was missed.
  const days = pastDays(7).filter((d) => d !== YESTERDAY);
  const c = ctx({ habits: [hb('Walk')] as any, habitLogs: days.map((d) => hlog('Walk', d)) as any });
  check('a single missed day is asked about', kinds(c).includes('habit-missed'), true);
  check(
    'by name',
    buildSuggestions(c).find((x) => x.kind === 'habit-missed')?.message,
    'You missed "Walk" yesterday. Did something come up? Today is still open.'
  );
  const doneToday = ctx({ habits: [hb('Walk')] as any, habitLogs: [...days, TODAY].map((d) => hlog('Walk', d)) as any });
  ok('but not once today is already done', !kinds(doneToday).includes('habit-missed'));
}

ok(
  'a twice-a-week habit met twice is neither slipping nor missed',
  !kinds(ctx({ habits: [hb('Run', { cadence: 'weekly', timesPerWeek: 2 })] as any, habitLogs: [hlog('Run', pastDays(7)[1]), hlog('Run', pastDays(7)[4])] as any })).some((k) => k === 'habit-slipping' || k === 'habit-missed')
);

console.log('\n--- training that has gone quiet ---');

const wk = (date: string) => ({ id: `w-${date}`, date, results: {}, completed: {} });

{
  const c = ctx({ workouts: [wk('2026-09-10'), wk('2026-09-12')] as any });
  const s = buildSuggestions(c).find((x) => x.kind === 'training-idle');
  check(
    'six days since the last session is said with the real date',
    s?.message,
    "No body training since 12 Sep, 6 days ago. What's stopping you from a quick set today?"
  );
  check('and opens body training', s?.actions[0].id, 'open-training');
}

ok('a session two days ago is not nagged about', !kinds(ctx({ workouts: [wk('2026-09-16')] as any })).includes('training-idle'));
ok('no history at all makes no claim', !kinds(ctx({ workouts: [] })).includes('training-idle'));

console.log('\n--- mind training ---');

const mods = (dates: string[], sessions = dates.length) => ({
  modules: {
    memory: { level: 1, xp: 0, bestScore: 0, totalSessions: sessions, completedToday: false, history: dates.map((date) => ({ date, timestamp: 0, score: 1, accuracy: 1, level: 1 })) },
    focus: { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
  },
});

{
  const s = buildSuggestions(ctx({ profile: mods(['2026-09-01', '2026-09-13']) as any })).find((x) => x.kind === 'modules-idle');
  check('five days without a module is counted from the last one', s?.message, 'No mind training for 5 days. Want to do one module today?');
  check('and opens the modules tab', s?.actions[0].id, 'open-modules');
}

ok('a module yesterday is not nagged about', !kinds(ctx({ profile: mods([YESTERDAY]) as any })).includes('modules-idle'));

check(
  'an account in use that has never tried a module is invited once',
  buildSuggestions(ctx({ tasks: [task('a')], profile: mods([], 0) as any })).find((x) => x.kind === 'modules-idle')?.id,
  'modules-idle:never'
);

ok(
  'no profile means no claim either way',
  !kinds(ctx({ tasks: [task('a')], profile: null })).includes('modules-idle')
);

ok(
  'malformed history dates are ignored rather than parsed',
  !kinds(ctx({ profile: { modules: { memory: { totalSessions: 3, history: [{ date: 'yesterday' }, null] } } } as any })).includes('modules-idle')
);

console.log('\n--- goal nagging is gone ---');

ok(
  'a goal with no linked tasks is not raised',
  !buildSuggestions(ctx({ goals: [{ id: 'g', title: 'Fit', status: 'active' }] as any, tasks: [task('a')] })).some((s) =>
    /no open tasks attached|link/i.test(s.message)
  )
);

console.log('\n--- accounts are kept apart ---');

check('each account has its own suppression bucket', eliMemoryKey('alice') === eliMemoryKey('bob'), false);
check('and a signed-out session has its own', eliMemoryKey(null), 'elitelife_eli_memory_guest');

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
