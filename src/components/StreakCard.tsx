import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Check, Shield } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { WEEKDAY_INITIALS, computeStreak } from '../lib/streak';

interface Props {
  input: MomentumInput;
  /** Activity before this date does not count. */
  resetFrom?: string;
}

/**
 * Daily streak, derived from recorded activity rather than a stored counter —
 * so it is identical on every device the moment the underlying data syncs.
 */
export const StreakCard: React.FC<Props> = ({ input, resetFrom }) => {
  const streak = useMemo(() => computeStreak(input, undefined, resetFrom), [input, resetFrom]);

  return (
    <div className="eb-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eb-label flex items-center gap-1.5">
            <Flame className={`w-3 h-3 ${streak.current > 0 ? 'text-orange-400' : 'text-[var(--ink-dim)]'}`} />
            Streak
          </span>
          <p className="eb-stat text-3xl mt-1.5">
            {streak.current}
            <span className="text-xs font-bold text-[var(--ink-dim)] ml-2">
              {streak.current === 1 ? 'day' : 'days'}
            </span>
          </p>
          <p className="text-[10px] font-mono text-[var(--ink-dim)] mt-0.5">
            {streak.freezeInUse
              ? 'A missed day was covered by a protection'
              : streak.current === 0
                ? 'Do one thing today to start it'
                : streak.activeToday
                  ? `Best: ${streak.best} days`
                  : 'Not logged today yet — still alive'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {streak.best > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#8B5CF6]/12 border border-[#8B5CF6]/30 text-[#A78BFA]">
              Best {streak.best}
            </span>
          )}
          {streak.freezesAvailable > 0 && (
            <span
              title="Earned by staying consistent. Covers one missed day."
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#4C9AFF]/12 border border-[#4C9AFF]/30 text-[#7FA6FF] flex items-center gap-1"
            >
              <Shield className="w-2.5 h-2.5 shrink-0" />
              {streak.freezesAvailable}
            </span>
          )}
        </div>
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
                      ? 'bg-transparent text-[var(--rule-strong)]'
                      : 'eb-day-off'
              }`}
            >
              {d.active ? (
                <Check className="w-4 h-4 shrink-0 stroke-[3]" />
              ) : (
                <span className="text-[11px] font-mono font-bold tabular-nums">
                  {new Date(`${d.date}T00:00:00`).getDate()}
                </span>
              )}
            </motion.div>
            <span
              className={`text-[11px] font-mono font-bold ${
                d.isToday ? 'text-[#A78BFA]' : 'text-[var(--ink-dim)]'
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
