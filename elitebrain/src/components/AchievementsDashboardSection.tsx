import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Award, Sparkles, ChevronRight, Lock, Flame, Zap, Binary, Layers, Compass, Boxes, Shuffle, Cuboid, Target, TrendingUp, Crown } from 'lucide-react';
import { UserProfile } from '../types';
import { ACHIEVEMENTS_LIST } from '../utils/achievements';
import { soundFx } from '../utils/audio';

interface Props {
  profile: UserProfile;
  onOpenGallery: () => void;
}

export const AchievementsDashboardSection: React.FC<Props> = ({ profile, onOpenGallery }) => {
  const unlockedMap = profile.unlockedAchievements || {};
  const unlockedCount = Object.keys(unlockedMap).length;
  const totalCount = ACHIEVEMENTS_LIST.length;

  const totalPoints = ACHIEVEMENTS_LIST.reduce((acc, b) => {
    return unlockedMap[b.id] ? acc + b.points : acc;
  }, 0);

  const renderIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Zap': return <Zap className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Crown': return <Crown className={className} />;
      case 'Binary': return <Binary className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Compass': return <Compass className={className} />;
      case 'Boxes': return <Boxes className={className} />;
      case 'Shuffle': return <Shuffle className={className} />;
      case 'Cuboid': return <Cuboid className={className} />;
      case 'Target': return <Target className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'Trophy': return <Trophy className={className} />;
      default: return <Award className={className} />;
    }
  };

  // Get top 6 badges to highlight
  const featuredBadges = ACHIEVEMENTS_LIST.slice(0, 6);

  return (
    <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-5 sm:p-6 mb-8 shadow-xl">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-2xl shadow-inner">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Earned Badges & Milestones</span>
              <span className="text-xs font-mono font-black px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg">
                {unlockedCount}/{totalCount}
              </span>
            </h3>
            <p className="text-xs font-mono text-[#98A2B3]">
              {totalPoints} Total Badge PTS • Complete training targets to unlock new rewards
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            soundFx.playClick();
            onOpenGallery();
          }}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <span>View Badges ({totalCount})</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Featured Badges Horizontal Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {featuredBadges.map((badge) => {
          const isUnlocked = Boolean(unlockedMap[badge.id]);

          return (
            <motion.div
              key={badge.id}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                soundFx.playClick();
                onOpenGallery();
              }}
              className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between cursor-pointer transition-all ${
                isUnlocked
                  ? 'bg-[#171B22] border-amber-500/40 hover:border-amber-500/80 shadow-md'
                  : 'bg-[#0E1116] border-[#2A313C] hover:border-slate-500'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-2 shadow-sm ${
                  isUnlocked
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-[#12161F] border-[#2A313C] text-slate-500'
                }`}
              >
                {isUnlocked ? renderIcon(badge.icon, 'w-5 h-5') : <Lock className="w-4 h-4 text-slate-500" />}
              </div>

              <div className="text-xs font-bold font-display text-white line-clamp-1 mb-0.5">
                {badge.title}
              </div>

              <span className={`text-[10px] font-mono font-bold ${isUnlocked ? 'text-amber-400' : 'text-slate-500'}`}>
                {isUnlocked ? `+${badge.points} PTS` : 'Locked'}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
