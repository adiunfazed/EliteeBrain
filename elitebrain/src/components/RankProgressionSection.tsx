import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ModuleState, DailyLog } from '../types';
import { calculateBrainScore, calculateTotalXp } from '../utils/storage';
import { ChartRecorder } from './ChartRecorder';
import { DayProgressCalendar } from './DayProgressCalendar';
import { AchievementsDashboardSection } from './AchievementsDashboardSection';
import { soundFx } from '../utils/audio';
import {
  Flame,
  Trophy,
  Award,
  Zap,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  BarChart2,
  Calendar,
  Sparkles,
  Activity,
  Layers,
} from 'lucide-react';

interface RankProgressionSectionProps {
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
  { id: 'gold-1', tierNumber: '1', baseName: 'GOLD', minXp: 3000, maxXp: 3999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'text-amber-400' },
  { id: 'gold-2', tierNumber: '2', baseName: 'GOLD', minXp: 4000, maxXp: 4999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'text-amber-400' },
  { id: 'gold-3', tierNumber: '3', baseName: 'GOLD', minXp: 5000, maxXp: 5999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'text-amber-400' },
  { id: 'gold-4', tierNumber: '4', baseName: 'GOLD', minXp: 6000, maxXp: 6999, color: '#F59E0B', badgeBg: 'bg-amber-500/15', badgeBorder: 'border-amber-400', textColor: 'text-amber-400' },
  
  // PLATINUM (1-4)
  { id: 'platinum-1', tierNumber: '1', baseName: 'PLATINUM', minXp: 7000, maxXp: 8499, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-2', tierNumber: '2', baseName: 'PLATINUM', minXp: 8500, maxXp: 9999, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-3', tierNumber: '3', baseName: 'PLATINUM', minXp: 10000, maxXp: 11499, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  { id: 'platinum-4', tierNumber: '4', baseName: 'PLATINUM', minXp: 11500, maxXp: 12999, color: '#38BDF8', badgeBg: 'bg-sky-500/15', badgeBorder: 'border-sky-400', textColor: 'text-sky-300' },
  
  // DIAMOND (1-5)
  { id: 'diamond-1', tierNumber: '1', baseName: 'DIAMOND', minXp: 13000, maxXp: 14999, color: '#818CF8', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-2', tierNumber: '2', baseName: 'DIAMOND', minXp: 15000, maxXp: 16999, color: '#818CF8', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-3', tierNumber: '3', baseName: 'DIAMOND', minXp: 17000, maxXp: 18999, color: '#818CF8', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-4', tierNumber: '4', baseName: 'DIAMOND', minXp: 19000, maxXp: 20999, color: '#818CF8', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  { id: 'diamond-5', tierNumber: '5', baseName: 'DIAMOND', minXp: 21000, maxXp: 24999, color: '#818CF8', badgeBg: 'bg-indigo-500/15', badgeBorder: 'border-indigo-400', textColor: 'text-indigo-300' },
  
  // HEROIC
  { id: 'heroic', tierNumber: '', baseName: 'HEROIC', minXp: 25000, maxXp: 999999, color: '#EC4899', badgeBg: 'bg-pink-500/15', badgeBorder: 'border-pink-400', textColor: 'text-pink-400' },
];

export const RankProgressionSection: React.FC<RankProgressionSectionProps> = ({
  profile,
  onLaunchModule,
  onOpenBadgesGallery,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'rank' | 'chart' | 'calendar'>('rank');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSubTab]);

  // Calculate total EXP strictly across modules and games
  const careerXp = calculateTotalXp(profile);

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
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2A313C]">
        <div className="flex items-center gap-1.5 p-1 bg-[#12161F] border border-[#2A313C] rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveSubTab('rank');
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              activeSubTab === 'rank'
                ? 'bg-[#5C6CF2] text-white shadow-md shadow-[#5C6CF2]/20'
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
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              activeSubTab === 'chart'
                ? 'bg-[#5C6CF2] text-white shadow-md shadow-[#5C6CF2]/20'
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
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
              activeSubTab === 'calendar'
                ? 'bg-[#5C6CF2] text-white shadow-md shadow-[#5C6CF2]/20'
                : 'text-[#98A2B3] hover:text-[#F4F6F8]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>30-Day Matrix</span>
          </button>
        </div>

