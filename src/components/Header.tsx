import React, { useState } from 'react';
import { UserProfile } from '../types';
import { soundFx } from '../utils/audio';
import { updateUserProfileName, User } from '../lib/firebase';
import { saveProfile } from '../utils/storage';
import { Volume2, VolumeX, Sun, Moon, Shield, LogIn, Eye, HelpCircle, Sparkles, Crown, Sliders, X, User as UserIcon, Trophy, Check, Edit2, Bell } from 'lucide-react';
import { EliteLifeLogo } from './EliteLifeLogo';
import { motion, AnimatePresence } from 'motion/react';
import { resolveEntitlement } from '../lib/entitlement';

interface Props {
  profile: UserProfile;
  currentUser: User | null;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal: () => void;
  onOpenSignOutModal: () => void;
  onOpenAICoach: () => void;
  onOpenProModal: () => void;
  onOpenAdminPortal: () => void;
  onOpenMethodsModal: () => void;
  onOpenNotifications?: () => void;
  onOpenBadgesGallery?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isColorblind: boolean;
  onToggleColorblind: () => void;
  onProfileUpdate?: (p: UserProfile) => void;
}

export const Header: React.FC<Props> = ({
  profile,
  currentUser,
  onToggleSound,
  onOpenAuthModal,
  onOpenSignOutModal,
  onOpenAICoach,
  onOpenProModal,
  onOpenAdminPortal,
  onOpenMethodsModal,
  onOpenNotifications,
  onOpenBadgesGallery,
  isDarkMode,
  onToggleDarkMode,
  isColorblind,
  onToggleColorblind,
  onProfileUpdate,
}) => {
  const ent = resolveEntitlement(profile);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(
    profile.displayName || currentUser?.displayName || ''
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase() === 'unfazed.adibiz@gmail.com';

  const handleSaveName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) return;

    soundFx.playClick();
    setIsSavingName(true);

    if (currentUser) {
      await updateUserProfileName(clean);
    }

    const updated = { ...profile, displayName: clean };
    saveProfile(updated);
    if (onProfileUpdate) onProfileUpdate(updated);

    setIsSavingName(false);
    setIsEditingName(false); // Hide the input form after saving!
    setNameSavedSuccess(true);
    setTimeout(() => setNameSavedSuccess(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0E1116]/95 backdrop-blur-xl border-b border-[#2A313C] px-2.5 sm:px-4 md:px-6 py-2 transition-all select-none shadow-md overflow-x-clip">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
        
        {/* BRAND LOGO & TITLE */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          <EliteLifeLogo size="sm" showSubtext={false} />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl font-mono font-black tracking-wider flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
              <span className="text-[#F4F6F8]">ELITE</span>
              <span className="text-[#A855F7]">LIFE</span>
            </h1>

            {/* Pro Badge or Get Pro Button (Desktop View) */}
            <div className="hidden md:block">
              {profile.isProUser ? (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onOpenProModal();
                  }}
                  title="View Active Subscription & Time Remaining"
                  className="text-[10px] font-mono font-bold text-[#A78BFA] px-2 py-0.5 bg-[#2A1B4B] hover:bg-[#3B2468] border border-[#8B5CF6]/40 rounded-full tracking-wide flex items-center gap-1 shrink-0 cursor-pointer transition-all active:scale-95"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>{ent.status === 'trial' ? `TRIAL · ${ent.trialDaysLeft}D` : 'PRO'}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onOpenProModal();
                  }}
                  className="text-[10px] font-mono font-bold text-amber-300 px-2 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-full transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs active:scale-95"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Get Pro</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* DESKTOP ACTIONS BAR (Visible on md and above) */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Science Methods Button */}
          <button
            onClick={() => {
              soundFx.playClick();
              onOpenMethodsModal();
            }}
            title="Scientific Methodology Citations"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171B22] hover:bg-[#212631] border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] text-xs font-mono rounded-xl transition-all cursor-pointer active:scale-95"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Science Methods</span>
          </button>

          {/* Badges & Rewards Button */}
          {onOpenBadgesGallery && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => {
                soundFx.playClick();
                onOpenBadgesGallery();
              }}
              title="Badges & Milestones Gallery"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Badges</span>
              <span className="px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/40 text-[10px] rounded-md text-amber-200">
                {Object.keys(profile.unlockedAchievements || {}).length}
              </span>
            </motion.button>
          )}

          <div className="h-4 w-[1px] bg-[#2A313C] mx-1" />

          {/* Colorblind Toggle */}
          <button
            onClick={() => {
              soundFx.playClick();
              onToggleColorblind();
            }}
            title={isColorblind ? 'Disable Colorblind Palette' : 'Enable Colorblind Palette'}
            className={`p-2 border rounded-xl transition-all cursor-pointer active:scale-95 ${
              isColorblind
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-sm'
                : 'bg-[#171B22] hover:bg-[#212631] border-[#2A313C] text-[#98A2B3]'
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => {
              soundFx.playClick();
              onToggleDarkMode();
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 bg-[#171B22] hover:bg-[#212631] border border-[#2A313C] text-[#F4F6F8] rounded-xl transition-all cursor-pointer active:scale-95"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Audio Synth Mute Toggle */}
          <button
            onClick={() => {
              soundFx.playClick();
              onToggleSound();
            }}
            title={profile.soundEnabled ? 'Mute Audio Synth' : 'Enable Audio Synth'}
            className="p-2 bg-[#171B22] hover:bg-[#212631] border border-[#2A313C] text-[#F4F6F8] rounded-xl transition-all cursor-pointer active:scale-95"
          >
            {profile.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#A78BFA]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#98A2B3]" />
            )}
          </button>

          {/* Admin Verification Portal Button */}
          {isAdmin && (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenAdminPortal();
              }}
              title="Admin Portal"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {/* User Sign In / Profile */}
          {currentUser ? (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenSignOutModal();
              }}
              className="flex items-center gap-2 bg-[#171B22] hover:bg-[#212631] border border-[#2A313C] px-3.5 py-1.5 rounded-xl font-mono text-xs text-[#F4F6F8] cursor-pointer transition-all active:scale-95 max-w-[140px]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold truncate">
                {profile.displayName?.split(' ')[0] || currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || 'User'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenAuthModal();
              }}
              className="flex items-center gap-1.5 bg-[#8B5CF6] hover:bg-[#4B5BE0] text-white font-mono text-xs font-bold px-3.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* MOBILE CONTROLS HEADER BAR (Visible on screens < md) */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:hidden shrink-0">
          {/* Mobile Pro Badge / Get Pro Pill */}
          {profile.isProUser ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                soundFx.playClick();
                onOpenProModal();
              }}
              title="View Active Subscription"
              className="text-[10px] font-mono font-bold text-[#A78BFA] px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#2A1B4B] hover:bg-[#3B2468] border border-[#8B5CF6]/40 rounded-lg sm:rounded-xl tracking-wide flex items-center gap-0.5 sm:gap-1 shrink-0 cursor-pointer transition-all"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>{ent.status === 'trial' ? `${ent.trialDaysLeft}D` : 'PRO'}</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                soundFx.playClick();
                onOpenProModal();
              }}
              className="text-[10px] font-mono font-bold text-amber-300 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg sm:rounded-xl transition-all flex items-center gap-0.5 sm:gap-1 cursor-pointer shrink-0 shadow-xs"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Get Pro</span>
            </motion.button>
          )}

          {/* Mobile Badges Quick Pill */}
          {onOpenBadgesGallery && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                soundFx.playClick();
                onOpenBadgesGallery();
              }}
              className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-mono font-bold rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>{Object.keys(profile.unlockedAchievements || {}).length}</span>
            </motion.button>
          )}

          {/* Mobile Admin Button for unfazed.adibiz@gmail.com */}
          {isAdmin && (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenAdminPortal();
              }}
              title="Admin Portal"
              className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] sm:text-xs font-mono font-bold rounded-lg sm:rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 shadow-sm"
            >
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Admin</span>
            </button>
          )}

          {/* Quick Tools & Options Menu Trigger */}
          <button
            onClick={() => {
              soundFx.playClick();
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            aria-label="Toggle Quick Controls Menu"
            className={`p-1 sm:p-1.5 border rounded-lg sm:rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0 ${
              isMobileMenuOpen
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                : 'bg-[#171B22] border-[#2A313C] text-[#F4F6F8]'
            }`}
          >
            {isMobileMenuOpen ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#A78BFA]" />}
          </button>
        </div>

      </div>

      {/* MOBILE EXPANDABLE QUICK CONTROLS MENU */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-[#2A313C]/80 mt-2.5 pt-3 pb-1"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Science Methods */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenMethodsModal();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono rounded-xl active:bg-[#212631]"
              >
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" />
                <span>Methods</span>
              </button>

              {/* Notifications */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenNotifications?.();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono rounded-xl active:bg-[#212631]"
              >
                <Bell className="w-4 h-4 text-[#A78BFA]" />
                <span>Alerts</span>
              </button>

              {/* Sound FX */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  onToggleSound();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono rounded-xl active:bg-[#212631]"
              >
                {profile.soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-[#A78BFA]" />
                    <span>Audio: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-[#98A2B3]" />
                    <span>Audio: MUTED</span>
                  </>
                )}
              </button>

              {/* Theme Mode */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  onToggleDarkMode();
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono rounded-xl active:bg-[#212631]"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Dark Theme</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-300" />
                    <span>Light Theme</span>
                  </>
                )}
              </button>

              {/* Colorblind Palette */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  onToggleColorblind();
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2 border text-xs font-mono rounded-xl ${
                  isColorblind
                    ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                    : 'bg-[#171B22] border-[#2A313C] text-[#F4F6F8]'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Colorblind</span>
              </button>

              {/* Admin Portal (Only visible to admin unfazed.adibiz@gmail.com) */}
              {isAdmin && (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onOpenAdminPortal();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 border text-xs font-mono rounded-xl font-bold transition-all cursor-pointer active:scale-95 bg-rose-600/20 text-rose-300 border-rose-500/50 hover:bg-rose-600/30"
                >
                  <Shield className="w-4 h-4 text-rose-400" />
                  <span>Admin Portal</span>
                </button>
              )}
            </div>

            {/* Account & Display Name Section (below Dark Theme & Colorblind) */}
            <div className="mt-3 pt-3 border-t border-[#2A313C]/60 space-y-2.5">
              {/* Account Display Name Card */}
              <div className="bg-[#171B22] border border-[#2A313C] p-2.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-[#98A2B3]">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <UserIcon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span>User Profile Name</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {nameSavedSuccess && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <Check className="w-3 h-3" />
                        <span>Saved!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsEditingName(!isEditingName);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-[#2A313C]/60 hover:bg-[#2A313C] text-slate-200 text-[10px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Edit2 className="w-2.5 h-2.5 text-[#A78BFA]" />
                      <span>{isEditingName ? 'Cancel' : 'Edit Name'}</span>
                    </button>
                  </div>
                </div>

                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Enter display name..."
                      maxLength={30}
                      className="flex-1 bg-[#0E1116] border border-[#2A313C] rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <button
                      type="submit"
                      disabled={isSavingName || !nameInput.trim()}
                      className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#4B5BE0] text-white font-mono text-xs font-bold rounded-xl cursor-pointer transition-all disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {isSavingName ? 'Saving...' : 'Save'}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs font-mono text-slate-200 font-bold pl-1 truncate">
                    {profile.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'there'}
                  </p>
                )}
              </div>

              {/* Account Sign In / Sign Out Button */}
              {currentUser ? (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onOpenSignOutModal();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#171B22] border border-[#2A313C] hover:bg-[#212631] px-3.5 py-2 rounded-xl font-mono text-xs text-[#F4F6F8] cursor-pointer transition-all active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-bold truncate">
                    Signed in as {profile.displayName || currentUser.displayName || currentUser.email?.split('@')[0]} (Sign Out)
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onOpenAuthModal();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#8B5CF6] text-white font-mono text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm active:bg-[#4B5BE0] cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In or Register Account</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

