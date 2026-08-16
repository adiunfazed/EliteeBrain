import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, User } from './firebase';
import { resolveEntitlement } from './entitlement';
import { UserProfile } from '../types';
import { countConsecutiveCompletedDays } from '../utils/storage';
import { saveProfile, calculateBrainScore, createInitialProfile, loadProfile } from '../utils/storage';

export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = sanitizeForFirestore(val);
    }
  }
  return cleaned;
}

export async function syncProfileToCloud(profile: UserProfile, user: User) {
  if (!user || !db) return;

  try {
    const userRef = doc(db, 'users', user.uid);
    const brainScore = calculateBrainScore(profile);

    const payload = sanitizeForFirestore({
      uid: user.uid,
      displayName: user.displayName || 'Neural Athlete',
      email: user.email || '',
      photoURL: user.photoURL || '',
      brainScore,
      streak: profile.streakDays || 0,
      currentDay: profile.currentDay || 1,
      isProUser: Boolean(profile.isProUser),
      lifetimePro: profile.lifetimePro === true,
      trialStartedAt: profile.trialStartedAt || null,
      proExpiresAt: profile.proExpiresAt || null,
      proPlanType: profile.proPlanType || null,
      proPaidAt: profile.proPaidAt || null,
      proAmountPaid: profile.proAmountPaid || null,
      proUtrNumber: profile.proUtrNumber || null,
      profileData: profile,
      updatedAt: new Date().toISOString(),
    });

    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.error('Error syncing profile to Firestore:', error);
  }
}

export async function fetchProfileFromCloud(userId: string): Promise<UserProfile | null> {
  if (!db) return null;

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        let profileObj: Partial<UserProfile> = {};
        if (data.profileData) {
          if (typeof data.profileData === 'string') {
            try {
              profileObj = JSON.parse(data.profileData);
            } catch (e) {
              console.error('Error parsing profileData:', e);
            }
          } else if (typeof data.profileData === 'object') {
            profileObj = data.profileData;
          }
        }

        const baseProfile = loadProfile() || createInitialProfile();
        // Access is DERIVED, never read straight from the stored flag.
        const isPro = resolveEntitlement({
          ...profileObj,
          lifetimePro: data.lifetimePro === true || profileObj.lifetimePro === true,
          trialStartedAt: data.trialStartedAt || profileObj.trialStartedAt,
          proPlanType: data.proPlanType || profileObj.proPlanType,
          proExpiresAt: data.proExpiresAt || profileObj.proExpiresAt,
          isProUser: data.isProUser === true,
        }).isPro;
        const merged: any = {
          ...baseProfile,
          ...profileObj,
          modules: {
            ...baseProfile.modules,
            ...(profileObj.modules || {}),
          },
          dailyLogs: {
            ...baseProfile.dailyLogs,
            ...(profileObj.dailyLogs || {}),
          },
          // Deep-merge like modules and dailyLogs. A shallow spread let the
          // cloud copy replace the local one wholesale, so badges earned on one
          // device disappeared when another device synced.
          unlockedAchievements: {
            ...(baseProfile.unlockedAchievements || {}),
            ...(profileObj.unlockedAchievements || {}),
          },
          isProUser: isPro,
          lifetimePro: data.lifetimePro === true || profileObj.lifetimePro === true,
          trialStartedAt: data.trialStartedAt || profileObj.trialStartedAt,
          proExpiresAt: data.proExpiresAt || profileObj.proExpiresAt || undefined,
          proPlanType: data.proPlanType || profileObj.proPlanType || undefined,
          proPaidAt: data.proPaidAt || profileObj.proPaidAt || undefined,
          proAmountPaid: data.proAmountPaid || profileObj.proAmountPaid || undefined,
          proUtrNumber: data.proUtrNumber || profileObj.proUtrNumber || undefined,
          pendingPayment: isPro ? undefined : (profileObj.pendingPayment || baseProfile.pendingPayment),
        };

        // Never trust a stored streak: the old code incremented it on every
        // module completion, so cloud copies are inflated too. Daily logs are
        // the record; recompute from them.
        merged.streakDays = countConsecutiveCompletedDays(merged);

        const fullProfile: UserProfile = merged;
        return fullProfile;
      }
    }
  } catch (error) {
    console.error('Error fetching profile from Firestore:', error);
  }
  return null;
}


