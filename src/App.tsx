import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { UserProfile, ModuleId, SessionResult } from './types';
import { applyDayRollover, applyStreakReset, loadProfile, saveProfile, processModuleResult, MODULE_METADATA, createInitialProfile, resetAdminProfile, countConsecutiveCompletedDays, setActiveUser } from './utils/storage';
import { soundFx } from './utils/audio';
import { getIdToken, auth, db, onAuthStateChanged, logoutUser, User } from './lib/firebase';
import { syncProfileToCloud, fetchProfileFromCloud } from './lib/sync';
import { doc, onSnapshot } from 'firebase/firestore';

import { SignInScreen } from './components/SignInScreen';
import { Header } from './components/Header';
import { NotificationSettings } from './components/NotificationSettings';
import { Dashboard } from './components/Dashboard';
import { SummaryModal } from './components/SummaryModal';
import { SettingsModal } from './components/SettingsModal';
import { SignOutConfirmModal } from './components/SignOutConfirmModal';
import { AICoachModal } from './components/AICoachModal';
import { ProSubscriptionModal } from './components/ProSubscriptionModal';
import { AdminPortalModal } from './components/AdminPortalModal';
import { MethodsModal } from './components/MethodsModal';
import { SplashScreen } from './components/SplashScreen';
import { AchievementUnlockedModal } from './components/AchievementUnlockedModal';
import { AchievementsGalleryModal } from './components/AchievementsGalleryModal';

