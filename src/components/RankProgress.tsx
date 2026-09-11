import React from 'react';
import { motion } from 'motion/react';
import { RankEmblem } from './RankEmblem';
import { tierFor, nextTierAfter, tierLabel, tierProgress } from '../lib/tiers';

interface Props {
  careerXp: number;
  /** Hides figures until the authoritative value arrives. */
  pending?: boolean;
}

/**
 * Rank and progression.
 *
 * States the three things that matter — where you are, where you are going,
 * and how far — in one glance. Previously rank was a coloured word in a box,
 * which told you nothing about progress.
 */
export const RankProgress: React.FC<Props> = ({ careerXp, pending = false }) => {
  const tier = tierFor(careerXp);
  const next = nextTierAfter(careerXp);
  const progress = tierProgress(careerXp);
  const toGo = next ? next.min - careerXp : 0;

  // Only hold back when there is genuinely nothing to show. With any XP at
  // all, the local figure is displayed and corrected when the server answers.
  if (pending && careerXp <= 0) {
    return (
      <div
        className="rounded-xl h-[132px] animate-pulse"
        style={{ background: 'var(--surface-sunk)' }}
      />
    );
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--rule)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset',
      }}
    >
      <div className="flex items-center gap-4">
        <RankEmblem tier={tier} size={54} />

        <div className="min-w-0 flex-1">
          <p className="eb-label">Rank</p>
          <p
            className="t-title mt-0.5 break-words"
            style={{ color: tier.color }}
          >
            {tierLabel(tier)}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="t-figure text-[26px]">{careerXp.toLocaleString('en-IN')}</p>
          <p className="eb-label mt-1">XP</p>
        </div>
      </div>

      {next ? (
        <>
          <div
            className="h-2 rounded-full overflow-hidden mt-5"
            style={{ background: 'var(--surface-sunk)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${tier.color}, ${next.color})`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 mt-2.5">
            <p className="t-meta">{Math.round(progress * 100)}% through {tierLabel(tier)}</p>
            <p className="t-meta">
              {toGo.toLocaleString('en-IN')} XP to{' '}
              <span style={{ color: next.color }}>{tierLabel(next)}</span>
            </p>
          </div>
        </>
      ) : (
        <p className="t-sub mt-5">Top tier reached. Nothing above this one.</p>
      )}
    </div>
  );
};
