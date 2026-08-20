import type { Habit, HabitLog, RoutineBlock, RoutineLog, Task } from '../types';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate, minutesOf } from './routine';

/**
 * "What should I do right now?" and "did I actually do it?"
 *
 * Both answers come from stored activity. Where the data doesn't support a
 * recommendation, this says so rather than inventing one — a confident
 * suggestion built on nothing is worse than no suggestion, because the user
 * stops trusting every later one.
 */

export interface NextAction {
  id: string;
  kind: 'task' | 'habit' | 'routine';
  title: string;
  /** Plain-language justification, drawn from real signals. */
  reason: string;
  minutes?: number;
  goalTitle?: string;
  /** Underlying task id, when the action is a task. */
  taskId?: string;
}

export interface TodayInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  goals: { id: string; title: string }[];
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 25,
  normal: 10,
  low: 0,
};

function daysUntil(date: string | undefined, today: string): number | null {
  if (!date) return null;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${date}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * The one to three things that matter most today.
 *
 * Scored on real signals: how overdue something is, how often it has been
 * pushed, its priority, whether it feeds a goal, and whether a routine block
 * for it is running right now.
 */
export function importantToday(
  input: TodayInput,
  now: Date = new Date(),
  today: string = todayISO()
): NextAction[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: { action: NextAction; score: number }[] = [];

  const goalTitle = (id?: string) => input.goals.find((g) => g.id === id)?.title;

  // --- Tasks ---
  for (const t of input.tasks) {
    if (t.completed) continue;
    const due = daysUntil(t.dueDate, today);
    // Only today's work and anything already late.
    if (due === null || due > 1) continue;

    let score = PRIORITY_WEIGHT[t.priority] ?? 10;
    const reasons: string[] = [];

    if (due < 0) {
      score += Math.min(40, Math.abs(due) * 12);
      reasons.push(`${Math.abs(due)} day${Math.abs(due) === 1 ? '' : 's'} overdue`);
    } else if (due === 0) {
      score += 18;
      reasons.push('due today');
    } else {
      score += 8;
      reasons.push('due tomorrow');
    }

    const pushed = t.postponeCount || 0;
    if (pushed > 0) {
      score += pushed * 14;
      reasons.push(`postponed ${pushed} time${pushed === 1 ? '' : 's'}`);
    }

    const gTitle = goalTitle(t.goalId);
    if (gTitle) {
      score += 12;
      reasons.push('moves a goal forward');
    }

    out.push({
      score,
      action: {
        id: `task:${t.id}`,
        kind: 'task',
        title: t.title,
        reason: reasons.join(' · '),
        minutes: t.estimatedMinutes,
        goalTitle: gTitle,
        taskId: t.id,
      },
    });
  }

  // --- A routine block happening right now outranks most planning ---
  for (const { block, state } of blocksForDate(input.routineBlocks, input.routineLogs, today)) {
    if (state !== 'pending') continue;
    const start = minutesOf(block.startTime);
    const end = minutesOf(block.endTime);
    const live = start <= nowMin && end > nowMin;
    const soon = start > nowMin && start - nowMin <= 45;
    if (!live && !soon) continue;

    out.push({
      score: live ? 70 : 34,
      action: {
        id: `block:${block.id}`,
        kind: 'routine',
        title: block.title,
        reason: live
          ? `scheduled now, ${block.startTime}–${block.endTime}`
          : `starts at ${block.startTime}`,
        minutes: Math.max(0, end - start),
        goalTitle: goalTitle(block.goalId),
      },
    });
  }

  // --- Habits not yet met today ---
  for (const h of input.habits) {
    if (h.status !== 'active' || !isScheduledOn(h, today)) continue;
    const target = Math.max(1, h.targetValue || 1);
    if (valueOn(input.habitLogs, h.id, today) >= target) continue;

    out.push({
      score: 20,
      action: {
        id: `habit:${h.id}`,
        kind: 'habit',
        title: h.title,
        reason: 'a habit you set for today',
        goalTitle: goalTitle(h.goalId),
      },
    });
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.action);
}

/** The single best next action, or null when there is nothing to recommend. */
export function nextAction(
  input: TodayInput,
  now: Date = new Date(),
  today: string = todayISO()
): NextAction | null {
  return importantToday(input, now, today)[0] || null;
}

/* ------------------------------------------------------------------ */
/* End of day                                                          */
/* ------------------------------------------------------------------ */

export interface DailyReset {
  /** True once the day is far enough along for a review to be useful. */
  ready: boolean;
  planned: number;
  completed: number;
  /** Named items still open, for the "move to tomorrow" action. */
  unfinished: { id: string; title: string; taskId?: string }[];
}

/**
 * End-of-day summary.
 *
 * Only offered after 8pm and only when something was actually planned — an
 * empty review at noon is noise.
 */
export function dailyReset(
  input: TodayInput,
  now: Date = new Date(),
  today: string = todayISO()
): DailyReset {
  const dueTasks = input.tasks.filter((t) => t.dueDate === today);
  const doneTasks = dueTasks.filter((t) => t.completed);

  const blocks = blocksForDate(input.routineBlocks, input.routineLogs, today);
  const doneBlocks = blocks.filter((b) => b.state === 'done');

  const dueHabits = input.habits.filter(
    (h) => h.status === 'active' && isScheduledOn(h, today)
  );
  const doneHabits = dueHabits.filter(
    (h) => valueOn(input.habitLogs, h.id, today) >= Math.max(1, h.targetValue || 1)
  );

  const planned = dueTasks.length + blocks.length + dueHabits.length;
  const completed = doneTasks.length + doneBlocks.length + doneHabits.length;

  const unfinished = [
    ...dueTasks.filter((t) => !t.completed).map((t) => ({ id: t.id, title: t.title, taskId: t.id })),
    ...blocks.filter((b) => b.state === 'pending').map((b) => ({ id: b.block.id, title: b.block.title })),
    ...dueHabits
      .filter((h) => valueOn(input.habitLogs, h.id, today) < Math.max(1, h.targetValue || 1))
      .map((h) => ({ id: h.id, title: h.title })),
  ];

  return {
    ready: now.getHours() >= 20 && planned > 0,
    planned,
    completed,
    unfinished,
  };
}
