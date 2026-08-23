import webpush from 'web-push';
import { getFirestore } from 'firebase-admin/firestore';
import { buildCoachContext } from './serverCoachContext';

/**
 * Web push.
 *
 * Real server-sent notifications, as opposed to the in-page reminders that
 * only fire while the app is open. Two things make this safe to run:
 *
 *   1. Subscriptions live in Firestore under the owning user, written only by
 *      the server after verifying their token. A push endpoint is a capability
 *      — anyone holding it can send that device a notification.
 *
 *   2. Sending is idempotent per day per kind, so a scheduler that fires twice
 *      cannot notify someone twice.
 */

let configured = false;

/** Configure VAPID once. Returns false when keys are absent. */
export function initPush(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@elitelife.app';

  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not set — push notifications disabled.');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

/** Store a device subscription under its owner. */
export async function saveSubscription(uid: string, sub: StoredSubscription): Promise<void> {
  const db = getFirestore();
  // The endpoint is unique per device, so it doubles as the document id and
  // re-subscribing the same device overwrites rather than duplicating.
  const id = Buffer.from(sub.endpoint).toString('base64url').slice(0, 200);

  await db
    .collection('users')
    .doc(uid)
    .collection('pushSubscriptions')
    .doc(id)
    .set({ ...sub, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function removeSubscription(uid: string, endpoint: string): Promise<void> {
  const db = getFirestore();
  const id = Buffer.from(endpoint).toString('base64url').slice(0, 200);
  await db.collection('users').doc(uid).collection('pushSubscriptions').doc(id).delete();
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send to every device a user has registered.
 *
 * A 404 or 410 means the browser has discarded the subscription — that device
 * is gone, so the record is deleted rather than retried forever.
 */
export async function sendToUser(uid: string, payload: PushPayload): Promise<number> {
  if (!initPush()) return 0;

  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).collection('pushSubscriptions').get();
  if (snap.empty) return 0;

  let sent = 0;

  await Promise.all(
    snap.docs.map(async (doc) => {
      const sub = doc.data() as StoredSubscription;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await doc.ref.delete().catch(() => {});
        } else {
          console.warn('Push failed for', uid, status, err?.message);
        }
      }
    })
  );

  return sent;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a reminder from the user's real state, or return null.
 *
 * Returning null when there is nothing to say is deliberate. A notification
 * that says "keep going!" with no substance trains people to ignore the app,
 * and the fastest way to lose notification permission is to waste it.
 */
export async function buildReminder(uid: string): Promise<PushPayload | null> {
  const ctx = await buildCoachContext(uid);
  if (!ctx) return null;

  const openBlocks = ctx.routineToday.filter((b) => b.state === 'pending');
  const openHabits = ctx.habitsToday.filter((h) => !h.done);
  const remaining = openBlocks.length + openHabits.length + ctx.openTasksToday.length;

  // Nothing scheduled, or everything already done — say nothing.
  if (remaining === 0) return null;

  // Lead with the most specific thing available.
  if (ctx.overdueTasks.length > 0) {
    const t = ctx.overdueTasks[0];
    return {
      title: t.title,
      body:
        t.postponed > 0
          ? `${t.daysLate} days late and moved ${t.postponed} times. Ten minutes on it?`
          : `${t.daysLate} days overdue.`,
      url: '/',
      tag: 'overdue',
    };
  }

  if (openBlocks.length > 0) {
    const b = openBlocks[0];
    return { title: b.title, body: `Scheduled ${b.time}.`, url: '/', tag: 'routine' };
  }

  if (ctx.openTasksToday.length > 0) {
    return {
      title: ctx.openTasksToday[0],
      body:
        remaining > 1 ? `Due today, plus ${remaining - 1} more.` : 'Due today.',
      url: '/',
      tag: 'task',
    };
  }

  const h = openHabits[0];
  return {
    title: h.title,
    body: h.streak > 1 ? `${h.streak}-day streak on the line.` : 'Not done yet today.',
    url: '/',
    tag: 'habit',
  };
}

/**
 * Send one reminder per user, at most once per day.
 *
 * The guard is written BEFORE sending: a duplicate notification is worse than
 * a missed one, so a crash mid-send should not cause a repeat.
 */
export async function runDailyReminders(): Promise<{ considered: number; sent: number }> {
  if (!initPush()) return { considered: 0, sent: 0 };

  const db = getFirestore();
  const today = todayISO();
  const snap = await db.collection('users').get();

  let considered = 0;
  let sent = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data?.pushOptOut === true) continue;
    if (data?.lastPushDate === today) continue;

    const subs = await doc.ref.collection('pushSubscriptions').limit(1).get();
    if (subs.empty) continue;

    considered++;

    try {
      const payload = await buildReminder(doc.id);
      if (!payload) continue;

      await doc.ref.set({ lastPushDate: today }, { merge: true });
      const count = await sendToUser(doc.id, payload);
      if (count > 0) sent++;
    } catch (err: any) {
      console.warn('Reminder failed for', doc.id, err?.message);
    }
  }

  return { considered, sent };
}
