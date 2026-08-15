import type { MomentumInput } from './momentum';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';

/**
 * Daily streak.
 *
 * A day counts when the user actually did something recorded — completed a
 * task, met a habit, ran a focus session, or ticked a routine block. It is
 * derived from stored activity rather than a separate counter, so it cannot
 * drift, cannot be inflated by opening the app, and syncs across devices
 * automatically because the underlying records do.
 *
 * Today being empty does not break a live streak; the day isn't over.
 */

export interface StreakDay {
  date: string;
  /** Sun=0 .. Sat=6 */
  weekday: number;
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface StreakInfo {
  current: number;
  best: number;
  /** The seven days of the current week, Sunday first. */
  week: StreakDay[];
  activeToday: boolean;
  totalActiveDays: number;
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Did the user record anything real on this date? */
export function wasActiveOn(input: MomentumInput, iso: string): boolean {
  if (input.tasks.some((t) => t.completed && (t.completedAt || '').startsWith(iso))) return true;
  if (input.focusSessions.some((s) => s.startedAt.startsWith(iso) && (s.focusedSeconds || 0) >= 60))
    return true;
  if (input.routineLogs.some((l) => l.date === iso && l.state === 'done')) return true;
  if (input.sleepLogs.some((l) => l.date === iso)) return true;

  return input.habits.some(
    (h) =>
      h.status === 'active' &&
      isScheduledOn(h, iso) &&
      valueOn(input.habitLogs, h.id, iso) >= Math.max(1, h.targetValue || 1)
  );
}

export function computeStreak(input: MomentumInput, today: string = todayISO()): StreakInfo {
  const activeToday = wasActiveOn(input, today);

  // Current streak: walk backwards. Today not being done yet is not a break —
  // otherwise every streak would read zero each morning.
  let current = 0;
  for (let i = 0; i < 400; i++) {
    const iso = shift(today, -i);
    if (wasActiveOn(input, iso)) {
      current++;
      continue;
    }
    if (i === 0) continue;
    break;
  }

  // Best streak across everything recorded.
  let best = 0;
  let run = 0;
  for (let i = 400; i >= 0; i--) {
    if (wasActiveOn(input, shift(today, -i))) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  best = Math.max(best, current);

  // This week, Sunday first.
  const todayDate = new Date(`${today}T00:00:00`);
  const sunday = shift(today, -todayDate.getDay());
  const week: StreakDay[] = Array.from({ length: 7 }, (_, i) => {
    const iso = shift(sunday, i);
    return {
      date: iso,
      weekday: i,
      active: wasActiveOn(input, iso),
      isToday: iso === today,
      isFuture: iso > today,
    };
  });

  let totalActiveDays = 0;
  for (let i = 0; i < 400; i++) if (wasActiveOn(input, shift(today, -i))) totalActiveDays++;

  return { current, best, week, activeToday, totalActiveDays };
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
