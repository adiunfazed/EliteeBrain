import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Scale, Lightbulb, ArrowRight } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { adaptiveSignals, realityVsPlan } from '../lib/adaptive';

interface Props {
  input: MomentumInput;
  onGo?: (pane: 'today' | 'tasks' | 'goals' | 'routine' | 'focus') => void;
}

/**
 * Planned versus actual.
 *
 * The point is to make over-planning visible so the next plan is realistic.
 * Framing matters here: a low number means the plan was too big, not that the
 * person failed — the copy says so explicitly.
 */
export const RealityVsPlan: React.FC<Props> = ({ input, onGo }) => {
  const report = useMemo(() => realityVsPlan(input, 7), [input]);
  const signals = useMemo(() => adaptiveSignals(input), [input]);

  return (
    <div className="eb-panel p-4 sm:p-5">
      <span className="eb-label flex items-center gap-1.5">
        <Scale className="w-3 h-3 shrink-0 text-[#A78BFA]" />
        Did you do what you planned?
      </span>

      {!report.hasPlan ? (
        <p className="text-[11px] text-[#98A2B3] mt-2.5 leading-relaxed">
          Nothing scheduled in the last week. Give tasks a date, or add routine blocks, and
          this compares what you planned with what happened.
        </p>
      ) : (
        <>
          {report.execution !== null && (
            <p className="eb-heading text-2xl tabular-nums mt-1">
              {Math.round(report.execution * 100)}%
              <span className="text-xs font-bold text-[#7E8899] ml-2">executed</span>
            </p>
          )}

          <div className="mt-3 space-y-2.5">
            {report.rows
              .filter((r) => r.ratio !== null)
              .map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-[#98A2B3]">{r.label}</span>
                    <span className="text-[#7E8899] tabular-nums">
                      {r.actual} / {r.planned} {r.unit}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-[#171B22] rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        (r.ratio as number) >= 0.8
                          ? 'bg-emerald-500'
                          : (r.ratio as number) >= 0.5
                            ? 'bg-[#8B5CF6]'
                            : 'bg-amber-500'
                      }`}
                      initial={false}
                      animate={{ width: `${Math.round((r.ratio as number) * 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
          </div>

          {report.insight && (
            <p className="text-[11px] text-[#98A2B3] mt-3.5 leading-relaxed">{report.insight}</p>
          )}
        </>
      )}

      {signals.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-[#2A313C] space-y-2">
          <span className="eb-label flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3 shrink-0 eb-warn" />
            What your data shows
          </span>
          {signals.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-3">
              <p className="text-[11px] text-[#98A2B3] leading-relaxed min-w-0">{s.message}</p>
              {onGo && (
                <button
                  onClick={() =>
                    onGo(
                      s.key === 'routine' || s.key === 'overload'
                        ? 'routine'
                        : s.key === 'estimates'
                          ? 'focus'
                          : 'tasks'
                    )
                  }
                  className="eb-press shrink-0 text-[10px] font-mono font-bold text-[var(--signal-ink)] flex items-center gap-1"
                >
                  Open
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
