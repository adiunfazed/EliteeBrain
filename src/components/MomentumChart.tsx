import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';
import type { MomentumInput, MomentumRange } from '../lib/momentum';
import { momentumInsights, momentumSeries, summarise } from '../lib/momentum';

interface Props {
  input: MomentumInput;
}

const RANGES: { id: MomentumRange; label: string }[] = [
  { id: 7, label: '7D' },
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
  { id: 365, label: '1Y' },
];

/**
 * Life Momentum over time.
 *
 * Days with no recorded data are gaps in the line rather than zeroes — drawing
 * them at the bottom would imply a bad day when the truth is simply that
 * nothing was logged.
 */
export const MomentumChart: React.FC<Props> = ({ input }) => {
  const [range, setRange] = useState<MomentumRange>(30);

  const series = useMemo(() => momentumSeries(input, range), [input, range]);
  const summary = useMemo(() => summarise(series), [series]);
  const insights = useMemo(() => momentumInsights(series), [series]);

  const W = 320;
  const H = 90;

  const path = useMemo(() => {
    const pts = series
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.score !== null);
    if (pts.length < 2) return '';

    return pts
      .map(({ p, i }, idx) => {
        const x = (i / Math.max(1, series.length - 1)) * W;
        const y = H - ((p.score as number) / 100) * H;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series]);

  const hasData = summary.current !== null;

  return (
    <div className="eb-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <span className="eb-label flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[#A78BFA]" />
            Life Momentum
          </span>
          {hasData ? (
            <p className="text-2xl font-black font-mono text-[#F4F6F8] tabular-nums mt-1">
              {summary.current}
              {summary.trend !== null && (
                <span
                  className={`text-xs font-bold ml-2 ${
                    summary.trend > 0
                      ? 'text-emerald-300'
                      : summary.trend < 0
                        ? 'text-amber-300'
                        : 'text-[#5A6472]'
                  }`}
                >
                  {summary.trend > 0 ? '+' : ''}
                  {summary.trend}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm font-bold text-[#98A2B3] mt-1">No activity logged yet</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg border ${
                range === r.id
                  ? 'text-[#A78BFA] bg-[#8B5CF6]/15 border-[#8B5CF6]/35'
                  : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24 mt-4">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="#171B22" strokeWidth="1" />
        ))}
        {path && (
          <motion.path
            d={path}
            fill="none"
            stroke="#A855F7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </svg>

      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-3">
          {series[series.length - 1].components.map((c) => (
            <div
              key={c.key}
              className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1.5 min-w-0"
            >
              <p className="text-[9px] font-mono text-[#5A6472] truncate">{c.label}</p>
              <p className="text-[11px] font-mono font-bold text-[#F4F6F8] tabular-nums">
                {c.value === null ? '—' : `${Math.round(c.value * 100)}%`}
              </p>
            </div>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <ul className="mt-3 space-y-1">
          {insights.map((t) => (
            <li key={t} className="text-[11px] text-[#98A2B3] leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] font-mono text-[#5A6472] mt-3 leading-relaxed">
        Calculated from activity you logged. Days with nothing recorded are left blank rather
        than counted as zero. This measures execution — not intelligence, health or worth.
      </p>
    </div>
  );
};
