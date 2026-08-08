import type { Goal, GoalHealth, Habit, HabitLog, Task } from '../types';
import { todayISO } from './tasks';
import { habitStats } from './habits';
import { rankTasks } from './taskEngine';

/**
 * Goal progress and health.
 *
 * Progress is always DERIVED from something real — a recorded value, ticked
 * milestones, or the completion rate of the habits that support the goal.
 * Nothing is estimated, and no source is counted twice.
 */

export function daysRemaining(deadline?: string, today: string = todayISO()): number | null {
  if (!deadline) return null;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${deadline}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

export interface GoalProgress {
  /** 0-1. */
  ratio: number;
  percent: number;
  label: string;
  /** Where the number came from, so the UI never implies more than it knows. */
  source: 'value' | 'milestones' | 'habits' | 'none';
}

export function goalProgress(
  goal: Goal,
  habits: Habit[] = [],
  logs: HabitLog[] = [],
  today: string = todayISO()
): GoalProgress {
  // 1. Milestone-driven goals.
  if (goal.metric === 'completion') {
    const ms = goal.milestones || [];
    if (ms.length === 0) {
      return { ratio: 0, percent: 0, label: 'No milestones yet', source: 'none' };
    }
    const done = ms.filter((m) => m.done).length;
    const ratio = done / ms.length;
    return {
      ratio,
      percent: Math.round(ratio * 100),
      label: `${done} of ${ms.length} milestones`,
      source: 'milestones',
    };
  }

  // 2. Habit-driven goals: average completion rate of the linked habits.
  if (goal.metric === 'habit') {
    const linked = habits.filter((h) => h.goalId === goal.id && h.status !== 'archived');
    if (linked.length === 0) {
      return { ratio: 0, percent: 0, label: 'No habits linked yet', source: 'none' };
    }
    const avg =
      linked.reduce((sum, h) => sum + habitStats(h, logs, today).completionRate, 0) /
      linked.length;
    return {
      ratio: avg / 100,
      percent: Math.round(avg),
      label: `${linked.length} habit${linked.length === 1 ? '' : 's'} · ${Math.round(avg)}% consistency`,
      source: 'habits',
    };
  }

  // 3. Value-driven goals.
  const target = goal.targetValue || 0;
  const current = goal.currentValue || 0;
  if (target <= 0) {
    return { ratio: 0, percent: 0, label: 'No target set', source: 'none' };
  }
  const ratio = Math.max(0, Math.min(1, current / target));
  const unit = goal.unit ? ` ${goal.unit}` : goal.metric === 'percentage' ? '%' : '';
  return {
    ratio,
    percent: Math.round(ratio * 100),
    label: `${current}${unit} of ${target}${unit}`,
    source: 'value',
  };
}

export interface GoalHealthResult {
  health: GoalHealth;
  label: string;
  /** Plain explanation of why. Never vague. */
  reason: string;
}

/**
 * Health compares how far through the goal you are against how far through the
 * time you are. A goal with no deadline can't be behind schedule, so it is only
 * judged on whether anything has happened at all.
 */
export function goalHealth(
  goal: Goal,
  progress: GoalProgress,
  today: string = todayISO()
): GoalHealthResult {
  if (goal.status === 'completed' || progress.ratio >= 1) {
    return { health: 'done', label: 'Complete', reason: 'You hit the target.' };
  }

  const left = daysRemaining(goal.deadline, today);

  if (left === null) {
    if (progress.ratio === 0) {
      return {
        health: 'needs_attention',
        label: 'Needs attention',
        reason: 'No progress recorded yet, and no deadline to pace against.',
      };
    }
    return {
      health: 'on_track',
      label: 'On track',
      reason: `${progress.percent}% done. No deadline set.`,
    };
  }

  if (left < 0) {
    return {
      health: 'at_risk',
      label: 'At risk',
      reason: `The deadline passed ${Math.abs(left)} day${Math.abs(left) === 1 ? '' : 's'} ago at ${progress.percent}%.`,
    };
  }

  const startMs = Date.parse(`${goal.createdAt.slice(0, 10)}T00:00:00`);
  const endMs = Date.parse(`${goal.deadline}T00:00:00`);
  const nowMs = Date.parse(`${today}T00:00:00`);
  const span = endMs - startMs;
  const elapsed = span > 0 ? Math.max(0, Math.min(1, (nowMs - startMs) / span)) : 0;

  // Behind by more than a quarter of the timeline is at risk; more than a
  // tenth is worth flagging.
  const gap = elapsed - progress.ratio;

  if (gap > 0.25) {
    return {
      health: 'at_risk',
      label: 'At risk',
      reason: `${Math.round(elapsed * 100)}% of the time has gone but you're ${progress.percent}% done, with ${left} day${left === 1 ? '' : 's'} left.`,
    };
  }
  if (gap > 0.1) {
    return {
      health: 'needs_attention',
      label: 'Needs attention',
      reason: `Slightly behind pace — ${progress.percent}% done with ${left} day${left === 1 ? '' : 's'} left.`,
    };
  }
  return {
    health: 'on_track',
    label: 'On track',
    reason: `${progress.percent}% done with ${left} day${left === 1 ? '' : 's'} left.`,
  };
}

/** The most useful task to do next for this goal, from the existing task list. */
export function nextActionForGoal(goal: Goal, tasks: Task[]): Task | null {
  const relevant = tasks.filter(
    (t) => !t.completed && (!goal.category || t.category === goal.category)
  );
  return rankTasks(relevant)[0] ?? null;
}

/**
 * Warn when the day's scheduled habits plainly exceed the time available.
 * Only counts duration habits, since those are the only ones with real minutes.
 */
export function overcommitmentWarning(
  habits: Habit[],
  today: string = todayISO(),
  availableMinutes = 480
): string | null {
  const scheduled = habits.filter(
    (h) => h.status === 'active' && h.metric === 'duration'
  );
  const total = scheduled.reduce((sum, h) => sum + (h.targetValue || 0), 0);
  if (total <= availableMinutes) return null;
  const hours = Math.round((total / 60) * 10) / 10;
  return `Your daily habits add up to about ${hours} hours. That may be more than one day holds.`;
}

export const GOAL_HEALTH_STYLE: Record<GoalHealth, string> = {
  on_track: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30',
  needs_attention: 'text-amber-300 bg-amber-500/12 border-amber-500/30',
  at_risk: 'text-rose-300 bg-rose-500/12 border-rose-500/30',
  done: 'text-[#818CF8] bg-[#5C6CF2]/12 border-[#5C6CF2]/30',
};
