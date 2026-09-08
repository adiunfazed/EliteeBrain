import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readField, resolveEntitlement, toMillis } from './serverEntitlement';

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
  status: 'lifetime' | 'subscription' | 'trial' | 'expired' | 'free';
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

    // Entitlement lookup. Separated deliberately: a Firestore permission or
    // API-enablement problem here is NOT the user's fault, and previously it
    // surfaced as "could not verify your sign-in" even though the sign-in was
    // perfectly valid.
    let data: any = null;
    try {
      const snap = await getFirestore().collection('users').doc(decoded.uid).get();
      data = snap.exists ? snap.data() : null;
    } catch (dbErr: any) {
      const dbCode = String(dbErr?.code ?? dbErr?.errorInfo?.code ?? '');
      console.error(
        'Firestore read failed for uid',
        decoded.uid,
        '| code:',
        dbCode,
        '|',
        dbErr?.message || dbErr
      );
      lastVerifyFailure = { reason: 'db_unavailable', code: dbCode };
      // The user is authenticated; we simply cannot read their entitlement.
      // Report that honestly rather than blaming their sign-in.
      throw new Error('ENTITLEMENT_LOOKUP_FAILED');
    }

    // Delegates to the shared reader, which handles profileData stored as an
    // object OR a JSON string, and dates as ISO/epoch/Timestamp. Reading only
    // one shape is why trial users were refused the coach.
    let { isPro, status } = resolveEntitlement(data);

    // Self-heal. A trial started on one device may exist inside profileData
    // while the top-level fields were never written — a partial sync, an
    // interrupted write, an older client. The evidence is there; the document
    // shape is just wrong. Repair it rather than refusing a paying user.
    if (!isPro) {
      const repaired = repairEntitlement(data);
      if (repaired) {
        try {
          await getFirestore().collection('users').doc(decoded.uid).set(repaired, { merge: true });
          console.info('Repaired entitlement fields for', decoded.uid, JSON.stringify(repaired));
          const after = resolveEntitlement({ ...data, ...repaired });
          isPro = after.isPro;
          status = after.status;
        } catch (repairErr: any) {
          console.warn('Could not repair entitlement:', repairErr?.message);
        }
      }
    }

    if (!isPro) {
      // Log every field consulted, so a report of "it says buy Pro" can be
      // resolved from the logs instead of another round of guessing.
      console.info(
        'Coach denied for',
        decoded.uid,
        JSON.stringify({
          status,
          top: {
            lifetimePro: data?.lifetimePro ?? null,
            trialStartedAt: data?.trialStartedAt ?? null,
            trialEverStarted: data?.trialEverStarted ?? null,
            proPlanType: data?.proPlanType ?? null,
            isProUser: data?.isProUser ?? null,
          },
          profileDataType: typeof data?.profileData,
          hasProfileData: !!data?.profileData,
        })
      );
    }

    return { uid: decoded.uid, email: decoded.email, isPro, status };
  } catch (err: any) {
    // Firebase error codes are specific: auth/id-token-expired,
    // auth/argument-error (malformed), auth/id-token-revoked, and
    // project mismatch all need different fixes.
    // Normalise here: Firebase returns strings, but some transports surface a
    // numeric code, and callers were doing string operations on it.
    const rawCode = err?.errorInfo?.code ?? err?.code ?? 'unknown';
    const code = String(rawCode);
    lastVerifyFailure = { reason: 'verify_failed', code };
    console.error('ID token verification failed:', code, err?.message || err);
    return null;
  }
}
