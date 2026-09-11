import React from 'react';
import { Flame, Zap, Play } from 'lucide-react';
import { tierFor, tierLabel, tierProgress, nextTierAfter } from '../../lib/tiers';
import { RankEmblem } from '../RankEmblem';

/**
 * Compact dashboard panels.
 *
 * Each is a small bordered block rather than a full-width card, so several
 * sit side by side on a wider screen and stack cleanly on a phone. They take
 * only the values they display — no data fetching — so they can be placed
 * anywhere in the grid.
 */

export const StreakPanel: React.FC<{ days: number; freezes?: number }> = ({
  days,
  freezes = 0,
}) => (
  <div className="panel-sm">
    <div className="panel-head">
      <span className="panel-title">Streak</span>
      <Flame className="w-3.5 h-3.5 shrink-0 eb-warn" />
    </div>

    <p className="t-figure" style={{ fontSize: 30, color: '#FFB020' }}>
      {days}
    </p>
    <p className="t-meta mt-1">{days === 1 ? 'day running' : 'days running'}</p>

    {freezes > 0 && (
      <p className="t-meta mt-2">{freezes} freeze{freezes === 1 ? '' : 's'} banked</p>
    )}
  </div>
);

export const XpPanel: React.FC<{ careerXp: number; pending?: boolean }> = ({
  careerXp,
  pending = false,
}) => {
  const tier = tierFor(careerXp);
  const next = nextTierAfter(careerXp);
  const pct = Math.round(tierProgress(careerXp) * 100);

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Rank</span>
        <RankEmblem tier={tier} size={18} />
      </div>

      {pending ? (
        <div className="h-8 rounded animate-pulse" style={{ background: 'var(--surface-sunk)' }} />
      ) : (
        <>
          <p className="t-figure" style={{ fontSize: 20, color: tier.color }}>
            {tierLabel(tier)}
          </p>
          <p className="t-meta mt-1">{careerXp.toLocaleString('en-IN')} XP</p>

          <div
            className="h-1.5 rounded-full overflow-hidden mt-3"
            style={{ background: 'var(--surface-sunk)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: 'var(--signal)' }}
            />
          </div>

          {next && (
            <p className="t-meta mt-1.5 truncate">
              {(next.min - careerXp).toLocaleString('en-IN')} to {tierLabel(next)}
            </p>
          )}
        </>
      )}
    </div>
  );
};

interface FocusPanelProps {
  /** The task a session would run against, if one is suggested. */
  suggestion?: string | null;
  minutesToday: number;
  onStart: () => void;
}

export const FocusPanel: React.FC<FocusPanelProps> = ({
  suggestion,
  minutesToday,
  onStart,
}) => (
  <div className="panel-sm">
    <div className="panel-head">
      <span className="panel-title">Focus</span>
      <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--signal-ink)' }} />
    </div>

    <p className="t-figure" style={{ fontSize: 24 }}>
      {Math.floor(minutesToday / 60)}h {minutesToday % 60}m
    </p>
    <p className="t-meta mt-1">focused today</p>

    <button
      onClick={onStart}
      className="w-full mt-3 min-h-[38px] rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold"
      style={{
        background: 'color-mix(in oklab, var(--signal) 18%, transparent)',
        border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
        color: 'var(--signal-ink)',
      }}
    >
      <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
      Start focus
    </button>

    {suggestion && (
      <p className="t-meta mt-2 truncate" title={suggestion}>
        Next: {suggestion}
      </p>
    )}
  </div>
);
