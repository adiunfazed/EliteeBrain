import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Task, TaskPriority } from '../types';

/**
 * Tasks live at users/{uid}/tasks/{taskId} — a subcollection rather than a blob
 * on the profile document, so a task write never races the profile sync and one
 * task changing doesn't rewrite the whole profile.
 *
 * A localStorage mirror keeps the list usable offline and while signed out.
 * Firestore is authoritative whenever the user is signed in.
 */

const LOCAL_KEY = 'elitebrain_tasks_v1';

function keyFor(userId?: string | null): string {
  // Per-account: a shared key meant signing into a second account on the same
  // device clobbered the first account's cached tasks.
  return userId ? `${LOCAL_KEY}:${userId}` : LOCAL_KEY;
}

function readLocal(userId?: string | null): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(tasks: Task[], userId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(tasks));
  } catch {
    /* quota or private mode — the in-memory list still works */
  }
}

export function localTasks(): Task[] {
  return readLocal();
}

/**
 * Firestore rejects `undefined` outright — one undefined field throws and the
 * ENTIRE write is lost. Optional fields like dueDate and completedAt are
 * frequently absent, so every payload is stripped before it goes out.
 */
function stripUndefined<T>(value: T): T {
  // Must recurse: a task's `subtasks` array and `recurrence` object can each
  // hold undefined, and Firestore fails the entire write if any survives.
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export function newTaskId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** ISO date n days from the given date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function makeTask(
  title: string,
  priority: TaskPriority = 'normal',
  dueDate?: string
): Task {
  const now = new Date().toISOString();
  return {
    id: newTaskId(),
    title: title.trim(),
    priority,
    dueDate,
    completed: false,
    createdAt: now,
    updatedAt: now,
    focusSeconds: 0,
  };
}

/**
 * Subscribe to the signed-in user's tasks. Returns an unsubscribe function.
 * When there is no user or no database, replays the local list once so the UI
 * still renders.
 */
export function subscribeTasks(
  userId: string | null,
  onChange: (tasks: Task[]) => void
): () => void {
  if (!userId || !db) {
    onChange(readLocal(userId));
    return () => {};
  }

  const ref = collection(db, 'users', userId, 'tasks');

  return onSnapshot(
    ref,
    (snap) => {
      // Sorting here rather than with orderBy: a Firestore orderBy excludes
      // documents that lack the field entirely, so one task saved without
      // createdAt would disappear from the list without any error.
      const tasks = snap.docs
        .map((d) => ({ ...(d.data() as Task), id: d.id }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

      writeLocal(tasks, userId);
      onChange(tasks);
    },
    (err) => {
      // Surface this properly: a permissions failure here looks identical to
      // "you have no tasks", which is how a save can appear to be lost.
      console.error('Task subscription failed:', err?.code || '', err?.message || err);
      onChange(readLocal(userId));
    }
  );
}

export async function saveTask(userId: string | null, task: Task): Promise<void> {
  const next = readLocal(userId).filter((t) => t.id !== task.id);
  writeLocal([task, ...next], userId);

  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'tasks', task.id), stripUndefined(task), { merge: true });
}

export async function patchTask(
  userId: string | null,
  taskId: string,
  changes: Partial<Task>
): Promise<void> {
  const patch = { ...changes, updatedAt: new Date().toISOString() };

  writeLocal(readLocal(userId).map((t) => (t.id === taskId ? { ...t, ...patch } : t)), userId);

  if (!userId || !db) return;

  // Any key explicitly set to undefined means "remove this field". Firestore
  // needs deleteField() for that — passing undefined throws.
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    payload[k] = v === undefined ? deleteField() : v;
  }
  await updateDoc(doc(db, 'users', userId, 'tasks', taskId), payload);
}

export async function removeTask(userId: string | null, taskId: string): Promise<void> {
  writeLocal(readLocal(userId).filter((t) => t.id !== taskId), userId);

  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'tasks', taskId));
}

