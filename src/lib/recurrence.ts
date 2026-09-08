import type { Recurrence, Task } from '../types';
import { newTaskId } from './tasks';

/**
 * Recurring tasks.
 *
 * The dangerous failure mode here is duplicate generation — spawn on every
 * render or every sync and the list fills with copies until it's unusable.
 * Two guards prevent that:
 *
 *   1. A successor is only ever created when a task is COMPLETED, never on a
 *      timer or a render.
 *   2. The completed task records `spawnedNextAt`. If it's already set, no
 *      further successor is created no matter how many times the code runs.
 *
 * Everything is a pure function so the behaviour can be tested without a
 * database.
 */

export const RECURRENCE_LABELS: Record<Recurrence['freq'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function parseISO(iso: string): Date | null {
  const ms = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * The next date in the series strictly after `fromISO`.
 * Returns null when the recurrence is malformed.
 */
export function nextOccurrence(
  rec: Recurrence,
  fromISO: string,
  today: string = toISO(new Date())
): string | null {
  const base = parseISO(fromISO) || parseISO(today);
  if (!base) return null;

  const interval = Math.max(1, Math.floor(rec.interval || 1));

  if (rec.freq === 'daily') {
    const d = new Date(base);
    d.setDate(d.getDate() + interval);
    return toISO(d);
  }

  if (rec.freq === 'weekly') {
    const days = (rec.weekdays && rec.weekdays.length > 0
      ? [...rec.weekdays]
      : [base.getDay()]
    ).sort((a, b) => a - b);

    // Next selected weekday later this week.
    const after = days.find((d) => d > base.getDay());
    if (after !== undefined && interval === 1) {
      const d = new Date(base);
      d.setDate(d.getDate() + (after - base.getDay()));
      return toISO(d);
    }

    // Otherwise jump to the first selected weekday of the next active week.
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * interval - base.getDay() + days[0]);
    return toISO(d);
  }

  // Monthly. Clamp to the last day when the target month is shorter, so
  // "31st monthly" doesn't silently skip February.
  const d = new Date(base);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + interval);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return toISO(d);
}

/**
 * Given a task that has just been completed, return the successor to create —
 * or null when none should exist.
 */
export function buildNextInSeries(
  task: Task,
  today: string = toISO(new Date())
): Task | null {
  if (!task.recurrence) return null;
  // Guard 2: already spawned. Never create a second successor.
  if (task.spawnedNextAt) return null;
  if (!task.completed) return null;

  const anchor = task.dueDate || today;
  const nextDate = nextOccurrence(task.recurrence, anchor, today);
  if (!nextDate) return null;

  const now = new Date().toISOString();

  return {
    ...task,
    id: newTaskId(),
    seriesId: task.seriesId || task.id,
    completed: false,
    completedAt: undefined,
    dueDate: nextDate,
    createdAt: now,
    updatedAt: now,
    focusSeconds: 0,
    reflection: undefined,
    spawnedNextAt: undefined,
    // Subtasks come back unticked; the work has to be done again.
    subtasks: task.subtasks?.map((s) => ({ ...s, done: false })),
  };
}

export function describeRecurrence(rec?: Recurrence): string {
  if (!rec) return '';
  const n = Math.max(1, Math.floor(rec.interval || 1));
  if (rec.freq === 'daily') return n === 1 ? 'Every day' : `Every ${n} days`;
  if (rec.freq === 'monthly') return n === 1 ? 'Every month' : `Every ${n} months`;
  if (rec.weekdays && rec.weekdays.length > 0) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Weekly · ${rec.weekdays.sort((a, b) => a - b).map((d) => names[d]).join(', ')}`;
  }
  return n === 1 ? 'Every week' : `Every ${n} weeks`;
}

/** Progress across a task's subtasks. */
export function subtaskProgress(task: Task): { done: number; total: number } {
  const list = task.subtasks || [];
  return { done: list.filter((s) => s.done).length, total: list.length };
}

/** Free-text search across title, notes, category and subtasks. */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => {
    if (t.title.toLowerCase().includes(q)) return true;
    if (t.notes?.toLowerCase().includes(q)) return true;
    if (t.category?.toLowerCase().includes(q)) return true;
    if (t.priority.toLowerCase().includes(q)) return true;
    return (t.subtasks || []).some((s) => s.title.toLowerCase().includes(q));
  });
}
