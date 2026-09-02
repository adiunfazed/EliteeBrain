/**
 * Entitlement reading, shared by the coach gate and the leaderboard.
 *
 * A user's Pro fields can appear in several shapes depending on which code
 * path wrote them:
 *
 *   - top level of the user document (admin portal grants)
 *   - inside `profileData` as an object (normal app sync)
 *   - inside `profileData` as a JSON STRING (older records)
 *   - dates as ISO strings, Firestore Timestamps, or epoch numbers
 *
 * Reading only one of these is why trial users were told the AI Coach was a
 * Pro feature and why their Pro badge never appeared on the leaderboard.
 * Everything server-side now goes through this file so the shapes can only be
 * handled wrongly in one place.
 */

const TRIAL_DAYS = 30;

/** profileData as an object, whatever form it was stored in. */
function profileOf(data: any): any {
  if (!data) return {};
  const p = data.profileData;
  if (!p) return {};
  if (typeof p === 'object') return p;
  if (typeof p === 'string') {
    try {
      return JSON.parse(p) || {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Read a field from the top level, falling back to profileData. */
export function readField(data: any, key: string): any {
  if (!data) return undefined;
  const top = data[key];
  if (top !== undefined && top !== null) return top;
  const p = profileOf(data);
  return p[key];
}

/** Milliseconds from an ISO string, epoch number, or Firestore Timestamp. */
export function toMillis(value: any): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  // Firestore Timestamp — either the SDK class or its serialised form.
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      try {
        return value.toMillis();
      } catch {
        return null;
      }
    }
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return null;
}

export type EntitlementStatus = 'lifetime' | 'subscription' | 'trial' | 'expired' | 'free';

export interface Entitlement {
  isPro: boolean;
  status: EntitlementStatus;
}

/** Mirrors src/lib/entitlement.ts. Lifetime and an active trial both count. */
export function resolveEntitlement(data: any, now: number = Date.now()): Entitlement {
  if (!data) return { isPro: false, status: 'free' };

  if (readField(data, 'lifetimePro') === true || readField(data, 'proPlanType') === 'lifetime') {
    return { isPro: true, status: 'lifetime' };
  }

  // Active dated subscription, before the trial: a paying customer whose
  // trial also lapsed must not read as expired. No isProUser flag required —
  // the expiry date alone is the grant, and it is written server-side.
  const expiryMs = toMillis(readField(data, 'proExpiresAt'));
  if (expiryMs !== null && now < expiryMs) {
    return { isPro: true, status: 'subscription' };
  }

  const startMs = toMillis(readField(data, 'trialStartedAt'));
  if (startMs !== null) {
    // A forward-dated start would stretch the trial indefinitely; clamp it.
    const end = Math.min(startMs, now) + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    if (now < end) return { isPro: true, status: 'trial' };
    return { isPro: false, status: 'expired' };
  }

  const isProFlag = readField(data, 'isProUser') === true;
  const legacy = toMillis(readField(data, 'proExpiresAt'));

  if (isProFlag && legacy !== null) {
    // Dated legacy plan — honour it until it runs out.
    return now < legacy
      ? { isPro: true, status: 'lifetime' }
      : { isPro: false, status: 'expired' };
  }

  if (isProFlag) {
    // Granted before plan type and expiry were recorded. There is no evidence
    // it ever ended, so it is honoured rather than silently revoked.
    return { isPro: true, status: 'lifetime' };
  }

  return { isPro: false, status: 'free' };
}

/** Display name from any stored location. Never invents a name. */
export function readDisplayName(data: any): string {
  const raw =
    readField(data, 'displayName') ||
    (typeof data?.email === 'string' ? data.email.split('@')[0] : '') ||
    '';
  return String(raw).trim().slice(0, 40) || 'Unnamed member';
}
