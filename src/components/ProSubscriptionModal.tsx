import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { soundFx } from '../utils/audio';
import { X, Check, Crown, ArrowRight, QrCode, Clock, Zap, Smartphone, RefreshCw, Shield, MessageCircle, Gift } from 'lucide-react';
import { getIdToken, User, createPaymentRequest, getAdminMerchantUpiId } from '../lib/firebase';
import { syncProfileToCloud, fetchProfileFromCloud } from '../lib/sync';
import { saveProfile } from '../utils/storage';
import { hasUsedTrial, LIFETIME_PRICE_INR, resolveEntitlement, entitlementLabel, startTrialFields } from '../lib/entitlement';

interface Props {
  isOpen: boolean;
  currentUser: User | null;
  profile: UserProfile;
  onClose: () => void;
  onOpenAdminPortal?: () => void;
  onOpenAuthModal?: () => void;
  /** Pull the fresh profile after the trial is started. */
  onRefreshProfile?: () => void;
}

export type PlanId = 'lifetime';

export interface PlanDetails {
  id: PlanId;
  name: string;
  priceINR: number;
  durationLabel: string;
  savingsLabel?: string;
  description: string;
  badge?: string;
  color: string;
}

export const PLAN_CONFIGS: Record<PlanId, PlanDetails> = {
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime Pro',
    priceINR: LIFETIME_PRICE_INR,
    durationLabel: 'One payment. Yours permanently.',
    description: 'Every training module, the AI Coach, full progress history and cloud sync — with no renewal.',
    color: 'amber',
  },
};

export function getTimeRemainingText(proExpiresAt?: string, proPlanType?: string) {
  if (proPlanType === 'lifetime' || (proExpiresAt && new Date(proExpiresAt).getFullYear() > 2090)) {
    return { label: 'Unlimited Lifetime Access', daysLeft: null, isExpired: false, isLifetime: true };
  }

  if (!proExpiresAt) {
    return { label: 'No Active Subscription', daysLeft: 0, isExpired: true, isLifetime: false };
  }

  const expTime = new Date(proExpiresAt).getTime();
  const now = Date.now();
  const diffMs = expTime - now;

  if (diffMs <= 0) {
    return { label: 'Subscription Expired', daysLeft: 0, isExpired: true, isLifetime: false };
  }

  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (daysLeft > 0) {
    return { label: `${daysLeft} Day${daysLeft > 1 ? 's' : ''} ${hoursLeft}h Remaining`, daysLeft, isExpired: false, isLifetime: false };
  }

  return { label: `${hoursLeft} Hour${hoursLeft > 1 ? 's' : ''} Remaining`, daysLeft: 0, isExpired: false, isLifetime: false };
}

