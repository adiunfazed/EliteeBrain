import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FocusSession } from '../types';
import { todayISO } from './tasks';

const LOCAL_KEY = 'elitebrain_focus_v1';
/** A run in progress, so a refresh mid-session doesn't lose the timer. */
const ACTIVE_KEY = 'elitebrain_focus_active_v1';

export const FOCUS_PRESETS = [15, 25, 45, 60];

function readLocal(): FocusSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as FocusSession[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: FocusSession[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

/**
 * A running session, persisted so a refresh or accidental navigation doesn't
 * destroy it.
 *
 * Elapsed time is derived from wall-clock timestamps rather than counted by an
 * interval. Browsers throttle timers in background tabs, so a counting timer
 * loses minutes whenever the user switches away — which is precisely when they
 * are supposed to be focusing on something else.
 */
export interface ActiveFocus {
  taskId?: string;
  taskTitle: string;
  plannedMinutes: number;
  startedAt: number;
  /** Total milliseconds spent paused so far. */
  pausedMs: number;
  /** Timestamp the current pause began, or null when running. */
  pausedAt: number | null;
}

export function loadActiveFocus(): ActiveFocus | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveFocus) : null;
  } catch {
    return null;
  }
}

export function saveActiveFocus(active: ActiveFocus | null) {
  if (typeof window === 'undefined') return;
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function startFocus(
  taskTitle: string,
  plannedMinutes: number,
  taskId?: string,
  now: number = Date.now()
): ActiveFocus {
  return { taskId, taskTitle, plannedMinutes, startedAt: now, pausedMs: 0, pausedAt: null };
}

/** Seconds of genuine focus so far, excluding paused time. */
export function elapsedSeconds(active: ActiveFocus, now: number = Date.now()): number {
  const pausedNow = active.pausedAt !== null ? now - active.pausedAt : 0;
  const ms = now - active.startedAt - active.pausedMs - pausedNow;
  return Math.max(0, Math.floor(ms / 1000));
}

export function remainingSeconds(active: ActiveFocus, now: number = Date.now()): number {
  return Math.max(0, active.plannedMinutes * 60 - elapsedSeconds(active, now));
}

export function isFinished(active: ActiveFocus, now: number = Date.now()): boolean {
  return remainingSeconds(active, now) <= 0;
}

export function pauseFocus(active: ActiveFocus, now: number = Date.now()): ActiveFocus {
  if (active.pausedAt !== null) return active;
  return { ...active, pausedAt: now };
}

export function resumeFocus(active: ActiveFocus, now: number = Date.now()): ActiveFocus {
  if (active.pausedAt === null) return active;
  return { ...active, pausedMs: active.pausedMs + (now - active.pausedAt), pausedAt: null };
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
}

export async function saveFocusSession(
  userId: string | null,
  session: FocusSession
): Promise<void> {
  writeLocal([session, ...readLocal().filter((s) => s.id !== session.id)]);
  if (!userId || !db) return;
  await setDoc(doc(db, 'users', userId, 'focusSessions', session.id), session, { merge: true });
}

export function subscribeFocusSessions(
  userId: string | null,
  onChange: (sessions: FocusSession[]) => void
): () => void {
  if (!userId || !db) {
    onChange(readLocal());
    return () => {};
  }

  const q = query(collection(db, 'users', userId, 'focusSessions'), orderBy('startedAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as FocusSession);
      writeLocal(list);
      onChange(list);
    },
    (err) => {
      console.warn('Focus session subscription notice:', err?.message || err);
      onChange(readLocal());
    }
  );
}

export function focusSecondsToday(
  sessions: FocusSession[],
  today: string = todayISO()
): number {
  return sessions
    .filter((s) => s.startedAt.startsWith(today))
    .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0);
}

export function focusSessionsToday(
  sessions: FocusSession[],
  today: string = todayISO()
): number {
  return sessions.filter((s) => s.startedAt.startsWith(today)).length;
}