        {/* Streak Quick Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-amber-300">
            {profile.streakDays} Day Streak
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
            <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
              
              {/* Outer ambient glow */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none blur-3xl transition-all duration-500"
                style={{ backgroundColor: currentTier.color }}
              />

              {/* Circular Gauge Ring */}
              <div className="relative mx-auto w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center my-2">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="#1E2634"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  {/* Active Progress Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={currentTier.color}
                    strokeWidth="6"
                    strokeDasharray={263.89}
                    strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Hexagonal Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {/* Hexagon Shape Container */}
                  <div
                    className="w-16 h-18 sm:w-20 sm:h-22 flex items-center justify-center relative mb-1"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      backgroundColor: currentTier.color + '25',
                      border: `2px solid ${currentTier.color}`,
                    }}
                  >
                    <span className="text-xl sm:text-2xl font-mono font-black text-white tracking-widest drop-shadow-md">
                      {currentTier.tierNumber}
                    </span>
                  </div>

                  {/* Percentage under Hexagon */}
                  <span className="text-xs font-mono font-bold text-[#98A2B3]">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Rank Info Text */}
              <div className="space-y-1 mt-2">
                <span className="text-[10px] font-mono font-extrabold text-[#98A2B3] uppercase tracking-widest block">
                  CURRENT COGNITIVE RANK
                </span>
                <h1
                  className="text-3xl sm:text-4xl font-display font-black tracking-wider uppercase drop-shadow-lg"
                  style={{ color: currentTier.color }}
                >
                  {currentRankLabel}
                </h1>

                {/* Subtitle Details */}
                <p className="text-xs font-mono text-[#98A2B3] pt-1">
                  NEXT: {nextTier.baseName} {nextTier.tierNumber} — <strong className="text-white">{xpToGo.toLocaleString()} XP</strong> TO GO
                </p>
                <div className="text-[11px] font-mono text-[#6C757D]">
                  {careerXp.toLocaleString()} TOTAL EARNED EXP
                </div>
              </div>

              {/* PROGRESSION LADDER (Grouped by Base Tier) */}
              <div className="mt-8 pt-6 border-t border-[#2A313C]/80">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-[#98A2B3] uppercase tracking-wider">
                    PROGRESSION LADDER (TIER OVERVIEW)
                  </span>
                </div>

                {/* Grid of Hexagon Tier Cards */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Array.from(new Set(TIERS.map(t => t.baseName))).map((baseName) => {
                    const baseTiers = TIERS.filter(t => t.baseName === baseName);
                    const firstTier = baseTiers[0];
                    const isCurrentBase = currentTier.baseName === baseName;
                    const isUnlocked = TIERS.findIndex(t => t.baseName === baseName) <= currentTierIndex;

                    return (
                      <div
                        key={baseName}
                        className={`p-3 rounded-2xl border text-center transition-all relative ${
                          isCurrentBase
                            ? 'bg-[#1A1F2C] border-2 border-amber-400 shadow-lg shadow-amber-500/10'
                            : isUnlocked
                            ? 'bg-[#12161F] border-[#2A313C] opacity-90'
                            : 'bg-[#0D1117]/60 border-[#1F242D] opacity-40'
                        }`}
                      >
                        {/* Hexagon Icon */}
                        <div
                          className="w-8 h-9 mx-auto flex items-center justify-center font-mono font-extrabold text-xs mb-1.5"
                          style={{
                            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                            backgroundColor: isUnlocked ? firstTier.color + '30' : '#1A1F2C',
                            border: `1.5px solid ${isUnlocked ? firstTier.color : '#363F4D'}`,
                            color: isUnlocked ? firstTier.color : '#6C757D',
                          }}
                        >
                          {baseName.charAt(0)}
                        </div>

                        <span className="block text-[10px] font-mono font-black uppercase tracking-tight text-white">
                          {baseName}
                        </span>

                        <span className="text-[9px] font-mono text-[#98A2B3] block">
                          {firstTier.minXp >= 1000 ? `${Math.floor(firstTier.minXp / 1000)}K+` : firstTier.minXp + '+'}
                        </span>

                        {/* Active Bottom Highlight Line */}
                        {isCurrentBase && (
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-amber-400 rounded-full shadow-xs" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Quick Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#12161F] border border-[#2A313C] rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#98A2B3] uppercase">
                    Streak Continuity
                  </span>
                  <div className="text-lg font-mono font-extrabold text-white">
                    {profile.streakDays} Days
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#12161F] border border-[#2A313C] rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-[#5C6CF2]/15 border border-[#5C6CF2]/30 text-[#818CF8] rounded-xl">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#98A2B3] uppercase">
                    Composite Brain Score
                  </span>
                  <div className="text-lg font-mono font-extrabold text-[#818CF8]">
                    {brainScore} pts
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#12161F] border border-[#2A313C] rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#98A2B3] uppercase">
                    Unlocked Achievements
                  </span>
                  <div className="text-lg font-mono font-extrabold text-white">
                    {Object.keys(profile.unlockedAchievements || {}).length} Badges
                  </div>
                </div>
              </div>
            </div>

            {/* Earned Badges Section */}
            {onOpenBadgesGallery && (
              <AchievementsDashboardSection
                profile={profile}
                onOpenGallery={onOpenBadgesGallery}
              />
            )}
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
                  <span className="text-[10px] font-mono font-bold text-[#5C6CF2] uppercase tracking-wider">
                    ECHO-RECORDING PEN PLOTTER
                  </span>
                  <h3 className="text-lg font-display font-bold text-white">
                    Cognitive Trajectory & Index Graph
                  </h3>
                </div>
                <div className="text-xs font-mono text-[#98A2B3]">
                  Score: <strong className="text-[#818CF8]">{brainScore} pts</strong>
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
