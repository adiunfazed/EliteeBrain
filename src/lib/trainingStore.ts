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
import type { PersonalRecord, RecordMap } from './personalRecords';
import { mergeRecord, recordView } from './personalRecords';
import { WorkoutTemplate, TEMPLATE_LIMITS, normaliseTemplate } from './workoutTemplates';

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
const RECORDS_KEY = 'elitebrain_records_v1';
const TEMPLATES_KEY = 'elitebrain_workout_templates_v1';

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

/** Newest first, so "recent workouts" needs no further sorting. */
function byNewest(rows: WorkoutSession[]): WorkoutSession[] {
  return [...rows].sort((a, b) =>
    (b.finishedAt || b.startedAt || b.date || '').localeCompare(
      a.finishedAt || a.startedAt || a.date || ''
    )
  );
}

/**
 * Live listeners within this tab.
 *
 * Firestore's own snapshot covers the signed-in online case, but a workout
 * finished while signed out — or while a write is failing — produced no
 * snapshot at all, so history and personal bests only appeared after the page
 * was closed and reopened. Notifying locally on every save removes that
 * entirely: the UI updates from the local write, and the server reconciles
 * behind it.
 */
const workoutListeners = new Set<(rows: WorkoutSession[]) => void>();

function publishWorkouts(rows: WorkoutSession[]): void {
  const sorted = byNewest(rows);
  for (const fn of workoutListeners) {
    try {
      fn(sorted);
    } catch (err) {
      console.error('Workout listener failed:', err);
    }
  }
}

export function subscribeWorkouts(
  userId: string | null,
  onChange: (rows: WorkoutSession[]) => void
): () => void {
  workoutListeners.add(onChange);
  onChange(byNewest(localWorkouts()));

  if (!userId || !db) {
    return () => {
      workoutListeners.delete(onChange);
    };
  }

  const stop = onSnapshot(
    collection(db, 'users', userId, 'workouts'),
    (snap) => {
      const server = snap.docs.map((d) => d.data() as WorkoutSession);
      const serverIds = new Set(server.map((w) => w.id));

      // Local rows the server has not accepted yet are kept rather than
      // dropped. Replacing outright meant a just-finished workout — and the
      // personal best inside it — could vanish the moment a snapshot landed,
      // which is the stale-overwrites-newer case the brief calls out.
      const pending = localWorkouts().filter((w) => !serverIds.has(w.id));
      const merged = byNewest([...server, ...pending]).slice(0, 200);

      writeLocal(WORKOUTS_KEY, merged);
      publishWorkouts(merged);
    },
    (err) => console.error('Workout subscription failed:', err?.message || err)
  );

  return () => {
    workoutListeners.delete(onChange);
    stop();
  };
}

export async function saveWorkout(
  userId: string | null,
  session: WorkoutSession
): Promise<void> {
  const next = byNewest([
    session,
    ...localWorkouts().filter((w) => w.id !== session.id),
  ]).slice(0, 200);

  // Local first, then tell everyone watching — before the network is touched,
  // so the screen updates whether or not the write succeeds.
  writeLocal(WORKOUTS_KEY, next);
  publishWorkouts(next);

  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'workouts', session.id), strip(session), {
    merge: true,
  });
}

/* ---------------- custom workout templates ---------------- */

/**
 * A user's own workouts, synced to their account.
 *
 * Same local-first arrangement as workouts: the template is usable the moment
 * it is saved, signed in or not, and Firestore reconciles behind it. A
 * template is small and rarely written, but it is the thing the user actually
 * built — losing one to a dropped connection would be the worst failure in
 * this section, so nothing here depends on the network succeeding.
 */
export function localTemplates(): WorkoutTemplate[] {
  return readLocal<WorkoutTemplate>(TEMPLATES_KEY);
}

/** Most recently updated first: the one you are working on stays on top. */
function byRecent(rows: WorkoutTemplate[]): WorkoutTemplate[] {
  return [...rows].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
  );
}

const templateListeners = new Set<(rows: WorkoutTemplate[]) => void>();

function publishTemplates(rows: WorkoutTemplate[]): void {
  const sorted = byRecent(rows);
  for (const fn of templateListeners) {
    try {
      fn(sorted);
    } catch (err) {
      console.error('Template listener failed:', err);
    }
  }
}

export function subscribeTemplates(
  userId: string | null,
  onChange: (rows: WorkoutTemplate[]) => void
): () => void {
  templateListeners.add(onChange);
  onChange(byRecent(localTemplates()));

  if (!userId || !db) {
    return () => {
      templateListeners.delete(onChange);
    };
  }

  const stop = onSnapshot(
    collection(db, 'users', userId, 'workoutTemplates'),
    (snap) => {
      const server = snap.docs.map((d) => d.data() as WorkoutTemplate).filter((t) => t?.id);
      const serverIds = new Set(server.map((t) => t.id));

      // A template saved locally that the server has not accepted yet is kept.
      // Replacing outright would delete a workout the user just built the
      // moment the first snapshot arrived.
      //
      // Deletions are the exception: an id the server has seen and dropped
      // must not come back, so only rows the server never knew about survive.
      const deleted = readLocal<string>(`${TEMPLATES_KEY}__deleted`);
      const pending = localTemplates().filter(
        (t) => !serverIds.has(t.id) && !deleted.includes(t.id)
      );

      const merged = byRecent([...server, ...pending]).slice(0, TEMPLATE_LIMITS.templates);
      writeLocal(TEMPLATES_KEY, merged);
      publishTemplates(merged);
    },
    (err) => console.error('Template subscription failed:', err?.message || err)
  );

  return () => {
    templateListeners.delete(onChange);
    stop();
  };
}

