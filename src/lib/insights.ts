import { MomentumInput } from './momentum';
import { todayISO } from './tasks';

/**
 * Patterns in the user's own data.
 *
 * Everything here is derived from records the app already keeps. Nothing is
 * invented, and an insight is only produced when there is enough evidence to
 * support it — a claim built on three data points is worse than no claim,
 * because it teaches people to distrust the ones that are real.
 */

export interface Insight {
  id: string;
  /** The finding, stated plainly. */
  headline: string;
  /** What to do about it. */
  advice: string;
  /** 'good' celebrates, 'watch' warns, 'neutral' simply informs. */
  tone: 'good' | 'watch' | 'neutral';
  /** How much data backs this up, for ordering. */
  strength: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourOf(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.getHours() : null;
}

function dateOf(iso?: string): string | null {
  if (!iso) return null;
  return iso.slice(0, 10) || null;
}

/** Minimum records before a pattern is worth reporting. */
const MIN_SAMPLE = 12;

/**
 * Which part of the day work actually gets finished.
 *
 * The most actionable insight most people can get: scheduling work at an hour
 * they never complete anything is a planning error, not a discipline problem.
 */
function timeOfDayInsight(input: MomentumInput): Insight | null {
  const done = input.tasks.filter((t) => t.completed && t.completedAt);
  if (done.length < MIN_SAMPLE) return null;

  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const t of done) {
    const h = hourOf(t.completedAt);
    if (h === null) continue;
    if (h < 12) buckets.morning++;
    else if (h < 17) buckets.afternoon++;
    else if (h < 22) buckets.evening++;
    else buckets.night++;
  }

  const entries = Object.entries(buckets) as [keyof typeof buckets, number][];
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (total === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [bestName, bestCount] = entries[0];
  const share = Math.round((bestCount / total) * 100);

  // A near-even spread is not a pattern.
  if (share < 40) return null;

  const label = {
    morning: 'mornings',
    afternoon: 'afternoons',
    evening: 'evenings',
    night: 'late at night',
  }[bestName];

  return {
    id: 'time-of-day',
    headline: `${share}% of your finished work happens in the ${label}`,
    advice:
      bestName === 'night'
        ? 'That works, but it competes with sleep. Try moving one task earlier and see if it still gets done.'
        : `Put your hardest task in the ${label} and protect that time.`,
    tone: 'neutral',
    strength: total,
  };
}

/** Which weekday goes best and which goes worst. */
function weekdayInsight(input: MomentumInput): Insight | null {
  const done = input.tasks.filter((t) => t.completed && t.completedAt);
  if (done.length < MIN_SAMPLE) return null;

  const perDay = new Array(7).fill(0);
  for (const t of done) {
    const d = dateOf(t.completedAt);
    if (!d) continue;
    perDay[new Date(`${d}T00:00:00`).getDay()]++;
  }

  const best = perDay.indexOf(Math.max(...perDay));
  const worst = perDay.indexOf(Math.min(...perDay));
  if (perDay[best] === 0 || best === worst) return null;

  // Only report a real gap.
  if (perDay[best] < perDay[worst] * 2) return null;

  return {
    id: 'weekday',
    headline: `${DAY_NAMES[best]} is your strongest day, ${DAY_NAMES[worst]} your weakest`,
    advice: `Schedule demanding work on ${DAY_NAMES[best]}. Keep ${DAY_NAMES[worst]} light rather than fighting it.`,
    tone: 'neutral',
    strength: done.length,
  };
}

/** Tasks that keep getting pushed. */
function postponeInsight(input: MomentumInput): Insight | null {
  const stalled = input.tasks.filter((t) => !t.completed && (t.postponeCount || 0) >= 3);
  if (stalled.length === 0) return null;

  const worst = stalled.sort((a, b) => (b.postponeCount || 0) - (a.postponeCount || 0))[0];

  return {
    id: 'postponed',
    headline: `${stalled.length} ${stalled.length === 1 ? 'task keeps' : 'tasks keep'} getting moved`,
    advice: `"${worst.title}" has moved ${worst.postponeCount} times. It is either too big, or it is not actually a priority. Split it or drop it.`,
    tone: 'watch',
    strength: stalled.length * 5,
  };
}

/** Habit consistency, named specifically. */
function habitInsight(input: MomentumInput): Insight | null {
  const active = input.habits.filter((h) => h.status === 'active');
  if (active.length === 0) return null;

  const last30 = new Set<string>();
  const today = todayISO();
  for (let i = 0; i < 30; i++) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    last30.add(d.toISOString().slice(0, 10));
  }

  const rates = active.map((h) => {
    const met = input.habitLogs.filter(
      (l) => l.habitId === h.id && last30.has(l.date) && (l.value || 0) >= Math.max(1, h.targetValue || 1)
    ).length;
    return { habit: h, met };
  });

