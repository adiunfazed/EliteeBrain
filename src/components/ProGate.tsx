import React from 'react';
import { motion } from 'motion/react';
import { Crown, Gift } from 'lucide-react';
import type { UserProfile } from '../types';
import { resolveEntitlement } from '../lib/entitlement';

interface Props {
  profile: UserProfile;
  /** Short name of what's behind the gate, e.g. "Goals & Habits". */
  feature: string;
  blurb: string;
  onOpenPro: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a Pro-only feature.
 *
 * This is presentation only. Access is decided by resolveEntitlement, which
 * reads fields the Firestore rules forbid a user from editing — so removing
 * this component in devtools reveals the UI but the underlying data is still
 * protected, and the entitlement re-derives on every load.
 */
export const ProGate: React.FC<Props> = ({ profile, feature, blurb, onOpenPro, children }) => {
  const ent = resolveEntitlement(profile);
  if (ent.isPro) return <>{children}</>;

  const expired = ent.status === 'expired';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12 px-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05]"
    >
      <span className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
        <Crown className="w-6 h-6 shrink-0 eb-warn" />
      </span>

      <h3 className="text-base font-black font-mono text-[#F4F6F8] mt-3 tracking-tight">
        {feature} is a Pro feature
      </h3>
      <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
        {expired
          ? 'Your free month has ended. Your data is safe and comes straight back when you unlock Pro.'
          : blurb}
      </p>

      <button
        onClick={onOpenPro}
        className="eb-lift eb-glow-emerald eb-marquee mt-5 px-5 py-3 rounded-xl bg-emerald-500 hover:brightness-110 text-slate-950 text-xs font-mono font-black inline-flex items-center gap-2"
      >
        <Gift className="w-4 h-4 shrink-0" />
        {expired ? 'Unlock Pro' : 'Get 1 month free'}
      </button>
    </motion.div>
  );
};
