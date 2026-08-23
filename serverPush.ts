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
  /** Minutes ahead of UTC, so reminders land at the user's local time. */
  utcOffsetMinutes?: number;
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

/** Local clock for a user, from their stored offset. */
function localNow(offsetMinutes: number): { minutes: number; date: string } {
  const now = new Date();
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  return {
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    date: local.toISOString().slice(0, 10),
  };
}

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Reminder kinds, each sendable once per day. */
type Slot = 'morning' | 'block' | 'evening';

/**
 * How many notifications a single user may receive in one day.
 *
 * Five slots exist (sleep, morning, block reminders, evening, wrap-up) but a
 * user rarely qualifies for all of them — the cap is a ceiling, not a target.
 */
const MAX_PER_DAY = 5;

/**
 * Decide what to send this user right now, if anything.
 *
 * Runs frequently (every 15 minutes) and sends only when something is
 * genuinely happening: a routine block about to start, a morning plan, or an
 * evening nudge about what is still open. Frequency without relevance is how
 * an app loses notification permission for good.
 */
async function reminderFor(
  uid: string,
  offsetMinutes: number,
  sentSlots: string[]
): Promise<{ payload: PushPayload; slot: string } | null> {
  const { minutes } = localNow(offsetMinutes);
  const ctx = await buildCoachContext(uid);
  if (!ctx) return null;

  // 1. A routine block starting in the next 15 minutes. The most useful
  //    notification there is: the user already decided this matters.
  for (const block of ctx.routineToday) {
    if (block.state !== 'pending') continue;
    const start = parseHHMM(block.time.split('–')[0] || '');
    if (start === null) continue;

    const until = start - minutes;
    if (until < 0 || until > 15) continue;

    const slot = `block:${block.title}`;
    if (sentSlots.includes(slot)) continue;

    return {
      slot,
      payload: {
        title: block.title,
        body: until <= 1 ? 'Starting now.' : `Starts in ${until} minutes.`,
        tag: 'routine',
      },
    };
  }

  const openHabits = ctx.habitsToday.filter((h) => !h.done);
  const openBlocks = ctx.routineToday.filter((b) => b.state === 'pending');
  const remaining = openHabits.length + openBlocks.length + ctx.openTasksToday.length;

  // 2. Sleep log, 05:00–06:30 local. Asked early because last night's sleep
  //    is best recorded on waking, not remembered at midday.
  if (minutes >= 300 && minutes < 390 && !sentSlots.includes('sleep') && !ctx.sleptLastNight) {
    return {
      slot: 'sleep',
      payload: {
        title: 'How did you sleep?',
        body: 'Log last night while you still remember it.',
        tag: 'sleep',
      },
    };
  }

  // 3. End-of-day wrap-up, 21:45–22:45 local. This one fires even when the
  //    day looks complete, because its purpose is catching things that were
  //    done but never ticked off.
  if (minutes >= 1305 && minutes < 1365 && !sentSlots.includes('wrapup')) {
    if (remaining > 0) {
      const names = [
        ...ctx.openTasksToday.slice(0, 2),
        ...openBlocks.slice(0, 2).map((b) => b.title),
        ...openHabits.slice(0, 2).map((h) => h.title),
      ].slice(0, 2);

      return {
        slot: 'wrapup',
        payload: {
          title: `${remaining} not logged yet`,
          body: `${names.join(', ')}${remaining > names.length ? ' and more' : ''}. Tick off anything you did.`,
          tag: 'wrapup',
        },
      };
    }

    if (!ctx.sleptLastNight) {
      return {
        slot: 'wrapup',
        payload: {
          title: 'Day complete',
          body: 'Everything logged. Set your bedtime before you turn in.',
          tag: 'wrapup',
        },
      };
    }
    return null;
  }

  if (remaining === 0) return null;

  // Afternoon prompt for overdue work, once, 14:00–16:00 local. Late enough
  // that the morning has been used, early enough to still fix the day.
  if (
    minutes >= 840 &&
    minutes < 960 &&
    !sentSlots.includes('afternoon') &&
    ctx.overdueTasks.length > 0
  ) {
    const t = ctx.overdueTasks[0];
    return {
      slot: 'afternoon',
      payload: {
        title: t.title,
        body:
          t.postponed > 0
            ? `${t.daysLate} days late and moved ${t.postponed} times.`
            : `${t.daysLate} days overdue. Still time today.`,
        tag: 'afternoon',
      },
    };
  }

  // 4. Morning plan, once, 07:00–09:00 local. Names the first real item,
  //    whether that's a task, a block or a habit.
  if (minutes >= 420 && minutes < 540 && !sentSlots.includes('morning')) {
    const first =
      ctx.openTasksToday[0] || openBlocks[0]?.title || openHabits[0]?.title || null;

    return {
      slot: 'morning',
      payload: {
        title: 'Today',
        body: first
          ? `${remaining} things planned. First up: ${first}.`
          : `${remaining} things planned for today.`,
        tag: 'morning',
      },
    };
  }

  // 3. Evening nudge, once, between 19:00 and 21:00 local — late enough to
  //    be a real prompt, early enough to still act on.
  if (minutes >= 1140 && minutes < 1260 && !sentSlots.includes('evening')) {
    if (ctx.overdueTasks.length > 0) {
      const t = ctx.overdueTasks[0];
      return {
        slot: 'evening',
        payload: {
          title: t.title,
          body:
            t.postponed > 0
              ? `${t.daysLate} days late, moved ${t.postponed} times. Ten minutes?`
              : `${t.daysLate} days overdue.`,
          tag: 'evening',
        },
      };
    }

    return {
      slot: 'evening',
      payload: {
        title: `${remaining} still open`,
        body: openHabits.length > 0 ? `Including ${openHabits[0].title}.` : 'Still time today.',
        tag: 'evening',
      },
    };
  }

  return null;
}

/**
 * One scheduler pass.
 *
 * Called every 15 minutes. Each user receives at most MAX_PER_DAY, and each
 * slot fires at most once — so a scheduler that runs twice, or a retry after
 * a crash, cannot produce duplicates.
 */
export async function runScheduledReminders(): Promise<{ considered: number; sent: number }> {
  if (!initPush()) return { considered: 0, sent: 0 };

  const db = getFirestore();
  const snap = await db.collection('users').get();

  let considered = 0;
  let sent = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data?.pushOptOut === true) continue;

    const subs = await doc.ref.collection('pushSubscriptions').limit(1).get();
    if (subs.empty) continue;

    const offset = (subs.docs[0].data() as StoredSubscription).utcOffsetMinutes ?? 0;
    const { date } = localNow(offset);

    // Slot history resets with the user's local date, not UTC.
    const history = data?.pushLog?.date === date ? data.pushLog : { date, slots: [] as string[] };
    if (history.slots.length >= MAX_PER_DAY) continue;

    considered++;

    try {
      const result = await reminderFor(doc.id, offset, history.slots);
      if (!result) continue;

      // Record BEFORE sending: a duplicate is worse than a miss.
      await doc.ref.set(
        { pushLog: { date, slots: [...history.slots, result.slot] } },
        { merge: true }
      );

      const count = await sendToUser(doc.id, result.payload);
      if (count > 0) sent++;
    } catch (err: any) {
      console.warn('Reminder failed for', doc.id, err?.message);
    }
  }

  return { considered, sent };
}
