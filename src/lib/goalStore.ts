import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Goal, GoalSnapshot, Habit, HabitLog, RoutineBlock, RoutineLog, SleepLog } from '../types';
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
  routineBlocks: 'elitebrain_routine_blocks_v1',
  routineLogs: 'elitebrain_routine_logs_v1',
  sleep: 'elitebrain_sleep_v1',
  goalSnapshots: 'elitebrain_goal_snapshots_v1',
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

/**
 * Remove undefined values at EVERY depth.
 *
 * Firestore rejects undefined anywhere in a payload and fails the whole write.
 * The previous version only cleaned the top level, so a milestone array
 * containing `completedAt: undefined` (any unticked milestone) silently killed
 * the save — milestones appeared to work until the page was refreshed.
 */
/**
 * Turn explicit `undefined` values into Firestore delete instructions.
 *
 * strip() removes undefined, which is correct when a caller simply didn't
 * supply a field — but it also silently swallowed deliberate clears, so
 * unlinking a habit or goal appeared to do nothing.
 */
function withDeletes(patch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value === undefined ? deleteField() : strip(value);
  }
  return out;
}

function strip<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => strip(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v === undefined) continue;
      out[k] = strip(v);
    }
    return out as T;
  }
  return value;
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
  await updateDoc(doc(db, 'users', userId, 'goals', goalId), withDeletes(patch));
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
  await updateDoc(doc(db, 'users', userId, 'habits', habitId), withDeletes(patch));
}

/**
 * Archiving rather than deleting is the default everywhere in this system:
 * a habit's history is the whole point, and deleting a habit would silently
 * destroy weeks of records.
 */
export async function archiveHabit(userId: string | null, habitId: string): Promise<void> {
  await patchHabit(userId, habitId, { status: 'archived' });
}

/**
 * Permanent removal. Kept separate from archiving and only reachable behind a
 * confirmation, because this discards the habit's entire streak history.
 */
export async function removeHabit(userId: string | null, habitId: string): Promise<void> {
  writeLocal('habits', readLocal<Habit>('habits').filter((h) => h.id !== habitId));
  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'habits', habitId));
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


/* ---------------- Routine ---------------- */

export function newRoutineBlock(
  title: string,
  kind: RoutineBlock['kind'],
  startTime: string,
  endTime: string
): RoutineBlock {
  const now = new Date().toISOString();
  return {
    id: newTaskId(),
    title: title.trim(),
    kind,
    startTime,
    endTime,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export const subscribeRoutineBlocks = (userId: string | null, cb: (b: RoutineBlock[]) => void) =>
  subscribe<RoutineBlock>('routineBlocks', 'routineBlocks', userId, cb);

export const subscribeRoutineLogs = (userId: string | null, cb: (l: RoutineLog[]) => void) =>
  subscribe<RoutineLog>('routineLogs', 'routineLogs', userId, cb);

export async function saveRoutineBlock(userId: string | null, block: RoutineBlock): Promise<void> {
  writeLocal('routineBlocks', [
    block,
    ...readLocal<RoutineBlock>('routineBlocks').filter((b) => b.id !== block.id),
  ]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'routineBlocks', block.id), strip(block), { merge: true });
}

export async function patchRoutineBlock(
  userId: string | null,
  blockId: string,
  changes: Partial<RoutineBlock>
): Promise<void> {
  const patch = { ...changes, updatedAt: new Date().toISOString() };
  writeLocal(
    'routineBlocks',
    readLocal<RoutineBlock>('routineBlocks').map((b) => (b.id === blockId ? { ...b, ...patch } : b))
  );
  if (!userId || !db) return;
  await updateDoc(doc(db, 'users', userId, 'routineBlocks', blockId), withDeletes(patch));
}

export async function removeRoutineBlock(userId: string | null, blockId: string): Promise<void> {
  writeLocal('routineBlocks', readLocal<RoutineBlock>('routineBlocks').filter((b) => b.id !== blockId));
  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'routineBlocks', blockId));
}

/**
 * Mark one occurrence. The id is date + blockId, so editing the same day again
 * overwrites instead of stacking duplicate rows — and changing the recurring
 * definition never rewrites past days.
 */
export async function setRoutineState(
  userId: string | null,
  blockId: string,
  date: string,
  state: RoutineLog['state']
): Promise<void> {
  const entry: RoutineLog = {
    id: `${date}__${blockId}`,
    blockId,
    date,
    state,
    updatedAt: new Date().toISOString(),
  };
  writeLocal('routineLogs', [
    entry,
    ...readLocal<RoutineLog>('routineLogs').filter((l) => l.id !== entry.id),
  ]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'routineLogs', entry.id), strip(entry), { merge: true });
}

/* ---------------- Sleep ---------------- */

export const subscribeSleepLogs = (userId: string | null, cb: (l: SleepLog[]) => void) =>
  subscribe<SleepLog>('sleep', 'sleepLogs', userId, cb);

/** Keyed by wake date, so re-entering a night corrects it rather than duplicating. */
export async function saveSleepLog(userId: string | null, log: SleepLog): Promise<void> {
  writeLocal('sleep', [log, ...readLocal<SleepLog>('sleep').filter((l) => l.id !== log.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'sleepLogs', log.id), strip(log), { merge: true });
}

export async function removeSleepLog(userId: string | null, date: string): Promise<void> {
  writeLocal('sleep', readLocal<SleepLog>('sleep').filter((l) => l.id !== date));
  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'sleepLogs', date));
}


/* ---------------- Goal history ---------------- */

export const subscribeGoalSnapshots = (userId: string | null, cb: (s: GoalSnapshot[]) => void) =>
  subscribe<GoalSnapshot>('goalSnapshots', 'goalSnapshots', userId, cb);

/**
 * Record where a goal stands today. The id is goalId + date, so running this
 * repeatedly in a day overwrites rather than creating duplicate points — which
 * is what keeps the history graph honest.
 */
export async function snapshotGoal(
  userId: string | null,
  goalId: string,
  date: string,
  percent: number
): Promise<void> {
  const entry: GoalSnapshot = {
    id: `${goalId}__${date}`,
    goalId,
    date,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    updatedAt: new Date().toISOString(),
  };

  const existing = readLocal<GoalSnapshot>('goalSnapshots');
  const prior = existing.find((e) => e.id === entry.id);
  // Skip the write when nothing changed; this runs on every load.
  if (prior && prior.percent === entry.percent) return;

  writeLocal('goalSnapshots', [entry, ...existing.filter((e) => e.id !== entry.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'goalSnapshots', entry.id), strip(entry), { merge: true });
}

/** Points for one goal, oldest first. */
export function snapshotsFor(all: GoalSnapshot[], goalId: string): GoalSnapshot[] {
  return all.filter((s) => s.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date));
}
