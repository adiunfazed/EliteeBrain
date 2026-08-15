import type {
  FocusSession,
  Habit,
  HabitLog,
  RoutineBlock,
  RoutineLog,
  SleepLog,
  Task,
  UserProfile,
} from '../types';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate, routineAdherence, sleepStats, minutesOf } from './routine';

/**
 * Life Momentum.
 *
 * One number describing whether execution is trending up. Three rules govern
 * it, and they are what stop it becoming a vanity metric:
 *
 *   1. Every input is real recorded activity. Nothing is estimated or invented.
 *   2. The calculation is deterministic — the same day's data always yields the
 *      same score, so the line never wanders on its own.
 *   3. A component with no data is EXCLUDED rather than scored zero. Someone
 *      who doesn't track sleep shouldn't be punished for it; the remaining
 *      components are simply reweighted.
 *
 * It is a description of logged activity. It is not intelligence, health,
 * discipline, or personal worth, and must never be presented as any of those.
 */

export type MomentumRange = 7 | 30 | 90 | 365;

export interface MomentumComponent {
  key: 'tasks' | 'habits' | 'focus' | 'routine' | 'sleep';
  label: string;
  /** 0-1, or null when there is nothing recorded to measure. */
  value: number | null;
  weight: number;
}

export interface MomentumPoint {
  date: string;
  /** 0-100, or null on days with no data at all. */
  score: number | null;
  components: MomentumComponent[];
  /**
   * Whether the user actually RECORDED something that day, as opposed to
   * merely having had an obligation. A day where a daily habit existed and was
   * missed legitimately scores 0, but calling it an "active day" would
   * overstate engagement — so the two are tracked separately.
   */
  hasActivity: boolean;
}

const WEIGHTS = {
  tasks: 0.28,
  habits: 0.26,
  focus: 0.2,
  routine: 0.16,
  sleep: 0.1,
} as const;

/** Focus minutes in a day that count as a full score. */
const FOCUS_TARGET_MIN = 90;

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export interface MomentumInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  sleepLogs: SleepLog[];
  profile?: UserProfile;
}

/** Score a single day. Returns null when the user recorded nothing at all. */
export function momentumForDate(input: MomentumInput, iso: string): MomentumPoint {
  const components: MomentumComponent[] = [];

  // --- Tasks: completed vs the work that was actually on the plate. ---
  const completedToday = input.tasks.filter(
    (t) => t.completed && (t.completedAt || '').startsWith(iso)
  ).length;
  const dueToday = input.tasks.filter(
    (t) => t.dueDate === iso || (t.completedAt || '').startsWith(iso)
  ).length;
  components.push({
    key: 'tasks',
    label: 'Tasks',
    weight: WEIGHTS.tasks,
    value: dueToday > 0 ? Math.min(1, completedToday / dueToday) : completedToday > 0 ? 1 : null,
  });

  // --- Habits: share of the day's scheduled habits met. ---
  const scheduled = input.habits.filter((h) => h.status === 'active' && isScheduledOn(h, iso));
  const met = scheduled.filter(
    (h) => valueOn(input.habitLogs, h.id, iso) >= Math.max(1, h.targetValue || 1)
  ).length;
  components.push({
    key: 'habits',
    label: 'Habits',
    weight: WEIGHTS.habits,
    value: scheduled.length > 0 ? met / scheduled.length : null,
  });

  // --- Focus: minutes actually focused, capped so one huge day can't skew. ---
  const focusMin =
    input.focusSessions
      .filter((s) => s.startedAt.startsWith(iso))
      .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0) / 60;
  components.push({
    key: 'focus',
    label: 'Focus',
    weight: WEIGHTS.focus,
    value: focusMin > 0 ? Math.min(1, focusMin / FOCUS_TARGET_MIN) : null,
  });

  // --- Routine adherence. ---
  const day = blocksForDate(input.routineBlocks, input.routineLogs, iso);
  components.push({
    key: 'routine',
    label: 'Routine',
    weight: WEIGHTS.routine,
    value: day.length > 0 ? routineAdherence(input.routineBlocks, input.routineLogs, iso).ratio : null,
  });

  // --- Sleep: judged on consistency of bedtime, not duration. ---
  const night = input.sleepLogs.find((l) => l.date === iso);
  let sleepValue: number | null = null;
  if (night) {
    const window = input.sleepLogs.filter((l) => l.date <= iso);
    const stats = sleepStats(window, iso, 30);
    // With one night there is no variance to measure; credit the log itself.
    sleepValue = stats.nights >= 3 ? stats.consistency / 100 : 0.6;
  }
  components.push({ key: 'sleep', label: 'Sleep', weight: WEIGHTS.sleep, value: sleepValue });

  // Reweight across only the components that have data.
  const hasActivity =
    completedToday > 0 ||
    scheduled.some((h) => valueOn(input.habitLogs, h.id, iso) > 0) ||
    focusMin > 0 ||
    input.routineLogs.some((l) => l.date === iso) ||
    !!night;

  const active = components.filter((c) => c.value !== null);
  if (active.length === 0) return { date: iso, score: null, components, hasActivity };

  const totalWeight = active.reduce((s, c) => s + c.weight, 0);
  const score = active.reduce((s, c) => s + (c.value as number) * c.weight, 0) / totalWeight;

  return { date: iso, score: Math.round(score * 100), components, hasActivity };
}

