import React, { useEffect, useState } from 'react';
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
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Achievement, ACHIEVEMENTS_LIST } from '../utils/achievements';
import { soundFx } from '../utils/audio';

interface Props {
  unlockedIds: string[];
  onClose: () => void;
}

export const AchievementUnlockedModal: React.FC<Props> = ({ unlockedIds, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const achievementsToDisplay: Achievement[] = unlockedIds
    .map((id) => ACHIEVEMENTS_LIST.find((a) => a.id === id))
    .filter((a): a is Achievement => Boolean(a));

  const currentAchievement = achievementsToDisplay[currentIndex];

  useEffect(() => {
    soundFx.playLevelUp();
  }, [currentIndex]);

  if (!currentAchievement) return null;

  const handleNext = () => {
    soundFx.playClick();
    if (currentIndex < achievementsToDisplay.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const renderBadgeIcon = (iconName: string, className: string = 'w-10 h-10') => {
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

  const getColorClasses = (color: Achievement['color']) => {
    switch (color) {
      case 'amber':
        return {
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/50',
          text: 'text-amber-400',
          glow: 'rgba(245, 158, 11, 0.4)',
          pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'rose':
        return {
          bg: 'bg-rose-500/15',
          border: 'border-rose-500/50',
          text: 'text-rose-400',
          glow: 'rgba(244, 63, 94, 0.4)',
          pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'violet':
        return {
          bg: 'bg-violet-500/15',
          border: 'border-violet-500/50',
          text: 'text-violet-400',
          glow: 'rgba(139, 92, 246, 0.4)',
          pill: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          glow: 'rgba(16, 185, 129, 0.4)',
          pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'sky':
        return {
          bg: 'bg-sky-500/15',
          border: 'border-sky-500/50',
          text: 'text-sky-400',
          glow: 'rgba(14, 165, 233, 0.4)',
          pill: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        };
      case 'teal':
        return {
          bg: 'bg-teal-500/15',
          border: 'border-teal-500/50',
          text: 'text-teal-400',
          glow: 'rgba(20, 184, 166, 0.4)',
          pill: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        };
      default:
        return {
          bg: 'bg-[#8B5CF6]/15',
          border: 'border-[#8B5CF6]/50',
          text: 'text-[#A78BFA]',
          glow: 'rgba(92, 108, 242, 0.4)',
          pill: 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/40',
        };
    }
  };

  const style = getColorClasses(currentAchievement.color);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        {/* Animated Background Confetti Light Rays */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-30">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            className="w-[600px] h-[600px] rounded-full bg-conic-gradient from-amber-500/20 via-indigo-500/20 via-emerald-500/20 to-amber-500/20 blur-2xl"
          />
        </div>

        <motion.div
          key={currentAchievement.id}
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative w-full max-w-md bg-surface border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(245,158,11,0.25)] text-center overflow-hidden z-10"
        >
          {/* Close Icon Top Right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-ink-muted hover:text-ink hover:bg-surface-sunk rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner Tagline */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full text-amber-300 text-xs font-mono font-bold tracking-widest uppercase mb-6 shadow-xs animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Achievement Unlocked!</span>
          </div>

          {/* Animated Glowing Badge Circle */}
          <div className="relative mx-auto w-28 h-28 mb-6 flex items-center justify-center">
            {/* Outer Rotating Pulse Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              className={`absolute inset-0 rounded-full border-2 border-dashed ${style.border}`}
            />

            {/* Glowing Backdrop */}
            <div
              className={`absolute inset-2 rounded-full ${style.bg} blur-md`}
              style={{ boxShadow: `0 0 40px ${style.glow}` }}
            />

            {/* Core Badge Container */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.15, 1] }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
              className={`relative z-10 w-24 h-24 rounded-2xl ${style.bg} border-2 ${style.border} flex items-center justify-center ${style.text} shadow-xl transform rotate-3 hover:rotate-0 transition-transform`}
            >
              {renderBadgeIcon(currentAchievement.icon, 'w-12 h-12')}
            </motion.div>
          </div>

          {/* Category Pill & XP Points */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`px-2.5 py-0.5 border text-[11px] font-mono font-bold rounded-md ${style.pill}`}>
              {currentAchievement.category}
            </span>
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold rounded-md flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>+{currentAchievement.points} PTS</span>
            </span>
          </div>

          {/* Achievement Title */}
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-ink mb-2 tracking-tight">
            {currentAchievement.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-ink-muted leading-relaxed mb-6 max-w-xs mx-auto">
            {currentAchievement.description}
          </p>

          {/* Multi-unlock pagination indicator */}
          {achievementsToDisplay.length > 1 && (
            <div className="text-xs font-mono text-ink-muted mb-4 flex items-center justify-center gap-1.5">
              <span>Badge {currentIndex + 1} of {achievementsToDisplay.length}</span>
              <div className="flex gap-1">
                {achievementsToDisplay.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentIndex ? 'bg-amber-400 w-4' : 'bg-surface-sunk'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleNext}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-mono font-bold rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
            <span>
              {currentIndex < achievementsToDisplay.length - 1 ? 'Next Achievement' : 'Claim Badge & Continue'}
            </span>
            {currentIndex < achievementsToDisplay.length - 1 && <ChevronRight className="w-4 h-4" />}
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
