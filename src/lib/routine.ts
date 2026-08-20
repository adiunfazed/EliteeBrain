import type { BlockState, RoutineBlock, RoutineLog, SleepLog } from '../types';
import { todayISO } from './tasks';

/**
 * Routines and sleep.
 *
 * Both are stored as a recurring definition plus one log row per day, keyed by
 * date, so editing a schedule never rewrites history and marking the same day
 * twice overwrites rather than accumulating.
 */

export const BLOCK_META: Record<
  RoutineBlock['kind'],
  { label: string; tint: string; bar: string }
> = {
  study: { label: 'Study', tint: 'text-[#A78BFA] bg-[#8B5CF6]/12 border-[#8B5CF6]/30', bar: 'bg-[#8B5CF6]' },
  work: { label: 'Work', tint: 'text-sky-300 bg-sky-500/12 border-sky-500/30', bar: 'bg-sky-500' },
  exercise: { label: 'Exercise', tint: 'text-amber-300 bg-amber-500/12 border-amber-500/30', bar: 'bg-amber-500' },
  sleep: { label: 'Sleep', tint: 'text-indigo-300 bg-indigo-500/12 border-indigo-500/30', bar: 'bg-indigo-500' },
  meal: { label: 'Meal', tint: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30', bar: 'bg-emerald-500' },
  personal: { label: 'Personal', tint: 'text-rose-300 bg-rose-500/12 border-rose-500/30', bar: 'bg-rose-500' },
  custom: { label: 'Other', tint: 'text-slate-300 bg-slate-700/25 border-slate-600/30', bar: 'bg-slate-500' },
};

export function routineLogId(blockId: string, date: string): string {
  return `${date}__${blockId}`;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  if (!Number.isFinite(h)) return 0;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatHHMM(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Length of a block in minutes. A block whose end is before its start crosses
 * midnight (a night shift, or sleep) and must wrap rather than go negative.
 */
export function blockDuration(block: RoutineBlock): number {
  const start = minutesOf(block.startTime);
  const end = minutesOf(block.endTime);
  return end > start ? end - start : 1440 - start + end;
}

export function isBlockOn(block: RoutineBlock, iso: string): boolean {
  if (!block.active) return false;
  const days = block.weekdays;
  if (!days || days.length === 0) return true;
  const d = new Date(`${iso}T00:00:00`);
  return days.includes(d.getDay());
}

/** Today's blocks in clock order, each with its recorded state. */
export function blocksForDate(
  blocks: RoutineBlock[],
  logs: RoutineLog[],
  iso: string = todayISO()
): { block: RoutineBlock; state: BlockState }[] {
  const stateById = new Map<string, BlockState>();
  for (const l of logs) if (l.date === iso) stateById.set(l.blockId, l.state);

  return blocks
    .filter((b) => isBlockOn(b, iso))
    .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
    .map((block) => ({ block, state: stateById.get(block.id) ?? 'pending' }));
}

/** Share of a day's blocks completed. Partial counts as half. */
export function routineAdherence(
  blocks: RoutineBlock[],
  logs: RoutineLog[],
  iso: string = todayISO()
): { done: number; total: number; ratio: number } {
  const day = blocksForDate(blocks, logs, iso);
  if (day.length === 0) return { done: 0, total: 0, ratio: 0 };
  const score = day.reduce(
    (sum, d) => sum + (d.state === 'done' ? 1 : d.state === 'partial' ? 0.5 : 0),
    0
  );
  return {
    done: day.filter((d) => d.state === 'done').length,
    total: day.length,
    ratio: score / day.length,
  };
}

/**
 * Committed minutes per day, used to spot an overloaded schedule.
 * Sleep and meals are excluded — they are not discretionary work.
 */
export function committedMinutes(blocks: RoutineBlock[], iso: string = todayISO()): number {
  return blocks
    .filter((b) => isBlockOn(b, iso) && b.kind !== 'sleep' && b.kind !== 'meal')
    .reduce((sum, b) => sum + blockDuration(b), 0);
}

export function overloadWarning(
  blocks: RoutineBlock[],
  iso: string = todayISO(),
  waking = 16 * 60
): string | null {
  const total = committedMinutes(blocks, iso);
  if (total <= waking) return null;
  const hrs = Math.round((total / 60) * 10) / 10;
  return `Today's blocks total about ${hrs} hours of committed time. That may be more than the day holds.`;
}

/* ------------------------------------------------------------------ */
/* Sleep                                                               */
/* ------------------------------------------------------------------ */

/** Minutes slept, wrapping past midnight. */
export function sleepMinutes(bedtime: string, wakeTime: string): number {
  const bed = minutesOf(bedtime);
  const wake = minutesOf(wakeTime);
  return wake > bed ? wake - bed : 1440 - bed + wake;
}

export function makeSleepLog(date: string, bedtime: string, wakeTime: string, note?: string): SleepLog {
  return {
    id: date,
    date,
    bedtime,
    wakeTime,
    minutes: sleepMinutes(bedtime, wakeTime),
    note,
    updatedAt: new Date().toISOString(),
  };
}

export interface SleepStats {
  nights: number;
  averageMinutes: number;
  /** 0-100. How steady the bedtime is, not how long the sleep is. */
  consistency: number;
  lastNight?: SleepLog;
}

/**
 * Consistency measures how much bedtime varies, because a steady schedule is
 * the part a person can actually control. It is a description of their own
 * recorded times — not a health score, and no claim is made about either.
 */
export function sleepStats(logs: SleepLog[], today: string = todayISO(), days = 30): SleepStats {
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const recent = logs.filter((l) => l.date > cutoffISO).sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length === 0) return { nights: 0, averageMinutes: 0, consistency: 0 };

  const avg = recent.reduce((s, l) => s + l.minutes, 0) / recent.length;

  // Bedtimes near midnight wrap, so shift the axis to treat 23:00 and 01:00 as
  // 2 hours apart rather than 22.
  const shifted = recent.map((l) => {
    const m = minutesOf(l.bedtime);
    return m < 12 * 60 ? m + 1440 : m;
  });
  const mean = shifted.reduce((a, b) => a + b, 0) / shifted.length;
  const variance = shifted.reduce((s, m) => s + (m - mean) ** 2, 0) / shifted.length;
  const stdDevMin = Math.sqrt(variance);

  // A 90-minute swing in bedtime scores zero; perfectly steady scores 100.
  const consistency = Math.max(0, Math.min(100, Math.round(100 - (stdDevMin / 90) * 100)));

  return {
    nights: recent.length,
    averageMinutes: Math.round(avg),
    consistency,
    lastNight: recent[recent.length - 1],
  };
}

export function formatSleepDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
