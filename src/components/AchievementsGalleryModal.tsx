import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Sparkles,
  Award,
  Zap,
  Flame,
  Crown,
  Binary,
  Layers,
  Compass,
  Boxes,
  Shuffle,
  Cuboid,
  Target,
  TrendingUp,
  X,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Star,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Achievement, ACHIEVEMENTS_LIST } from '../utils/achievements';
import { UserProfile } from '../types';
import { soundFx } from '../utils/audio';

interface Props {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
}

export const AchievementsGalleryModal: React.FC<Props> = ({ isOpen, profile, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [activeBadgeDetail, setActiveBadgeDetail] = useState<Achievement | null>(null);

  if (!isOpen) return null;

  const unlockedMap = profile.unlockedAchievements || {};
  const unlockedCount = Object.keys(unlockedMap).length;
  const totalCount = ACHIEVEMENTS_LIST.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  // Total points earned
  const totalPointsEarned = ACHIEVEMENTS_LIST.reduce((acc, badge) => {
    return unlockedMap[badge.id] ? acc + badge.points : acc;
  }, 0);

  const categories = ['All', 'Milestones', 'Streak', 'Memory', 'Focus', 'Logic', 'Mastery'];

  // Filtered achievements
  const filteredAchievements = ACHIEVEMENTS_LIST.filter((badge) => {
    const matchesCategory = selectedCategory === 'All' || badge.category === selectedCategory;
    const isUnlocked = Boolean(unlockedMap[badge.id]);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unlocked' && isUnlocked) ||
      (statusFilter === 'locked' && !isUnlocked);

    return matchesCategory && matchesStatus;
  });

  const renderBadgeIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Zap':
        return <Zap className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Crown':
        return <Crown className={className} />;
      case 'Binary':
        return <Binary className={className} />;
      case 'Layers':
        return <Layers className={className} />;
      case 'Compass':
        return <Compass className={className} />;
      case 'Boxes':
        return <Boxes className={className} />;
      case 'Shuffle':
        return <Shuffle className={className} />;
      case 'Cuboid':
        return <Cuboid className={className} />;
      case 'Target':
        return <Target className={className} />;
      case 'TrendingUp':
        return <TrendingUp className={className} />;
      case 'Trophy':
        return <Trophy className={className} />;
      default:
        return <Award className={className} />;
    }
  };

  const formatUnlockDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-4xl bg-[#121620] border border-[#2D3748] rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header Bar */}
          <div className="flex items-start justify-between pb-4 border-b border-[#2D3748] mb-4 shrink-0 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 border border-amber-500/40 eb-warn rounded-2xl shrink-0 shadow-inner">
                <Trophy className="w-6 h-6 shrink-0 sm:w-7 sm:h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-tight">
                    Badges & Milestones
                  </h2>
                  <span className="whitespace-nowrap inline-flex items-center px-2.5 py-0.5 bg-amber-500/20 eb-warn border border-amber-500/40 rounded-lg text-xs font-mono font-black">
                    {unlockedCount} / {totalCount}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#A0AEC0] mt-0.5 leading-snug">
                  Track cognitive milestones, skill badges, and brain training achievements.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-2 text-[#A0AEC0] hover:text-white hover:bg-[#1A202C] border border-transparent hover:border-[#2D3748] rounded-xl transition-all cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Reward Status Card */}
          <div className="bg-[#181E2A] border border-[#2D3748] rounded-2xl p-3.5 sm:p-4 mb-4 shrink-0 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 eb-warn flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 shrink-0" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider eb-warn font-bold">
                    Reward Tier Status
                  </div>
                  <div className="text-sm sm:text-base font-display font-black text-white">
                    {totalPointsEarned} Badge PTS Earned
                  </div>
                </div>
              </div>

              <div className="text-xs font-mono text-[#A0AEC0] flex items-center gap-1.5 bg-[#0F141C] px-3 py-1 border border-[#2D3748] rounded-xl shrink-0">
                <ShieldCheck className="w-4 h-4 shrink-0 eb-done" />
                <span>Completion: <strong className="text-white font-black">{progressPercent}%</strong></span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#0F141C] h-2.5 rounded-full overflow-hidden border border-[#2D3748]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full"
              />
            </div>
          </div>

          {/* Category Horizontal Scroll Pills */}
          <div className="mb-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-[#181E2A] hover:bg-[#212938] border border-[#2D3748] text-[#A0AEC0] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Status Segmented Controls */}
          <div className="grid grid-cols-3 gap-1 bg-[#0F141C] p-1 border border-[#2D3748] rounded-2xl mb-4 shrink-0 text-xs font-mono font-bold">
            <button
              onClick={() => {
                soundFx.playClick();
                setStatusFilter('all');
              }}
              className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                statusFilter === 'all'
                  ? 'bg-amber-500/20 eb-warn border border-amber-500/40'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                setStatusFilter('unlocked');
              }}
              className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                statusFilter === 'unlocked'
                  ? 'bg-emerald-500/20 eb-done border border-emerald-500/40'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
            >
              Unlocked ({unlockedCount})
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                setStatusFilter('locked');
              }}
              className={`py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                statusFilter === 'locked'
                  ? 'bg-slate-700/40 text-slate-200 border border-slate-600'
                  : 'text-[#A0AEC0] hover:text-white'
              }`}
            >
              Locked ({totalCount - unlockedCount})
            </button>
          </div>

          {/* Badges Cards Scrollable List */}
          <div className="flex-1 min-w-0 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 custom-scrollbar pb-2">
            {filteredAchievements.map((badge) => {
              const isUnlocked = Boolean(unlockedMap[badge.id]);
              const unlockTime = unlockedMap[badge.id];

              return (
                <motion.div
                  key={badge.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    soundFx.playClick();
                    setActiveBadgeDetail(badge);
                  }}
                  className={`flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none shrink-0 ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-[#1E2638] to-[#181E2A] border-amber-500/50 hover:border-amber-400 shadow-xl'
                      : 'bg-[#161B26] border-[#2D3748] hover:border-slate-500'
                  }`}
                >
                  <div>
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-md ${
                            isUnlocked
                              ? 'bg-gradient-to-br from-amber-500/30 to-amber-600/10 border-amber-500/50 eb-warn'
                              : 'bg-[#0F141C] border-[#2D3748] text-slate-400'
                          }`}
                        >
                          {isUnlocked ? (
                            renderBadgeIcon(badge.icon, 'w-5 h-5')
                          ) : (
                            <Lock className="w-5 h-5 shrink-0 text-slate-400" />
                          )}
                        </div>

                        <div>
                          <h3 className="text-sm sm:text-base font-display font-black text-white leading-tight">
                            {badge.title}
                          </h3>
                          <span className="inline-block text-[10px] font-mono eb-danger font-bold uppercase tracking-wider mt-0.5">
                            {badge.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-mono font-black rounded-md ${
                            isUnlocked
                              ? 'bg-amber-500/20 eb-warn border-amber-500/40'
                              : 'bg-[#0F141C] text-slate-300 border-[#2D3748]'
                          }`}
                        >
                          +{badge.points} PTS
                        </span>
                        {isUnlocked ? (
                          <span className="text-[10px] font-mono eb-done flex items-center gap-0.5 font-extrabold">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Unlocked
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 font-extrabold">Locked</span>
                        )}
                      </div>
                    </div>

                    {/* Badge Description */}
                    <p className="text-xs text-[#A0AEC0] leading-relaxed mb-3">
                      {badge.description}
                    </p>
                  </div>

                  {/* PROMINENT REQUIREMENT BOX (What it is for) */}
                  <div className="mt-2 pt-2.5 border-t border-[#2D3748]/70">
                    <div className="p-2.5 bg-[#0D1117] border border-[#2B3545] rounded-xl flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {isUnlocked ? (
                          <CheckCircle2 className="w-4 h-4 eb-done shrink-0" />
                        ) : (
                          <Target className="w-4 h-4 eb-warn shrink-0" />
                        )}
                        <span className="text-slate-200 font-semibold truncate">
                          <strong className="eb-warn font-bold mr-1">Target:</strong>
                          {badge.conditionDescription}
                        </span>
                      </div>
                      {isUnlocked && (
                        <span className="text-[10px] font-bold eb-done shrink-0">
                          {formatUnlockDate(unlockTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Badge Detail Modal Popover */}
          <AnimatePresence>
            {activeBadgeDetail && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="bg-[#121620] border border-[#2D3748] rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl"
                >
                  <button
                    onClick={() => setActiveBadgeDetail(null)}
                    className="absolute top-4 right-4 p-1.5 text-[#A0AEC0] hover:text-white rounded-full hover:bg-[#181E2A] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5 shrink-0" />
                  </button>

                  <div className="w-20 h-20 shrink-0 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/40 eb-warn flex items-center justify-center mb-4 shadow-xl">
                    {renderBadgeIcon(activeBadgeDetail.icon, 'w-10 h-10')}
                  </div>

                  <span className="px-3 py-1 bg-amber-500/20 eb-warn border border-amber-500/40 text-xs font-mono font-extrabold rounded-lg inline-block mb-2">
                    {activeBadgeDetail.category} • +{activeBadgeDetail.points} PTS
                  </span>

                  <h3 className="text-xl font-display font-extrabold text-white mb-2">
                    {activeBadgeDetail.title}
                  </h3>

                  <p className="text-xs text-[#A0AEC0] mb-4 leading-relaxed">
                    {activeBadgeDetail.description}
                  </p>

                  <div className="p-3.5 bg-[#0D1117] border border-[#2B3545] rounded-2xl text-xs font-mono text-[#A0AEC0] mb-5 text-left">
                    <strong className="eb-warn block mb-1 uppercase tracking-wider text-[10px]">
                      Unlock Requirement:
                    </strong>
                    <div className="text-white font-semibold">{activeBadgeDetail.conditionDescription}</div>
                  </div>

                  <button
                    onClick={() => setActiveBadgeDetail(null)}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-lg active:scale-95"
                  >
                    Close Window
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
