import type { Task } from '../types';
import type { MomentumInput } from './momentum';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blockDuration, blocksForDate, isBlockOn } from './routine';

/**
 * Reality vs Plan, and help for work that keeps getting pushed.
 *
 * The purpose is to make the gap between intention and execution visible so a
 * person can plan closer to reality. Every message states a number and what to
 * do about it. Nothing here shames the user, diagnoses them, or implies the gap
 * is a character flaw — an unrealistic plan is a planning problem.
 */

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function rangeDates(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => shift(today, -(days - 1 - i)));
}

export interface PlanRow {
  label: string;
  planned: number;
  actual: number;
  unit: string;
  /** actual / planned, capped at 1. Null when nothing was planned. */
  ratio: number | null;
}

export interface RealityReport {
  hasPlan: boolean;
  rows: PlanRow[];
  /** Overall execution across everything that was planned, 0-1. */
  execution: number | null;
  insight: string | null;
}

/**
 * Compare what was planned against what happened over `days`.
 * A category with nothing planned is excluded rather than scored zero.
 */
export function realityVsPlan(
  input: MomentumInput,
  days = 7,
  today: string = todayISO()
): RealityReport {
  const dates = rangeDates(today, days);
  const inRange = (iso?: string) => !!iso && dates.some((d) => iso.startsWith(d));
  const rows: PlanRow[] = [];

  // --- Tasks ---
  const plannedTasks = input.tasks.filter((t) => dates.includes(t.dueDate || '')).length;
  const doneTasks = input.tasks.filter(
    (t) => t.completed && inRange(t.completedAt) && dates.includes(t.dueDate || '')
  ).length;
  rows.push({
    label: 'Tasks',
    planned: plannedTasks,
    actual: doneTasks,
    unit: '',
    ratio: plannedTasks > 0 ? Math.min(1, doneTasks / plannedTasks) : null,
  });

  // --- Focus: planned from estimates on dated tasks, actual from sessions. ---
  const plannedFocus = input.tasks
    .filter((t) => dates.includes(t.dueDate || ''))
    .reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
  const actualFocus = Math.round(
    input.focusSessions
      .filter((s) => inRange(s.startedAt))
      .reduce((s, x) => s + (x.focusedSeconds || 0), 0) / 60
  );
  rows.push({
    label: 'Focus',
    planned: plannedFocus,
    actual: actualFocus,
    unit: 'min',
    ratio: plannedFocus > 0 ? Math.min(1, actualFocus / plannedFocus) : null,
  });

  // --- Routine ---
  let plannedBlocks = 0;
  let doneBlocks = 0;
  for (const d of dates) {
    const day = blocksForDate(input.routineBlocks, input.routineLogs, d);
    plannedBlocks += day.length;
    doneBlocks += day.filter((x) => x.state === 'done').length;
  }
  rows.push({
    label: 'Routine',
    planned: plannedBlocks,
    actual: doneBlocks,
    unit: 'blocks',
    ratio: plannedBlocks > 0 ? doneBlocks / plannedBlocks : null,
  });

  // --- Habits ---
  let scheduled = 0;
  let met = 0;
  for (const d of dates) {
    for (const h of input.habits.filter((x) => x.status === 'active' && isScheduledOn(x, d))) {
      scheduled++;
      if (valueOn(input.habitLogs, h.id, d) >= Math.max(1, h.targetValue || 1)) met++;
    }
  }
  rows.push({
    label: 'Habits',
    planned: scheduled,
    actual: met,
    unit: '',
    ratio: scheduled > 0 ? met / scheduled : null,
  });

  // Sleep is compared as nights-logged against nights-in-range, because there
  // is no "planned sleep" field to compare against — inventing a target would
  // be fabricating a plan the user never made.
  const nightsLogged = input.sleepLogs.filter((l) => dates.includes(l.date)).length;
  if (nightsLogged > 0) {
    rows.push({
      label: 'Sleep',
      planned: dates.length,
      actual: nightsLogged,
      unit: 'nights',
      ratio: nightsLogged / dates.length,
    });
  }

  const active = rows.filter((r) => r.ratio !== null);
  const execution =
    active.length > 0
      ? active.reduce((s, r) => s + (r.ratio as number), 0) / active.length
      : null;

  let insight: string | null = null;
  if (execution !== null) {
    const focusRow = rows.find((r) => r.label === 'Focus');
    if (focusRow && focusRow.ratio !== null && focusRow.planned > 60 && focusRow.ratio < 0.7) {
      const hoursPlanned = Math.round((focusRow.planned / 60) * 10) / 10;
      const hoursActual = Math.round((focusRow.actual / 60) * 10) / 10;
      insight = `You planned ${hoursPlanned}h of focused work and completed ${hoursActual}h. Planning a smaller workload usually beats planning an ambitious one you don't finish.`;
    } else if (execution < 0.5) {
      insight = `You completed about ${Math.round(execution * 100)}% of what you planned. That usually means the plan was too big, not that the day was wasted.`;
    } else if (execution >= 0.85) {
      insight = `You completed about ${Math.round(execution * 100)}% of your plan. You could afford to plan slightly more.`;
    } else {
      insight = `You completed about ${Math.round(execution * 100)}% of your plan.`;
    }
  }

  return { hasPlan: active.length > 0, rows, execution, insight };
}

/* ------------------------------------------------------------------ */
/* Anti-procrastination                                                */
/* ------------------------------------------------------------------ */

export type StuckReason = 'too_big' | 'too_hard' | 'boring' | 'no_start' | 'not_important';

