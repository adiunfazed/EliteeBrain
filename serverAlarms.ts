import { getFirestore } from 'firebase-admin/firestore';
import { sendToUser } from './serverPush';

/**
 * Wake Challenge alarms, server side.
 *
 * The client cannot be trusted with any of this: entitlement, ownership and
 * XP all have to be decided here, or a free user can grant themselves Pro by
 * editing a boolean in devtools.
 *
 * Delivery is via Web Push rather than a timer in the page, because a page
 * that is closed runs no timers at all.
 */

export interface StoredAlarm {
  id: string;
  uid: string;
  time: string;
  /** IANA zone, captured at creation. An alarm must ring at local 7am. */
  timezone: string;
  label: string;
  weekdays: number[];
  enabled: boolean;
  challenge: string;
  difficulty: string;
  sound: string;
  createdAt: string;
  updatedAt: string;
}

/** Minutes since midnight, or null if malformed. */
function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Local wall-clock time in a given zone.
 *
 * Computed from the server's UTC clock rather than assuming the server shares
 * the user's timezone — it does not, and an alarm that fires on Render's
 * clock would be hours out for everyone.
 */
function localNow(timezone: string): { minutes: number; weekday: number; date: string } {
  const now = new Date();

  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false,
    });

    const parts = Object.fromEntries(
      fmt.formatToParts(now).map((p) => [p.type, p.value])
    );

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return {
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
      weekday: weekdayMap[parts.weekday as string] ?? now.getUTCDay(),
      date: `${parts.year}-${parts.month}-${parts.day}`,
    };
  } catch {
    // An invalid zone must not stop every other alarm from being processed.
    return {
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
      weekday: now.getUTCDay(),
      date: now.toISOString().slice(0, 10),
    };
  }
}

/** Whether an alarm is due, within a tolerance window. */
export function isDue(alarm: StoredAlarm, windowMinutes = 6): boolean {
  if (!alarm.enabled) return false;

  const target = minutesOf(alarm.time);
  if (target === null) return false;

  const local = localNow(alarm.timezone || 'UTC');

  if (alarm.weekdays?.length > 0 && !alarm.weekdays.includes(local.weekday)) {
    return false;
  }

  const since = local.minutes - target;
  return since >= 0 && since <= windowMinutes;
}

/** The local date key for an alarm, used to prevent repeat sends. */
export function localDateFor(alarm: StoredAlarm): string {
  return localNow(alarm.timezone || 'UTC').date;
}

/**
 * Send every alarm that is currently due.
 *
 * Called by the same cron that drives the existing daily push, so there is no
 * second scheduler to keep alive.
 */
export async function runDueAlarms(): Promise<{ checked: number; sent: number }> {
  const db = getFirestore();

  // Only enabled alarms, so a disabled one costs nothing to skip.
  const snap = await db.collectionGroup('alarms').where('enabled', '==', true).get();

  let sent = 0;

  for (const doc of snap.docs) {
    const alarm = doc.data() as StoredAlarm;
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;

    if (!isDue(alarm)) continue;

    const dateKey = localDateFor(alarm);
    const sentId = `${alarm.id}__${dateKey}`;
    const sentRef = db.collection('users').doc(uid).collection('alarmSends').doc(sentId);

    // A duplicate push is worse than a late one: being woken twice by the
    // same alarm is the kind of thing that makes people delete an app.
    const already = await sentRef.get();
    if (already.exists) continue;

    // Written BEFORE sending. If the send fails the user misses one alarm;
    // if the write fails after sending they could be woken repeatedly.
    await sentRef.set({
      alarmId: alarm.id,
      date: dateKey,
      sentAt: new Date().toISOString(),
    });

    try {
      // Deliberately plain. A notification appears on a locked screen, so it
      // must not disclose anything about the user's routine.
      await sendToUser(uid, {
        title: 'EliteLife Wake Challenge',
        body: 'Time to start your day.',
        tag: `wake-${alarm.id}`,
        url: `/?wake=${encodeURIComponent(alarm.id)}`,
      });
      sent++;
    } catch (err) {
      console.error('Alarm push failed for', uid, (err as Error)?.message);
    }
  }

  return { checked: snap.size, sent };
}
