/**
 * Subscription plans.
 *
 * Kept in one place so the payment screen, the entitlement check and the admin
 * portal can never disagree about what a plan costs or how long it lasts.
 */

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export interface Plan {
  id: PlanId;
  name: string;
  /** Price in rupees. */
  price: number;
  /** Days of access. Null means it never expires. */
  days: number | null;
  /** Shown alongside the price, e.g. "per month". */
  cadence: string;
  /** What this plan is for, in plain terms. */
  blurb: string;
  /** Effective monthly cost, for honest comparison. */
  perMonth: number | null;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 299,
    days: 30,
    cadence: 'per month',
    blurb: 'Everything unlocked. Cancel any time by simply not renewing.',
    perMonth: 299,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 2499,
    days: 365,
    cadence: 'per year',
    blurb: 'Same as monthly, paid once a year. Works out cheaper if you stay.',
    perMonth: Math.round(2499 / 12),
    badge: 'Best value',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: 4999,
    days: null,
    cadence: 'one time',
    blurb: 'Pay once. Every feature, including everything added later, forever.',
    perMonth: null,
  },
];

export function planById(id: string | undefined | null): Plan | null {
  return PLANS.find((p) => p.id === id) || null;
}

/** Saving against paying monthly for the same period, as a percentage. */
export function savingVsMonthly(plan: Plan): number | null {
  const monthly = PLANS[0].price;
  if (plan.days === null || plan.id === 'monthly') return null;
  const months = plan.days / 30;
  const full = monthly * months;
  return Math.round(((full - plan.price) / full) * 100);
}

/**
 * When a plan bought now would expire.
 *
 * Extends from an existing expiry rather than from today, so renewing early
 * never costs the buyer the days they already paid for.
 */
export function expiryFor(plan: Plan, existingExpiry?: string | null): string | null {
  if (plan.days === null) return null;

  const now = Date.now();
  const existing = existingExpiry ? Date.parse(existingExpiry) : NaN;
  const base = Number.isFinite(existing) && existing > now ? existing : now;

  return new Date(base + plan.days * 24 * 60 * 60 * 1000).toISOString();
}
