/**
 * Completion messages.
 *
 * Scaled to what was actually achieved. Identical praise for every action
 * teaches people that the praise means nothing — so a two-minute task gets a
 * quiet acknowledgement and a two-hour focus session gets something that
 * sounds earned.
 *
 * Kept deliberately plain: no exclamation marks stacked three deep, no
 * "CRUSHING IT". Overstated praise for small things reads as insincere and
 * makes the genuine moments worth less.
 */

export type EffortKind = 'task' | 'habit' | 'routine' | 'focus' | 'quest' | 'goal' | 'module';

export interface EffortContext {
  kind: EffortKind;
  /** Minutes involved, where known. */
  minutes?: number;
  /** Task priority, if applicable. */
  priority?: string;
  /** How many times this was postponed before finally being done. */
  postponed?: number;
  /** Current streak on a habit. */
  streak?: number;
  /** Title, for messages that name the thing. */
  title?: string;
}

/** Effort score, 0-3. Drives how strong the response is. */
function weigh(ctx: EffortContext): number {
  let score = 0;

  if (ctx.minutes) {
    if (ctx.minutes >= 90) score += 3;
    else if (ctx.minutes >= 45) score += 2;
    else if (ctx.minutes >= 20) score += 1;
  }

  if (ctx.priority === 'critical') score += 2;
  else if (ctx.priority === 'high') score += 1;

  // The top tier should be rare. Without this, a moderately long task at high
  // priority reads the same as a genuinely exceptional effort.
  if (score >= 3 && !(ctx.minutes && ctx.minutes >= 90)) score = 2;

  // Something avoided repeatedly and finally done is the hardest kind of win.
  if (ctx.postponed && ctx.postponed >= 3) score += 2;
  else if (ctx.postponed && ctx.postponed >= 1) score += 1;

  if (ctx.streak && ctx.streak >= 30) score += 2;
  else if (ctx.streak && ctx.streak >= 7) score += 1;

  if (ctx.kind === 'goal') score += 3;
  if (ctx.kind === 'quest') score += 1;

  return Math.min(3, score);
}

const LIGHT = [
  'Done.',
  'Ticked off.',
  'That one is out of the way.',
  'Cleared.',
  'One less thing.',
];

const SOLID = [
  'Good. That one mattered.',
  'Solid work.',
  'That is the kind of thing that adds up.',
  'Well handled.',
  'Real progress.',
];

const STRONG = [
  'That was a proper piece of work.',
  'Serious effort. It shows.',
  'That is the hard kind of done.',
  'Genuinely well done.',
];

const EXCEPTIONAL = [
  'That is the work most people avoid. You did it anyway.',
  'Difficult, and you finished it. That is the whole game.',
  'This is what separates a good week from a wasted one.',
];

/** Deterministic pick, so the same completion does not reshuffle on re-render. */
function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return list[h % list.length];
}

/**
 * A message for a completed action.
 *
 * The specific cases come first, because naming what actually happened beats
 * any generic praise — "four days late, finally done" lands harder than
 * "great job".
 */
export function praiseFor(ctx: EffortContext, seed = ''): string {
  const key = `${ctx.kind}|${ctx.title || ''}|${seed}`;

  // Specific situations worth naming.
  if (ctx.postponed && ctx.postponed >= 3) {
    return `Postponed ${ctx.postponed} times, and now it is done. That is the hard part.`;
  }

  if (ctx.kind === 'goal') {
    return 'Goal complete. That took sustained work, not a good day.';
  }

  if (ctx.kind === 'focus' && ctx.minutes && ctx.minutes >= 90) {
    return `${ctx.minutes} minutes of real focus. That is rare.`;
  }

  if (ctx.streak && ctx.streak >= 30) {
    return `${ctx.streak} days unbroken. That is a habit now, not an effort.`;
  }

  if (ctx.streak && ctx.streak >= 7) {
    return `${ctx.streak} days running. Keep it going.`;
  }

  const score = weigh(ctx);
  if (score >= 3) return pick(EXCEPTIONAL, key);
  if (score === 2) return pick(STRONG, key);
  if (score === 1) return pick(SOLID, key);
  return pick(LIGHT, key);
}
