import type { MomentumInput } from './momentum';
import { momentumSeries, summarise } from './momentum';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate, routineAdherence, sleepStats } from './routine';
import { goalProgress } from './goalSystem';

/**
 * Weekly review and life areas.
 *
 * Everything is computed from recorded activity. Where there is nothing to
 * report, the section says so rather than inventing an encouraging number.
 * Nothing here diagnoses the user or judges them — it reports what happened.
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

export type AreaKey =
  | 'study' | 'work' | 'fitness' | 'sleep' | 'focus' | 'habits' | 'goals' | 'personal';

export interface LifeArea {
  key: AreaKey;
  label: string;
  /** 0-1, or null when nothing is tracked for this area. */
  value: number | null;
  detail: string;
}

/** Per-area activity over the window. Untracked areas return null, not zero. */
export function lifeAreas(
  input: MomentumInput,
  days = 7,
  today: string = todayISO()
): LifeArea[] {
  const dates = rangeDates(today, days);
  const areas: LifeArea[] = [];

  // Task and routine categories map onto the life areas people recognise.
  const byCategory = (cat: string) => {
    const linked = input.tasks.filter((t) => t.category === cat);
    const done = linked.filter(
      (t) => t.completed && dates.some((d) => (t.completedAt || '').startsWith(d))
    ).length;

    const blocks = input.routineBlocks.filter((b) => b.kind === cat);
    let blockDone = 0;
    let blockTotal = 0;
    for (const d of dates) {
      const day = blocksForDate(blocks, input.routineLogs, d);
      blockTotal += day.length;
      blockDone += day.filter((x) => x.state === 'done').length;
    }

    if (linked.length === 0 && blockTotal === 0) return null;
    const taskRatio = linked.length > 0 ? done / linked.length : null;
    const blockRatio = blockTotal > 0 ? blockDone / blockTotal : null;
    const parts = [taskRatio, blockRatio].filter((v): v is number => v !== null);
    return {
      value: parts.reduce((a, b) => a + b, 0) / parts.length,
      detail:
        blockTotal > 0
          ? `${blockDone}/${blockTotal} blocks · ${done} tasks done`
          : `${done} of ${linked.length} tasks done`,
    };
  };

  for (const [key, label, cat] of [
    ['study', 'Study', 'study'],
    ['work', 'Work', 'work'],
    ['fitness', 'Fitness', 'fitness'],
    ['personal', 'Personal', 'personal'],
  ] as [AreaKey, string, string][]) {
    const r = byCategory(cat);
    areas.push({ key, label, value: r ? r.value : null, detail: r ? r.detail : 'Not tracked yet' });
  }

  // Sleep — consistency of recorded bedtimes.
  const sleep = sleepStats(input.sleepLogs, today, days);
  areas.push({
    key: 'sleep',
    label: 'Sleep',
    value: sleep.nights > 0 ? sleep.consistency / 100 : null,
    detail: sleep.nights > 0 ? `${sleep.nights} nights logged` : 'Not tracked yet',
  });

  // Focus — minutes actually focused against a 90-minute daily reference.
  const focusMin =
    input.focusSessions
      .filter((s) => dates.some((d) => s.startedAt.startsWith(d)))
      .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0) / 60;
  areas.push({
    key: 'focus',
    label: 'Focus',
    value: focusMin > 0 ? Math.min(1, focusMin / (90 * days)) : null,
    detail: focusMin > 0 ? `${Math.round(focusMin)} min focused` : 'Not tracked yet',
  });

  // Habits — share of scheduled days met.
  let scheduled = 0;
  let met = 0;
  for (const d of dates) {
    for (const h of input.habits.filter((x) => x.status === 'active' && isScheduledOn(x, d))) {
      scheduled++;
      if (valueOn(input.habitLogs, h.id, d) >= Math.max(1, h.targetValue || 1)) met++;
    }
  }
  areas.push({
    key: 'habits',
    label: 'Habits',
    value: scheduled > 0 ? met / scheduled : null,
    detail: scheduled > 0 ? `${met} of ${scheduled} scheduled` : 'Not tracked yet',
  });

  // Goals — average progress across active goals.
  const active = (input as any).goals?.filter?.((g: any) => g.status === 'active') || [];
  if (active.length > 0) {
    const avg =
      active.reduce(
        (s: number, g: any) =>
          s + goalProgress(g, input.habits, input.habitLogs, today, input.tasks).ratio,
        0
      ) / active.length;
    areas.push({
      key: 'goals',
      label: 'Goals',
      value: avg,
      detail: `${active.length} active`,
    });
  } else {
    areas.push({ key: 'goals', label: 'Goals', value: null, detail: 'None set' });
  }

  return areas;
}