/** A continuous series ending today. */
export function momentumSeries(
  input: MomentumInput,
  range: MomentumRange,
  today: string = todayISO()
): MomentumPoint[] {
  const out: MomentumPoint[] = [];
  for (let i = range - 1; i >= 0; i--) {
    out.push(momentumForDate(input, shift(today, -i)));
  }
  return out;
}

export interface MomentumSummary {
  current: number | null;
  /** Average of the most recent third of the window. */
  recentAverage: number | null;
  /** Average of the earliest third, for comparison. */
  priorAverage: number | null;
  /** Positive means improving. Null when there isn't enough data to say. */
  trend: number | null;
  activeDays: number;
  /** The component dragging hardest, if any. */
  weakest: MomentumComponent | null;
}

export function summarise(series: MomentumPoint[]): MomentumSummary {
  const scored = series.filter((p) => p.score !== null);
  if (scored.length === 0) {
    return { current: null, recentAverage: null, priorAverage: null, trend: null, activeDays: 0, weakest: null };
  }

  const third = Math.max(1, Math.floor(scored.length / 3));
  const prior = scored.slice(0, third);
  const recent = scored.slice(-third);
  const avg = (arr: MomentumPoint[]) =>
    Math.round(arr.reduce((s, p) => s + (p.score as number), 0) / arr.length);

  const recentAverage = avg(recent);
  const priorAverage = avg(prior);

  // Averaging component values across the window finds the persistent weak
  // spot rather than reacting to a single bad day.
  const totals = new Map<string, { sum: number; n: number; c: MomentumComponent }>();
  for (const p of scored) {
    for (const c of p.components) {
      if (c.value === null) continue;
      const cur = totals.get(c.key) || { sum: 0, n: 0, c };
      cur.sum += c.value;
      cur.n += 1;
      totals.set(c.key, cur);
    }
  }
  let weakest: MomentumComponent | null = null;
  let lowest = Infinity;
  for (const { sum, n, c } of totals.values()) {
    const mean = sum / n;
    if (n >= 3 && mean < lowest) {
      lowest = mean;
      weakest = { ...c, value: mean };
    }
  }

  return {
    current: scored[scored.length - 1].score,
    recentAverage,
    priorAverage,
    trend: scored.length >= 6 ? recentAverage - priorAverage : null,
    activeDays: series.filter((p) => p.hasActivity).length,
    weakest,
  };
}

/** Plain-language observations. Descriptive only — never diagnostic. */
export function momentumInsights(series: MomentumPoint[]): string[] {
  const s = summarise(series);
  const out: string[] = [];
  if (s.activeDays === 0) return out;

  if (s.trend !== null && Math.abs(s.trend) >= 4) {
    out.push(
      s.trend > 0
        ? `Your execution is up ${s.trend} points versus the start of this period.`
        : `Your execution is down ${Math.abs(s.trend)} points versus the start of this period.`
    );
  } else if (s.trend !== null) {
    out.push('Your execution has been steady across this period.');
  }

  out.push(`You logged activity on ${s.activeDays} of ${series.length} days.`);

  if (s.weakest && (s.weakest.value as number) < 0.5) {
    out.push(`${s.weakest.label} is the area getting the least follow-through right now.`);
  }
  return out;
}
