import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { loadProfile, createInitialProfile } from '../utils/storage';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore targeting the custom databaseId if configured
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || undefined
);

// Enable offline persistence for smooth offline and intermittent connection handling
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.info('Firestore persistence notice:', err.message);
    }
  });
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo, null, 2));

  let friendlyMsg = 'A database error occurred. Please try again.';
  if (errInfo.error.includes('Missing or insufficient permissions')) {
    friendlyMsg = 'You do not have permission to access this data.';
  } else if (errInfo.error.includes('offline')) {
    friendlyMsg = 'You are currently offline. Please check your connection.';
  } else if (errInfo.error.includes('Invalid database')) {
    friendlyMsg = 'Could not connect to the database. Please check your configuration.';
  }

  throw new Error(friendlyMsg);
}

// Connection verification with graceful offline detection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'admin_settings', 'ping'));
  } catch (error: any) {
    if (
      error?.code === 'unavailable' ||
      error?.message?.includes('offline') ||
      error?.message?.includes('Could not reach') ||
      error?.message?.includes('the client is offline')
    ) {
      console.info('EliteLife Firestore operating in offline cache mode or client is offline.');
    } else {
      console.info('Firebase status check:', error?.message || error);
    }
  }
}
testConnection();

// --- Local Authentication Helper ---
const LOCAL_AUTH_KEY = 'elitebrain_authenticated_user_session';

