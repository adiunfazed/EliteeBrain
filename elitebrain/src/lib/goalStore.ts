import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Goal, Habit, HabitLog } from '../types';
import { newTaskId } from './tasks';
import { logId } from './habits';

/**
 * Persistence for goals, habits and habit logs.
 *
 * Same shape as tasks: private subcollections under the user document, a
 * localStorage mirror so the UI works offline, and every payload stripped of
 * undefined because Firestore throws on it and loses the whole write.
 */

const KEYS = {
  goals: 'elitebrain_goals_v1',
  habits: 'elitebrain_habits_v1',
  logs: 'elitebrain_habitlogs_v1',
} as const;

type Kind = keyof typeof KEYS;

function readLocal<T>(kind: Kind): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(kind: Kind, list: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS[kind], JSON.stringify(list.slice(0, 500)));
  } catch {
    /* quota — in-memory state still works */
  }
}

function strip<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

function subscribe<T extends { id: string }>(
  kind: Kind,
  path: string,
  userId: string | null,
  onChange: (items: T[]) => void
): () => void {
  if (!userId || !db) {
    onChange(readLocal<T>(kind));
    return () => {};
  }
  return onSnapshot(
    collection(db, 'users', userId, path),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as T);
      writeLocal(kind, items);
      onChange(items);
    },
    (err) => {
      console.warn(`${path} subscription notice:`, err?.message || err);
      onChange(readLocal<T>(kind));
    }
  );
}

/* ---------------- Goals ---------------- */

export function newGoal(title: string): Goal {
  const now = new Date().toISOString();
  return {
    id: newTaskId(),
    title: title.trim(),
    metric: 'completion',
    status: 'active',
    milestones: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const subscribeGoals = (userId: string | null, cb: (g: Goal[]) => void) =>
  subscribe<Goal>('goals', 'goals', userId, cb);

export async function saveGoal(userId: string | null, goal: Goal): Promise<void> {
  writeLocal('goals', [goal, ...readLocal<Goal>('goals').filter((g) => g.id !== goal.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'goals', goal.id), strip(goal), { merge: true });
}

export async function patchGoal(
  userId: string | null,
  goalId: string,
  changes: Partial<Goal>
): Promise<void> {
  const patch = { ...changes, updatedAt: new Date().toISOString() };
  writeLocal(
    'goals',
    readLocal<Goal>('goals').map((g) => (g.id === goalId ? { ...g, ...patch } : g))
  );
  if (!userId || !db) return;
  await updateDoc(doc(db, 'users', userId, 'goals', goalId), strip(patch));
}

export async function removeGoal(userId: string | null, goalId: string): Promise<void> {
  writeLocal('goals', readLocal<Goal>('goals').filter((g) => g.id !== goalId));
  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'goals', goalId));
}

/* ---------------- Habits ---------------- */

export function newHabit(title: string): Habit {
  const now = new Date().toISOString();
  return {
    id: newTaskId(),
    title: title.trim(),
    cadence: 'daily',
    metric: 'yes_no',
    targetValue: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

export const subscribeHabits = (userId: string | null, cb: (h: Habit[]) => void) =>
  subscribe<Habit>('habits', 'habits', userId, cb);

export async function saveHabit(userId: string | null, habit: Habit): Promise<void> {
  writeLocal('habits', [habit, ...readLocal<Habit>('habits').filter((h) => h.id !== habit.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'habits', habit.id), strip(habit), { merge: true });
}

export async function patchHabit(
  userId: string | null,
  habitId: string,
  changes: Partial<Habit>
): Promise<void> {
  const patch = { ...changes, updatedAt: new Date().toISOString() };
  writeLocal(
    'habits',
    readLocal<Habit>('habits').map((h) => (h.id === habitId ? { ...h, ...patch } : h))
  );
  if (!userId || !db) return;
  await updateDoc(doc(db, 'users', userId, 'habits', habitId), strip(patch));
}

/**
 * Archiving rather than deleting is the default everywhere in this system:
 * a habit's history is the whole point, and deleting a habit would silently
 * destroy weeks of records.
 */
export async function archiveHabit(userId: string | null, habitId: string): Promise<void> {
  await patchHabit(userId, habitId, { status: 'archived' });
}

/* ---------------- Habit logs ---------------- */

export const subscribeHabitLogs = (userId: string | null, cb: (l: HabitLog[]) => void) =>
  subscribe<HabitLog>('logs', 'habitLogs', userId, cb);

/**
 * Record progress for one habit on one day. The document id is derived from
 * date + habitId, so repeated writes overwrite rather than accumulate rows —
 * this is what stops double-counting when a focus session and a manual tap
 * both land on the same habit.
 */
export async function setHabitValue(
  userId: string | null,
  habitId: string,
  date: string,
  value: number
): Promise<void> {
  const entry: HabitLog = {
    id: logId(habitId, date),
    habitId,
    date,
    value: Math.max(0, Math.round(value)),
    updatedAt: new Date().toISOString(),
  };

  writeLocal('logs', [
    entry,
    ...readLocal<HabitLog>('logs').filter((l) => l.id !== entry.id),
  ]);

  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'habitLogs', entry.id), strip(entry), { merge: true });
}
