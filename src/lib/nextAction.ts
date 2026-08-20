import type { Habit, HabitLog, RoutineBlock, RoutineLog, Task } from '../types';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate, minutesOf } from './routine';

/**
 * What to do next.
 *
 * The recommendation must be explainable. A suggestion the user cannot
 * interrogate is indistinguishable from a random pick, so every candidate
 * carries the actual reason it scored highly — "due tomorrow and postponed
 * twice" — drawn from stored data rather than invented.
 *
 * If nothing scores above the floor, the honest answer is that there is
 * nothing pressing, not a filler suggestion.
 */

export interface Suggestion {
  kind: 'task' | 'habit' | 'block';
  id: string;
  title: string;
  /** Plain-language justification, assembled from real signals. */
  reason: string;
  minutes?: number;
  goalId?: string;
  score: number;
}

export interface SuggestInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  now?: Date;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 25,
  normal: 10,
  low: 0,
};

function daysUntil(dateISO: string | undefined, today: string): number | null {
  if (!dateISO) return null;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${dateISO}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Rank everything the user could do right now.
 *
 * Signals, in rough order of weight: how overdue something is, how often it
 * has been pushed, its priority, whether its routine block is happening now,
 * and whether a scheduled habit is still open.
 */
export function suggestNextActions(input: SuggestInput, limit = 3): Suggestion[] {
  const now = input.now || new Date();
  const today = todayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: Suggestion[] = [];

  // --- Tasks ---
  for (const t of input.tasks) {
    if (t.completed) continue;

    const due = daysUntil(t.dueDate, today);
    const postponed = t.postponeCount || 0;
    const reasons: string[] = [];
    let score = PRIORITY_WEIGHT[t.priority] ?? 10;

    if (due !== null) {
      if (due < 0) {
        score += 40 + Math.min(30, Math.abs(due) * 6);
        reasons.push(`${Math.abs(due)} day${Math.abs(due) === 1 ? '' : 's'} overdue`);
      } else if (due === 0) {
        score += 32;
        reasons.push('due today');
      } else if (due === 1) {
        score += 20;
        reasons.push('due tomorrow');
      } else if (due <= 3) {
        score += 8;
        reasons.push(`due in ${due} days`);
      }
    }

    if (postponed > 0) {
      score += Math.min(30, postponed * 10);
      reasons.push(`moved ${postponed} time${postponed === 1 ? '' : 's'}`);
    }

    if (t.priority === 'critical' || t.priority === 'high') {
      reasons.push(`${t.priority} priority`);
    }

    // Nothing notable about it — don't manufacture urgency.
    if (reasons.length === 0) continue;

    out.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      reason: reasons.slice(0, 2).join(' · '),
      minutes: t.estimatedMinutes,
      goalId: t.goalId,
      score,
    });
  }

  // --- Routine blocks happening now or imminent ---
  for (const { block, state } of blocksForDate(input.routineBlocks, input.routineLogs, today)) {
    if (state !== 'pending') continue;

    const start = minutesOf(block.startTime);
    const end = minutesOf(block.endTime);
    const live = start <= nowMin && end > nowMin;
    const soon = start > nowMin && start - nowMin <= 30;

    if (!live && !soon) continue;

    out.push({
      kind: 'block',
      id: block.id,
      title: block.title,
      reason: live ? 'scheduled for right now' : `starts at ${block.startTime}`,
      goalId: block.goalId,
      score: live ? 55 : 34,
    });
  }

  // --- Habits still open today ---
  for (const h of input.habits) {
    if (h.status !== 'active' || !isScheduledOn(h, today)) continue;
    const target = Math.max(1, h.targetValue || 1);
    if (valueOn(input.habitLogs, h.id, today) >= target) continue;

    // Later in the day, an unfinished habit becomes more pressing.
    const lateNudge = nowMin > 18 * 60 ? 18 : 0;

    out.push({
      kind: 'habit',
      id: h.id,
      title: h.title,
      reason: lateNudge > 0 ? 'still open, and the day is nearly over' : 'today’s habit, not done yet',
      goalId: h.goalId,
      score: 16 + lateNudge,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface DayReview {
  total: number;
  done: number;
  /** Named items that were scheduled today and left unfinished. */
  missed: { kind: 'task' | 'habit' | 'block'; id: string; title: string }[];
}

/**
 * What actually happened today.
 *
 * Used by the end-of-day summary. Reports only what was genuinely scheduled,
 * so a light day reads as a light day rather than a failure.
 */
export function reviewToday(input: SuggestInput, today: string = todayISO()): DayReview {
  let total = 0;
  let done = 0;
  const missed: DayReview['missed'] = [];

  for (const t of input.tasks) {
    const dueToday = t.dueDate === today;
    const doneToday = t.completed && (t.completedAt || '').startsWith(today);
    if (!dueToday && !doneToday) continue;
    total++;
    if (t.completed) done++;
    else missed.push({ kind: 'task', id: t.id, title: t.title });
  }

  for (const h of input.habits) {
    if (h.status !== 'active' || !isScheduledOn(h, today)) continue;
    total++;
    if (valueOn(input.habitLogs, h.id, today) >= Math.max(1, h.targetValue || 1)) done++;
    else missed.push({ kind: 'habit', id: h.id, title: h.title });
  }

  for (const { block, state } of blocksForDate(input.routineBlocks, input.routineLogs, today)) {
    total++;
    if (state === 'done') done++;
    else if (state !== 'skipped') missed.push({ kind: 'block', id: block.id, title: block.title });
  }

  return { total, done, missed };
}
