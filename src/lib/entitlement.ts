import type { UserProfile } from '../types';

/**
 * Single source of truth for Pro access.
 *
 * Before this existed, `isProUser` was written independently by the admin
 * portal, the payment modal, the sync layer and the profile loader, so the four
 * could disagree. Everything now derives access from this one function.
 *
 * Access is granted when EITHER:
 *   - lifetimePro is true (paid ₹1,999, or granted by admin), or
 *   - the 1-month free trial started and has not yet elapsed.
 */

export const TRIAL_DAYS = 30;
export const LIFETIME_PRICE_INR = 1999;

export type EntitlementStatus = 'lifetime' | 'subscription' | 'trial' | 'expired' | 'free';

export interface Entitlement {
  status: EntitlementStatus;
  /** Whether Pro features should be unlocked right now. */
  isPro: boolean;
  /** Whole days left in the trial. 0 for every non-trial status. */
  trialDaysLeft: number;
  /** Days left on a paid subscription. */
  daysRemaining?: number;
  proExpiresAt?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
}

function parseDate(value?: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function trialEndMs(trialStartedAt?: string): number | null {
  const start = parseDate(trialStartedAt);
  if (start === null) return null;
  return start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Resolve entitlement from stored profile fields.
 * `now` is injectable so expiry logic can be tested without waiting a month.
 */
export function resolveEntitlement(
  profile: Partial<UserProfile> | null | undefined,
  now: number = Date.now()
): Entitlement {
  if (!profile) {
    return { status: 'free', isPro: false, trialDaysLeft: 0 };
  }

  // Lifetime wins over everything and never expires.
  // `proPlanType === 'lifetime'` is honoured too so unlocks recorded before
  // this field existed keep working.
  if (profile.lifetimePro === true || profile.proPlanType === 'lifetime') {
    return { status: 'lifetime', isPro: true, trialDaysLeft: 0 };
  }

  // Active dated subscription. Checked before the trial so a paying customer
  // whose trial also lapsed is never reported as expired. An expiry in the
  // past deliberately falls through — access must end when it is paid up to.
  const expiry = parseDate(profile.proExpiresAt);
  if (expiry !== null && now < expiry) {
    return {
      status: 'subscription',
      isPro: true,
      trialDaysLeft: 0,
      proExpiresAt: new Date(expiry).toISOString(),
      // Whole calendar days remaining, matching how the trial counts.
      daysRemaining: Math.max(
        1,
        Math.round(
          (new Date(expiry).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) /
            86400000
        )
      ),
    };
  }

  const startMs = parseDate(profile.trialStartedAt);
  if (startMs !== null && startMs > now) {
    // A start date in the future would stretch the trial indefinitely. The
    // Firestore rules already forbid editing this field, but access control
    // should not depend on a single layer, so a forward-dated trial is treated
    // as starting now.
    const clamped = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    return {
      status: 'trial',
      isPro: true,
      trialDaysLeft: TRIAL_DAYS,
      trialStartedAt: new Date(now).toISOString(),
      trialEndsAt: new Date(clamped).toISOString(),
    };
  }

  const endMs = trialEndMs(profile.trialStartedAt);
  if (endMs !== null) {
    const trialEndsAt = new Date(endMs).toISOString();
    if (now < endMs) {
      // Count whole CALENDAR days, not elapsed milliseconds. A trial started
      // at 3pm previously ticked down at 3pm each day, which looks arbitrary;
      // users expect "days left" to change when the date changes.
      const startOfDay = (ms: number) => {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };
      const daysBetween = Math.round(
        (startOfDay(endMs) - startOfDay(now)) / (24 * 60 * 60 * 1000)
      );
      const trialDaysLeft = Math.min(TRIAL_DAYS, Math.max(1, daysBetween));
      return {
        status: 'trial',
        isPro: true,
        trialDaysLeft,
        trialStartedAt: profile.trialStartedAt,
        trialEndsAt,
      };
    }
    return {
      status: 'expired',
      isPro: false,
      trialDaysLeft: 0,
      trialStartedAt: profile.trialStartedAt,
      trialEndsAt,
    };
  }

  return { status: 'free', isPro: false, trialDaysLeft: 0 };
}

/** Human-readable label for the admin portal and profile screen. */
export function entitlementLabel(e: Entitlement): string {
  switch (e.status) {
    case 'lifetime':
      return 'Lifetime Pro';
    case 'subscription':
      return e.daysRemaining ? `Pro · ${e.daysRemaining} days left` : 'Pro';
    case 'trial':
      return `Trial — ${e.trialDaysLeft} day${e.trialDaysLeft === 1 ? '' : 's'} left`;
    case 'expired':
      return 'Trial expired';
    default:
      return 'Free';
  }
}

/**
 * Fields to persist when a new account starts its trial.
 * Callers must only apply these when `trialStartedAt` is absent, so a user
 * cannot restart the clock by signing out and back in.
 */
/**
 * Has this account ever started a trial?
 *
 * Checked separately from trialStartedAt because the flag is permanent: it is
 * never cleared, so a lost or reset start date cannot make someone eligible
 * for a second free month.
 */
export function hasUsedTrial(profile: any): boolean {
  if (!profile) return false;
  return profile.trialEverStarted === true || !!profile.trialStartedAt;
}

export function startTrialFields(now: number = Date.now()) {
  return {
    // Permanent marker — survives cache clears and re-syncs.
    trialEverStarted: true,
    trialStartedAt: new Date(now).toISOString(),
    proPlanType: 'trial' as const,
  };
}

/** Fields to persist when lifetime access is purchased or granted. */
export function grantLifetimeFields() {
  return {
    lifetimePro: true,
    isProUser: true,
    proPlanType: 'lifetime' as const,
    proExpiresAt: null as string | null,
  };
}

/** Fields to persist when an admin revokes access. Trial history is kept. */
export function revokeLifetimeFields() {
  return {
    lifetimePro: false,
    isProUser: false,
    proPlanType: null as string | null,
    proExpiresAt: null as string | null,
  };
}
