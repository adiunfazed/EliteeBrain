import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { GoalSnapshot } from '../types';

interface Props {
  snapshots: GoalSnapshot[];
}

/**
 * Progress for one goal over time.
 *
 * Only renders once there are at least two recorded points — a single dot is
 * not a trend, and drawing one would imply history that doesn't exist.
 */
export const GoalHistoryChart: React.FC<Props> = ({ snapshots }) => {
  const W = 240;
  const H = 44;

  const path = useMemo(() => {
    if (snapshots.length < 2) return '';
    return snapshots
      .map((s, i) => {
        const x = (i / (snapshots.length - 1)) * W;
        const y = H - (s.percent / 100) * H;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [snapshots]);

  if (!path) return null;

  const first = snapshots[0].percent;
  const last = snapshots[snapshots.length - 1].percent;
  const delta = last - first;

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-mono font-bold text-[#5A6472] tracking-widest uppercase">
          Progress · {snapshots.length} days
        </span>
        <span
          className={`text-[10px] font-mono font-bold tabular-nums ${
            delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-amber-300' : 'text-[#5A6472]'
          }`}
        >
          {delta > 0 ? '+' : ''}
          {delta}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-11 mt-1.5">
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#171B22" strokeWidth="1" />
        <motion.path
          d={path}
          fill="none"
          stroke="#A855F7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
    </div>
  );
};
