import React from 'react';
import { motion } from 'motion/react';
import { ModuleConfig, ModuleState } from '../types';
import { Mic, BookOpen, Calculator,
  Binary,
  Zap,
  Layers,
  Compass,
  Boxes,
  Shuffle,
  Box,
  Target,
  CheckCircle2,
  Lock,
  Brain,
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
        return <Binary className="w-5 h-5 shrink-0 text-rose-500 dark:eb-danger" />;
      case 'Zap':
        return <Zap className="w-5 h-5 shrink-0 text-indigo-500 dark:text-[#8B5CF6]" />;
      case 'Layers':
        return <Layers className="w-5 h-5 shrink-0 text-emerald-500 dark:eb-done" />;
      case 'Compass':
        return <Compass className="w-5 h-5 shrink-0 text-blue-500 dark:text-blue-400" />;
      case 'Boxes':
        return <Boxes className="w-5 h-5 shrink-0 text-amber-500 dark:eb-warn" />;
      case 'Shuffle':
        return <Shuffle className="w-5 h-5 shrink-0 text-indigo-500 dark:text-indigo-300" />;
      case 'Cuboid':
        return <Box className="w-5 h-5 shrink-0 text-indigo-500 dark:text-indigo-400" />;
      case 'Target':
        return <Target className="w-5 h-5 shrink-0 text-teal-500 dark:text-teal-400" />;
      case 'Mic':
        return <Mic className="w-5 h-5 shrink-0 text-sky-400" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />;
      case 'Calculator':
        return <Calculator className="w-5 h-5 shrink-0 text-violet-500 dark:text-[#A78BFA]" />;
      default:
        return <Brain className="w-5 h-5 shrink-0 text-[#8B5CF6]" />;
    }
  };

  const handleCardClick = () => {
    soundFx.playClick();
    onLaunch();
  };

  return (
    <motion.div
      // The first two cards animate in on mount so the section never looks
      // like it holds a single module. Everything below still reveals on
      // scroll, which is what tells people to keep going.
      initial={index < 2 ? { opacity: 0, y: 10 } : { opacity: 0, y: 28, scale: 0.96 }}
      {...(index < 2
        ? { animate: { opacity: 1, y: 0, scale: 1 } }
        : {
            whileInView: { opacity: 1, y: 0, scale: 1 },
            viewport: { once: true, amount: 0.2, margin: '0px 0px -40px 0px' },
          })}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        delay: Math.min(index * 0.07, 0.35),
      }}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      onClick={handleCardClick}
      className={`group eb-lift eb-shine ${config.isPro ? 'eb-glow-amber' : 'eb-glow-brand'} relative flex flex-col justify-between bg-surface border rounded-2xl p-3.5 cursor-pointer select-none touch-manipulation overflow-hidden ${
        isPressed
          ? 'scale-[0.96] border-[#8B5CF6] shadow-[0_15px_30px_-5px_rgba(92,108,242,0.35)] bg-[#8B5CF6]/10'
          : isLocked
          ? 'border-amber-500/30 hover:border-amber-500/80 active:border-amber-500 active:scale-[0.96] shadow-md'
          : state.completedToday
          ? 'border-emerald-500/40 hover:border-emerald-500 active:border-emerald-500 active:scale-[0.96] shadow-md'
          : 'border-rule hover:border-[#8B5CF6]/80 active:border-[#8B5CF6] active:scale-[0.96] hover:shadow-[0_12px_30px_-5px_rgba(92,108,242,0.25)]'
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
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="currentColor">
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
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
                  <circle cx="50" cy="50" r="15" />
                  <circle cx="50" cy="50" r="30" strokeDasharray="4 4" />
                  <circle cx="50" cy="50" r="42" />
                </svg>
              </div>
            );
          case 'pattern-matrix':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-amber-500 select-none">
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="currentColor">
                  <polygon points="50,10 90,80 10,80" opacity="0.6" />
                  <circle cx="50" cy="55" r="15" />
                </svg>
              </div>
            );
          case 'cognitive-shift':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-indigo-500 select-none">
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6">
                  <path d="M20 30 H80 L65 15 M80 30 L65 45" />
                  <path d="M80 70 H20 L35 55 M20 70 L35 85" />
                </svg>
              </div>
            );
          case 'visuospatial':
            return (
              <div className="absolute right-2 bottom-2 pointer-events-none opacity-[0.08] dark:opacity-[0.14] text-indigo-400 select-none">
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
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
                <svg className="w-20 h-20 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5">
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

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2">
          <span
            className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: `color-mix(in oklab, ${config.domainColor} 18%, transparent)` }}
          >
            {getIcon()}
          </span>

          {/* Level ring: progress within the current level, at a glance. */}
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-sunk)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={config.domainColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 15}
                strokeDashoffset={2 * Math.PI * 15 * (1 - Math.min(1, (state.xp % 100) / 100))}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums">
              {isLocked ? '–' : state.level}
            </span>
          </div>
        </div>

        <h4 className="text-[14px] font-semibold leading-tight mt-3 break-words">
          {config.name}
        </h4>

        <div className="flex items-center gap-1.5 mt-auto pt-3 flex-wrap">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold eb-warn">
              <Lock className="w-3 h-3 shrink-0" /> Pro
            </span>
          ) : state.completedToday ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold eb-done">
              <CheckCircle2 className="w-3 h-3 shrink-0" /> Done
            </span>
          ) : (
            <span
              className="text-[11px] font-semibold"
              style={{ color: config.domainColor }}
            >
              {state.bestScore > 0 ? `Best ${state.bestScore}%` : 'Not started'}
            </span>
          )}
        </div>
      </div>

    </motion.div>
  );
};