export const STUCK_OPTIONS: { id: StuckReason; label: string }[] = [
  { id: 'too_big', label: 'Too big' },
  { id: 'too_hard', label: 'Too difficult' },
  { id: 'boring', label: 'Boring' },
  { id: 'no_start', label: "Don't know where to start" },
  { id: 'not_important', label: 'No longer important' },
];

/** How overdue a task is, in whole days. */
export function daysOverdue(task: Task, today: string = todayISO()): number {
  if (!task.dueDate || task.completed) return 0;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${task.dueDate}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((a - b) / 86400000));
}

/**
 * The one task most worth unsticking: pushed twice or more, or several days
 * overdue. Returns a single task rather than a list — a list of things you're
 * avoiding is discouraging, and the point is to restart one of them.
 */
export function mostStuckTask(tasks: Task[], today: string = todayISO()): Task | null {
  const candidates = tasks
    .filter((t) => !t.completed)
    .map((t) => ({
      t,
      score: (t.postponeCount || 0) * 2 + daysOverdue(t, today),
    }))
    .filter((c) => (c.t.postponeCount || 0) >= 2 || daysOverdue(c.t, today) >= 3)
    .sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].t : null;
}

export interface StuckSuggestion {
  headline: string;
  /** A concrete, small first move. */
  firstStep: string;
  /** Minutes the suggested step should take. */
  minutes: number;
  /** True when splitting the task into subtasks is the right response. */
  offerSplit: boolean;
}

/** A concrete way forward, chosen by what the user says is wrong. */
export function suggestionFor(task: Task, reason: StuckReason): StuckSuggestion {
  const title = task.title.trim();

  switch (reason) {
    case 'too_big':
      return {
        headline: 'Cut it down.',
        firstStep: `Write the three parts "${title}" breaks into, then do only the first.`,
        minutes: 15,
        offerSplit: true,
      };
    case 'too_hard':
      return {
        headline: 'Shrink the difficulty.',
        firstStep: `Spend 10 minutes on the easiest part of "${title}". Stop when the timer ends.`,
        minutes: 10,
        offerSplit: true,
      };
    case 'boring':
      return {
        headline: 'Make it short.',
        firstStep: `Set 15 minutes on "${title}" and stop dead when it ends, finished or not.`,
        minutes: 15,
        offerSplit: false,
      };
    case 'no_start':
      return {
        headline: 'Start absurdly small.',
        firstStep: `Open whatever "${title}" needs — the file, the book, the app — and do 10 minutes.`,
        minutes: 10,
        offerSplit: true,
      };
    case 'not_important':
      return {
        headline: 'Then drop it.',
        firstStep: `Delete "${title}" or move it out of this week. A list you don't trust stops working.`,
        minutes: 0,
        offerSplit: false,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Adaptive planning                                                   */
/* ------------------------------------------------------------------ */

export interface AdaptiveSignal {
  key: 'estimates' | 'routine' | 'overload' | 'postponed';
  message: string;
}

/** Observations drawn from behaviour, each with a number behind it. */
export function adaptiveSignals(
  input: MomentumInput,
  today: string = todayISO()
): AdaptiveSignal[] {
  const out: AdaptiveSignal[] = [];

  // Estimate drift, measured against real focus time.
  const measured = input.tasks.filter(
    (t) => t.completed && t.estimatedMinutes && (t.focusSeconds || 0) > 60
  );
  if (measured.length >= 3) {
    const drift =
      measured.reduce(
        (s, t) => s + ((t.focusSeconds || 0) / 60 - (t.estimatedMinutes || 0)),
        0
      ) / measured.length;
    if (Math.abs(drift) >= 10) {
      out.push({
        key: 'estimates',
        message:
          drift > 0
            ? `Across ${measured.length} tasks you took about ${Math.round(drift)} minutes longer than estimated. Add that margin when planning.`
            : `Across ${measured.length} tasks you finished about ${Math.round(Math.abs(drift))} minutes early. You can schedule a little more.`,
      });
    }
  }

  // Routine blocks that are scheduled but rarely done.
  const dates = rangeDates(today, 14);
  for (const block of input.routineBlocks.filter((b) => b.active)) {
    const days = dates.filter((d) => isBlockOn(block, d));
    if (days.length < 5) continue;
    const done = input.routineLogs.filter(
      (l) => l.blockId === block.id && l.state === 'done' && days.includes(l.date)
    ).length;
    if (done / days.length < 0.3) {
      out.push({
        key: 'routine',
        message: `"${block.title}" was kept ${done} of ${days.length} scheduled days. Consider moving it or shortening it.`,
      });
      break;
    }
  }

  // A day scheduled beyond what a day holds.
  const committed = input.routineBlocks
    .filter((b) => isBlockOn(b, today) && b.kind !== 'sleep' && b.kind !== 'meal')
    .reduce((s, b) => s + blockDuration(b), 0);
  if (committed > 16 * 60) {
    out.push({
      key: 'overload',
      message: `Today's blocks total ${Math.round((committed / 60) * 10) / 10} hours. Something will have to give — better to choose which.`,
    });
  }

  // Repeatedly pushed work.
  const pushed = input.tasks.filter((t) => !t.completed && (t.postponeCount || 0) >= 3);
  if (pushed.length > 0) {
    out.push({
      key: 'postponed',
      message: `${pushed.length} task${pushed.length === 1 ? ' has' : 's have'} been pushed three or more times. They may need splitting or dropping.`,
    });
  }

  return out;
}
