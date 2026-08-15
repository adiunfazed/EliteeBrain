import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
    console.warn(
      'FIREBASE_SERVICE_ACCOUNT is not set — server-side Pro verification is disabled.'
    );
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
    console.error('Could not initialise Firebase Admin:', (err as Error).message);
    available = false;
  }

  return available;
}

export function isAdminAvailable(): boolean {
  return available;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  isPro: boolean;
  status: 'lifetime' | 'trial' | 'expired' | 'free';
}

const TRIAL_DAYS = 30;

/**
 * Mirrors src/lib/entitlement.ts. Kept deliberately simple and separate: the
 * server must not import client code, and this is the copy that actually
 * decides access.
 */
function resolveEntitlement(data: any, now = Date.now()): {
  isPro: boolean;
  status: VerifiedUser['status'];
} {
  if (!data) return { isPro: false, status: 'free' };

  if (data.lifetimePro === true || data.proPlanType === 'lifetime') {
    return { isPro: true, status: 'lifetime' };
  }

  const startMs = Date.parse(data.trialStartedAt || '');
  if (Number.isFinite(startMs)) {
    // A forward-dated start would stretch the trial indefinitely; clamp it.
    const start = Math.min(startMs, now);
    const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    if (now < end) return { isPro: true, status: 'trial' };
    return { isPro: false, status: 'expired' };
  }

  const legacy = Date.parse(data.proExpiresAt || '');
  if (data.isProUser === true && Number.isFinite(legacy) && now < legacy) {
    return { isPro: true, status: 'lifetime' };
  }

  return { isPro: false, status: 'free' };
}

/**
 * Verify a Firebase ID token and look up that user's real entitlement.
 * Returns null when the token is missing, invalid, or expired.
 */
export async function verifyUser(idToken?: string): Promise<VerifiedUser | null> {
  if (!available || !idToken) return null;

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const snap = await getFirestore().collection('users').doc(decoded.uid).get();
    const data = snap.exists ? snap.data() : null;

    // Entitlement fields live at the top level; profileData is the fallback for
    // documents written before that was standardised.
    const source = {
      lifetimePro: data?.lifetimePro ?? data?.profileData?.lifetimePro,
      trialStartedAt: data?.trialStartedAt ?? data?.profileData?.trialStartedAt,
      proPlanType: data?.proPlanType ?? data?.profileData?.proPlanType,
      proExpiresAt: data?.proExpiresAt ?? data?.profileData?.proExpiresAt,
      isProUser: data?.isProUser ?? data?.profileData?.isProUser,
    };

    const { isPro, status } = resolveEntitlement(source);
    return { uid: decoded.uid, email: decoded.email, isPro, status };
  } catch (err) {
    console.warn('ID token verification failed:', (err as Error).message);
    return null;
  }
}
