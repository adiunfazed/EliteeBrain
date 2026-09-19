import type {
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  RoutineBlock,
  RoutineLog,
  Task,
  UserProfile,
} from '../types';
import type { WorkoutSession } from './bodyTraining';
import { isScheduledOn, isCompleteOn, habitStats } from './habits';
import { blocksForDate } from './routine';

/**
 * ELI's context engine.
 *
 * Deliberately deterministic. Every suggestion below is a rule over data the
 * app already has, so ELI cannot invent a statistic, cannot describe activity
 * that did not happen, and costs nothing to evaluate — no request, no latency,
 * no spend. Open-ended questions still go to the existing chat, which is where
 * a language model belongs.
 *
 * The consequence worth knowing: because a suggestion is a pure function of
 * live data, it stops existing the moment it stops being true. Finish the
 * workout and the "finish your workout" line is not dismissed or expired, it
 * is simply never generated again.
 *
 * Nothing here reads a user id. It is handed the data the caller already
 * subscribed to for the signed-in account, so there is no path by which it
 * could reach another account's records.
 */

export type EliSignalKind =
  | 'overdue-priority'
  | 'postponed'
  | 'due-today'
  | 'tasks-left'
  | 'habit-at-risk'
  | 'routine-missed'
  | 'quest'
  | 'new-record'
  | 'workout-done'
  | 'focus-progress'
  | 'goal-deadline'
  | 'goal-untouched'
  | 'day-summary'
  | 'inactive'
  | 'first-steps';

/** What a suggestion can offer to do, in terms the app already supports. */
export type EliActionId =
  | 'open-tasks'
  | 'start-focus'
  | 'open-habits'
  | 'open-routine'
  | 'open-goals'
  | 'open-quest'
  | 'open-training'
  | 'open-progress'
  | 'ask'
  | 'later'
  | 'dismiss';

export interface EliAction {
  id: EliActionId;
  label: string;
  /** The task this action concerns, where one applies. */
  taskId?: string;
}

export interface EliSuggestion {
  /**
   * Stable across renders for the same underlying fact.
   *
   * Includes the subject, so dismissing a nudge about one task does not
   * silence the same kind of nudge about a different one.
   */
  id: string;
  kind: EliSignalKind;
  /** One or two short sentences. Facts, not encouragement. */
  message: string;
  tone: 'nudge' | 'warn' | 'praise';
  /** Higher wins when several rules fire at once. */
  score: number;
  actions: EliAction[];
  /** How long "later" should hold this back, in minutes. */
  snoozeMinutes: number;
}

export interface EliContext {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  goals: Goal[];
  workouts: WorkoutSession[];
  /** Best single set per exercise, for spotting a record set today. */
  records?: Record<string, number>;
  profile?: Partial<UserProfile> | null;
  /** Injected so the rules are testable at any hour. */
  now?: Date;
}

/* ------------------------------------------------------------------ */
/* Suppression                                                         */
/* ------------------------------------------------------------------ */

/** suggestionId → epoch ms until which it stays hidden. */
export type EliMemory = Record<string, number>;

/**
 * Keyed per account.
 *
 * Switching accounts must not carry one person's dismissals — or the shape of
 * their day — into another's session, so the key includes the uid and a
 * signed-out session gets its own bucket.
 */
export function eliMemoryKey(userId: string | null): string {
  return `elitelife_eli_memory_${userId || 'guest'}`;
}

export function loadEliMemory(userId: string | null): EliMemory {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(eliMemoryKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};

    // Expired entries are dropped on read, so the record cannot grow without
    // bound as tasks come and go.
    const now = Date.now();
    const out: EliMemory = {};
    for (const [id, until] of Object.entries(parsed as Record<string, unknown>)) {
      const ms = Number(until);
      if (Number.isFinite(ms) && ms > now) out[id] = ms;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveEliMemory(userId: string | null, memory: EliMemory): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(eliMemoryKey(userId), JSON.stringify(memory));
  } catch {
    /* private mode or quota — suppression simply lasts this session */
  }
}

