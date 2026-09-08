import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { MomentumInput } from '../lib/momentum';
import { buildInsights, insightReadiness } from '../lib/insights';

interface Props {
  input: MomentumInput;
}

const TONE = {
  good: { color: 'var(--done)', Icon: TrendingUp },
  watch: { color: 'var(--warn)', Icon: AlertTriangle },
  neutral: { color: 'var(--signal)', Icon: Sparkles },
} as const;

/**
 * Patterns from the user's own history.
 *
 * Shows nothing rather than something generic when the data is thin. An
 * insight that could apply to anyone is worse than an empty state, because it
 * makes the genuine ones look equally hollow.
 */
export const InsightsSection: React.FC<Props> = ({ input }) => {
  const insights = useMemo(() => buildInsights(input), [input]);
  const readiness = useMemo(() => insightReadiness(input), [input]);

  if (insights.length === 0) {
    return (
      <div className="text-center py-10 px-6">
        <span
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: 'var(--surface-sunk)' }}
        >
          <Lightbulb className="w-6 h-6 shrink-0 text-[var(--ink-dim)]" />
        </span>
        <h3 className="t-section mt-4">Not enough history yet</h3>
        <p className="t-sub mt-2 max-w-xs mx-auto leading-relaxed">
          {readiness.needs || 'Keep using the app and patterns in your own data will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {insights.map((insight, i) => {
        const { color, Icon } = TONE[insight.tone];

        return (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.25) }}
            className="rounded-2xl border p-4"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--rule)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color }} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug break-words">
                  {insight.headline}
                </p>
                <p className="t-sub mt-1.5 leading-relaxed">{insight.advice}</p>
              </div>
            </div>
          </motion.div>
        );
      })}

      <p className="t-sub text-center pt-2 leading-relaxed">
        Based only on what you have actually recorded.
      </p>
    </div>
  );
};