  const sample = rates.reduce((n, r) => n + r.met, 0);
  if (sample < MIN_SAMPLE) return null;

  rates.sort((a, b) => b.met - a.met);
  const strongest = rates[0];
  const weakest = rates[rates.length - 1];

  if (rates.length > 1 && weakest.met === 0 && strongest.met >= 8) {
    return {
      id: 'habit-gap',
      headline: `You have kept "${strongest.habit.title}" going but not "${weakest.habit.title}"`,
      advice: `Attach the one you skip to the one you keep — do it immediately after. Or drop it and stop carrying the guilt.`,
      tone: 'watch',
      strength: sample,
    };
  }

  if (strongest.met >= 20) {
    return {
      id: 'habit-strong',
      headline: `"${strongest.habit.title}" is holding — ${strongest.met} of the last 30 days`,
      advice: 'This one has stuck. Consider adding one more, but only one.',
      tone: 'good',
      strength: sample,
    };
  }

  return null;
}

/** Focus session length versus completion. */
function focusInsight(input: MomentumInput): Insight | null {
  const sessions = input.focusSessions.filter((s) => (s.focusedSeconds || 0) > 0);
  if (sessions.length < 8) return null;

  const completed = sessions.filter((s) => s.completed);
  const rate = Math.round((completed.length / sessions.length) * 100);

  const avgMinutes = Math.round(
    sessions.reduce((n, s) => n + (s.focusedSeconds || 0) / 60, 0) / sessions.length
  );

  if (rate < 60) {
    return {
      id: 'focus-abandon',
      headline: `You finish ${rate}% of the focus sessions you start`,
      advice: `Your average session runs ${avgMinutes} minutes. Try setting a shorter timer — a finished 15 minutes beats an abandoned 45.`,
      tone: 'watch',
      strength: sessions.length,
    };
  }

  return {
    id: 'focus-good',
    headline: `You finish ${rate}% of your focus sessions`,
    advice: `Averaging ${avgMinutes} minutes each. That is a working habit — try extending by five minutes.`,
    tone: 'good',
    strength: sessions.length,
  };
}

/** Sleep against next-day output. */
function sleepInsight(input: MomentumInput): Insight | null {
  if (input.sleepLogs.length < 10) return null;

  const doneByDate = new Map<string, number>();
  for (const t of input.tasks) {
    if (!t.completed || !t.completedAt) continue;
    const d = dateOf(t.completedAt);
    if (d) doneByDate.set(d, (doneByDate.get(d) || 0) + 1);
  }

  const paired: { hours: number; done: number }[] = [];
  for (const log of input.sleepLogs) {
    const bed = log.bedtime?.split(':').map(Number);
    const wake = log.wakeTime?.split(':').map(Number);
    if (!bed || !wake || bed.length < 2 || wake.length < 2) continue;

    let hours = wake[0] + wake[1] / 60 - (bed[0] + bed[1] / 60);
    if (hours < 0) hours += 24;
    if (hours < 2 || hours > 14) continue;

    paired.push({ hours, done: doneByDate.get(log.date) || 0 });
  }

  if (paired.length < 8) return null;

  const good = paired.filter((p) => p.hours >= 7);
  const poor = paired.filter((p) => p.hours < 6);
  if (good.length < 3 || poor.length < 3) return null;

  const goodAvg = good.reduce((n, p) => n + p.done, 0) / good.length;
  const poorAvg = poor.reduce((n, p) => n + p.done, 0) / poor.length;

  // Only report a difference large enough to be worth acting on.
  if (goodAvg < poorAvg * 1.3) return null;

  return {
    id: 'sleep',
    headline: `You finish ${(goodAvg / Math.max(0.1, poorAvg)).toFixed(1)}× more work after 7+ hours of sleep`,
    advice: 'On your own numbers, sleep is the highest-return thing you can fix.',
    tone: 'watch',
    strength: paired.length,
  };
}

/**
 * Every insight the data currently supports, strongest first.
 *
 * Returns an empty list when there is not enough history, rather than padding
 * with generic advice — a fabricated pattern devalues the real ones.
 */
export function buildInsights(input: MomentumInput): Insight[] {
  const found = [
    postponeInsight(input),
    sleepInsight(input),
    timeOfDayInsight(input),
    habitInsight(input),
    focusInsight(input),
    weekdayInsight(input),
  ].filter((i): i is Insight => i !== null);

  return found.sort((a, b) => b.strength - a.strength);
}

/** How much more history is needed before insights appear. */
export function insightReadiness(input: MomentumInput): { ready: boolean; needs: string } {
  const done = input.tasks.filter((t) => t.completed).length;
  if (done >= MIN_SAMPLE) return { ready: true, needs: '' };
  return {
    ready: false,
    needs: `Complete ${MIN_SAMPLE - done} more ${MIN_SAMPLE - done === 1 ? 'task' : 'tasks'} and patterns will start appearing here.`,
  };
}