/** Hide one suggestion for a while. */
export function suppressSuggestion(
  memory: EliMemory,
  id: string,
  minutes: number,
  now = Date.now()
): EliMemory {
  return { ...memory, [id]: now + Math.max(1, minutes) * 60_000 };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ACT = {
  openTasks: (label = 'Open task', taskId?: string): EliAction => ({
    id: 'open-tasks',
    label,
    taskId,
  }),
  focus: (taskId?: string): EliAction => ({ id: 'start-focus', label: 'Start focus', taskId }),
  habits: (label = 'Complete habit'): EliAction => ({ id: 'open-habits', label }),
  routine: (label = 'Open routine'): EliAction => ({ id: 'open-routine', label }),
  goals: (label = 'View goal'): EliAction => ({ id: 'open-goals', label }),
  quest: (label = 'Do quest'): EliAction => ({ id: 'open-quest', label }),
  training: (label = 'Open training'): EliAction => ({ id: 'open-training', label }),
  progress: (label = 'View progress'): EliAction => ({ id: 'open-progress', label }),
};

/** "3 tasks" / "1 task" — a count with the right noun, never "1 tasks". */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function minutesSinceMidnight(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Local YYYY-MM-DD for a given moment. */
function isoOf(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function parseHm(hm?: string): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00`);
  const b = Date.parse(`${toISO}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/**
 * Every suggestion the current data supports, unscored by relevance order.
 *
 * Each rule states only what it can see. Where a number is not available the
 * rule produces nothing rather than a vaguer version of itself.
 */
export function buildSuggestions(ctx: EliContext): EliSuggestion[] {
  const now = ctx.now ?? new Date();
  // Derived from the same clock as the time of day, so a test that sets the
  // hour cannot end up comparing it against today's real date.
  const today = isoOf(now);
  const clock = minutesSinceMidnight(now);
  const out: EliSuggestion[] = [];

  const tasks = ctx.tasks || [];
  const open = tasks.filter((t) => !t.completed);

  /* ---- tasks ---- */

  const overdue = open
    .filter((t) => !!t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  const urgentOverdue = overdue.filter(
    (t) => t.priority === 'critical' || t.priority === 'high'
  );

  if (urgentOverdue.length > 0) {
    const worst = urgentOverdue[0];
    const late = daysBetween(worst.dueDate!, today);
    out.push({
      id: `overdue-priority:${worst.id}`,
      kind: 'overdue-priority',
      message:
        late === 1
          ? `"${worst.title}" was due yesterday and is still open.`
          : `"${worst.title}" was due ${late} days ago and is still open.`,
      tone: 'warn',
      score: 95,
      actions: [ACT.focus(worst.id), ACT.openTasks('Open task', worst.id)],
      snoozeMinutes: 180,
    });
  } else if (overdue.length > 0) {
    const worst = overdue[0];
    out.push({
      id: `overdue:${worst.id}`,
      kind: 'overdue-priority',
      message:
        overdue.length === 1
          ? `"${worst.title}" is past its date.`
          : `${plural(overdue.length, 'task')} are past their date, the oldest being "${worst.title}".`,
      tone: 'warn',
      score: 70,
      actions: [ACT.openTasks('Open tasks', worst.id), ACT.focus(worst.id)],
      snoozeMinutes: 240,
    });
  }

  // Postponed repeatedly. The count is stored on the task each time its date
  // is pushed forward, so this is a fact rather than an inference.
  const postponed = open
    .filter((t) => (t.postponeCount || 0) >= 2)
    .sort((a, b) => (b.postponeCount || 0) - (a.postponeCount || 0));

  if (postponed.length > 0) {
    const worst = postponed[0];
    out.push({
      id: `postponed:${worst.id}`,
      kind: 'postponed',
      message: `"${worst.title}" has been pushed back ${
        worst.postponeCount
      } times. Block ${worst.estimatedMinutes || 30} minutes for it?`,
      tone: 'nudge',
      score: 88,
      actions: [ACT.focus(worst.id), ACT.openTasks('Open task', worst.id)],
      snoozeMinutes: 360,
    });
  }

  const dueToday = open.filter((t) => t.dueDate === today);
  const urgentToday = dueToday.filter(
    (t) => t.priority === 'critical' || t.priority === 'high'
  );

  if (urgentToday.length > 0 && clock >= 12 * 60) {
    const first = urgentToday[0];
    out.push({
      id: `due-today:${first.id}`,
      kind: 'due-today',
      message:
        urgentToday.length === 1
          ? `"${first.title}" is high priority and still open today.`
          : `${plural(urgentToday.length, 'high-priority task')} are still open today.`,
      tone: 'nudge',
      score: 78,
      actions: [ACT.focus(first.id), ACT.openTasks('Open tasks', first.id)],
      snoozeMinutes: 120,
    });
  }

  // What is left today, at any priority. This is the line ELI opens with when
  // the app is launched, so it has to exist on an ordinary day too — not only
  // when something is late or urgent.
  if (dueToday.length > 0) {
    const order = { critical: 0, high: 1, normal: 2, low: 3 } as const;
    const first = [...dueToday].sort(
      (a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
    )[0];
    out.push({
      id: `tasks-left:${today}:${dueToday.length}`,
      kind: 'tasks-left',
      message:
        dueToday.length === 1
          ? `1 task left today: "${first.title}".`
          : `${dueToday.length} tasks left today, starting with "${first.title}".`,
      tone: 'nudge',
      score: 50,
      actions: [ACT.focus(first.id), ACT.openTasks('Open tasks', first.id)],
      snoozeMinutes: 180,
    });
  }

  /* ---- habits ---- */

  const activeHabits = (ctx.habits || []).filter((h) => h.status === 'active');

  for (const habit of activeHabits) {
    if (!isScheduledOn(habit, today)) continue;
    if (isCompleteOn(habit, ctx.habitLogs || [], today)) continue;

    const stats = habitStats(habit, ctx.habitLogs || [], today);
    // A streak is only "at risk" if there is a streak to lose, and only worth
    // saying once the day is getting on.
    if (stats.currentStreak >= 3 && clock >= 17 * 60) {
      out.push({
        id: `habit-at-risk:${habit.id}:${today}`,
        kind: 'habit-at-risk',
        message: `Your ${habit.title} streak is at ${stats.currentStreak} days and today is not logged yet.`,
        tone: 'warn',
        score: 92,
        actions: [ACT.habits(), ACT.progress('See habit')],
        snoozeMinutes: 90,
      });
      break;
    }
  }

  /* ---- routine ---- */

  const dayBlocks = blocksForDate(ctx.routineBlocks || [], ctx.routineLogs || [], today);
  const missed = dayBlocks.filter((b) => {
    const end = parseHm(b.block?.endTime);
    return b.state !== 'done' && end !== null && end < clock;
  });

  if (missed.length > 0) {
    const title = missed[0].block?.title;
    if (title) {
      out.push({
        id: `routine-missed:${title}:${today}`,
        kind: 'routine-missed',
        message:
          missed.length === 1
            ? `Your "${title}" block finished without being marked done.`
            : `${plural(missed.length, 'routine block')} today have passed unmarked.`,
        tone: 'nudge',
        score: 55,
        actions: [ACT.routine()],
        snoozeMinutes: 240,
      });
    }
  }

  /* ---- training ---- */

  const workouts = ctx.workouts || [];
  const todaysWorkouts = workouts.filter((w) => w.date === today);

  // A record set today. Read from the record values against the sessions, so
  // it is only ever claimed when both agree it happened today.
  const recordToday = todaysWorkouts.find((w) => (w.prXp || 0) > 0);
  if (recordToday) {
    const exerciseId = Object.keys(recordToday.results || {})[0];
    const value = ctx.records?.[exerciseId];
    if (exerciseId && value) {
      out.push({
        id: `new-record:${recordToday.id}`,
        kind: 'new-record',
        message: `You set a personal record today: ${value} in one set.`,
        tone: 'praise',
        score: 84,
        actions: [ACT.training('See training'), ACT.progress()],
        snoozeMinutes: 720,
      });
    }
  }

  if (todaysWorkouts.length > 0 && !recordToday) {
    const sets = todaysWorkouts.reduce(
      (n, w) => n + Object.values(w.completed || {}).reduce((a, b) => a + b, 0),
      0
    );
    if (sets > 0) {
      out.push({
        id: `workout-done:${today}`,
        kind: 'workout-done',
        message: `${plural(sets, 'set')} done today. That is training logged.`,
        tone: 'praise',
        score: 40,
        actions: [ACT.training('Train again')],
        snoozeMinutes: 480,
      });
    }
  }

  /* ---- focus ---- */

  const focusToday = (ctx.focusSessions || []).filter(
    (s) => (s.endedAt || '').slice(0, 10) === today && s.completed
  );

  if (focusToday.length >= 2) {
    out.push({
      id: `focus-progress:${today}:${focusToday.length}`,
      kind: 'focus-progress',
      message: `${plural(focusToday.length, 'focus session')} finished today. Good run.`,
      tone: 'praise',
      score: 38,
      actions: [ACT.focus()],
      snoozeMinutes: 240,
    });
  }

  /* ---- goals ---- */

  const activeGoals = (ctx.goals || []).filter((g) => g.status === 'active');

  for (const goal of activeGoals) {
    if (!goal.deadline) continue;
    const left = daysBetween(today, goal.deadline);
    if (left < 0 || left > 7) continue;

    const linked = open.filter((t) => t.goalId === goal.id).length;
    out.push({
      id: `goal-deadline:${goal.id}`,
      kind: 'goal-deadline',
      message:
        left === 0
          ? `"${goal.title}" is due today${linked > 0 ? ` with ${plural(linked, 'task')} still open` : ''}.`
          : `"${goal.title}" is due in ${plural(left, 'day')}${
              linked > 0 ? ` with ${plural(linked, 'task')} still open` : ''
            }.`,
      tone: left <= 1 ? 'warn' : 'nudge',
      score: left <= 1 ? 86 : 64,
      actions: [ACT.goals(), ...(linked > 0 ? [ACT.openTasks('Open tasks')] : [])],
      snoozeMinutes: 480,
    });
    break;
  }

  // A goal with nothing attached to it is a wish, not a plan — but this is
  // only worth raising when there is other work to compare it against.
  if (out.length === 0 && activeGoals.length > 0 && open.length > 0) {
    const orphan = activeGoals.find((g) => !open.some((t) => t.goalId === g.id));
    if (orphan) {
      out.push({
        id: `goal-untouched:${orphan.id}`,
        kind: 'goal-untouched',
        message: `"${orphan.title}" has no open tasks attached to it.`,
        tone: 'nudge',
        score: 30,
        actions: [ACT.goals(), ACT.openTasks('Add a task')],
        snoozeMinutes: 1440,
      });
    }
  }

  /* ---- daily quest ---- */

  const questDone = ctx.profile?.questLog?.date === today;
  if (!questDone && clock >= 10 * 60) {
    out.push({
      id: `quest:${today}`,
      kind: 'quest',
      message: 'Today’s quest is still open.',
      tone: 'nudge',
      score: 34,
      actions: [ACT.quest()],
      snoozeMinutes: 240,
    });
  }

  /* ---- end of day ---- */

  if (clock >= 20 * 60) {
    const doneToday = tasks.filter(
      (t) => t.completed && (t.completedAt || '').slice(0, 10) === today
    ).length;
    const plannedToday = doneToday + dueToday.length;

    if (plannedToday > 0) {
      out.push({
        id: `day-summary:${today}:${doneToday}/${plannedToday}`,
        kind: 'day-summary',
        message:
          dueToday.length === 0
            ? `${doneToday} of ${plannedToday} planned today, all done.`
            : `${doneToday} of ${plannedToday} planned today. ${plural(
                dueToday.length,
                'task'
              )} left.`,
        tone: dueToday.length === 0 ? 'praise' : 'nudge',
        score: dueToday.length === 0 ? 46 : 52,
        actions: dueToday.length === 0 ? [ACT.progress()] : [ACT.openTasks('Open tasks')],
        snoozeMinutes: 240,
      });
    }
  }

  /* ---- dormancy ---- */

  const lastActivity = [
    ...tasks.map((t) => (t.completedAt || '').slice(0, 10)),
    ...(ctx.focusSessions || []).map((s) => (s.endedAt || '').slice(0, 10)),
    ...(ctx.habitLogs || []).map((l) => l.date),
    ...workouts.map((w) => w.date),
  ]
    .filter(Boolean)
    .sort()
    .pop();

  if (lastActivity && daysBetween(lastActivity, today) >= 4) {
    const gap = daysBetween(lastActivity, today);
    out.push({
      id: `inactive:${lastActivity}`,
      kind: 'inactive',
      message: `Nothing has been logged for ${plural(gap, 'day')}. Pick one small thing to restart with.`,
      tone: 'nudge',
      score: 60,
      actions: [ACT.openTasks('Open tasks'), ACT.quest('Do quest')],
      snoozeMinutes: 720,
    });
  }

  /* ---- a genuinely empty account ---- */

  if (
    open.length === 0 &&
    activeHabits.length === 0 &&
    activeGoals.length === 0 &&
    tasks.length === 0
  ) {
    out.push({
      id: 'first-steps',
      kind: 'first-steps',
      message: 'Nothing is set up yet. Add one task for today and I will track it from there.',
      tone: 'nudge',
      // Above the quest nudge: with an empty account, setting something up is
      // more use than being pointed at a quest.
      score: 36,
      actions: [ACT.openTasks('Add a task')],
      snoozeMinutes: 1440,
    });
  }

  return out;
}

/**
 * The one suggestion worth showing, or nothing at all.
 *
 * Nothing at all is the normal state, and is a feature: a coach that always
 * has something to say is one people stop reading.
 */
export function pickSuggestion(
  ctx: EliContext,
  memory: EliMemory = {},
  now = Date.now()
): EliSuggestion | null {
  const candidates = buildSuggestions(ctx)
    .filter((s) => !(memory[s.id] && memory[s.id] > now))
    // Ties broken by id so the same data never produces a different answer
    // between two renders.
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return candidates[0] ?? null;
}
