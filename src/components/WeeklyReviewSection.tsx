import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CalendarCheck, Check, AlertCircle, Compass, ArrowRight } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { lifeAreas, weeklyReview } from '../lib/review';

interface Props {
  input: MomentumInput;
  /** Opens the screen where the named bottleneck can actually be addressed. */
  onGo?: (pane: 'today' | 'tasks' | 'goals' | 'routine' | 'focus') => void;
}

const AREA_TINT: Record<string, string> = {
  study: 'bg-[#8B5CF6]',
  work: 'bg-sky-500',
  fitness: 'bg-amber-500',
  personal: 'bg-rose-500',
  sleep: 'bg-indigo-500',
  focus: 'bg-emerald-500',
  habits: 'bg-[#8B5CF6]',
  goals: 'bg-[#A855F7]',
};

export const WeeklyReviewSection: React.FC<Props> = ({ input, onGo }) => {
  const review = useMemo(() => weeklyReview(input), [input]);
  const areas = useMemo(() => lifeAreas(input, 7), [input]);

  return (
    <div className="space-y-4">
      {/* Life areas */}
      <div className="eb-panel p-4 sm:p-5">
        <span className="eb-label flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-[#A78BFA]" />
          Life areas · last 7 days
        </span>

        <div className="mt-3 space-y-2.5">
          {areas.map((a) => (
            <div key={a.key} className="flex items-center gap-3">
              <span className="text-[11px] text-[#98A2B3] w-16 shrink-0 truncate">
                {a.label}
              </span>
              <div className="flex-1 min-w-0 h-2 bg-[#171B22] rounded-full overflow-hidden">
                {a.value !== null && (
                  <motion.div
                    className={`h-full rounded-full ${AREA_TINT[a.key] || 'bg-slate-500'}`}
                    initial={false}
                    animate={{ width: `${Math.round(a.value * 100)}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-mono tabular-nums w-10 text-right shrink-0 ${
                  a.value === null ? 'text-[#5A6472]' : 'text-[#F4F6F8]'
                }`}
              >
                {a.value === null ? '—' : `${Math.round(a.value * 100)}%`}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-mono text-[#5A6472] mt-3 leading-relaxed">
          Areas you don't track show a dash rather than zero — no data isn't the same as no
          effort.
        </p>
      </div>

      {/* Weekly review */}
      <div className="eb-panel p-4 sm:p-5">
        <span className="eb-label flex items-center gap-1.5">
          <CalendarCheck className="w-3 h-3 eb-done" />
          This week
        </span>

        {!review.hasData ? (
          <p className="text-[11px] text-[#98A2B3] mt-2.5 leading-relaxed">
            Nothing logged in the last seven days yet. Complete a task, run a focus session or
            tick a habit and this fills in.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[
                { label: 'Tasks', value: `${review.tasksCompleted}/${review.tasksPlanned}` },
                { label: 'Focus', value: `${Math.round(review.focusMinutes / 60)}h ${review.focusMinutes % 60}m` },
                {
                  label: 'Habits',
                  value: review.habitRate === null ? '—' : `${Math.round(review.habitRate * 100)}%`,
                },
                { label: 'Sleep', value: `${review.sleepNights}n` },
              ].map((s) => (
                <div
                  key={s.label}
                  className="eb-card-sunk p-2.5 min-w-0"
                >
                  <p className="text-[9px] font-mono text-[#5A6472] truncate">{s.label}</p>
                  <p className="eb-heading text-sm tabular-nums mt-0.5">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {review.wentWell.length > 0 && (
              <div className="mt-3.5">
                <p className="text-[10px] font-mono font-bold eb-done tracking-widest uppercase">
                  What went well
                </p>
                <ul className="mt-1.5 space-y-1">
                  {review.wentWell.map((t) => (
                    <li key={t} className="text-[11px] text-[#98A2B3] flex items-start gap-2">
                      <Check className="w-3 h-3 eb-done shrink-0 mt-0.5 stroke-[3]" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {review.missed.length > 0 && (
              <div className="mt-3.5">
                <p className="text-[10px] font-mono font-bold eb-warn tracking-widest uppercase">
                  What slipped
                </p>
                <ul className="mt-1.5 space-y-1">
                  {review.missed.map((t) => (
                    <li key={t} className="text-[11px] text-[#98A2B3] flex items-start gap-2">
                      <AlertCircle className="w-3 h-3 eb-warn shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {review.oneThing && (
              <div className="mt-3.5 p-3 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/25">
                <p className="text-[10px] font-mono font-bold text-[#A78BFA] tracking-widest uppercase">
                  One thing next week
                </p>
                <p className="text-[11px] text-[#F4F6F8] mt-1 leading-relaxed">
                  {review.oneThing}
                </p>

                {onGo && review.bottleneck && (
                  <button
                    onClick={() =>
                      onGo(
                        review.bottleneck === 'Habits'
                          ? 'goals'
                          : review.bottleneck === 'Focus'
                            ? 'focus'
                            : review.bottleneck === 'Routine'
                              ? 'routine'
                              : 'tasks'
                      )
                    }
                    className="eb-btn-primary mt-3 px-3.5 py-2 text-[11px] font-mono flex items-center gap-1.5"
                  >
                    Fix it now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
