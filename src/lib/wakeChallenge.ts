import { Difficulty } from './bodyTraining';

/**
 * Wake Challenge.
 *
 * An alarm that requires a short challenge before the usual dismissal appears.
 *
 * A browser cannot guarantee an alarm fires when the app is fully closed.
 * There is no web API for that — only a notification the operating system may
 * deliver. So this is built in two halves: the schedule and challenge logic
 * here, which is platform-independent, and the firing mechanism behind a
 * narrow interface, so a native Android alarm can replace it later without
 * touching any of this.
 */

export type ChallengeType = 'pushups' | 'squats' | 'movement' | 'mental' | 'sequence';

export interface ChallengeSpec {
  id: ChallengeType;
  name: string;
  /** What the user will be asked to do. */
  blurb: string;
  /** Reps, seconds, or steps depending on the challenge. */
  targets: Record<Difficulty, number>;
  unit: string;
  icon: string;
}

export const CHALLENGES: ChallengeSpec[] = [
  {
    id: 'pushups',
    name: 'Push-ups',
    blurb: 'Count them off, then confirm.',
    targets: { easy: 5, moderate: 10, hard: 15 },
    unit: 'reps',
    icon: 'ArrowDownUp',
  },
  {
    id: 'squats',
    name: 'Squats',
    blurb: 'Stand up and move before the day starts.',
    targets: { easy: 8, moderate: 15, hard: 20 },
    unit: 'reps',
    icon: 'MoveVertical',
  },
  {
    id: 'movement',
    name: 'Get moving',
    blurb: 'Stand and stretch, or walk to another room.',
    targets: { easy: 20, moderate: 30, hard: 45 },
    unit: 'seconds',
    icon: 'Footprints',
  },
  {
    id: 'mental',
    name: 'Quick maths',
    blurb: 'Solve a few problems — harder to do half asleep.',
    targets: { easy: 3, moderate: 5, hard: 7 },
    unit: 'problems',
    icon: 'Calculator',
  },
  {
    id: 'sequence',
    name: 'Tap sequence',
    blurb: 'Repeat a pattern back. Quiet, for shared rooms.',
    targets: { easy: 4, moderate: 6, hard: 8 },
    unit: 'steps',
    icon: 'Grid3x3',
  },
];

export function challengeById(id: string): ChallengeSpec | null {
  return CHALLENGES.find((c) => c.id === id) || null;
}

/** users/{uid}/alarms/{id} */
export interface Alarm {
  id: string;
  /** HH:MM, 24-hour, in the user's local time. */
  time: string;
  label: string;
  /** 0=Sun..6=Sat. Empty means every day. */
  weekdays: number[];
  enabled: boolean;
  challenge: ChallengeType;
  difficulty: Difficulty;
  sound: string;
  createdAt: string;
  updatedAt: string;
}

/** users/{uid}/alarmLogs/{id} */
export interface AlarmLog {
  id: string;
  alarmId: string;
  /** YYYY-MM-DD of the occurrence. */
  date: string;
  firedAt: string;
  outcome: 'completed' | 'skipped' | 'dismissed';
  /** Seconds from firing to resolution. */
  tookSeconds: number;
  xpAwarded: number;
}

/** Seconds before the skip option appears. */
export const SKIP_LOCKOUT_SECONDS = 30;

export const ALARM_XP = 30;

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Whether an alarm is scheduled for the given day. */
export function runsOn(alarm: Alarm, date: Date): boolean {
  if (!alarm.enabled) return false;
  if (!alarm.weekdays || alarm.weekdays.length === 0) return true;
  return alarm.weekdays.includes(date.getDay());
}

/**
 * When this alarm next fires, or null if it never will.
 *
 * Works in local time throughout — an alarm set for 7am must ring at 7am
 * wherever the user is, so converting to UTC would be wrong here.
 */
export function nextOccurrence(alarm: Alarm, from: Date = new Date()): Date | null {
  const target = minutesOf(alarm.time);
  if (target === null || !alarm.enabled) return null;

  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);

    if (!runsOn(alarm, day)) continue;

    const when = new Date(day);
    when.setMinutes(target);

    // Today's slot only counts if it has not already passed.
    if (when.getTime() > from.getTime()) return when;
  }

  return null;
}

/**
 * The alarm due to fire right now, if any.
 *
 * A window is needed because a browser timer cannot be trusted to fire on the
 * exact second — the tab may be throttled or the device asleep. Anything
 * within the window that has not already been logged today counts.
 */
export function dueNow(
  alarms: Alarm[],
  logs: AlarmLog[],
  now: Date = new Date(),
  windowMinutes = 5
): Alarm | null {
  const current = now.getHours() * 60 + now.getMinutes();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  for (const alarm of alarms) {
    if (!runsOn(alarm, now)) continue;

    const target = minutesOf(alarm.time);
    if (target === null) continue;

    const since = current - target;
    if (since < 0 || since > windowMinutes) continue;

    // Already handled today — firing again would be a bug, not a feature.
    if (logs.some((l) => l.alarmId === alarm.id && l.date === today)) continue;

    return alarm;
  }

  return null;
}

/** Reject settings that would produce an alarm that never fires. */
export function validateAlarm(alarm: Partial<Alarm>): string | null {
  if (!alarm.time || minutesOf(alarm.time) === null) return 'Pick a valid time.';
  if (alarm.weekdays && alarm.weekdays.length > 7) return 'Invalid repeat days.';
  if (alarm.challenge && !challengeById(alarm.challenge)) return 'Pick a challenge.';
  return null;
}
