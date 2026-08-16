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
  /**
   * Unused protections. One is earned for every 7 consecutive active days and
   * covers a single missed day, so one bad day doesn't erase months of work.
   * Earned through consistency rather than purchased — a paid streak save
   * turns a habit tool into a slot machine.
   */
  freezesAvailable: number;
  /** True when a protection is currently covering a missed day. */
  freezeInUse: boolean;
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

/** Earliest date this user has any record for. Bounds every scan. */
function earliestRecord(input: MomentumInput, today: string): string {
  let earliest = today;
  const consider = (iso?: string) => {
    if (!iso) return;
    const d = iso.slice(0, 10);
    if (d.length === 10 && d < earliest) earliest = d;
  };

  for (const t of input.tasks) {
    consider(t.completedAt);
    consider(t.createdAt);
  }
  for (const s of input.focusSessions) consider(s.startedAt);
  for (const l of input.routineLogs) consider(l.date);
  for (const l of input.sleepLogs) consider(l.date);
  for (const l of input.habitLogs) consider(l.date);
  for (const h of input.habits) consider(h.createdAt);

  return earliest;
}

/** Whole days between two ISO dates. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function computeStreak(input: MomentumInput, today: string = todayISO()): StreakInfo {
  const activeToday = wasActiveOn(input, today);

  // Scan only as far back as this user actually has records. No fixed ceiling,
  // so a streak can run indefinitely; a user with two days of history costs
  // two iterations rather than four hundred.
  const firstRecord = earliestRecord(input, today);
  const span = daysBetween(firstRecord, today) + 1;

  // One protection for every 7 active days recorded, capped at 3 so a long
  // absence can't be papered over. Counting total active days rather than the
  // in-progress run means the balance doesn't read zero the moment it's earned.
  let activeDayTally = 0;
  for (let i = 0; i < span; i++) {
    if (wasActiveOn(input, shift(today, -i))) activeDayTally++;
  }
  const earnedFreezes = Math.min(3, Math.floor(activeDayTally / 7));

  // Current streak: walk backwards. Today not being done yet is not a break —
  // otherwise every streak would read zero each morning. A single gap may be
  // covered by an earned protection.
  let current = 0;
  let freezesSpent = 0;
  let freezeInUse = false;

  for (let i = 0; i < span; i++) {
    const iso = shift(today, -i);
    if (wasActiveOn(input, iso)) {
      current++;
      continue;
    }
    if (i === 0) continue;

    // Days before the user's first record are not missed days — there was
    // nothing to miss. Spending a protection there silently drained the
    // balance the moment it was earned.
    if (iso < firstRecord) break;

    // A missed day: spend a protection if one is available, otherwise stop.
    if (freezesSpent < earnedFreezes) {
      freezesSpent++;
      freezeInUse = true;
      continue;
    }
    break;
  }

  // Best streak across everything recorded.
  let best = 0;
  let run = 0;
  for (let i = span - 1; i >= 0; i--) {
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
  for (let i = 0; i < span; i++) if (wasActiveOn(input, shift(today, -i))) totalActiveDays++;

  return {
    current,
    best,
    week,
    activeToday,
    totalActiveDays,
    freezesAvailable: Math.max(0, earnedFreezes - freezesSpent),
    freezeInUse,
  };
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
