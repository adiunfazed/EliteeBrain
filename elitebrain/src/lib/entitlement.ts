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

export type EntitlementStatus = 'lifetime' | 'trial' | 'expired' | 'free';

export interface Entitlement {
  status: EntitlementStatus;
  /** Whether Pro features should be unlocked right now. */
  isPro: boolean;
  /** Whole days left in the trial. 0 for every non-trial status. */
  trialDaysLeft: number;
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

  const endMs = trialEndMs(profile.trialStartedAt);
  if (endMs !== null) {
    const trialEndsAt = new Date(endMs).toISOString();
    if (now < endMs) {
      const trialDaysLeft = Math.max(1, Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)));
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

  // Legacy: a dated grant from before the lifetime model. Honour it until it
  // runs out so nobody who already had access loses it on deploy.
  const legacyExpiry = parseDate(profile.proExpiresAt);
  if (profile.isProUser === true && legacyExpiry !== null && now < legacyExpiry) {
    return { status: 'lifetime', isPro: true, trialDaysLeft: 0 };
  }

  return { status: 'free', isPro: false, trialDaysLeft: 0 };
}

/** Human-readable label for the admin portal and profile screen. */
export function entitlementLabel(e: Entitlement): string {
  switch (e.status) {
    case 'lifetime':
      return 'Lifetime Pro';
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
export function startTrialFields(now: number = Date.now()) {
  return {
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