export interface WeeklyReview {
  hasData: boolean;
  tasksPlanned: number;
  tasksCompleted: number;
  focusMinutes: number;
  habitRate: number | null;
  routineRate: number | null;
  sleepNights: number;
  momentumTrend: number | null;
  wentWell: string[];
  missed: string[];
  bottleneck: string | null;
  oneThing: string | null;
}

/** A short, actionable summary of the last seven days. */
export function weeklyReview(
  input: MomentumInput,
  today: string = todayISO()
): WeeklyReview {
  const dates = rangeDates(today, 7);
  const inWeek = (iso?: string) => !!iso && dates.some((d) => iso.startsWith(d));

  const tasksCompleted = input.tasks.filter((t) => t.completed && inWeek(t.completedAt)).length;
  const tasksPlanned =
    input.tasks.filter((t) => dates.includes(t.dueDate || '') || inWeek(t.completedAt)).length;

  const focusMinutes = Math.round(
    input.focusSessions
      .filter((s) => inWeek(s.startedAt))
      .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0) / 60
  );

  let scheduled = 0;
  let met = 0;
  for (const d of dates) {
    for (const h of input.habits.filter((x) => x.status === 'active' && isScheduledOn(x, d))) {
      scheduled++;
      if (valueOn(input.habitLogs, h.id, d) >= Math.max(1, h.targetValue || 1)) met++;
    }
  }

  let blockTotal = 0;
  let blockScore = 0;
  for (const d of dates) {
    const a = routineAdherence(input.routineBlocks, input.routineLogs, d);
    if (a.total > 0) {
      blockTotal += a.total;
      blockScore += a.ratio * a.total;
    }
  }

  const sleep = sleepStats(input.sleepLogs, today, 7);
  const summary = summarise(momentumSeries(input, 7, today));

  const habitRate = scheduled > 0 ? met / scheduled : null;
  const routineRate = blockTotal > 0 ? blockScore / blockTotal : null;

  const wentWell: string[] = [];
  const missed: string[] = [];

  if (tasksCompleted > 0) wentWell.push(`Completed ${tasksCompleted} tasks.`);
  if (focusMinutes >= 60) wentWell.push(`Focused for ${Math.round(focusMinutes / 60)}h ${focusMinutes % 60}m.`);
  if (habitRate !== null && habitRate >= 0.7)
    wentWell.push(`Hit ${Math.round(habitRate * 100)}% of scheduled habits.`);
  if (routineRate !== null && routineRate >= 0.7)
    wentWell.push(`Kept ${Math.round(routineRate * 100)}% of your routine.`);
  if (sleep.nights >= 5) wentWell.push(`Logged sleep on ${sleep.nights} nights.`);

  if (tasksPlanned > tasksCompleted)
    missed.push(`${tasksPlanned - tasksCompleted} planned tasks weren't finished.`);
  if (habitRate !== null && habitRate < 0.5)
    missed.push(`Habits ran at ${Math.round(habitRate * 100)}% this week.`);
  if (routineRate !== null && routineRate < 0.5)
    missed.push(`Routine adherence was ${Math.round(routineRate * 100)}%.`);
  if (sleep.nights > 0 && sleep.nights < 4) missed.push(`Sleep was logged on only ${sleep.nights} nights.`);

  // The bottleneck is the weakest component with enough data to mean something.
  const bottleneck = summary.weakest ? summary.weakest.label : null;

  let oneThing: string | null = null;
  if (bottleneck === 'Habits') oneThing = 'Pick one habit and protect it every scheduled day next week.';
  else if (bottleneck === 'Focus') oneThing = 'Book one 45-minute focus session per day and start it before noon.';
  else if (bottleneck === 'Tasks') oneThing = 'Plan three tasks a day instead of ten, and finish all three.';
  else if (bottleneck === 'Routine') oneThing = 'Cut your routine to the blocks you actually keep, then add back slowly.';
  else if (bottleneck === 'Sleep') oneThing = 'Pick one bedtime and hold it for seven nights.';

  const hasData =
    tasksCompleted > 0 || focusMinutes > 0 || scheduled > 0 || blockTotal > 0 || sleep.nights > 0;

  return {
    hasData,
    tasksPlanned,
    tasksCompleted,
    focusMinutes,
    habitRate,
    routineRate,
    sleepNights: sleep.nights,
    momentumTrend: summary.trend,
    wentWell,
    missed,
    bottleneck,
    oneThing,
  };
}
