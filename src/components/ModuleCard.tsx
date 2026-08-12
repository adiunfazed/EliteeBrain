import React from 'react';
import { motion } from 'motion/react';
import { ModuleConfig, ModuleState } from '../types';
import {
  Binary,
  Zap,
  Layers,
  Compass,
  Boxes,
  Shuffle,
  Box,
  Target,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Award,
  Crown,
  Lock,
  Brain,
  Sparkles,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface Props {
  config: ModuleConfig;
  state: ModuleState;
  isProUser?: boolean;
  index?: number;
  onLaunch: () => void;
}

export const ModuleCard: React.FC<Props> = ({ config, state, isProUser, index = 0, onLaunch }) => {
  const isLocked = Boolean(config.isPro && !isProUser);
  const [isPressed, setIsPressed] = React.useState(false);

  const getIcon = () => {
    switch (config.icon) {
      case 'Binary':
        return <Binary className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-indigo-500 dark:text-[#5C6CF2]" />;
      case 'Layers':
        return <Layers className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
      case 'Compass':
        return <Compass className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
      case 'Boxes':
        return <Boxes className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
      case 'Shuffle':
        return <Shuffle className="w-5 h-5 text-indigo-500 dark:text-indigo-300" />;
      case 'Cuboid':
        return <Box className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      case 'Target':
        return <Target className="w-5 h-5 text-teal-500 dark:text-teal-400" />;
      default:
        return <Brain className="w-5 h-5 text-[#5C6CF2]" />;
    }
  };

  const handleCardClick = () => {
    soundFx.playClick();
    onLaunch();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.08 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 22,
        delay: Math.min(index * 0.04, 0.2),
      }}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onClick={handleCardClick}
      className={`group eb-lift eb-shine ${config.isPro ? 'eb-glow-amber' : 'eb-glow-indigo'} relative flex flex-col justify-between bg-surface border rounded-2xl p-4 sm:p-5 cursor-pointer select-none touch-manipulation overflow-hidden ${
        isPressed
          ? 'scale-[0.96] border-[#5C6CF2] shadow-[0_15px_30px_-5px_rgba(92,108,242,0.35)] bg-[#5C6CF2]/10'
          : isLocked
          ? 'border-amber-500/30 hover:border-amber-500/80 active:border-amber-500 active:scale-[0.96] shadow-md'
          : state.completedToday
          ? 'border-emerald-500/40 hover:border-emerald-500 active:border-emerald-500 active:scale-[0.96] shadow-md'
          : 'border-rule hover:border-[#5C6CF2]/80 active:border-[#5C6CF2] active:scale-[0.96] hover:shadow-[0_12px_30px_-5px_rgba(92,108,242,0.25)]'
      }`}
    >
      {/* 4px Domain Left Accent Strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[5px] group-hover:w-[7px] transition-all duration-200"
        style={{ backgroundColor: config.domainColor }}
      />

      {/* Module Light Opacity Background Watermark */}
      {(() => {
        switch (config.id) {
          case 'digit-span':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-rose-500 font-mono text-6xl font-black select-none">
                842
              </div>
            );
          case 'stroop':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-violet-500 font-display text-5xl font-black uppercase select-none">
                RGB
              </div>
            );
          case 'n-back':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-emerald-500 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="currentColor">
                  <rect x="10" y="10" width="22" height="22" rx="4" />
                  <rect x="39" y="10" width="22" height="22" rx="4" />
                  <rect x="68" y="10" width="22" height="22" rx="4" />
                  <rect x="10" y="39" width="22" height="22" rx="4" />
                  <rect x="39" y="39" width="22" height="22" rx="4" fillOpacity="0.8" />
                  <rect x="68" y="39" width="22" height="22" rx="4" />
                  <rect x="10" y="68" width="22" height="22" rx="4" />
                  <rect x="39" y="68" width="22" height="22" rx="4" />
                  <rect x="68" y="68" width="22" height="22" rx="4" />
                </svg>
              </div>
            );
          case 'stillness':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-blue-500 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
                  <circle cx="50" cy="50" r="15" />
                  <circle cx="50" cy="50" r="30" strokeDasharray="4 4" />
                  <circle cx="50" cy="50" r="42" />
                </svg>
              </div>
            );
          case 'pattern-matrix':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-amber-500 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="currentColor">
                  <polygon points="50,10 90,80 10,80" opacity="0.6" />
                  <circle cx="50" cy="55" r="15" />
                </svg>
              </div>
            );
          case 'cognitive-shift':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-indigo-500 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6">
                  <path d="M20 30 H80 L65 15 M80 30 L65 45" />
                  <path d="M80 70 H20 L35 55 M20 70 L35 85" />
                </svg>
              </div>
            );
          case 'visuospatial':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-indigo-400 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
                  <path d="M30 20 L70 20 L70 60 L30 60 Z" />
                  <path d="M45 35 L85 35 L85 75 L45 75 Z" />
                  <line x1="30" y1="20" x2="45" y2="35" />
                  <line x1="70" y1="20" x2="85" y2="35" />
                  <line x1="70" y1="60" x2="85" y2="75" />
                  <line x1="30" y1="60" x2="45" y2="75" />
                </svg>
              </div>
            );
          case 'reaction-inhibitor':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-teal-400 select-none">
                <svg className="w-20 h-20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5">
                  <circle cx="50" cy="50" r="40" />
                  <circle cx="50" cy="50" r="25" />
                  <circle cx="50" cy="50" r="10" fill="currentColor" />
                </svg>
              </div>
            );
          default:
            return null;
        }
      })()}

      {/* Main Content Area */}
      <div className="pl-2 relative z-10">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-surface-sunk border border-rule group-hover:border-[#5C6CF2]/60 transition-colors shadow-xs">
              {getIcon()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-bold">
                  {config.category}
                </span>
                {config.isPro && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold font-mono text-ink group-hover:text-[#5C6CF2] transition-colors">
                {config.name}
              </h4>
            </div>
          </div>

          {/* Level Display */}
          <div className="text-right shrink-0">
            <span className="block text-[9px] font-mono text-ink-muted uppercase">LEVEL</span>
            <span className="text-base font-mono font-bold text-ink">
              {isLocked ? 0 : state.level}
            </span>
          </div>
        </div>

        {/* Tagline & Description */}
        <p className="text-xs font-mono font-semibold text-ink mb-1">
          {config.tagline}
        </p>
        <p className="text-xs text-ink-muted leading-relaxed mb-4 line-clamp-2">
          {config.description}
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 p-2.5 bg-surface-sunk/80 border border-rule rounded-xl mb-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <div>
              <span className="block text-[9px] text-ink-muted">BEST SCORE</span>
              <span className="font-bold text-ink">{state.bestScore > 0 ? `${state.bestScore}%` : '--'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <div>
              <span className="block text-[9px] text-ink-muted">TOTAL XP</span>
              <span className="font-bold text-ink">{state.xp} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action Button Bar */}
      <div className="pl-2 pt-2.5 border-t border-rule flex items-center justify-between gap-2 relative z-10">
        {isLocked ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
            <Lock className="w-3.5 h-3.5" /> Locked Pro
          </span>
        ) : state.completedToday ? (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done Today
          </span>
        ) : (
          <span className="text-xs font-mono text-[#5C6CF2] font-semibold">
            Ready
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          className={`eb-press eb-shine px-3.5 py-1.5 font-mono text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs ${
            isLocked
              ? 'bg-amber-600 text-white hover:bg-amber-500'
              : state.completedToday
              ? 'bg-surface-sunk text-ink border border-rule hover:bg-surface'
              : 'bg-ink text-ground hover:bg-[#5C6CF2] hover:text-white'
          }`}
        >
          {isLocked ? (
            <>
              <Crown className="w-3.5 h-3.5" />
              <span>Unlock</span>
            </>
          ) : (
            <>
              <span>{state.completedToday ? 'Replay' : 'Start'}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      {/* Visual Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center opacity-90 group-hover:opacity-100 transition-opacity">
          <div className="p-3 bg-slate-900/95 border border-amber-500/60 rounded-2xl shadow-xl flex flex-col items-center space-y-2 max-w-[200px]">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              PRO MODULE
            </span>
            <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Tap to unlock all 8
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
