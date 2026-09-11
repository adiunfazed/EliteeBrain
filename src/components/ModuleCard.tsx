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
        return <Calculator className="w-5 h-5 shrink-0 text-violet-500 dark:text-[var(--signal-ink)]" />;
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
      className="group relative flex flex-col rounded-xl p-3 cursor-pointer select-none touch-manipulation overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${
          state.completedToday
            ? 'color-mix(in oklab, var(--done) 38%, var(--rule))'
            : isPressed
              ? 'var(--signal)'
              : 'var(--rule)'
        }`,
        transform: isPressed ? 'scale(0.975)' : undefined,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset',
      }}
    >
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

        <p className="t-meta mt-1">{config.category}</p>

        <div className="flex items-center gap-1.5 mt-auto pt-3 flex-wrap">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold eb-warn">
              <Lock className="w-3.5 h-3.5 shrink-0" /> Pro
            </span>
          ) : state.completedToday ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold eb-done">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Done
            </span>
          ) : (
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-[11px] font-semibold shrink-0"
                style={{ color: config.domainColor }}
              >
                {state.bestScore > 0 ? `Best ${state.bestScore}%` : 'Not started'}
              </span>
              {state.totalSessions > 0 && (
                <span className="t-meta truncate">· {state.totalSessions}×</span>
              )}
            </span>
          )}
        </div>
      </div>

    </motion.div>
  );
};