import { DigitSpanModule } from './components/modules/DigitSpanModule';
import { StroopModule } from './components/modules/StroopModule';
import { SpatialNBackModule } from './components/modules/SpatialNBackModule';
import { StillnessModule } from './components/modules/StillnessModule';
import { PatternMatrixModule } from './components/modules/PatternMatrixModule';
import { CognitiveShiftModule } from './components/modules/CognitiveShiftModule';
import { VisuospatialModule } from './components/modules/VisuospatialModule';
import { ReactionInhibitorModule } from './components/modules/ReactionInhibitorModule';
import { MentalMathModule } from './components/modules/MentalMathModule';
import { resolveEntitlement, startTrialFields } from './lib/entitlement';
import { goalById } from './lib/goals';
import { ScrollProgress } from './components/ScrollProgress';
import { XpProvider } from './components/XpToast';
import { WelcomeScreen } from './components/WelcomeScreen';
import { UpdateBanner } from './components/UpdateBanner';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());

  // Cloud writes are blocked until the signed-in user's cloud profile has
  // actually loaded. Without this, the stale localStorage copy that seeds
  // `profile` gets pushed up in the window between auth firing and the fetch
  // resolving — which is how two devices end up overwriting each other.
  const hydratedRef = useRef(false);
  /** True once the cloud profile has been applied for this account. */
  const [isHydrated, setIsHydrated] = useState(false);

  // Roll the day over while the app is open. Someone who leaves it running
  // overnight would otherwise still see yesterday's completed modules.
  useEffect(() => {
    const id = setInterval(() => {
      setProfile((prev) => {
        const rolled = applyDayRollover(prev);
        if (rolled === prev) return prev;
        saveProfile(rolled);
        return rolled;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return localStorage.getItem('elitebrain_guest') === 'true';
  });
  
  // App Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  /** False until Firebase has reported whether anyone is signed in. */
  const [authResolved, setAuthResolved] = useState(false);

  // Theme & Accessibility States
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Dark mode by default
  const [isColorblind, setIsColorblind] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    return localStorage.getItem('elitebrain_onboarded') !== 'true';
  });

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isAICoachOpen, setIsAICoachOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  // Shown once per account, and only when there is genuinely nothing to show.
  const [showFirstRun, setShowFirstRun] = useState(false);

  // Show the welcome screen once per account, and only when we don't yet
  // have a name for them. No extra subscriptions — the previous version
  // opened goal and task listeners purely to make this decision.
  useEffect(() => {
    if (!currentUser) return;

    const key = `elitebrain_firstrun_v1:${currentUser.uid}`;
    try {
      if (localStorage.getItem(key) === 'done') return;
    } catch {
      return;
    }

    setShowFirstRun(true);
  }, [currentUser]);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [isMethodsOpen, setIsMethodsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBadgesGalleryOpen, setIsBadgesGalleryOpen] = useState(false);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([]);

  // Active Execution States
  const [activeModuleId, setActiveModuleId] = useState<ModuleId | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  // Apply Theme & Colorblind Classes to root <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (isColorblind) {
      root.classList.add('colorblind');
    } else {
      root.classList.remove('colorblind');
    }
  }, [isDarkMode, isColorblind]);

  useEffect(() => {
    if (activeModuleId) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeModuleId]);

  // Auth Listener and Real-Time Cloud Sync
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    // Wait for Firebase to finish restoring any persisted session before the
    // UI is allowed to conclude that nobody is signed in.
    (async () => {
      try {
        if (auth && typeof (auth as any).authStateReady === 'function') {
          await (auth as any).authStateReady();
        }
      } catch {
        /* older SDK — the listener below still resolves it */
      }
      setAuthResolved(true);
    })();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Must run BEFORE any profile is read. If the account changed, this
      // clears the previous user's cached data so their name, streak and
      // trial cannot appear on a different account.
      setActiveUser(user?.uid || null);

      setCurrentUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      if (!user) {
        hydratedRef.current = false;
        setIsHydrated(false);
      }

      if (user) {
        setIsAuthModalOpen(false);
        hydratedRef.current = false;
        setIsHydrated(false);

        // Re-read now that ownership is established — the initial load ran
        // before auth resolved and may have returned a stale profile.
        setProfile(loadProfile());

        const isAdminUser = user.email?.toLowerCase() === 'unfazed.adibiz@gmail.com';

        // Fetch initial profile
        const cloudProf = await fetchProfileFromCloud(user.uid);
        
        if (isAdminUser) {
          const zeroAdminProf = applyStreakReset(applyDayRollover(resetAdminProfile(cloudProf || undefined)));
          // Admins are not exempt from the entitlement system — otherwise a
          // revoke never takes effect on the admin's own account.
          zeroAdminProf.isProUser = resolveEntitlement(zeroAdminProf).isPro;
          setProfile(zeroAdminProf);
          await syncProfileToCloud(zeroAdminProf, user);
        } else if (cloudProf) {
          // Roll forward BEFORE it reaches state, or yesterday's completion
          // flags render for a moment and then correct themselves.
          const rolledCloud = applyStreakReset(applyDayRollover(cloudProf));
          setProfile(rolledCloud);
          saveProfile(rolledCloud);
        } else {
          const newProf = createInitialProfile();
          // The trial is started deliberately from the Get Pro screen rather
          // than silently on registration, so the user sees the offer and the
          // 30-day clock starts when they choose.
          newProf.isProUser = false;
          setProfile(newProf);
          saveProfile(newProf);
          await syncProfileToCloud(newProf, user);
        }

        // Cloud state is now authoritative; local writes may resume.
        hydratedRef.current = true;
        setIsHydrated(true);

        // Real-time listener
        if (db) {
          const userDocRef = doc(db, 'users', user.uid);
          unsubscribeDoc = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data) {
                  let cloudProfile: Partial<UserProfile> = {};
                  if (data.profileData) {
                    if (typeof data.profileData === 'string') {
                      try {
                        cloudProfile = JSON.parse(data.profileData);
                      } catch (e) {
                        console.error('Error parsing profileData:', e);
                      }
                    } else if (typeof data.profileData === 'object') {
                      cloudProfile = data.profileData;
                    }
                  }

                  setProfile((prev) => {
                    const merged: UserProfile = {
                      ...prev,
                      ...cloudProfile,
                      lifetimePro: data.lifetimePro === true || (cloudProfile as any).lifetimePro === true,
                      // Never let a stale cloud snapshot erase a started trial.
                      // The clock is write-once; keeping the EARLIEST value
                      // also means it cannot be restarted by any sync order.
                      trialStartedAt:
                        [
                          data.trialStartedAt,
                          (cloudProfile as any).trialStartedAt,
                          prev.trialStartedAt,
                        ]
                          .filter(Boolean)
                          .sort()[0],
                      isProUser: resolveEntitlement({
                        ...cloudProfile,
                        lifetimePro: data.lifetimePro === true || (cloudProfile as any).lifetimePro === true,
                        trialStartedAt:
                          [
                            data.trialStartedAt,
                            (cloudProfile as any).trialStartedAt,
                            prev.trialStartedAt,
                          ]
                            .filter(Boolean)
                            .sort()[0],
                        proPlanType: data.proPlanType || (cloudProfile as any).proPlanType,
                        proExpiresAt: data.proExpiresAt || (cloudProfile as any).proExpiresAt,
                        isProUser: data.isProUser === true,
                      }).isPro,
                    };

                    // The live listener applies the cloud copy directly, so a
                    // stale inflated streak would come straight back after the
                    // local repair. Recompute from the daily logs, which are
                    // the actual record.
                    merged.streakDays = countConsecutiveCompletedDays(merged);

                    // A profile arriving from the cloud may have been written
                    // yesterday. Roll it forward before it reaches the UI.
                    const rolled = applyStreakReset(applyDayRollover(merged));

                    saveProfile(rolled);
                    return rolled;
                  });
                }
              }
            },
            (error) => {
              console.warn('Profile snapshot listener notice:', error.message || error);
            }
          );
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Sync soundFx toggle state
  useEffect(() => {
    soundFx.setEnabled(profile.soundEnabled);
  }, [profile.soundEnabled]);

  // Save profile helper
  const updateAndSyncProfile = useCallback((newProfile: UserProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile);
    if (currentUser && hydratedRef.current) {
      syncProfileToCloud(newProfile, currentUser);
    }
  }, [currentUser]);

  /**
   * Reconcile entitlement with the server.
   *
   * Existing users may already be in the broken state: a trial recorded only
   * on their device, never written to the database. Asking the server once per
   * sign-in repairs those accounts without anyone having to contact support.
   */
  useEffect(() => {
    if (!currentUser || !isHydrated) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;

        const res = await fetch('/api/entitlement', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const server = await res.json();

        setProfile((prev) => {
          // The device believes it has a trial the server has no record of —
          // claim it properly so the two agree from now on.
          if (prev.trialStartedAt && !server.trialStartedAt && server.status === 'free') {
            fetch('/api/trial/start', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
            return prev;
          }

          // Otherwise the server is authoritative.
          if (prev.isProUser === server.isPro) return prev;
          const next = { ...prev, isProUser: server.isPro };
          saveProfile(next);
          return next;
        });
      } catch {
        /* offline — the local copy stands until next sign-in */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isHydrated]);


  const handleSignOut = async () => {
    await logoutUser();

    // Clear cached data and in-memory state together. Leaving either behind
    // meant the next sign-in flashed the previous user's name and streak.
    setActiveUser(null);
    setProfile(createInitialProfile());
    setCurrentUser(null);
    setIsGuestMode(false);

    localStorage.removeItem('elitebrain_guest');
    setIsSignOutModalOpen(false);
    soundFx.playClick();
  };

  const handleLaunchModule = (id: ModuleId) => {
    const meta = MODULE_METADATA.find((m) => m.id === id);
    if (meta?.isPro && !profile.isProUser) {
      soundFx.playClick();
      setIsProModalOpen(true);
      return;
    }
    soundFx.playClick();
    setActiveModuleId(id);
  };

  const handleFinishModule = (res: {
    score: number;
    accuracy: number;
    details: { label: string; value: string | number }[];
  }) => {
    if (!activeModuleId) return;

    const result = processModuleResult(
      profile,
      activeModuleId,
      res.score,
      res.accuracy,
      res.details
    );

    const updated = loadProfile();
    updateAndSyncProfile(updated);
    setActiveModuleId(null);
    setLastResult(result);

    if (result.newlyUnlockedAchievements && result.newlyUnlockedAchievements.length > 0) {
      setUnlockedAchievementIds(result.newlyUnlockedAchievements);
    }
  };

  const handleToggleSound = () => {
    const updated = { ...profile, soundEnabled: !profile.soundEnabled };
    soundFx.setEnabled(updated.soundEnabled);
    updateAndSyncProfile(updated);
  };

  const handleCompleteOnboarding = (
    baselineScore: number,
    goalSettings?: { focusGoal: string; dailyMinutes: number }
  ) => {
    localStorage.setItem('elitebrain_onboarded', 'true');
    setIsOnboardingOpen(false);
    const updated = {
      ...profile,
      ...(goalSettings
        ? { focusGoal: goalSettings.focusGoal, dailyMinutes: goalSettings.dailyMinutes }
        : {}),
    };
    updateAndSyncProfile(updated);

    // Take the user straight to the first useful action for the goal they chose,
    // rather than always launching the same module.
    const goal = goalById(goalSettings?.focusGoal);
    if (goal && goal.firstAction.kind === 'module') {
      handleLaunchModule(goal.firstAction.moduleId);
    } else if (!goal) {
      handleLaunchModule('digit-span');
    }
    // 'hub' goals land on the dashboard, where the Hub tab is one tap away.
  };

  return (
    <XpProvider>
    <div className="min-h-screen bg-ground text-ink font-sans selection:bg-signal selection:text-white transition-colors duration-150 relative">
      <AnimatePresence>
        {(showSplash || !authResolved) && (
          <SplashScreen onFinish={() => setShowSplash(false)} />
        )}
      </AnimatePresence>
      <div className="paper-tooth" />

      {/* Primary Header Bar */}
      <Header
        profile={profile}
        isHydrated={!currentUser || isHydrated}
        currentUser={currentUser}
        onToggleSound={handleToggleSound}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSignOutModal={() => setIsSignOutModalOpen(true)}
        onOpenAICoach={() => setIsAICoachOpen(true)}
        onOpenProModal={() => setIsProModalOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        onOpenMethodsModal={() => setIsMethodsOpen(true)}
        onOpenNotifications={() => setIsNotifOpen(true)}
        onOpenBadgesGallery={() => setIsBadgesGalleryOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isColorblind={isColorblind}
        onToggleColorblind={() => setIsColorblind(!isColorblind)}
        onProfileUpdate={updateAndSyncProfile}
      />

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Dashboard
          profile={profile}
          isHydrated={!currentUser || isHydrated}
          currentUser={currentUser}
          onLaunchModule={handleLaunchModule}
          onOpenProModal={() => setIsProModalOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenBadgesGallery={() => setIsBadgesGalleryOpen(true)}
          onProfileUpdate={updateAndSyncProfile}
        />
      </main>

      {/* Active Game Modules Overlays */}
      {activeModuleId === 'digit-span' && (
        <DigitSpanModule
          currentLevel={profile.modules['digit-span']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'stroop' && (
        <StroopModule
          currentLevel={profile.modules['stroop']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'n-back' && (
        <SpatialNBackModule
          currentLevel={profile.modules['n-back']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'stillness' && (
        <StillnessModule
          currentLevel={profile.modules['stillness']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'pattern-matrix' && (
        <PatternMatrixModule
          currentLevel={profile.modules['pattern-matrix']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'cognitive-shift' && (
        <CognitiveShiftModule
          currentLevel={profile.modules['cognitive-shift']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'visuospatial' && (
        <VisuospatialModule
          currentLevel={profile.modules['visuospatial']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'reaction-inhibitor' && (
        <ReactionInhibitorModule
          currentLevel={profile.modules['reaction-inhibitor']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {activeModuleId === 'mental-math' && (
        <MentalMathModule
          currentLevel={profile.modules['mental-math']?.level || 1}
          onFinishSession={handleFinishModule}
          onClose={() => setActiveModuleId(null)}
        />
      )}

      {/* Post Session Summary Modal */}
      {lastResult && (
        <SummaryModal result={lastResult} onClose={() => setLastResult(null)} />
      )}

      {/* Protocol Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          profile={profile}
          currentUser={currentUser}
          onUpdateProfile={updateAndSyncProfile}
          onClose={() => setIsSettingsOpen(false)}
          onReplayOnboarding={() => setIsOnboardingOpen(true)}
        />
      )}

      {/* Scientific Methodology Modal */}
      <MethodsModal isOpen={isMethodsOpen} onClose={() => setIsMethodsOpen(false)} />

      {/* Mandatory / Interactive Full-Screen Sign-In Gate */}
      {authResolved && ((!currentUser && !isGuestMode) || isAuthModalOpen) && (
        <SignInScreen
          onSignInSuccess={(user) => {
            if (user) {
              setCurrentUser(user);
            }
            setIsGuestMode(true);
            setIsAuthModalOpen(false);
          }}
          onContinueAsGuest={() => {
            setIsGuestMode(true);
            localStorage.setItem('elitebrain_guest', 'true');
            setIsAuthModalOpen(false);
          }}
        />
      )}

      {/* Sign Out Confirm Modal */}
      <SignOutConfirmModal
        isOpen={isSignOutModalOpen}
        user={currentUser}
        profile={profile}
        onUpdateProfile={updateAndSyncProfile}
        onClose={() => setIsSignOutModalOpen(false)}
        onConfirmSignOut={handleSignOut}
      />

      {/* AI Cognitive Coach Modal */}
      <AICoachModal
        isOpen={isAICoachOpen}
        profile={profile}
        onClose={() => setIsAICoachOpen(false)}
        onOpenProModal={() => {
          setIsAICoachOpen(false);
          setIsProModalOpen(true);
        }}
      />

      {/* Pro Subscription Modal */}
      {showFirstRun && currentUser && (
        <WelcomeScreen
          suggested={profile.displayName || currentUser.displayName || undefined}
          onDone={(name) => {
            const updated = { ...profile, displayName: name };
            setProfile(updated);
            saveProfile(updated);
            if (currentUser) syncProfileToCloud(updated, currentUser).catch(() => {});

            try {
              localStorage.setItem(`elitebrain_firstrun_v1:${currentUser.uid}`, 'done');
              localStorage.setItem('elitebrain_onboarded', 'true');
            } catch {
              /* private mode — the screen may reappear, which is harmless */
            }
            setShowFirstRun(false);
          }}
        />
      )}

      <UpdateBanner />

      <div className="eb-ambient" aria-hidden="true" />

      <ScrollProgress />

      <NotificationSettings isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      <ProSubscriptionModal
        isOpen={isProModalOpen}
        currentUser={currentUser}
        profile={profile}
        onClose={() => setIsProModalOpen(false)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onRefreshProfile={() => setProfile(loadProfile())}
      />

      {/* Admin Verification Portal Modal */}
      <AdminPortalModal
        isOpen={isAdminPortalOpen}
        currentUser={currentUser}
        profile={profile}
        onClose={() => setIsAdminPortalOpen(false)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onRefreshProfile={async () => {
          if (currentUser) {
            const cloudProf = await fetchProfileFromCloud(currentUser.uid);
            if (cloudProf) {
              setProfile(cloudProf);
              const rolledCloud = applyStreakReset(applyDayRollover(cloudProf));
          saveProfile(rolledCloud);
            }
          }
        }}
      />

      {/* Celebratory Achievement Unlocked Modal */}
      {unlockedAchievementIds.length > 0 && (
        <AchievementUnlockedModal
          unlockedIds={unlockedAchievementIds}
          onClose={() => setUnlockedAchievementIds([])}
        />
      )}

      {/* Badges & Rewards Gallery Modal */}
      <AchievementsGalleryModal
        isOpen={isBadgesGalleryOpen}
        profile={profile}
        onClose={() => setIsBadgesGalleryOpen(false)}
      />
    </div>
    </XpProvider>
  );
}