export const ProSubscriptionModal: React.FC<Props> = ({
  isOpen,
  currentUser,
  profile,
  onClose,
  onOpenAdminPortal,
  onRefreshProfile,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('lifetime');
  const [merchantUpiId, setMerchantUpiId] = useState('unfazed.adibiz@okicici');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAdminMerchantUpiId().then((id) => {
        if (id) setMerchantUpiId(id);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlan = PLAN_CONFIGS[selectedPlan];
  const ent = resolveEntitlement(profile);
  const timeInfo = getTimeRemainingText(profile.proExpiresAt, profile.proPlanType);

  const upiIntentUrl = `upi://pay?pa=${merchantUpiId}&pn=EliteLife&am=${currentPlan.priceINR}&cu=INR`;

  const WHATSAPP_NUMBER = '917986568659';

  /**
   * Start the one-month trial. The timestamp is written once and guarded by the
   * Firestore rules, so a user cannot restart it by clearing storage, signing
   * out, or editing anything in the browser.
   */
  const handleStartTrial = async () => {
    if (loading) return;

    // The button is only rendered for status 'free', but guard anyway: a stale
    // trialStartedAt used to make this return silently, so the button looked
    // broken rather than explaining itself.
    if (ent.status === 'trial') {
      setSuccessMsg('Your trial is already running.');
      return;
    }
    if (ent.status === 'expired' || hasUsedTrial(profile)) {
      alert('Your free month has already been used on this account.');
      return;
    }

    soundFx.playClick();
    setLoading(true);
    try {
      // The SERVER starts the trial, not the browser. A locally-written trial
      // that failed to sync left the device showing Pro while the database
      // said free — which is exactly why the coach refused some users.
      const token = await getIdToken();
      if (!token) throw new Error('Please sign in again.');

      const res = await fetch('/api/trial/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result?.error || 'Could not start your trial.');

      if (result.alreadyUsed && !result.isPro) {
        alert('Your free month has already been used on this account.');
        return;
      }

      // Mirror the server's answer locally so the UI updates immediately.
      const updated: UserProfile = {
        ...profile,
        trialStartedAt: result.trialStartedAt || profile.trialStartedAt,
        trialEverStarted: true,
        isProUser: result.isPro,
      };
      saveProfile(updated);

      soundFx.playSuccess();
      setSuccessMsg('Trial started. You have full Pro access for 30 days.');
      onRefreshProfile?.();
    } catch (err) {
      console.error('Could not start trial:', err);
      alert('Could not start your trial. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Payment confirmation now goes through WhatsApp with a screenshot instead of
   * a typed UTR. A UTR is just a number someone can invent; a screenshot sent
   * to a chat the owner reads is both easier for the user and harder to fake.
   */
  const handleWhatsAppConfirm = async () => {
    soundFx.playClick();
    setLoading(true);

    const submittedAt = new Date().toISOString();
    const targetEmail = currentUser?.email || 'guest@elitelife.app';
    const targetName = currentUser?.displayName || 'there';

    try {
      profile.pendingPayment = {
        utrNumber: 'WHATSAPP',
        plan: selectedPlan,
        amountINR: currentPlan.priceINR,
        submittedAt,
      };
      saveProfile(profile);

      await createPaymentRequest({
        userId: currentUser ? currentUser.uid : `guest_${Date.now()}`,
        userEmail: targetEmail,
        userName: targetName,
        plan: selectedPlan,
        amountINR: currentPlan.priceINR,
        utrNumber: 'WHATSAPP',
      });

      if (currentUser) await syncProfileToCloud(profile, currentUser);
    } catch (err) {
      // The request log is a convenience for the admin; never block the user
      // from reaching WhatsApp because a background write failed.
      console.error('Could not log payment request:', err);
    } finally {
      setLoading(false);
    }

    const message = encodeURIComponent(
      `Hi! I've paid ₹${currentPlan.priceINR} for Elite Life Lifetime Pro.\n\n` +
        `Account: ${targetEmail}\nName: ${targetName}\n\n` +
        `Screenshot of the payment is attached.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank', 'noopener');

    soundFx.playSuccess();
    setSuccessMsg(
      'WhatsApp opened. Send your payment screenshot and your Pro access will be activated shortly.'
    );
  };

  const handleCheckStatus = async () => {
    soundFx.playClick();
    setCheckingStatus(true);
    try {
      if (currentUser) {
        const cloudProfile = await fetchProfileFromCloud(currentUser.uid);
        if (cloudProfile && cloudProfile.isProUser) {
          soundFx.playLevelUp();
          saveProfile(cloudProfile);
          // Mutate local prop object
          Object.assign(profile, cloudProfile);
          alert('🎉 Payment Verified & Approved! Pro status is now active on your account.');
          onClose();
          return;
        }
      }
      setTimeout(() => {
        setCheckingStatus(false);
        alert('Your payment is being reviewed. Access is activated once it is confirmed.');
      }, 800);
    } catch (e) {
      setCheckingStatus(false);
    }
  };

  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    upiIntentUrl
  )}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md select-none overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl p-5 md:p-7 shadow-2xl shadow-amber-500/10 font-sans my-auto text-slate-100"
        >
          {/* Close Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors shadow-sm"
          >
            <X className="w-4 h-4 shrink-0" />
          </motion.button>

        {/* Pro Header Badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold eb-warn uppercase tracking-widest">
            ELITELIFE PRO
          </span>
          <span className="text-[10px] font-mono font-bold eb-warn px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
            <Crown className="w-3 h-3 shrink-0 eb-warn" /> UNLOCK ALL 8 MODULES
          </span>
        </div>

        <h2 className="text-xl md:text-2xl font-black text-slate-100">
          Select Your Subscription Plan
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          One payment. No subscription, no renewal.
        </p>

        {/* PENDING VERIFICATION CARD (If payment is waiting in queue) */}
        {profile.pendingPayment && !profile.isProUser && (
          <div className="mt-3.5 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 eb-warn animate-pulse" />
                <span className="text-xs font-mono font-bold text-amber-200 uppercase tracking-wider">
                  Payment Submitted: Verification Queue
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold eb-warn px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
                ⏳ UNDER REVIEW
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Awaiting confirmation · Plan: <strong className="text-slate-100">{PLAN_CONFIGS[profile.pendingPayment.plan as PlanId]?.name || 'Pro access'} (₹{profile.pendingPayment.amountINR})</strong>
            </p>

            <p className="text-[11px] text-slate-400 font-mono">
              Your payment is being verified. Pro access activates automatically once it is confirmed.
            </p>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 eb-warn font-mono text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>{checkingStatus ? 'Checking Cloud...' : 'Check Approval Status'}</span>
              </button>

              {currentUser?.email === 'unfazed.adibiz@gmail.com' && onOpenAdminPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminPortal();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>Open Admin Queue →</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE SUBSCRIPTION CARD (If user is already Pro) */}
        {profile.isProUser && (
          <div className="mt-3.5 p-4 rounded-2xl bg-indigo-950/70 border border-indigo-500/50 shadow-inner space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 shrink-0 eb-warn animate-pulse" />
                <span className="text-xs font-mono font-bold text-indigo-200 uppercase tracking-wider">
                  Active Subscription: {profile.proPlanType?.toUpperCase() || 'PRO USER'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold eb-done px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
                <Zap className="w-3 h-3 shrink-0 eb-done" /> ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-indigo-500/20">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Clock className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>Time Remaining:</span>
              </div>
              <span className="text-xs font-mono font-black eb-warn">
                {timeInfo.label}
              </span>
            </div>

            {profile.proAmountPaid && (
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between px-1">
                <span>Amount Paid: <strong>₹{profile.proAmountPaid} ONLY</strong></span>
                {profile.proUtrNumber && (
                  <span>UTR Ref: <strong className="text-slate-300">{profile.proUtrNumber}</strong></span>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TRIAL BANNER: first thing the user sees --- */}
        {ent.status === 'free' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleStartTrial}
            disabled={loading}
            className="eb-glow-green eb-marquee w-full mt-4 p-4 rounded-2xl bg-[#00C97A] hover:brightness-110 disabled:opacity-50 text-[#04231A] text-left"
          >
            <span className="flex items-center gap-2 text-sm font-black font-mono uppercase tracking-wide">
              <Gift className="w-4 h-4 shrink-0" />
              Get 1 month free trial
            </span>
            <span className="block text-[11px] font-medium mt-1 opacity-80">
              Full Pro access for 30 days. No card, no charge.
            </span>
          </motion.button>
        )}

        {ent.status === 'trial' && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-black font-mono eb-done uppercase tracking-wide">
                Free trial active
              </span>
              <span className="text-lg font-black font-mono eb-done tabular-nums">
                {ent.trialDaysLeft}
                <span className="text-[10px] ml-1">
                  day{ent.trialDaysLeft === 1 ? '' : 's'} left
                </span>
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full bg-emerald-950/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400 rounded-full"
                initial={false}
                animate={{ width: `${Math.max(3, (ent.trialDaysLeft / 30) * 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
              Everything unlocks again permanently with one payment below.
            </p>
          </div>
        )}

        {ent.status === 'lifetime' && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
            <Crown className="w-6 h-6 shrink-0 eb-warn mx-auto" />
            <p className="text-sm font-black font-mono eb-warn mt-2 uppercase tracking-wide">
              Lifetime Pro active
            </p>
            <p className="text-[11px] text-slate-300 mt-1">
              Everything is unlocked, permanently. Nothing more to pay.
            </p>
          </div>
        )}

        {/* TRIAL + SINGLE LIFETIME TIER */}
        {ent.status === 'trial' && (
          <div className="my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm font-bold eb-done font-mono">
              Your free trial is active
            </p>
            <p className="text-[11px] text-slate-300 mt-1 font-sans leading-relaxed">
              {ent.trialDaysLeft} day{ent.trialDaysLeft === 1 ? '' : 's'} left of full Pro access.
              Keep it permanently below — no renewal, no subscription.
            </p>
          </div>
        )}

        {ent.status === 'expired' && (
          <div className="my-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm font-bold eb-warn font-mono">Your free month has ended</p>
            <p className="text-[11px] text-slate-300 mt-1 font-sans leading-relaxed">
              Your progress and records are safe. Unlock everything again with a single payment.
            </p>
          </div>
        )}

        {ent.status !== 'lifetime' && (
        <div className="my-4 p-5 rounded-2xl bg-slate-950 border border-amber-500/40 ring-1 ring-amber-500/20">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-black font-mono eb-warn">
              ₹{LIFETIME_PRICE_INR}
            </span>
            <span className="text-xs font-mono text-slate-400">one time</span>
          </div>
          <p className="text-sm font-bold text-slate-100 font-mono mt-1">
            {PLAN_CONFIGS.lifetime.durationLabel}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 font-sans leading-relaxed">
            {PLAN_CONFIGS.lifetime.description}
          </p>

          <ul className="mt-3 space-y-1.5">
            {[
              'Every cognitive training module',
              'AI Coach, unlimited',
              'Full progress history and personal records',
              'Cloud sync across your devices',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] text-slate-300 font-sans">
                <Check className="w-3.5 h-3.5 eb-done shrink-0 mt-0.5 stroke-[3]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        )}

        {/* Payment is only shown to people who can actually benefit from it —
            trial and free users. Lifetime holders have nothing left to buy. */}
        {ent.status !== 'lifetime' && (
        <>
        {/* UPI APP DIRECT PAY & QR CODE CONTAINER */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-4 text-center space-y-3 shadow-inner">
          
          <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-mono font-semibold tracking-wide">
            <Smartphone className="w-4 h-4 shrink-0 eb-done" />
            <span>Pay with UPI</span>
          </div>

          {/* SINGLE REALISTIC PAY USING UPI BUTTON WITH MOTION */}
          <div className="max-w-md mx-auto">
            <motion.a
              href={upiIntentUrl}
              whileHover={{ scale: 1.025, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => soundFx.playClick()}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-sm font-bold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 touch-manipulation shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/30 border border-emerald-400/40 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Smartphone className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>PAY USING UPI</span>
              <ArrowRight className="w-4 h-4 text-emerald-200 ml-auto shrink-0 group-hover:translate-x-1 transition-transform" />
            </motion.a>
            <p className="text-[10px] font-sans text-slate-400 mt-1.5 flex items-center justify-center gap-1.5">
              <Shield className="w-3 h-3 shrink-0 eb-done" />
              <span>Opens GPay, PhonePe, Paytm or any UPI app</span>
            </p>
          </div>

          {/* OR Scan QR Code */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-mono mb-2">Or scan to pay</p>
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 bg-white rounded-2xl inline-block shadow-lg mx-auto relative cursor-pointer"
            >
              <img
                src={qrDataUrl}
                alt={`Scan QR Code to pay ₹${currentPlan.priceINR}`}
                className="w-36 h-36 shrink-0 mx-auto rounded-lg"
              />
              <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-mono font-black px-3 py-0.5 rounded-full shadow-md whitespace-nowrap">
                ₹{currentPlan.priceINR} ONLY
              </div>
            </motion.div>
          </div>

          <div className="pt-3 max-w-md mx-auto text-center">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Paid? Send the payment screenshot on WhatsApp and your Pro access
              will be activated.
            </p>
          </div>
        </div>

        {/* STATUS & ACTION BUTTON */}
        {successMsg ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full py-3.5 bg-emerald-600 text-white font-mono text-xs font-bold text-center rounded-2xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading}
            onClick={handleWhatsAppConfirm}
            className="eb-glow-green eb-shine w-full py-4 bg-[#25D366] hover:brightness-110 text-[#04231A] font-bold font-mono text-sm uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer select-none touch-manipulation disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>{loading ? 'Opening WhatsApp…' : 'Send screenshot on WhatsApp'}</span>
          </motion.button>
        )}

        <p className="text-[10px] font-mono text-slate-500 text-center mt-3">
          Send your payment screenshot on WhatsApp. Pro access is activated manually after the payment is confirmed.
        </p>
        </>
        )}

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

