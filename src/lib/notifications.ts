import type { Habit, HabitLog, RoutineBlock, RoutineLog, Task } from '../types';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate, minutesOf } from './routine';
import { bucketTasks } from './tasks';

/**
 * Notifications.
 *
 * What actually works, and where:
 *
 *   Android / desktop Chrome, Edge, Firefox — works from a normal browser tab.
 *   iPhone / iPad — Apple only permits notifications for a web app added to the
 *     Home Screen via Safari. An open Safari tab cannot receive them, and every
 *     iOS browser uses WebKit so Chrome and Firefox share the restriction.
 *
 * Reminders are scheduled locally by the page while it is running. That is
 * honest about its limits: it cannot wake a device that has fully closed the
 * app. Server-sent push would cover that, and the service worker already
 * handles the `push` event — it needs VAPID keys and a Firebase service account
 * so the server can look up who to notify.
 */

const PREFS_KEY = 'elitebrain_notification_prefs_v1';
/** Tags already fired today, so a reminder can't repeat on every tick. */
const FIRED_KEY = 'elitebrain_notification_fired_v1';

export interface NotificationPrefs {
  enabled: boolean;
  routine: boolean;
  habits: boolean;
  tasks: boolean;
  /** Minutes before a routine block starts. */
  leadMinutes: number;
  /** HH:MM for the end-of-day nudge. Empty disables it. */
  dailySummaryAt: string;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  routine: true,
  habits: true,
  tasks: true,
  leadMinutes: 10,
  dailySummaryAt: '20:00',
};

export function loadPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: NotificationPrefs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Capability detection                                                */
/* ------------------------------------------------------------------ */

export type NotificationSupport =
  | 'ready'
  | 'needs_permission'
  | 'denied'
  | 'ios_needs_install'
  | 'unsupported';

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; the touch check distinguishes it.
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function notificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    // On iOS in a browser tab, Notification is absent entirely.
    return isIOS() ? 'ios_needs_install' : 'unsupported';
  }
  if (isIOS() && !isStandalone()) return 'ios_needs_install';
  if (Notification.permission === 'granted') return 'ready';
  if (Notification.permission === 'denied') return 'denied';
  return 'needs_permission';
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/** Must be called from a user gesture — browsers reject it otherwise. */
export async function requestPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') await registerServiceWorker();
    return result === 'granted';
  } catch (err) {
    console.warn('Notification permission request failed:', err);
    return false;
  }
}

/** Show a notification through the service worker, falling back to the page. */
export async function showNotification(title: string, body: string, tag: string, url = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/brand/elitelife-logo-192.png',
        badge: '/brand/elitelife-logo-96.png',
        tag,
        data: { url },
      });
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    new Notification(title, { body, icon: '/brand/elitelife-logo-192.png', tag });
  } catch (err) {
    console.warn('Could not show notification:', err);
  }
}

/* ------------------------------------------------------------------ */
/* Personalised reminders                                              */
/* ------------------------------------------------------------------ */

export interface ReminderContext {
  blocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
}

export interface DueReminder {
  tag: string;
  title: string;
  body: string;
  url: string;
}

function firedToday(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayISO()) return new Set();
    return new Set<string>(parsed.tags || []);
  } catch {
    return new Set();
  }
}

function markFired(tag: string) {
  if (typeof window === 'undefined') return;
  try {
    const set = firedToday();
    set.add(tag);
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: todayISO(), tags: [...set] }));
  } catch {
    /* ignore */
  }
}

/**
 * Reminders that are due right now and haven't already fired today.
 *
 * Content is drawn from the user's own routine, habits and tasks — never
 * generic motivational filler. If nothing is scheduled, nothing is sent;
 * a notification with nothing to say is worse than silence.
 */
