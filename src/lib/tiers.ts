/**
 * Rank tiers — the single source of truth.
 *
 * These thresholds previously existed twice: once in the Arena leaderboard and
 * again in the rank screen, with different numbers. The same XP therefore
 * produced two different ranks depending on which screen you were looking at.
 * Both now read from here.
 */

export interface Tier {
  base: string;
  /** 1-3 within the base tier. */
  step: number;
  min: number;
  color: string;
  /** Roman numeral for the badge — reflects the step, not the base tier. */
  roman: string;
}

const BASES: { name: string; min: number; color: string }[] = [
  { name: 'BRONZE', min: 0, color: '#C97B3C' },
  { name: 'SILVER', min: 1500, color: '#A8B4C4' },
  { name: 'GOLD', min: 3000, color: '#E8A33D' },
  { name: 'PLATINUM', min: 7000, color: '#7FD4E8' },
  { name: 'DIAMOND', min: 13000, color: '#7C9CFF' },
  { name: 'ELITE', min: 25000, color: '#B98BFF' },
];

const ROMAN = ['I', 'II', 'III'];

/** Every tier step, ascending. Each base splits into three even steps. */
export const TIERS: Tier[] = BASES.flatMap((base, i) => {
  const next = BASES[i + 1];
  // The top tier has no ceiling, so its steps use the same span as the one
  // below rather than an arbitrary number.
  const span = next ? (next.min - base.min) / 3 : (base.min - BASES[i - 1].min) / 3;

  return [0, 1, 2].map((step) => ({
    base: base.name,
    step: step + 1,
    min: Math.round(base.min + span * step),
    color: base.color,
    roman: ROMAN[step],
  }));
});

/** The tier a given XP total falls in. */
export function tierFor(xp: number): Tier {
  let found = TIERS[0];
  for (const t of TIERS) if (xp >= t.min) found = t;
  return found;
}

/** The next tier up, or null at the top. */
export function nextTierAfter(xp: number): Tier | null {
  const current = tierFor(xp);
  const index = TIERS.indexOf(current);
  return TIERS[index + 1] || null;
}

/** "GOLD 2" */
export function tierLabel(tier: Tier): string {
  return `${tier.base} ${tier.step}`;
}

/** Progress through the current tier, 0-1. */
export function tierProgress(xp: number): number {
  const current = tierFor(xp);
  const next = nextTierAfter(xp);
  if (!next) return 1;
  const span = Math.max(1, next.min - current.min);
  return Math.max(0, Math.min(1, (xp - current.min) / span));
}
