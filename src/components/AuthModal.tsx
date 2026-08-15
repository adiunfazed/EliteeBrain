import React, { useState } from 'react';
import {
  auth,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPasswordForEmail,
} from '../lib/firebase';
import { soundFx } from '../utils/audio';
import {
  Cloud,
  X,
  Mail,
  Lock,
  User as UserIcon,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Award,
  Loader2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [emailMode, setEmailMode] = useState<'signin' | 'signup' | 'reset'>('signup');

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleClick = async () => {
    soundFx.playClick();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await signInWithGoogle();
      soundFx.playSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Google Auth notice:', err);
      let message = err.message || 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-closed-by-user' || message.includes('cancelled')) {
        message = 'Sign in was cancelled.';
      } else {
        message = 'Unable to connect to Google Auth in this view. Please try Email Login or Guest Mode.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (emailMode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your name.');
        }
        await signUpWithEmail(email, password, name);
        soundFx.playSuccess();
        setSuccessMsg('Account created successfully!');
        setTimeout(() => onClose(), 600);
      } else if (emailMode === 'signin') {
        await signInWithEmail(email, password);
        soundFx.playSuccess();
        setSuccessMsg('Signed in successfully!');
        setTimeout(() => onClose(), 600);
      } else if (emailMode === 'reset') {
        if (!email.trim()) {
          throw new Error('Please enter your email address.');
        }
        await resetPasswordForEmail(email);
        soundFx.playSuccess();
        setSuccessMsg('Password reset link sent to your email.');
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      let msg = err.message || 'Authentication failed.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Try signing in.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (msg.includes('internal-error')) {
        msg = 'Network timeout. Please click "Continue as Guest" or try again.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#171B22] border border-[#2A313C] rounded-3xl p-6 md:p-8 shadow-2xl my-auto text-center">
        {/* Close Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 text-[#98A2B3] hover:text-[#F4F6F8] p-2 rounded-xl bg-[#0E1116] border border-[#2A313C] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] shadow-lg">
          <Cloud className="w-7 h-7" />
        </div>

        <h2 className="text-xl md:text-2xl font-black text-[#F4F6F8] mb-1">
          {emailMode === 'reset' ? 'Reset Account Password' : 'Sign In to EliteLife'}
        </h2>
        <p className="text-xs text-[#98A2B3] leading-relaxed mb-5">
          {emailMode === 'reset'
            ? 'Enter your registered email address to receive a secure password reset link.'
            : 'Sync your 30-day cognitive protocol, daily streak, and performance stats securely across all your devices.'}
        </p>

        {/* Method Switch Tabs */}
        <div className="flex rounded-xl bg-[#0E1116] p-1 border border-[#2A313C] mb-5">
          <button
            onClick={() => {
              soundFx.playClick();
              setAuthMethod('google');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMethod === 'google'
                ? 'bg-[#8B5CF6] text-white shadow-sm'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Google Sign-In
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setAuthMethod('email');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMethod === 'email'
                ? 'bg-[#8B5CF6] text-white shadow-sm'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            Email Login
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 mb-4 text-left flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-200 font-medium leading-tight">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 mb-4 text-left flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200 font-medium leading-tight">{successMsg}</p>
          </div>
        )}

        {authMethod === 'google' ? (
          <div>
            {/* Features List */}
            <div className="bg-[#0E1116] rounded-2xl border border-[#2A313C] p-3.5 mb-5 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#F4F6F8]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Instant 1-click Google authentication</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#F4F6F8]">
                <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                <span>Encrypted cloud profile storage via Firebase</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#F4F6F8]">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Seamless cross-device protocol sync</span>
              </div>
            </div>

            {/* Google Action Button */}
            <button
              disabled={loading}
              onClick={handleGoogleClick}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-[#F4F6F8] hover:bg-white text-slate-900 font-bold text-sm shadow-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" />
                  <span>Connecting Google Account...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                window.open(window.location.href, '_blank');
              }}
              className="w-full text-center text-xs font-semibold text-[#8B5CF6] hover:underline py-1.5 cursor-pointer underline-offset-4 mb-2"
            >
              Pop-up blocked? Open in New Tab for 1-Click Google Login ↗
            </button>
          </div>
        ) : (
          /* Email Form */
          <form onSubmit={handleEmailSubmit} className="space-y-3.5 text-left mb-4">
            {/* Email Mode Selector */}
            <div className="flex gap-2 mb-2 pb-2 border-b border-[#2A313C]">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setEmailMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                  emailMode === 'signup'
                    ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40'
                    : 'text-[#98A2B3] hover:text-[#F4F6F8]'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setEmailMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                  emailMode === 'signin'
                    ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40'
                    : 'text-[#98A2B3] hover:text-[#F4F6F8]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setEmailMode('reset');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                  emailMode === 'reset'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-[#98A2B3] hover:text-[#F4F6F8]'
                }`}
              >
                Forgot Password?
              </button>
            </div>

            {emailMode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-[#98A2B3] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0E1116] border border-[#2A313C] focus:border-[#8B5CF6] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F4F6F8] placeholder-[#98A2B3]/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-[#98A2B3] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0E1116] border border-[#2A313C] focus:border-[#8B5CF6] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F4F6F8] placeholder-[#98A2B3]/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {emailMode !== 'reset' && (
              <div>
                <label className="block text-[11px] font-bold text-[#98A2B3] uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0E1116] border border-[#2A313C] focus:border-[#8B5CF6] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F4F6F8] placeholder-[#98A2B3]/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing...</span>
                </>
              ) : emailMode === 'reset' ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send Password Reset Email</span>
                </>
              ) : (
                <>
                  <span>{emailMode === 'signup' ? 'Create Account & Sync' : 'Sign In with Email'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Secondary Guest Button */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-[#98A2B3] hover:text-[#F4F6F8] cursor-pointer transition-colors"
        >
          Continue as Guest (Offline Mode)
        </button>
      </div>
    </div>
  );
};
