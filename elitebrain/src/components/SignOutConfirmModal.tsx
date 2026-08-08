import React, { useState } from 'react';
import { updateUserProfileName, User } from '../lib/firebase';
import { soundFx } from '../utils/audio';
import { LogOut, CloudCheck, ShieldCheck, X, AlertTriangle, User as UserIcon, Check, Edit2 } from 'lucide-react';
import { UserProfile } from '../types';
import { saveProfile } from '../utils/storage';

interface Props {
  isOpen: boolean;
  user: User | null;
  profile?: UserProfile;
  onUpdateProfile?: (p: UserProfile) => void;
  onClose: () => void;
  onConfirmSignOut: () => void;
}

export const SignOutConfirmModal: React.FC<Props> = ({
  isOpen,
  user,
  profile,
  onUpdateProfile,
  onClose,
  onConfirmSignOut,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(
    profile?.displayName || user?.displayName || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !user) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) return;

    soundFx.playClick();
    setIsSaving(true);
    await updateUserProfileName(clean);

    if (profile && onUpdateProfile) {
      const updated = { ...profile, displayName: clean };
      saveProfile(updated);
      onUpdateProfile(updated);
    }

    setIsSaving(false);
    setIsEditing(false); // Hide input after saving!
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center">
        {/* Close Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-3 py-0.5 rounded-full bg-[#5C6CF2]/10 text-[#5C6CF2] border border-[#5C6CF2]/30 inline-block mb-3">
          ACCOUNT MANAGEMENT
        </span>

        {/* User Avatar & Info */}
        <div className="relative w-20 h-20 mx-auto mb-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-20 h-20 rounded-full border-2 border-[#5C6CF2] shadow-lg shadow-[#5C6CF2]/20 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#5C6CF2] text-white font-black text-2xl flex items-center justify-center border-2 border-[#5C6CF2]">
              {user.displayName ? user.displayName[0] : 'U'}
            </div>
          )}
          <span className="absolute bottom-0 right-0 p-1 bg-[#5C6CF2] text-white rounded-full shadow-md">
            <CloudCheck className="w-4 h-4" />
          </span>
        </div>

        <h3 className="text-xl font-black text-slate-100">
          {profile?.displayName || user.displayName || 'Google Account'}
        </h3>
        <p className="text-xs text-slate-400 font-mono mb-4">{user.email}</p>

        {/* Display Name Edit Form */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 mb-4 space-y-2 text-left">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 font-bold">
              <UserIcon className="w-3.5 h-3.5 text-[#5C6CF2]" />
              <span>Display Name</span>
            </span>
            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                  <Check className="w-3 h-3" />
                  <span>Saved!</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setIsEditing(!isEditing);
                }}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1"
              >
                <Edit2 className="w-2.5 h-2.5 text-[#5C6CF2]" />
                <span>{isEditing ? 'Cancel' : 'Edit Name'}</span>
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-[#5C6CF2]"
              />
              <button
                type="submit"
                disabled={isSaving || !nameInput.trim()}
                className="px-3.5 py-1.5 bg-[#5C6CF2] hover:bg-[#4B5BE0] text-white font-mono font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </form>
          ) : (
            <p className="text-xs font-mono text-slate-300 pl-1 font-bold truncate">
              {profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Elite Athlete'}
            </p>
          )}
        </div>

        {/* Status Box */}
        <div className="bg-slate-950/80 rounded-2xl border border-[#5C6CF2]/20 p-3.5 mb-5 text-left flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#5C6CF2] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-[#5C6CF2] block mb-0.5">Google Cloud Sync Active</span>
            <span className="text-slate-400">
              Your 30-day cognitive protocol progress is linked and backed up safely under this account.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#5C6CF2] hover:bg-[#4B5ACD] text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-[#5C6CF2]/20 transition-all active:scale-95"
          >
            Close Account Manager
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              onConfirmSignOut();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 font-bold text-xs cursor-pointer transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Google Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
