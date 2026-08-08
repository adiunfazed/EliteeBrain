import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { soundFx } from '../utils/audio';
import { X, Check, Crown, ArrowRight, QrCode, Clock, Zap, Smartphone, RefreshCw, Shield } from 'lucide-react';
import { User, createPaymentRequest, getAdminMerchantUpiId } from '../lib/firebase';
import { syncProfileToCloud, fetchProfileFromCloud } from '../lib/sync';
import { saveProfile } from '../utils/storage';
import { LIFETIME_PRICE_INR, resolveEntitlement, entitlementLabel } from '../lib/entitlement';

interface Props {
  isOpen: boolean;
  currentUser: User | null;
  profile: UserProfile;
  onClose: () => void;
  onOpenAdminPortal?: () => void;
  onOpenAuthModal?: () => void;
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
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('lifetime');
  const [utrNumber, setUtrNumber] = useState('');
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

  const upiIntentUrl = `upi://pay?pa=${merchantUpiId}&pn=EliteBrain&am=${currentPlan.priceINR}&cu=INR`;

  const handleProcessPayment = async () => {
    soundFx.playClick();
    const cleanUtr = utrNumber.trim();

    if (!cleanUtr || cleanUtr.length < 6) {
      alert('Please enter your 12-digit UTR / Payment Transaction ID from your UPI app (e.g. 420912389102).');
      return;
    }

    setLoading(true);

    try {
      const submittedAt = new Date().toISOString();

      // Set pending payment object on local profile
      profile.pendingPayment = {
        utrNumber: cleanUtr,
        plan: selectedPlan,
        amountINR: currentPlan.priceINR,
        submittedAt,
      };

      saveProfile(profile);

      // Create Payment Verification Request in Firestore
      const targetUserId = currentUser ? currentUser.uid : `guest_${Date.now()}`;
      const targetEmail = currentUser ? (currentUser.email || 'guest@elitebrain.app') : 'guest@elitebrain.app';
      const targetName = currentUser ? (currentUser.displayName || 'there') : 'there';

      await createPaymentRequest({
        userId: targetUserId,
        userEmail: targetEmail,
        userName: targetName,
        plan: selectedPlan,
        amountINR: currentPlan.priceINR,
        utrNumber: cleanUtr,
      });

      if (currentUser) {
        await syncProfileToCloud(profile, currentUser);
      }

      soundFx.playSuccess();
      setSuccessMsg(`UTR (${cleanUtr}) Submitted to Verification Queue! Admin will verify and activate your Pro account.`);
    } catch (err) {
      console.error('Error submitting payment verification:', err);
      alert('Failed to submit payment verification request. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
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
        alert('⏳ Payment Status: Under Review in Admin Queue. Admin (unfazed.adibiz@gmail.com) is checking bank records.');
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
            <X className="w-4 h-4" />
          </motion.button>

        {/* Pro Header Badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
            ELITEBRAIN PRO ACCESS
          </span>
          <span className="text-[10px] font-mono font-bold text-amber-300 px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
            <Crown className="w-3 h-3 text-amber-400" /> UNLOCK ALL 8 MODULES
          </span>
        </div>

        <h2 className="text-xl md:text-2xl font-black text-slate-100">
          Select Your Subscription Plan
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          No trials or hidden fees. Choose a plan below to submit for instant admin verification.
        </p>

        {/* PENDING VERIFICATION CARD (If payment is waiting in queue) */}
        {profile.pendingPayment && !profile.isProUser && (
          <div className="mt-3.5 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-amber-200 uppercase tracking-wider">
                  Payment Submitted: Verification Queue
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-300 px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
                ⏳ UNDER REVIEW
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              UTR Reference: <strong className="font-mono text-amber-200">{profile.pendingPayment.utrNumber}</strong> · Plan: <strong className="text-slate-100">{PLAN_CONFIGS[profile.pendingPayment.plan as PlanId]?.name || 'Pro access'} (₹{profile.pendingPayment.amountINR})</strong>
            </p>

            <p className="text-[11px] text-slate-400 font-mono">
              Admin (<strong className="text-amber-300">unfazed.adibiz@gmail.com</strong>) is verifying your payment. Your account will automatically activate upon confirmation.
            </p>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
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
                  <Shield className="w-3.5 h-3.5" />
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
                <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-indigo-200 uppercase tracking-wider">
                  Active Subscription: {profile.proPlanType?.toUpperCase() || 'PRO USER'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500/40 rounded-full flex items-center gap-1 whitespace-nowrap">
                <Zap className="w-3 h-3 text-emerald-400" /> ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-indigo-500/20">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Time Remaining:</span>
              </div>
              <span className="text-xs font-mono font-black text-amber-300">
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

        {/* TRIAL + SINGLE LIFETIME TIER */}
        {ent.status === 'trial' && (
          <div className="my-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm font-bold text-emerald-300 font-mono">
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
            <p className="text-sm font-bold text-amber-300 font-mono">Your free month has ended</p>
            <p className="text-[11px] text-slate-300 mt-1 font-sans leading-relaxed">
              Your progress and records are safe. Unlock everything again with a single payment.
            </p>
          </div>
        )}

        <div className="my-4 p-5 rounded-2xl bg-slate-950 border border-amber-500/40 ring-1 ring-amber-500/20">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-black font-mono text-amber-400">
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
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 stroke-[3]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* UPI APP DIRECT PAY & QR CODE CONTAINER */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-4 text-center space-y-3 shadow-inner">
          
          <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-mono font-semibold tracking-wide">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>UPI Instant Payment Gateway</span>
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
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Directly launches Google Pay, PhonePe, Paytm, BHIM or any UPI app</span>
            </p>
          </div>

          {/* OR Scan QR Code */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-mono mb-2">Or scan QR Code directly from desktop:</p>
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="p-2.5 bg-white rounded-2xl inline-block shadow-lg mx-auto relative cursor-pointer"
            >
              <img
                src={qrDataUrl}
                alt={`Scan QR Code to pay ₹${currentPlan.priceINR}`}
                className="w-36 h-36 mx-auto rounded-lg"
              />
              <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-mono font-black px-3 py-0.5 rounded-full shadow-md whitespace-nowrap">
                ₹{currentPlan.priceINR} ONLY
              </div>
            </motion.div>
          </div>

          <div className="pt-2 text-left max-w-md mx-auto">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1">
              Enter 12-Digit UTR / Transaction Reference ID:
            </label>
            <input
              type="text"
              placeholder="e.g. 420912389102"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* STATUS & ACTION BUTTON */}
        {successMsg ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full py-3.5 bg-emerald-600 text-white font-mono text-xs font-bold text-center rounded-2xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading}
            onClick={handleProcessPayment}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all duration-200 select-none touch-manipulation border border-amber-300/40 disabled:opacity-50"
          >
            <span>
              {loading
                ? 'Submitting Payment to Verification Queue...'
                : `Submit Payment for Verification (₹${currentPlan.priceINR} ONLY) →`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        )}

        <p className="text-[10px] font-mono text-slate-500 text-center mt-3">
          Direct UPI Verification Queue. Pro access is granted upon admin approval (unfazed.adibiz@gmail.com).
        </p>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