export function dueReminders(
  ctx: ReminderContext,
  prefs: NotificationPrefs,
  now: Date = new Date()
): DueReminder[] {
  if (!prefs.enabled) return [];

  const today = todayISO();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const already = firedToday();
  const out: DueReminder[] = [];

  // --- Routine blocks starting soon ---
  if (prefs.routine) {
    for (const { block, state } of blocksForDate(ctx.blocks, ctx.routineLogs, today)) {
      if (state !== 'pending') continue;
      const start = minutesOf(block.startTime);
      const lead = start - prefs.leadMinutes;
      // Fire within a five-minute window so a missed tick still catches it.
      if (nowMin < lead || nowMin > lead + 5) continue;

      const tag = `block:${block.id}:${today}`;
      if (already.has(tag)) continue;
      out.push({
        tag,
        title: block.title,
        body:
          prefs.leadMinutes > 0
            ? `Starts in ${prefs.leadMinutes} min · ${block.startTime}–${block.endTime}`
            : `Starting now · ${block.startTime}–${block.endTime}`,
        url: '/',
      });
    }
  }

  // --- End-of-day summary: only when something is genuinely outstanding ---
  if (prefs.dailySummaryAt) {
    const at = minutesOf(prefs.dailySummaryAt);
    if (nowMin >= at && nowMin <= at + 5) {
      const tag = `summary:${today}`;
      if (!already.has(tag)) {
        const openHabits = prefs.habits
          ? ctx.habits.filter(
              (h) =>
                h.status === 'active' &&
                isScheduledOn(h, today) &&
                valueOn(ctx.habitLogs, h.id, today) < Math.max(1, h.targetValue || 1)
            )
          : [];
        const openTasks = prefs.tasks ? bucketTasks(ctx.tasks).today : [];
        const openBlocks = prefs.routine
          ? blocksForDate(ctx.blocks, ctx.routineLogs, today).filter((b) => b.state === 'pending')
          : [];

        const bits: string[] = [];
        if (openTasks.length) bits.push(`${openTasks.length} task${openTasks.length === 1 ? '' : 's'}`);
        if (openHabits.length)
          bits.push(`${openHabits.length} habit${openHabits.length === 1 ? '' : 's'}`);
        if (openBlocks.length)
          bits.push(`${openBlocks.length} block${openBlocks.length === 1 ? '' : 's'}`);

        if (bits.length > 0) {
          out.push({
            tag,
            title: 'Still open today',
            body: `${bits.join(', ')} left. Even one counts.`,
            url: '/',
          });
        }
      }
    }
  }

  return out;
}

export function fireReminders(reminders: DueReminder[]) {
  for (const r of reminders) {
    showNotification(r.title, r.body, r.tag, r.url);
    markFired(r.tag);
  }
}

/* ------------------------------------------------------------------ */
/* Web push                                                            */
/* ------------------------------------------------------------------ */

/**
 * Server-sent push, as distinct from the in-page reminders above.
 *
 * The scheduled reminders in this file only fire while the app is open. Web
 * push reaches the device when it is closed, which is the whole point of a
 * reminder — but it needs a subscription registered with the server first.
 */

/** VAPID keys arrive base64url-encoded and the API wants a byte array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * Register this device for push.
 *
 * Returns a plain result rather than throwing, because every failure here is
 * expected in normal use — permission denied, unsupported browser, keys not
 * configured — and none of them should surface as a crash.
 */
export async function subscribeToPush(
  getToken: () => Promise<string | null>
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'This browser does not support push notifications.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notifications are blocked. Enable them in browser settings.' };
    }

    const keyRes = await fetch('/api/push/key');
    if (!keyRes.ok) return { ok: false, reason: 'Push is not configured on the server yet.' };
    const { key } = await keyRes.json();

    const reg = await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than creating a duplicate.
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));

    const token = await getToken();
    if (!token) return { ok: false, reason: 'Sign in to enable notifications.' };

    const json = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        // Minutes this device is ahead of UTC. Without it the server has no
        // way to send "at 8am" — it would be 8am somewhere else entirely.
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      }),
    });

    if (!res.ok) return { ok: false, reason: 'Could not register this device.' };
    return { ok: true };
  } catch (err) {
    console.warn('Push subscription failed:', err);
    return { ok: false, reason: 'Something went wrong enabling notifications.' };
  }
}

export async function unsubscribeFromPush(
  getToken: () => Promise<string | null>
): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();

    const token = await getToken();
    if (!token) return;

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    });
  } catch (err) {
    console.warn('Could not unsubscribe:', err);
  }
}