function createCustomUserObject(
  uid: string,
  email: string,
  displayName: string,
  authProvider: 'google' | 'email'
): User {
  const cleanEmail = email || `${uid.slice(0, 10)}@elitelife.ai`;
  const cleanName = displayName || cleanEmail.split('@')[0] || 'Neural Athlete';
  return {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    photoURL:
      authProvider === 'google'
        ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`
        : '',
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as any,
    providerData: [
      {
        providerId: authProvider === 'google' ? 'google.com' : 'password',
        uid: cleanEmail,
        displayName: cleanName,
        email: cleanEmail,
        phoneNumber: null,
        photoURL: null,
      },
    ],
    refreshToken: 'session_token_' + uid,
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'session_token_' + uid,
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
  } as unknown as User;
}

function saveLocalUserSession(user: User) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        LOCAL_AUTH_KEY,
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          providerId: user.providerData?.[0]?.providerId || 'password',
        })
      );
    } catch (e) {
      console.warn('Local session save notice:', e);
    }
  }
}

function getLocalUserSession(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Earlier builds fabricated a session whenever Firebase auth failed. Those
    // accounts are not real Firebase users, so they can never sync. Discard any
    // that are still sitting in storage and make the person sign in properly.
    const fakeUid = typeof data?.uid === 'string' && /^(google_user_|usr_)/.test(data.uid);
    const fakeEmail = data?.email === 'google.athlete@elitelife.ai';
    if (fakeUid || fakeEmail) {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      return null;
    }

    if (data && data.uid) {
      return createCustomUserObject(
        data.uid,
        data.email || `${data.uid}@elitelife.ai`,
        data.displayName || 'Neural Athlete',
        data.providerId === 'google.com' ? 'google' : 'email'
      );
    }
  } catch (e) {
    console.warn('Local session parse notice:', e);
  }
  return null;
}

export interface RegisteredUserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  authProvider: 'google' | 'email';
  createdAt: string;
  lastLoginAt: string;
  isProUser?: boolean;
  lifetimePro?: boolean;
  trialStartedAt?: string;
  proPlanType?: string;
  proExpiresAt?: string;
  profileData?: any;
}

// Record/update user record in Firestore upon sign in / sign up
export async function registerUserRecord(
  user: User,
  authProvider: 'google' | 'email',
  customDisplayName?: string,
  overrideEmail?: string
) {
  if (!db) return;
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const email = overrideEmail || user.email || `${user.uid.slice(0, 8)}@elitelife.ai`;
  const displayName = customDisplayName || user.displayName || email.split('@')[0] || 'Member';

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        email,
        displayName,
        photoURL: user.photoURL || '',
        lastLoginAt: now,
        updatedAt: now,
      });
    } else {
      const initialProf = loadProfile() || createInitialProfile();
      const newUserDoc = {
        uid: user.uid,
        email,
        displayName,
        photoURL: user.photoURL || '',
        authProvider,
        createdAt: now,
        lastLoginAt: now,
        isProUser: Boolean(initialProf.isProUser),
        profileData: initialProf,
      };
      await setDoc(userRef, newUserDoc);
    }
  } catch (err) {
    console.warn('Firestore user record registration notice:', err);
  }
}

let localAuthStateCallback: ((user: User | null) => void) | null = null;

// Any auth failure must surface as an error. Previously each of these blocks
// fabricated a signed-in user, which both hid the real cause and let anyone
// past the login screen without credentials.
function describeAuthError(error: any): Error {
  const code = error?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return new Error(
      'This site is not authorised for sign-in yet. Add this domain under ' +
      'Firebase Console -> Authentication -> Settings -> Authorized domains.'
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('This sign-in method is disabled in Firebase Authentication.');
  }
  if (code === 'auth/popup-blocked') {
    return new Error('Your browser blocked the sign-in popup. Allow popups and try again.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Network error. Check your connection and try again.');
  }
  return new Error('Sign in failed. Please try again. (' + (code || 'unknown error') + ')');
}

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result && result.user) {
      saveLocalUserSession(result.user);
      await registerUserRecord(result.user, 'google');
      if (localAuthStateCallback) localAuthStateCallback(result.user);
      return result.user;
    }
  } catch (error: any) {
    console.warn('Firebase Google Auth SDK notice:', error?.code || error?.message);
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign in was cancelled.');
    }

    throw describeAuthError(error);
  }
  throw new Error('Could not complete Google sign in.');
}

export async function updateUserProfileName(newName: string): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed) return false;

  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    }
    if (auth.currentUser && db) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { displayName: trimmed, updatedAt: new Date().toISOString() });
    }
    return true;
  } catch (e) {
    console.error('Error updating user profile name:', e);
    return false;
  }
}

export async function signUpWithEmail(email: string, pass: string, name: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim() || cleanEmail.split('@')[0];

  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
  if (pass.length < 6) throw new Error('Password must be at least 6 characters.');

  try {
    const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    if (res.user) {
      if (cleanName) {
        try {
          await updateProfile(res.user, { displayName: cleanName });
        } catch (e) {
          console.warn('Update profile notice:', e);
        }
      }
      saveLocalUserSession(res.user);
      await registerUserRecord(res.user, 'email', cleanName, cleanEmail);
      if (localAuthStateCallback) localAuthStateCallback(res.user);
      return res.user;
    }
  } catch (error: any) {
    console.warn('Firebase Email Sign-Up SDK notice:', error?.code || error?.message);
    if (error?.code === 'auth/email-already-in-use') {
      throw new Error('An account with this email address already exists. Please sign in.');
    }
    if (error?.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters.');
    }

    throw describeAuthError(error);
  }
  throw new Error('Could not complete sign up.');
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid email address.');
  if (!pass) throw new Error('Please enter your password.');

  try {
    const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    if (res.user) {
      saveLocalUserSession(res.user);
      await registerUserRecord(res.user, 'email', res.user.displayName || cleanEmail.split('@')[0], cleanEmail);
      if (localAuthStateCallback) localAuthStateCallback(res.user);
      return res.user;
    }
  } catch (error: any) {
    console.warn('Firebase Email Sign-In SDK notice:', error?.code || error?.message);
    if (
      error?.code === 'auth/invalid-credential' ||
      error?.code === 'auth/user-not-found' ||
      error?.code === 'auth/wrong-password'
    ) {
      throw new Error('Invalid email address or password.');
    }

    throw describeAuthError(error);
  }
  throw new Error('Could not complete sign in.');
}

export async function resetPasswordForEmail(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.warn('Reset Password Notice:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address.');
    }
    // Friendly response for demo/preview reset password requests
    return true;
  }
}

export async function getAllRegisteredUsers(): Promise<RegisteredUserDoc[]> {
  try {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    const users: RegisteredUserDoc[] = [];
    snap.forEach((d) => {
      const data = d.data();
      users.push({
        uid: d.id,
        email: data.email || 'No email',
        displayName: data.displayName || 'Anonymous User',
        photoURL: data.photoURL || '',
        authProvider: data.authProvider || 'google',
        createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
        lastLoginAt: data.lastLoginAt || data.updatedAt || new Date().toISOString(),
        isProUser: Boolean(data.isProUser),
        // Needed so the admin list can show Free / Trial / Lifetime / Expired
        // rather than inferring from a single boolean.
        lifetimePro: data.lifetimePro === true,
        trialStartedAt: data.trialStartedAt || undefined,
        proPlanType: data.proPlanType || undefined,
        proExpiresAt: data.proExpiresAt || undefined,
        profileData: data.profileData,
      });
    });
    return users.sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime());
  } catch (err) {
    console.warn('getAllRegisteredUsers notice:', err);
    return [];
  }
}

export async function logoutUser() {
  localStorage.removeItem('elitebrain_guest');
  localStorage.removeItem(LOCAL_AUTH_KEY);
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.warn('Sign Out Notice:', error);
  }
  if (localAuthStateCallback) {
    localAuthStateCallback(null);
  }
}

export interface PaymentRequestDoc {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  plan: 'monthly' | 'annual' | 'lifetime';
  amountINR: number;
  utrNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const LOCAL_PAYMENTS_KEY = 'elitebrain_local_payments';

function getLocalPaymentRequests(): PaymentRequestDoc[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPaymentRequests(list: PaymentRequestDoc[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Local payments save notice:', e);
  }
}

export async function createPaymentRequest(data: Omit<PaymentRequestDoc, 'id' | 'createdAt' | 'status'>) {
  const reqId = `pay_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload: PaymentRequestDoc = {
    ...data,
    id: reqId,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  // Save locally as immediate backup
  const existingLocal = getLocalPaymentRequests();
  existingLocal.unshift(payload);
  saveLocalPaymentRequests(existingLocal);

  if (db) {
    try {
      const reqRef = doc(db, 'payment_requests', reqId);
      await setDoc(reqRef, payload);
    } catch (err) {
      console.warn('Firestore payment request setDoc notice:', err);
    }
  }
  return payload;
}

export async function getUserPaymentRequests(userId: string): Promise<PaymentRequestDoc[]> {
  const localList = getLocalPaymentRequests().filter((p) => p.userId === userId);
  if (!db) return localList;

  try {
    const q = query(collection(db, 'payment_requests'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const firestoreList: PaymentRequestDoc[] = [];
    snap.forEach((doc) => {
      firestoreList.push(doc.data() as PaymentRequestDoc);
    });

    const map = new Map<string, PaymentRequestDoc>();
    localList.forEach((p) => map.set(p.id, p));
    firestoreList.forEach((p) => map.set(p.id, p));

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.warn('getUserPaymentRequests notice:', err);
    return localList;
  }
}

export async function getAllPaymentRequests(): Promise<PaymentRequestDoc[]> {
  const localList = getLocalPaymentRequests();
  if (!db) return localList;

  try {
    const q = collection(db, 'payment_requests');
    const snap = await getDocs(q);
    const firestoreList: PaymentRequestDoc[] = [];
    snap.forEach((doc) => {
      firestoreList.push(doc.data() as PaymentRequestDoc);
    });

    const map = new Map<string, PaymentRequestDoc>();
    localList.forEach((p) => map.set(p.id, p));
    firestoreList.forEach((p) => map.set(p.id, p));

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.warn('getAllPaymentRequests notice:', err);
    return localList;
  }
}

export async function reviewPaymentRequest(
  requestId: string,
  targetUserId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  reviewerEmail: string,
  planType: 'monthly' | 'annual' | 'lifetime' = 'lifetime',
  amountINR: number = 1999
) {
  // Update local list
  const localList = getLocalPaymentRequests();
  const item = localList.find((p) => p.id === requestId);
  if (item) {
    item.status = newStatus;
    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = reviewerEmail;
    saveLocalPaymentRequests(localList);
  }

  if (db) {
    const reqRef = doc(db, 'payment_requests', requestId);
    try {
      await updateDoc(reqRef, {
        status: newStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerEmail,
      });
    } catch (err) {
      console.warn('reviewPaymentRequest updateDoc notice:', err);
    }
  }

  if (newStatus === 'APPROVED') {
    // Approving a payment must grant the SAME entitlement the admin button
    // grants. This previously wrote a dated expiry and never set lifetimePro,
    // so someone who paid ₹1,999 for lifetime access silently received one
    // year — and the entitlement system, which reads lifetimePro, never saw it.
    const isLifetime = planType === 'lifetime';
    const now = Date.now();
    const proExpiresAt: string | null = isLifetime
      ? null
      : new Date(now + (planType === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
    const paidAt = new Date().toISOString();

    if (db) {
      const userRef = doc(db, 'users', targetUserId);
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const existingData = userSnap.data();
          let rawProfile: any = existingData.profileData || {};
          if (typeof rawProfile === 'string') {
            try {
              rawProfile = JSON.parse(rawProfile);
            } catch (e) {
              rawProfile = {};
            }
          }

          const entitlement = {
            isProUser: true,
            lifetimePro: isLifetime,
            proExpiresAt,
            proPlanType: planType,
            proPaidAt: paidAt,
            proAmountPaid: amountINR,
          };

          await updateDoc(userRef, {
            ...entitlement,
            profileData: { ...rawProfile, ...entitlement },
            updatedAt: new Date().toISOString(),
          });
        } else {
          const entitlement = {
            isProUser: true,
            lifetimePro: isLifetime,
            proExpiresAt,
            proPlanType: planType,
            proPaidAt: paidAt,
            proAmountPaid: amountINR,
          };
          await setDoc(userRef, {
            uid: targetUserId,
            ...entitlement,
            profileData: entitlement,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Approval user pro update notice:', err);
      }
    }
  }
}

export async function getAdminMerchantUpiId(): Promise<string> {
  if (db) {
    try {
      const ref = doc(db, 'admin_settings', 'upi_config');
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().merchantUpiId) {
        return snap.data().merchantUpiId;
      }
    } catch (err) {
      console.warn('getAdminMerchantUpiId notice:', err);
    }
  }
  return '7986568659@ptyes';
}

export async function setAdminMerchantUpiId(newUpiId: string) {
  if (db) {
    const ref = doc(db, 'admin_settings', 'upi_config');
    try {
      await setDoc(
        ref,
        {
          merchantUpiId: newUpiId.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('setAdminMerchantUpiId notice:', err);
    }
  }
}

export function onAuthStateChanged(
  authObj: any,
  callback: (user: User | null) => void
) {
  localAuthStateCallback = callback;

  // 1. Instantly check if an authenticated session exists in localStorage
  const existingLocalUser = getLocalUserSession();
  if (existingLocalUser) {
    setTimeout(() => callback(existingLocalUser), 20);
  }

  // 2. Listen to Firebase Auth SDK state changes
  return firebaseOnAuthStateChanged(authObj, async (fbUser) => {
    if (fbUser) {
      localStorage.removeItem('elitebrain_guest');
      saveLocalUserSession(fbUser);
      try {
        await registerUserRecord(
          fbUser,
          fbUser.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'email'
        );
      } catch (e) {
        console.warn('Session persistence user record check notice:', e);
      }
      callback(fbUser);
    } else {
      const stored = getLocalUserSession();
      if (!stored) {
        callback(null);
      }
    }
  });
}

export type { User };


/**
 * Current user's Firebase ID token, for authenticating server requests.
 * The SDK refreshes it automatically, so this is always current.
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const user = auth?.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (err) {
    console.warn('Could not get ID token:', err);
    return null;
  }
}
