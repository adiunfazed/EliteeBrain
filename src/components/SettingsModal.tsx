import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveProfile } from '../utils/storage';
import { soundFx } from '../utils/audio';
import { updateUserProfileName, User } from '../lib/firebase';
import { X, Volume2, VolumeX, ShieldCheck, CloudCheck, Sparkles, RotateCcw, User as UserIcon, Check } from 'lucide-react';

interface Props {
  profile: UserProfile;
  currentUser?: User | null;
  onUpdateProfile: (p: UserProfile) => void;
  onClose: () => void;
  onReplayOnboarding?: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  profile,
  currentUser,
  onUpdateProfile,
  onClose,
  onReplayOnboarding,
}) => {
  const [nameInput, setNameInput] = useState(
    profile.displayName || currentUser?.displayName || ''
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  const handleSaveName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) return;

    soundFx.playClick();
    setIsSavingName(true);

    if (currentUser) {
      await updateUserProfileName(cleanName);
    }

    const updated = { ...profile, displayName: cleanName };
    saveProfile(updated);
    onUpdateProfile(updated);

    setIsSavingName(false);
    setNameSavedSuccess(true);
    setTimeout(() => setNameSavedSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-lg font-bold text-slate-100">Protocol & Account Settings</h3>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          
          {/* Edit Athlete Name Section */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#8B5CF6]" />
                <span className="font-bold text-slate-200">Athlete Display Name</span>
              </div>
              {currentUser && (
                <span className="text-[10px] font-mono eb-done bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Synced to Account
                </span>
              )}
            </div>

            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={isSavingName || !nameInput.trim()}
                className="px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#4B5BE0] text-white font-mono font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSavingName ? 'Saving...' : 'Save'}
              </button>
            </form>

            {nameSavedSuccess && (
              <div className="flex items-center gap-1.5 text-[11px] eb-done font-mono animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Name updated & synced across all your devices!</span>
              </div>
            )}
          </div>

          {/* Audio Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-3">
              {profile.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-[#8B5CF6]" />
              ) : (
                <VolumeX className="w-5 h-5 text-slate-500" />
              )}
              <div>
                <span className="block font-bold text-slate-200">Synthesizer Audio</span>
                <span className="text-[10px] text-slate-400">Web Audio chimes and response cues</span>
              </div>
            </div>
            <button
              onClick={() => {
                const updated = { ...profile, soundEnabled: !profile.soundEnabled };
                soundFx.setEnabled(updated.soundEnabled);
                saveProfile(updated);
                onUpdateProfile(updated);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                profile.soundEnabled
                  ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {profile.soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          {/* Replay Onboarding Guide */}
          {onReplayOnboarding && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 eb-warn" />
                <div>
                  <span className="block font-bold text-slate-200">Onboarding Sequence</span>
                  <span className="text-[10px] text-slate-400">Replay 5-step Protocol Tour & Core Concepts</span>
                </div>
              </div>
              <button
                onClick={() => {
                  soundFx.playClick();
                  onClose();
                  onReplayOnboarding();
                }}
                className="px-3 py-1.5 rounded-xl font-mono font-bold bg-amber-500/15 hover:bg-amber-500/25 eb-warn border border-amber-500/30 cursor-pointer transition-all flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay</span>
              </button>
            </div>
          )}

          {/* Cloud Synchronization Status */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CloudCheck className="w-5 h-5 eb-done shrink-0" />
              <div>
                <span className="block font-bold text-slate-200">Cloud Persistence</span>
                <span className="text-[10px] text-slate-400">
                  {currentUser ? `Synced to ${currentUser.email}` : 'Firebase Firestore cloud sync active'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 eb-done border border-emerald-500/40">
              ACTIVE
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

