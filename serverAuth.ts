import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readField, resolveEntitlement, toMillis } from './serverEntitlement';
import { getEntitlement } from './serverEntitlementCache';

/**
 * Server-side identity and entitlement verification.
 *
 * Before this existed, /api/coach trusted `userProfile.isProUser` sent by the
 * browser — anyone could post `{"userProfile":{"isProUser":true}}` and use the
 * AI Coach on the owner's Gemini quota without paying.
 *
 * Now the client sends a Firebase ID token, the server verifies it against
 * Google's public keys (which cannot be forged), reads that user's document
 * directly from Firestore, and derives Pro access from stored fields. Nothing
 * the browser claims about itself is trusted.
 *
 * If no service account is configured the server FAILS CLOSED for Pro checks
 * rather than silently reverting to trusting the client.
 */

let initialised = false;
let available = false;

export function initAdmin(): boolean {
  if (initialised) return available;
  initialised = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    initError = 'FIREBASE_SERVICE_ACCOUNT is not set on this server.';
    console.warn(initError);
    return false;
  }

  try {
    // The value may be raw JSON or base64. Base64 avoids newline mangling in
    // environment variables, which is the usual cause of "invalid PEM" errors.
    const text = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');

    const credentials = JSON.parse(text);
    // Escaped newlines survive some dashboards literally; restore them.
    if (typeof credentials.private_key === 'string') {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    if (getApps().length === 0) initializeApp({ credential: cert(credentials) });
    available = true;
    console.log('Firebase Admin initialised — server-side verification active.');
  } catch (err) {
    initError = (err as Error).message;
    console.error('Could not initialise Firebase Admin:', initError);
    available = false;
  }

  return available;
}

/** Why initialisation failed, for the diagnostic endpoint. */
export let initError: string | null = null;

export function isAdminAvailable(): boolean {
  return available;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  isPro: boolean;
  status: 'lifetime' | 'subscription' | 'trial' | 'expired' | 'free';
  /** True when the profile could not be read, so Pro status is unverified. */
  entitlementUnknown?: boolean;
}

/**
 * Recover entitlement fields that exist in profileData but not at the top level.
 *
 * Returns the fields to write, or null when there is nothing to repair. Only
 * promotes evidence that is already in the document — it never grants access
 * that was not there to begin with.
 */
function repairEntitlement(data: any): Record<string, any> | null {
  if (!data) return null;
  const out: Record<string, any> = {};

  const lifetime = readField(data, 'lifetimePro');
  if (lifetime === true && data.lifetimePro !== true) out.lifetimePro = true;

  const planType = readField(data, 'proPlanType');
  if (planType === 'lifetime' && data.proPlanType !== 'lifetime') out.proPlanType = 'lifetime';

  const trialStart = readField(data, 'trialStartedAt');
  if (trialStart && !data.trialStartedAt) {
    const ms = toMillis(trialStart);
    // Only promote a start date that is actually usable.
    if (ms !== null) out.trialStartedAt = new Date(ms).toISOString();
  }

  const everStarted = readField(data, 'trialEverStarted');
  if (everStarted === true && data.trialEverStarted !== true) out.trialEverStarted = true;

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Verify a Firebase ID token and look up that user's real entitlement.
 * Returns null when the token is missing, invalid, or expired.
 */
export interface VerifyFailure {
  reason: string;
  code?: string;
}

/** Populated when the last verification failed, so callers can report why. */
export let lastVerifyFailure: VerifyFailure | null = null;

export async function verifyUser(idToken?: string): Promise<VerifiedUser | null> {
  lastVerifyFailure = null;
  if (!available) {
    lastVerifyFailure = { reason: 'admin_unavailable' };
    return null;
  }
  if (!idToken) {
    lastVerifyFailure = { reason: 'no_token' };
    return null;
  }

  try {
    // Identity check. If this succeeds the user is genuinely signed in.
    const decoded = await getAuth().verifyIdToken(idToken);

    // Entitlement, via a five-minute cache.
    //
    // Reading Firestore on every request made a database hiccup break
    // authentication itself: the coach, leaderboard and rank all failed
    // together over a lookup that only decides Pro status. The token already
    // proves identity, so this is now at most one read per user per window,
    // and a failed read serves the last known value rather than locking
    // anyone out.
    const ent = await getEntitlement(decoded.uid, async () => {
      const snap = await getFirestore().collection('users').doc(decoded.uid).get();
      return snap.exists ? snap.data() : null;
    });

    if (ent.degraded) {
      lastVerifyFailure = { reason: 'db_unavailable', code: 'entitlement_read_failed' };
    }

    return {
      uid: decoded.uid,
      email: decoded.email,
      isPro: ent.isPro,
      status: ent.status as any,
      // Only unknown when there was no cached value to fall back on.
      entitlementUnknown: ent.degraded && !ent.fromCache,
    };
  } catch (err: any) {
    // Firebase error codes are specific: auth/id-token-expired,
    // auth/argument-error (malformed), auth/id-token-revoked, and
    // project mismatch all need different fixes.
    // Normalise here: Firebase returns strings, but some transports surface a
    // numeric code, and callers were doing string operations on it.
    // The inner Firestore handler already recorded db_unavailable and threw
    // this sentinel purely to unwind. Overwriting it here lost the real
    // reason and reported a database fault as a bad sign-in.
    if (err?.message === 'ENTITLEMENT_LOOKUP_FAILED') {
      return null;
    }

    const rawCode = err?.errorInfo?.code ?? err?.code ?? 'unknown';
    const code = String(rawCode);
    lastVerifyFailure = { reason: 'verify_failed', code };
    console.error('ID token verification failed:', code, err?.message || err);
    return null;
  }
}
