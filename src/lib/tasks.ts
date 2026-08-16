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

function readLocal(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(tasks: Task[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks));
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
    onChange(readLocal());
    return () => {};
  }

  const ref = collection(db, 'users', userId, 'tasks');
  const q = query(ref, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => d.data() as Task);
      writeLocal(tasks);
      onChange(tasks);
    },
    (err) => {
      console.warn('Task subscription notice:', err?.message || err);
      onChange(readLocal());
    }
  );
}

export async function saveTask(userId: string | null, task: Task): Promise<void> {
  const next = readLocal().filter((t) => t.id !== task.id);
  writeLocal([task, ...next]);

  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'tasks', task.id), stripUndefined(task), { merge: true });
}

export async function patchTask(
  userId: string | null,
  taskId: string,
  changes: Partial<Task>
): Promise<void> {
  const patch = { ...changes, updatedAt: new Date().toISOString() };

  writeLocal(readLocal().map((t) => (t.id === taskId ? { ...t, ...patch } : t)));

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
  writeLocal(readLocal().filter((t) => t.id !== taskId));

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
