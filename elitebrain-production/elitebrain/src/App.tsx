import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ModuleId, SessionResult } from './types';
import { loadProfile, saveProfile, processModuleResult, MODULE_METADATA, createInitialProfile, resetAdminProfile } from './utils/storage';
import { soundFx } from './utils/audio';
import { auth, db, onAuthStateChanged, logoutUser, User } from './lib/firebase';
import { syncProfileToCloud, fetchProfileFromCloud } from './lib/sync';
import { doc, onSnapshot } from 'firebase/firestore';

import { SignInScreen } from './components/SignInScreen';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { SummaryModal } from './components/SummaryModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { SignOutConfirmModal } from './components/SignOutConfirmModal';
import { AICoachModal } from './components/AICoachModal';
import { ProSubscriptionModal } from './components/ProSubscriptionModal';
import { AdminPortalModal } from './components/AdminPortalModal';
import { MethodsModal } from './components/MethodsModal';
import { OnboardingFlow } from './components/OnboardingFlow';
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

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return localStorage.getItem('elitebrain_guest') === 'true';
  });
  
  // App Splash Screen State
  const [showSplash, setShowSplash] = useState(true);

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

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        setIsAuthModalOpen(false);

        const isAdminUser = user.email?.toLowerCase() === 'unfazed.adibiz@gmail.com';

        // Fetch initial profile
        const cloudProf = await fetchProfileFromCloud(user.uid);
        
        if (isAdminUser) {
          const zeroAdminProf = resetAdminProfile(cloudProf || undefined);
          setProfile(zeroAdminProf);
          await syncProfileToCloud(zeroAdminProf, user);
        } else if (cloudProf) {
          setProfile(cloudProf);
          saveProfile(cloudProf);
        } else {
          const newProf = createInitialProfile();
          newProf.isProUser = false;
          setProfile(newProf);
          saveProfile(newProf);
          await syncProfileToCloud(newProf, user);
        }

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
                      isProUser: data.isProUser === true,
                    };
                    saveProfile(merged);
                    return merged;
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
    if (currentUser) {
      syncProfileToCloud(newProfile, currentUser);
    }
  }, [currentUser]);

  const handleSignOut = async () => {
    await logoutUser();
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

    // Launch Day 1 initial recommended exercise
    handleLaunchModule('digit-span');
  };

  return (
    <div className="min-h-screen bg-ground text-ink font-sans selection:bg-signal selection:text-white transition-colors duration-150 relative">
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      </AnimatePresence>
      <div className="paper-tooth" />
      {/* 90s Baseline Calibration Onboarding Flow */}
      {isOnboardingOpen && (
        <OnboardingFlow
          onCompleteOnboarding={handleCompleteOnboarding}
          onSkipOnboarding={() => {
            localStorage.setItem('elitebrain_onboarded', 'true');
            setIsOnboardingOpen(false);
          }}
        />
      )}

      {/* Primary Header Bar */}
      <Header
        profile={profile}
        currentUser={currentUser}
        onToggleSound={handleToggleSound}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSignOutModal={() => setIsSignOutModalOpen(true)}
        onOpenAICoach={() => setIsAICoachOpen(true)}
        onOpenProModal={() => setIsProModalOpen(true)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        onOpenMethodsModal={() => setIsMethodsOpen(true)}
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
      {((!currentUser && !isGuestMode) || isAuthModalOpen) && (
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
      <ProSubscriptionModal
        isOpen={isProModalOpen}
        currentUser={currentUser}
        profile={profile}
        onClose={() => setIsProModalOpen(false)}
        onOpenAdminPortal={() => setIsAdminPortalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
              saveProfile(cloudProf);
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
  );
}
