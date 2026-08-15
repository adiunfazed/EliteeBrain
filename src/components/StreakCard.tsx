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
    <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase flex items-center gap-1.5">
            <Flame className={`w-3 h-3 ${streak.current > 0 ? 'text-orange-400' : 'text-[#5A6472]'}`} />
            Streak
          </span>
          <p className="text-2xl font-black font-mono text-[#F4F6F8] tabular-nums mt-1">
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
              className={`w-full aspect-square max-w-[42px] rounded-xl border flex items-center justify-center ${
                d.active
                  ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-[0_0_16px_-4px_rgba(139,92,246,0.9)]'
                  : d.isToday
                    ? 'bg-[#171B22] border-[#8B5CF6]/50 text-[#A78BFA]'
                    : d.isFuture
                      ? 'bg-transparent border-[#20252E] text-[#3A424F]'
                      : 'bg-[#0B0E13] border-[#2A313C] text-[#5A6472]'
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

      <p className="text-[10px] font-mono text-[#5A6472] mt-3 leading-relaxed">
        A day counts when you complete a task, meet a habit, focus, tick a routine block or log
        sleep.
      </p>
    </div>
  );
};
