import type { Habit, HabitLog } from '../types';
import { todayISO } from './tasks';

/**
 * Habit engine.
 *
 * Streaks are the part people care about and the part that's easy to get
 * wrong. Two rules matter:
 *
 *   1. A streak only counts SCHEDULED days. Missing a Tuesday on a
 *      Mon/Wed/Fri habit must not break the streak.
 *   2. Today being unfinished does not break a live streak — otherwise every
 *      streak reads zero each morning, which is both wrong and demoralising.
 *
 * Partial progress is kept but does not count as a completion.
 */

export const HABIT_METRIC_LABELS = {
  yes_no: 'Done / not done',
  count: 'Count',
  duration: 'Minutes',
} as const;

export function logId(habitId: string, date: string): string {
  return `${date}__${habitId}`;
}

function parseISO(iso: string): Date | null {
  const ms = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function shiftISO(iso: string, days: number): string {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Is this habit scheduled on the given date? */
export function isScheduledOn(habit: Habit, iso: string): boolean {
  if (habit.status !== 'active') return false;
  const d = parseISO(iso);
  if (!d) return false;

  if (habit.cadence === 'daily') return true;
  if (habit.cadence === 'selected_days') {
    return (habit.weekdays || []).includes(d.getDay());
  }
  // 'weekly' is a quota rather than a fixed day, so every day is an
  // opportunity until the quota is met.
  return true;
}

export function logsByDate(logs: HabitLog[], habitId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of logs) {
    if (l.habitId !== habitId) continue;
    map.set(l.date, (map.get(l.date) || 0) + l.value);
  }
  return map;
}

export function valueOn(logs: HabitLog[], habitId: string, iso: string): number {
  return logsByDate(logs, habitId).get(iso) || 0;
}

export function isCompleteOn(habit: Habit, logs: HabitLog[], iso: string): boolean {
  const target = Math.max(1, habit.targetValue || 1);
  return valueOn(logs, habit.id, iso) >= target;
}

export interface HabitStats {
  /** Progress recorded today. */
  todayValue: number;
  target: number;
  completedToday: boolean;
  scheduledToday: boolean;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  /** Completed scheduled days as a percentage of scheduled days, 0-100. */
  completionRate: number;
  /** Last 84 days, oldest first, for the heatmap. */
  history: { date: string; value: number; complete: boolean; scheduled: boolean }[];
}

export function habitStats(
  habit: Habit,
  logs: HabitLog[],
  today: string = todayISO(),
  lookbackDays = 84
): HabitStats {
  const target = Math.max(1, habit.targetValue || 1);
  const byDate = logsByDate(logs, habit.id);
  const start = habit.createdAt?.slice(0, 10) || today;

  const history: HabitStats['history'] = [];
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const date = shiftISO(today, -i);
    const value = byDate.get(date) || 0;
    history.push({
      date,
      value,
      complete: value >= target,
      scheduled: isScheduledOn(habit, date),
    });
  }

  // Current streak: walk back over SCHEDULED days only.
  let currentStreak = 0;
  for (let i = 0; i < 400; i++) {
    const date = shiftISO(today, -i);
    if (date < start) break;
    if (!isScheduledOn(habit, date)) continue;

    const done = (byDate.get(date) || 0) >= target;
    if (done) {
      currentStreak++;
      continue;
    }
    // Rule 2: today still has time left.
    if (i === 0) continue;
    break;
  }

  // Best streak across all recorded history.
  let bestStreak = 0;
  let running = 0;
  const dates = Array.from(byDate.keys()).sort();
  if (dates.length > 0) {
    let cursor = dates[0];
    while (cursor <= today) {
      if (isScheduledOn(habit, cursor)) {
        if ((byDate.get(cursor) || 0) >= target) {
          running++;
          bestStreak = Math.max(bestStreak, running);
        } else if (cursor !== today) {
          running = 0;
        }
      }
      cursor = shiftISO(cursor, 1);
    }
  }
  bestStreak = Math.max(bestStreak, currentStreak);

  let scheduledDays = 0;
  let completedDays = 0;
  for (const h of history) {
    if (h.date < start) continue;
    if (!h.scheduled) continue;
    scheduledDays++;
    if (h.complete) completedDays++;
  }

  const totalCompletions = Array.from(byDate.entries()).filter(
    ([, v]) => v >= target
  ).length;

  return {
    todayValue: byDate.get(today) || 0,
    target,
    completedToday: (byDate.get(today) || 0) >= target,
    scheduledToday: isScheduledOn(habit, today),
    currentStreak,
    bestStreak,
    totalCompletions,
    completionRate: scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : 0,
    history,
  };
}

export function describeCadence(habit: Habit): string {
  if (habit.cadence === 'daily') return 'Every day';
  if (habit.cadence === 'weekly') {
    const n = habit.timesPerWeek || 3;
    return `${n}× per week`;
  }
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (habit.weekdays || []).slice().sort((a, b) => a - b);
  return days.length > 0 ? days.map((d) => names[d]).join(', ') : 'No days selected';
}

export function describeTarget(habit: Habit): string {
  if (habit.metric === 'yes_no') return 'Done';
  if (habit.metric === 'duration') return `${habit.targetValue} min`;
  return `${habit.targetValue}${habit.unit ? ` ${habit.unit}` : ''}`;
}

/**
 * A calm observation about the user's own record. Only returned when there is
 * enough data for it to mean anything.
 */
export function habitInsight(habit: Habit, stats: HabitStats): string | null {
  const tracked = stats.history.filter((h) => h.scheduled).length;
  if (tracked < 7) return null;

  if (stats.completionRate >= 80) {
    return `You've completed ${stats.completionRate}% of scheduled days.`;
  }
  if (stats.currentStreak === 0 && stats.bestStreak >= 3) {
    return `Your best run was ${stats.bestStreak} days. Next opportunity is today.`;
  }
  return `You've completed ${stats.completionRate}% of scheduled days so far.`;
}