export async function saveTemplate(
  userId: string | null,
  template: WorkoutTemplate
): Promise<void> {
  const clean = normaliseTemplate(template);
  const next = byRecent([
    clean,
    ...localTemplates().filter((t) => t.id !== clean.id),
  ]).slice(0, TEMPLATE_LIMITS.templates);

  writeLocal(TEMPLATES_KEY, next);
  publishTemplates(next);

  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'workoutTemplates', clean.id), strip(clean), {
    merge: true,
  });
}

export async function removeTemplate(userId: string | null, templateId: string): Promise<void> {
  writeLocal(TEMPLATES_KEY, localTemplates().filter((t) => t.id !== templateId));
  // Remembered so a snapshot that predates the delete cannot resurrect it.
  writeLocal(
    `${TEMPLATES_KEY}__deleted`,
    [templateId, ...readLocal<string>(`${TEMPLATES_KEY}__deleted`)].slice(0, 100)
  );
  publishTemplates(localTemplates());

  if (!userId || !db) return;
  await deleteDoc(doc(db, 'users', userId, 'workoutTemplates', templateId));
}

/* ---------------- personal records ---------------- */

/**
 * Records live in their own tiny documents, one per exercise.
 *
 * A record used to be inferred purely from the saved workouts, which meant a
 * single failed workout write silently erased a personal best — the set had
 * happened, the celebration had already been shown, and then the number was
 * gone. Writing the record separately, the moment it is set, decouples "my
 * best ever" from "did that one document save".
 */

export function localRecords(): RecordMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as RecordMap) : {};
  } catch {
    return {};
  }
}

function writeRecords(map: RecordMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(map));
  } catch {
    /* private mode or quota — the in-memory copy still serves this session */
  }
}

const recordListeners = new Set<(records: RecordMap) => void>();

function publishRecords(map: RecordMap): void {
  for (const fn of recordListeners) {
    try {
      fn(map);
    } catch (err) {
      console.error('Record listener failed:', err);
    }
  }
}

/**
 * Keep the best of two copies of a record.
 *
 * Merged per dimension rather than picking one document whole: a device that
 * has only ever seen the bodyweight best must not wipe out a weighted one,
 * and the reverse.
 */
function higher(a?: PersonalRecord, b?: PersonalRecord): PersonalRecord | undefined {
  return mergeRecord(a, b);
}

export function subscribeRecords(
  userId: string | null,
  onChange: (records: RecordMap) => void
): () => void {
  recordListeners.add(onChange);
  onChange(localRecords());

  if (!userId || !db) {
    return () => {
      recordListeners.delete(onChange);
    };
  }

  const stop = onSnapshot(
    collection(db, 'users', userId, 'records'),
    (snap) => {
      const server: RecordMap = {};
      for (const d of snap.docs) {
        const row = d.data() as PersonalRecord;
        if (row && typeof row.value === 'number') server[row.exerciseId || d.id] = row;
      }

      // Merged rather than replaced. A record set while offline, or while a
      // write was being refused, must not be wiped by the first snapshot that
      // does not know about it yet.
      const local = localRecords();
      const merged: RecordMap = {};
      for (const id of new Set([...Object.keys(local), ...Object.keys(server)])) {
        const best = higher(local[id], server[id]);
        if (best) merged[id] = best;
      }

      writeRecords(merged);
      publishRecords(merged);
    },
    (err) => console.error('Record subscription failed:', err?.message || err)
  );

  return () => {
    recordListeners.delete(onChange);
    stop();
  };
}

/**
 * Store a new personal record.
 *
 * Local first and published immediately, so the number on screen changes the
 * instant the set ends whether or not the network agrees. A lower value is
 * ignored outright: records only ever go up, so a stale write arriving late
 * can never knock one back down.
 */
export async function saveRecord(
  userId: string | null,
  record: PersonalRecord
): Promise<void> {
  if (!record?.exerciseId) return;

  const incoming = recordView(record);
  // Nothing worth storing: neither a bodyweight best nor a weighted one.
  if (incoming.reps <= 0 && incoming.e1rm <= 0) return;

  const current = localRecords();
  const held = current[record.exerciseId];
  const merged = mergeRecord(held, record);
  if (!merged) return;

  // A write that improves nothing is dropped, so a stale write arriving late
  // can never knock a record back down and cannot cause a pointless publish.
  const before = recordView(held);
  const after = recordView(merged);
  if (held && after.reps <= before.reps && after.e1rm <= before.e1rm) return;

  const next = { ...current, [record.exerciseId]: merged };
  writeRecords(next);
  publishRecords(next);

  if (!userId || !db) return;
  await setDoc(
    doc(db, 'users', userId, 'records', record.exerciseId),
    strip(next[record.exerciseId] as any),
    { merge: true }
  );
}
