import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { calculateBrainScore, calculateTotalXp } from '../utils/storage';
import { ChartRecorder } from './ChartRecorder';
import { DayProgressCalendar } from './DayProgressCalendar';
import { soundFx } from '../utils/audio';
import {
  Flame,
  Trophy,
  Calendar,
  Activity,
} from 'lucide-react';

interface RankProgressionSectionProps {
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
  lifeXp,
  onLaunchModule,
  onOpenBadgesGallery,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rank' | 'chart' | 'calendar'>('rank');

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
      
      {/* Sub Tab Switcher Pills */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2A313C] min-w-0">
        <div className="flex items-center gap-1.5 p-1 bg-[#12161F] border border-[#2A313C] rounded-2xl w-full sm:w-auto min-w-0 overflow-x-auto overscroll-x-contain no-scrollbar">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveSubTab('rank');
            }}
            className={`eb-press eb-shine shrink-0 px-3.5 sm:px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] ${
              activeSubTab === 'rank'
                ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/35'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span>Rank & Ladder</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveSubTab('chart');
            }}
            className={`eb-press eb-shine shrink-0 px-3.5 sm:px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] ${
              activeSubTab === 'chart'
                ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/35'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Performance Graph</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveSubTab('calendar');
            }}
            className={`eb-press eb-shine shrink-0 px-3.5 sm:px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] ${
              activeSubTab === 'calendar'
                ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/35'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>30-Day Matrix</span>
          </button>
        </div>

        {/* Streak Quick Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Flame className="w-4 h-4 eb-warn animate-pulse" />
          <span className="text-xs font-mono font-bold eb-warn">
            {derivedStreak ?? profile.streakDays} Day Streak
          </span>
        </div>
      </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  label: 'Rank',
                  value: currentRankLabel,
                  sub: nextTier !== currentTier ? `${xpToGo.toLocaleString()} XP to ${nextTier.baseName} ${nextTier.tierNumber}` : 'Top tier',
                  color: currentTier.color,
                },
                {
                  label: 'Total XP',
                  value: careerXp.toLocaleString(),
                  sub: 'earned',
                  color: '#F2F4F7',
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
                <div key={stat.label} className="eb-card p-3 min-w-0">
                  <span className="eb-label block truncate">{stat.label}</span>
                  <span
                    className="eb-stat block text-lg mt-1 truncate"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </span>
                  <span className="block text-[9px] text-[#8A93A5] mt-0.5 truncate">
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

        {/* PERFORMANCE GRAPH TAB */}
        {activeSubTab === 'chart' && (
          <motion.div
            key="chart-tab"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#8B5CF6] uppercase tracking-wider">
                    ECHO-RECORDING PEN PLOTTER
                  </span>
                  <h3 className="text-lg font-display font-bold text-white">
                    Cognitive Trajectory & Index Graph
                  </h3>
                </div>
                <div className="text-xs text-[#98A2B3]">
                  Score: <strong className="text-[#A78BFA]">{brainScore} pts</strong>
                </div>
              </div>

              <div className="flex justify-center py-2">
                <ChartRecorder profile={profile} className="w-full max-w-lg" />
              </div>
            </div>
          </motion.div>
        )}

        {/* 30-DAY MATRIX CALENDAR TAB */}
        {activeSubTab === 'calendar' && (
          <motion.div
            key="calendar-tab"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            <DayProgressCalendar profile={profile} onLaunchModule={onLaunchModule} />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