export async function toggleTask(
  userId: string | null,
  task: Task
): Promise<void> {
  const completed = !task.completed;
  await patchTask(userId, task.id, {
    completed,
    completedAt: completed ? new Date().toISOString() : undefined,
  });
}

/** Buckets used by the task UI. */
export interface TaskBuckets {
  today: Task[];
  upcoming: Task[];
  completed: Task[];
}

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export function bucketTasks(tasks: Task[], today: string = todayISO()): TaskBuckets {
  const byPriority = (a: Task, b: Task) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.createdAt.localeCompare(b.createdAt);

  const open = tasks.filter((t) => !t.completed);

  return {
    // Unscheduled and overdue work both belong in Today — otherwise overdue
    // tasks silently vanish from the list the day after they were due.
    today: open.filter((t) => !t.dueDate || t.dueDate <= today).sort(byPriority),
    upcoming: open
      .filter((t) => t.dueDate && t.dueDate > today)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || byPriority(a, b)),
    completed: tasks
      .filter((t) => t.completed)
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
  };
}

export function completedTodayCount(tasks: Task[], today: string = todayISO()): number {
  return tasks.filter((t) => t.completed && (t.completedAt || '').startsWith(today)).length;
}

/** One dated section of the single task list. */
export interface TaskGroup {
  /** Stable key. A date group uses its ISO date. */
  id: string;
  label: string;
  /** Overdue is the only group that should read as a warning. */
  tone?: 'warn';
  tasks: Task[];
}

/**
 * Group open tasks into the sections the task list shows.
 *
 * Chronological rather than categorical: a task moves between sections purely
 * because its due date and today's date have a different relationship, so
 * nothing has to be filed anywhere and nothing needs moving by hand.
 *
 * Completed tasks are excluded here and nowhere else — they stay in the
 * database, in history, and in every XP and analytics calculation. This
 * function decides what the *active* list shows, not what exists.
 */
export function groupTasksByDate(
  tasks: Task[],
  today: string = todayISO(),
  sortWithin: (a: Task, b: Task) => number = () => 0
): TaskGroup[] {
  const tomorrow = addDays(today, 1);

  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const tomorrowTasks: Task[] = [];
  const undated: Task[] = [];
  /** Every other future date gets its own section. */
  const future = new Map<string, Task[]>();

  for (const t of tasks) {
    if (t.completed) continue;

    if (!t.dueDate) undated.push(t);
    else if (t.dueDate < today) overdue.push(t);
    else if (t.dueDate === today) todayTasks.push(t);
    else if (t.dueDate === tomorrow) tomorrowTasks.push(t);
    else {
      const list = future.get(t.dueDate);
      if (list) list.push(t);
      else future.set(t.dueDate, [t]);
    }
  }

  const groups: TaskGroup[] = [];

  // Overdue first: it is the only thing in the list that is already a
  // problem, and burying it under today's work is how it stays one.
  if (overdue.length > 0) {
    groups.push({
      id: 'overdue',
      label: 'Overdue',
      tone: 'warn',
      // Oldest first — the thing that has been waiting longest is the thing
      // most worth dealing with.
      tasks: overdue.sort(
        (a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || sortWithin(a, b)
      ),
    });
  }

  if (todayTasks.length > 0) {
    groups.push({ id: 'today', label: 'Today', tasks: todayTasks.sort(sortWithin) });
  }

  if (tomorrowTasks.length > 0) {
    groups.push({ id: 'tomorrow', label: 'Tomorrow', tasks: tomorrowTasks.sort(sortWithin) });
  }

  for (const date of Array.from(future.keys()).sort()) {
    const when = new Date(`${date}T00:00:00`);
    const sameYear = when.getFullYear() === new Date(`${today}T00:00:00`).getFullYear();

    groups.push({
      id: date,
      label: when.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
      }),
      tasks: future.get(date)!.sort(sortWithin),
    });
  }

  // Undated work last. It is real, so it is never hidden, but it is also the
  // only group with no claim on any particular day.
  if (undated.length > 0) {
    groups.push({ id: 'anytime', label: 'No date', tasks: undated.sort(sortWithin) });
  }

  return groups;
}
