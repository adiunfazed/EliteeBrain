import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Check } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { WEEKDAY_INITIALS, computeStreak } from '../lib/streak';

interface Props {
  input: MomentumInput;
}

/**
 * Daily streak, derived from recorded activity rather than a stored counter —
 * so it is identical on every device the moment the underlying data syncs.
 */
export const StreakCard: React.FC<Props> = ({ input }) => {
  const streak = useMemo(() => computeStreak(input), [input]);

  return (
    <div className="eb-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eb-label flex items-center gap-1.5">
            <Flame className={`w-3 h-3 ${streak.current > 0 ? 'text-orange-400' : 'text-[#5A6472]'}`} />
            Streak
          </span>
          <p className="eb-stat text-3xl mt-1.5">
            {streak.current}
            <span className="text-xs font-bold text-[#5A6472] ml-2">
              {streak.current === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="text-[10px] font-mono text-[#5A6472] mt-0.5">
            {streak.current === 0
              ? 'Do one thing today to start it'
              : streak.activeToday
                ? `Best: ${streak.best} days`
                : 'Not logged today yet — still alive'}
          </p>
        </div>

        {streak.best > 0 && (
          <span className="shrink-0 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#8B5CF6]/12 border border-[#8B5CF6]/30 text-[#A78BFA]">
            Best {streak.best}
          </span>
        )}
      </div>

      {/* This week */}
      <div className="grid grid-cols-7 gap-1.5 mt-4">
        {streak.week.map((d, i) => (
          <div key={d.date} className="flex flex-col items-center gap-1.5 min-w-0">
            <motion.div
              initial={false}
              animate={{ scale: d.isToday ? 1.06 : 1 }}
              className={`eb-day w-full aspect-square max-w-[44px] text-xs ${
                d.active
                  ? 'eb-day-on'
                  : d.isToday
                    ? 'eb-day-today'
                    : d.isFuture
                      ? 'bg-transparent text-[#3A424F]'
                      : 'eb-day-off'
              }`}
            >
              {d.active ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                <span className="text-[11px] font-mono font-bold tabular-nums">
                  {new Date(`${d.date}T00:00:00`).getDate()}
                </span>
              )}
            </motion.div>
            <span
              className={`text-[9px] font-mono font-bold ${
                d.isToday ? 'text-[#A78BFA]' : 'text-[#5A6472]'
              }`}
            >
              {d.isToday ? 'NOW' : WEEKDAY_INITIALS[i]}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
};
