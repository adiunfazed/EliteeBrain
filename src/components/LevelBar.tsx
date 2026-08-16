import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, Trophy } from 'lucide-react';
import type { UserProfile } from '../types';
import { XpInput, careerXp, levelFromXp, xpForDate } from '../lib/xp';
import { todayISO } from '../lib/tasks';

interface Props {
  profile: UserProfile;
  input: XpInput;
}

/**
 * Level and today's XP.
 *
 * Shows what was earned today alongside overall level, so progress is visible
 * on the day someone does the work rather than only in aggregate.
 */
export const LevelBar: React.FC<Props> = ({ profile, input }) => {
  const today = todayISO();
  const total = useMemo(() => careerXp(profile, input, today), [profile, input, today]);
  const level = useMemo(() => levelFromXp(total), [total]);
  const dayXp = useMemo(() => xpForDate(input, today), [input, today]);

  return (
    <div className="eb-card relative overflow-hidden p-4 sm:p-5">
      <div
        className="pointer-events-none absolute -top-20 -left-10 w-52 h-52 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'var(--signal)' }}
      />

      <div className="relative flex items-center gap-4">
        {/* Level badge */}
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-2xl eb-card-sunk flex flex-col items-center justify-center">
            <span className="eb-stat text-2xl text-[var(--signal-ink)]">{level.level}</span>
            <span className="text-[8px] font-mono font-bold text-[#8A93A5] tracking-widest">
              LEVEL
            </span>
          </div>
          {dayXp.perfect && (
            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#00C2A8] flex items-center justify-center">
              <Trophy className="w-3 h-3 text-[#04231F]" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="eb-label">Progress</span>
            <span className="text-[10px] font-mono text-[#8A93A5] tabular-nums">
              {level.xpToNext} XP to L{level.level + 1}
            </span>
          </div>

          <div className="eb-bar mt-2">
            <motion.div
              className="eb-bar-fill"
              initial={false}
              animate={{ width: `${level.progress * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] font-mono text-[#8A93A5] tabular-nums">
              {total.toLocaleString()} XP total
            </span>
            {dayXp.total > 0 && (
              <span className="text-[10px] font-mono font-bold text-[var(--signal-ink)] flex items-center gap-1">
                <Zap className="w-3 h-3" />+{dayXp.total} today
              </span>
            )}
          </div>
        </div>
      </div>

      {dayXp.perfect && (
        <p className="relative text-[10px] font-mono text-[#00C2A8] mt-3">
          Perfect day — everything you scheduled is done.
        </p>
      )}
    </div>
  );
};
