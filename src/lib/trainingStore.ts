import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Alarm, AlarmLog } from './wakeChallenge';
import { WorkoutSession } from './bodyTraining';

/**
 * Persistence for body training and alarms.
 *
 * Mirrors the existing goalStore: local cache first so the UI is instant and
 * works offline, Firestore behind it for sync. Reusing that pattern rather
 * than inventing a second one keeps the offline behaviour consistent.
 */

const ALARMS_KEY = 'elitebrain_alarms_v1';
const ALARM_LOGS_KEY = 'elitebrain_alarm_logs_v1';
const WORKOUTS_KEY = 'elitebrain_workouts_v1';

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* private mode or quota — the in-memory copy still serves this session */
  }
}

/** Firestore rejects undefined outright, so strip before every write. */
function strip<T extends Record<string, any>>(value: T): T {
  const out: any = Array.isArray(value) ? [] : {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? strip(v) : v;
  }
  return out;
}

/* ---------------- alarms ---------------- */

export function localAlarms(): Alarm[] {
  return readLocal<Alarm>(ALARMS_KEY);
}

export function subscribeAlarms(
  userId: string | null,
  onChange: (rows: Alarm[]) => void
): () => void {
  onChange(localAlarms());
  if (!userId || !db) return () => {};

  return onSnapshot(
    collection(db, 'users', userId, 'alarms'),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as Alarm);
      writeLocal(ALARMS_KEY, rows);
      onChange(rows);
    },
    (err) => {
      // A subscription failure must not clear what is already on screen.
      console.error('Alarm subscription failed:', err?.message || err);
    }
  );
}

export async function saveAlarm(userId: string | null, alarm: Alarm): Promise<void> {
  writeLocal(ALARMS_KEY, [alarm, ...localAlarms().filter((a) => a.id !== alarm.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'alarms', alarm.id), strip(alarm), { merge: true });
}

export async function patchAlarm(
  userId: string | null,
  alarmId: string,
  patch: Partial<Alarm>
): Promise<void> {
  writeLocal(
    ALARMS_KEY,
    localAlarms().map((a) => (a.id === alarmId ? { ...a, ...patch } : a))
  );
  if (!userId || !db) return;
  await updateDoc(doc(db, 'users', userId, 'alarms', alarmId), strip(patch as any));
}

export async function removeAlarm(userId: string | null, alarmId: string): Promise<void> {
  writeLocal(ALARMS_KEY, localAlarms().filter((a) => a.id !== alarmId));
  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'alarms', alarmId));
}

/* ---------------- alarm history ---------------- */

export function localAlarmLogs(): AlarmLog[] {
  return readLocal<AlarmLog>(ALARM_LOGS_KEY);
}

export function subscribeAlarmLogs(
  userId: string | null,
  onChange: (rows: AlarmLog[]) => void
): () => void {
  onChange(localAlarmLogs());
  if (!userId || !db) return () => {};

  return onSnapshot(
    collection(db, 'users', userId, 'alarmLogs'),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as AlarmLog);
      writeLocal(ALARM_LOGS_KEY, rows);
      onChange(rows);
    },
    (err) => console.error('Alarm log subscription failed:', err?.message || err)
  );
}

export async function saveAlarmLog(userId: string | null, log: AlarmLog): Promise<void> {
  // Kept to the last 120 entries: history is useful, unbounded growth is not.
  const next = [log, ...localAlarmLogs().filter((l) => l.id !== log.id)].slice(0, 120);
  writeLocal(ALARM_LOGS_KEY, next);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'alarmLogs', log.id), strip(log), { merge: true });
}

/* ---------------- workouts ---------------- */

export function localWorkouts(): WorkoutSession[] {
  return readLocal<WorkoutSession>(WORKOUTS_KEY);
}

export function subscribeWorkouts(
  userId: string | null,
  onChange: (rows: WorkoutSession[]) => void
): () => void {
  onChange(localWorkouts());
  if (!userId || !db) return () => {};

  return onSnapshot(
    collection(db, 'users', userId, 'workouts'),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as WorkoutSession);
      writeLocal(WORKOUTS_KEY, rows);
      onChange(rows);
    },
    (err) => console.error('Workout subscription failed:', err?.message || err)
  );
}

export async function saveWorkout(
  userId: string | null,
  session: WorkoutSession
): Promise<void> {
  const next = [session, ...localWorkouts().filter((w) => w.id !== session.id)].slice(0, 200);
  writeLocal(WORKOUTS_KEY, next);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'workouts', session.id), strip(session), {
    merge: true,
  });
}
