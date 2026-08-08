import type { Task, TaskCategory, TaskEnergy, TaskPriority } from '../types';
import { todayISO } from './tasks';

/**
 * The execution engine: what to do next, what the user meant when they typed,
 * and what their own history says about their estimates.
 *
 * Everything here is a pure function so it can be tested without a database,
 * and every insight is computed from recorded activity only — no inference
 * about the person, just arithmetic on what they logged.
 */

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 40,
  high: 25,
  normal: 10,
  low: 0,
};

export const CATEGORY_META: Record<TaskCategory, { label: string; tint: string }> = {
  study: { label: 'Study', tint: 'text-[#818CF8] bg-[#5C6CF2]/12 border-[#5C6CF2]/25' },
  work: { label: 'Work', tint: 'text-sky-300 bg-sky-500/12 border-sky-500/25' },
  personal: { label: 'Personal', tint: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/25' },
  fitness: { label: 'Fitness', tint: 'text-amber-300 bg-amber-500/12 border-amber-500/25' },
  other: { label: 'Other', tint: 'text-slate-400 bg-slate-700/25 border-slate-600/30' },
};

export const ENERGY_META: Record<TaskEnergy, { label: string; hint: string }> = {
  low: { label: 'Low', hint: 'Fine when tired' },
  medium: { label: 'Medium', hint: 'Normal concentration' },
  high: { label: 'High', hint: 'Needs real focus' },
};

export const DURATION_PRESETS = [15, 30, 45, 60, 120];

function daysUntil(dueDate: string | undefined, today: string): number | null {
  if (!dueDate) return null;
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${dueDate}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Score an open task. Higher means "do this sooner".
 *
 * Overdue outranks everything because an overdue task is the one most likely to
 * be silently abandoned. Pinning is weighted heavily but not infinitely — the
 * user's own choice should lead without letting a pinned trivial task outrank
 * something critical and overdue.
 */
export function scoreTask(task: Task, now: Date = new Date()): number {
  if (task.completed) return -1;

  const today = todayISO();
  let score = PRIORITY_WEIGHT[task.priority] ?? 10;

  if (task.pinned) score += 30;

  const days = daysUntil(task.dueDate, today);
  if (days !== null) {
    if (days < 0) score += 50 + Math.min(20, Math.abs(days) * 4); // overdue
    else if (days === 0) score += 30;
    else if (days === 1) score += 15;
    else if (days <= 7) score += 6;
  } else {
    // Undated work should never crowd out dated work.
    score -= 5;
  }

  // A due time that has already passed today nudges it up.
  if (task.dueTime && task.dueDate === today) {
    const [h, m] = task.dueTime.split(':').map(Number);
    if (Number.isFinite(h)) {
      const due = new Date(now);
      due.setHours(h, m || 0, 0, 0);
      if (now.getTime() > due.getTime()) score += 10;
    }
  }

  // Among equals, prefer the shorter task — finishing something builds momentum.
  if (task.estimatedMinutes) score += Math.max(0, 8 - task.estimatedMinutes / 15);

  return score;
}

export interface NextActionContext {
  /** Minutes the user says they have. Undefined means no constraint. */
  availableMinutes?: number;
  /** Energy the user reports right now. */
  energy?: TaskEnergy;
}

const ENERGY_RANK: Record<TaskEnergy, number> = { low: 0, medium: 1, high: 2 };

/** Rank open tasks, optionally filtered by time and energy available. */
export function rankTasks(
  tasks: Task[],
  ctx: NextActionContext = {},
  now: Date = new Date()
): Task[] {
  return tasks
    .filter((t) => !t.completed)
    .filter((t) => {
      if (ctx.availableMinutes === undefined) return true;
      // Unestimated tasks stay visible — absence of data isn't a reason to hide.
      if (!t.estimatedMinutes) return true;
      return t.estimatedMinutes <= ctx.availableMinutes;
    })
    .filter((t) => {
      if (!ctx.energy) return true;
      if (!t.energy) return true;
      return ENERGY_RANK[t.energy] <= ENERGY_RANK[ctx.energy];
    })
    .sort((a, b) => scoreTask(b, now) - scoreTask(a, now));
}

export function nextBestAction(
  tasks: Task[],
  ctx: NextActionContext = {},
  now: Date = new Date()
): Task | null {
  return rankTasks(tasks, ctx, now)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Quick add                                                           */
/* ------------------------------------------------------------------ */

export interface ParsedEntry {
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  category?: TaskCategory;
  /** Human-readable summary of what was understood, for confirmation. */
  detected: string[];
}

function isoFromOffset(days: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a quick-add line such as
 *   "Complete Physics DPP tomorrow at 6pm !high 45m #study"
 *
 * Plain string matching, no AI call — this runs on every keystroke of the
 * preview, so it must be free and instant. Anything not recognised is left in
 * the title rather than being silently dropped.
 */
export function parseQuickEntry(input: string, now: Date = new Date()): ParsedEntry {
  let text = ` ${input.trim()} `;
  const detected: string[] = [];
  const out: ParsedEntry = { title: '', detected };

  const eat = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) {
      fn(m);
      text = text.replace(m[0], ' ');
    }
  };

  // Priority: !critical / !high / !low, or the bare words.
  eat(/\s!(critical|high|normal|low)\b/i, (m) => {
    out.priority = m[1].toLowerCase() as TaskPriority;
    detected.push(`${out.priority} priority`);
  });

  // Category: #study etc.
  eat(/\s#(study|work|personal|fitness|other)\b/i, (m) => {
    out.category = m[1].toLowerCase() as TaskCategory;
    detected.push(CATEGORY_META[out.category!].label);
  });

  // Duration: 45m, 45 min, 2h, 1.5 hours
  eat(/\s(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)\b/i, (m) => {
    out.estimatedMinutes = Math.round(parseFloat(m[1]));
    detected.push(`${out.estimatedMinutes} min`);
  });
  if (out.estimatedMinutes === undefined) {
    eat(/\s(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i, (m) => {
      out.estimatedMinutes = Math.round(parseFloat(m[1]) * 60);
      detected.push(`${out.estimatedMinutes} min`);
    });
  }

  // Time: at 6pm, 18:30, 6:30 pm
  eat(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m) => {
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    out.dueTime = `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
    detected.push(out.dueTime);
  });
  if (!out.dueTime) {
    eat(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, (m) => {
      out.dueTime = `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`;
      detected.push(out.dueTime);
    });
  }

  // Date words.
  eat(/\s(today|tonight|tomorrow|tmrw)\b/i, (m) => {
    const w = m[1].toLowerCase();
    out.dueDate = isoFromOffset(w === 'tomorrow' || w === 'tmrw' ? 1 : 0, now);
    detected.push(w === 'tomorrow' || w === 'tmrw' ? 'tomorrow' : 'today');
  });

  if (!out.dueDate) {
    eat(/\s(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, (m) => {
      const target = WEEKDAYS.indexOf(m[1].toLowerCase());
      let delta = (target - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      out.dueDate = isoFromOffset(delta, now);
      detected.push(m[1].toLowerCase());
    });
  }

  if (!out.dueDate) {
    eat(/\s(?:this\s+)?weekend\b/i, () => {
      // If it already is the weekend, "this weekend" means now — not next week.
      const dow = now.getDay(); // 0 Sun, 6 Sat
      const delta = dow === 6 || dow === 0 ? 0 : 6 - dow;
      out.dueDate = isoFromOffset(delta, now);
      detected.push('weekend');
    });
  }

  // A time without a date means today.
  if (out.dueTime && !out.dueDate) out.dueDate = isoFromOffset(0, now);

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface EstimateInsight {
  category?: TaskCategory;
  sampleSize: number;
  /** Positive means the user took longer than estimated. */
  averageDriftMinutes: number;
  text: string;
}

/**
 * Compare estimates against real focus time. Only reports when there is enough
 * data to mean anything — three tasks is the minimum worth a claim.
 */
export function estimateInsight(tasks: Task[]): EstimateInsight | null {
  const measured = tasks.filter(
    (t) => t.completed && t.estimatedMinutes && (t.focusSeconds || 0) > 60
  );
  if (measured.length < 3) return null;

  const drift =
    measured.reduce(
      (sum, t) => sum + ((t.focusSeconds || 0) / 60 - (t.estimatedMinutes || 0)),
      0
    ) / measured.length;

  const rounded = Math.round(drift);
  if (Math.abs(rounded) < 5) {
    return {
      sampleSize: measured.length,
      averageDriftMinutes: rounded,
      text: `Your time estimates have been close — within about ${Math.abs(
        rounded
      )} minutes across ${measured.length} tasks.`,
    };
  }

  return {
    sampleSize: measured.length,
    averageDriftMinutes: rounded,
    text:
      rounded > 0
        ? `You tend to take about ${rounded} minutes longer than you estimate, based on ${measured.length} tasks.`
        : `You tend to finish about ${Math.abs(
            rounded
          )} minutes faster than you estimate, based on ${measured.length} tasks.`,
  };
}

/** How many of the up-to-three pinned priorities are done today. */
export function priorityProgress(tasks: Task[], today: string = todayISO()) {
  const pinned = tasks.filter(
    (t) => t.pinned && (!t.dueDate || t.dueDate <= today || t.completedAt?.startsWith(today))
  );
  const done = pinned.filter((t) => t.completed).length;
  return { done, total: pinned.length, allDone: pinned.length > 0 && done === pinned.length };
}

export const MAX_PINNED = 3;
