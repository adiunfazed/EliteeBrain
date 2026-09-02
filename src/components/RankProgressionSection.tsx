import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { calculateBrainScore, calculateTotalXp } from '../utils/storage';
import {
  Flame,
  Trophy,
  Calendar,
  Activity,
} from 'lucide-react';

interface RankProgressionSectionProps {
  /** True while the authoritative figures are still loading. */
  statsPending?: boolean;
  /** Activity-derived streak, so this never disagrees with the Home card. */
  derivedStreak?: number;
  /** Unified career XP including habits, tasks, routine, focus and sleep. */
  lifeXp?: number;
  profile: UserProfile;
  onLaunchModule: (id: any) => void;
  onOpenBadgesGallery?: () => void;
}

interface TierInfo {
  id: string;
  tierNumber: string;
  baseName: string;
  minXp: number;
  maxXp: number;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
}

const TIERS: TierInfo[] = [
  // BRONZE (1-3)
  { id: 'bronze-1', tierNumber: '1', baseName: 'BRONZE', minXp: 0, maxXp: 499, color: '#D97706', badgeBg: 'bg-amber-950/40', badgeBorder: 'border-amber-700/60', textColor: 'text-amber-500' },
  { id: 'bronze-2', tierNumber: '2', baseName: 'BRONZE', minXp: 500, maxXp: 999, color: '#D97706', badgeBg: 'bg-amber-950/40', badgeBorder: 'border-amber-700/60', textColor: 'text-amber-500' },
  { id: 'bronze-3', tierNumber: '3', baseName: 'BRONZE', minXp: 1000, maxXp: 1499, color: '#D97706', badgeBg: 'bg-amber-950/40', badgeBorder: 'border-amber-700/60', textColor: 'text-amber-500' },
  
  // SILVER (1-3)
  { id: 'silver-1', tierNumber: '1', baseName: 'SILVER', minXp: 1500, maxXp: 1999, color: '#94A3B8', badgeBg: 'bg-slate-800/50', badgeBorder: 'border-slate-500/60', textColor: 'text-slate-300' },
  { id: 'silver-2', tierNumber: '2', baseName: 'SILVER', minXp: 2000, maxXp: 2499, color: '#94A3B8', badgeBg: 'bg-slate-800/50', badgeBorder: 'border-slate-500/60', textColor: 'text-slate-300' },
  { id: 'silver-3', tierNumber: '3', baseName: 'SILVER', minXp: 2500, maxXp: 2999, color: '#94A3B8', badgeBg: 'bg-slate-800/50', badgeBorder: 'border-slate-500/60', textColor: 'text-slate-300' },
  
  // GOLD (1-4)
  { id: 'gold-1', tierNumber: '1', baseName: 'GOLD', minXp: 3000, maxXp: 3999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'eb-warn' },
  { id: 'gold-2', tierNumber: '2', baseName: 'GOLD', minXp: 4000, maxXp: 4999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'eb-warn' },
  { id: 'gold-3', tierNumber: '3', baseName: 'GOLD', minXp: 5000, maxXp: 5999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'eb-warn' },
  { id: 'gold-4', tierNumber: '4', baseName: 'GOLD', minXp: 6000, maxXp: 6999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'eb-warn' },
  
  // PLATINUM (1-4)
  { id: 'platinum-1', tierNumber: '1', baseName: 'PLATINUM', minXp: 7000, maxXp: 8499, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-2', tierNumber: '2', baseName: 'PLATINUM', minXp: 8500, maxXp: 9999, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-3', tierNumber: '3', baseName: 'PLATINUM', minXp: 10000, maxXp: 11499, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-4', tierNumber: '4', baseName: 'PLATINUM', minXp: 11500, maxXp: 12999, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  
  // DIAMOND (1-5)
  { id: 'diamond-1', tierNumber: '1', baseName: 'DIAMOND', minXp: 13000, maxXp: 14999, color: '#A78BFA', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-2', tierNumber: '2', baseName: 'DIAMOND', minXp: 15000, maxXp: 16999, color: '#A78BFA', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-3', tierNumber: '3', baseName: 'DIAMOND', minXp: 17000, maxXp: 18999, color: '#A78BFA', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-4', tierNumber: '4', baseName: 'DIAMOND', minXp: 19000, maxXp: 20999, color: '#A78BFA', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-5', tierNumber: '5', baseName: 'DIAMOND', minXp: 21000, maxXp: 24999, color: '#A78BFA', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  
  // HEROIC
  { id: 'heroic', tierNumber: '', baseName: 'HEROIC', minXp: 25000, maxXp: 999999, color: '#EC4899', badgeBg: 'bg-pink-500/15', badgeBorder: 'border-pink-400', textColor: 'text-pink-400' },
];

export const RankProgressionSection: React.FC<RankProgressionSectionProps> = ({
  profile,
  derivedStreak,
  statsPending,
  lifeXp,
  onLaunchModule,
  onOpenBadgesGallery,
}) => {
  // Only one view remains; the switcher and its other panels were removed.
  const activeSubTab = 'rank' as const;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSubTab]);

  // Calculate total EXP strictly across modules and games
  // Same total the Level system uses, so Rank and Level can never disagree
  // about how much a user has done.
  const careerXp = lifeXp ?? calculateTotalXp(profile);

  // Determine current Tier strictly based on earned EXP
  let currentTierIndex = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (careerXp >= TIERS[i].minXp) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = TIERS[currentTierIndex];
  const nextTier = TIERS[currentTierIndex + 1] || currentTier;

  // Calculate progress percentage inside tier
  const tierXpRange = currentTier.maxXp - currentTier.minXp + 1;
  const currentTierXp = Math.max(0, careerXp - currentTier.minXp);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentTierXp / tierXpRange) * 100))
  );

  const currentRankLabel = `${currentTier.baseName} ${currentTier.tierNumber}`.trim();
  const xpToGo = Math.max(0, currentTier.maxXp + 1 - careerXp);

  const brainScore = calculateBrainScore(profile);

  return (
    <div className="space-y-6 select-none font-sans">
      <AnimatePresence mode="wait">
        {activeSubTab === 'rank' && (
          <motion.div
            key="rank-tab"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            {/* HERO RANK CARD (Directly matching screenshot layout) */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: 'Rank',
                  value: currentRankLabel,
                  sub:
                    nextTier !== currentTier
                      ? `${xpToGo.toLocaleString()} XP to ${nextTier.baseName} ${nextTier.tierNumber}`
                      : 'Top tier',
                  color: currentTier.color,
                },
                {
                  label: 'Total XP',
                  value: careerXp.toLocaleString(),
                  sub: 'earned so far',
                  color: 'var(--ink)',
                },
                {
                  label: 'Streak',
                  value: `${derivedStreak ?? profile.streakDays}`,
                  sub: (derivedStreak ?? profile.streakDays) === 1 ? 'day' : 'days',
                  color: '#FFB020',
                },
                {
                  label: 'Badges',
                  value: `${Object.keys(profile.unlockedAchievements || {}).length}`,
                  sub: 'unlocked',
                  color: '#00C2A8',
                },
              ].map((stat) => (
                <div key={stat.label} className="eb-card p-4 min-w-0 flex flex-col">
                  <span className="eb-label">{stat.label}</span>

                  {/* Fluid size with a floor: a long tier name shrinks to fit
                      rather than being cut off, and wraps if it still needs to. */}
                  {statsPending ? (
                    <span className="block h-6 w-16 rounded bg-[var(--surface-sunk)] animate-pulse mt-2" />
                  ) : (
                    <span
                      className="font-display font-extrabold mt-1.5 leading-tight break-words"
                      style={{
                        color: stat.color,
                        fontSize: 'clamp(17px, 5.2vw, 24px)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {stat.value}
                    </span>
                  )}

                  <span className="text-[12px] text-[var(--ink-muted)] mt-1.5 leading-snug break-words">
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Tier progress — one bar rather than a six-card ladder. */}
            <div className="eb-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="eb-label">Progress to next rank</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: currentTier.color }}>
                  {progressPercent}%
                </span>
              </div>
              <div className="eb-bar mt-2">
                <motion.div
                  className="eb-bar-fill"
                  initial={false}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ background: currentTier.color }}
                />
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
