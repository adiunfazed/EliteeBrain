import React from 'react';
import { AlarmClock, ChevronRight } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface Props {
  /** How many alarms are set, so the card says something useful at a glance. */
  alarmCount: number;
  /** The next alarm's time, if one is enabled. */
  nextTime?: string | null;
  isPro: boolean;
  onOpen: () => void;
}

/**
 * The Wake Challenge entry point.
 *
 * One row rather than a whole section. The alarm list, history and permission
 * setup previously sat inline and pushed the exercises off the screen — this
 * is the same treatment the leaderboard gets, where a compact card opens a
 * dedicated screen.
 */
export const WakeEntryCard: React.FC<Props> = ({
  alarmCount,
  nextTime,
  isPro,
  onOpen,
}) => (
  <button
    onClick={() => {
      soundFx.playClick();
      onOpen();
    }}
    className="w-full text-left rounded-xl p-4 flex items-center gap-3.5 transition-transform active:scale-[0.99]"
    style={{
      background:
        'linear-gradient(140deg, color-mix(in oklab, var(--signal) 26%, var(--surface)), color-mix(in oklab, var(--signal) 10%, var(--surface)))',
      border: '1px solid color-mix(in oklab, var(--signal) 50%, var(--rule))',
      // Restrained: a soft outer bloom rather than a lit panel.
      boxShadow:
        '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 4px 18px -10px color-mix(in oklab, var(--signal) 80%, transparent)',
    }}
  >
    <span
      className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
      style={{
        background: 'var(--signal)',
        boxShadow: '0 2px 10px -4px color-mix(in oklab, var(--signal) 90%, transparent)',
      }}
    >
      <AlarmClock className="w-[20px] h-[20px] shrink-0" style={{ color: '#fff' }} />
    </span>

    <span className="min-w-0 flex-1">
      <span className="block text-[16px] font-bold leading-tight">Wake Challenge</span>
      <span className="t-meta block mt-1 truncate">
        {!isPro
          ? 'Earn your way out of bed — a Pro feature'
          : alarmCount === 0
            ? 'No alarms yet. Set your first one.'
            : nextTime
              ? `${alarmCount} ${alarmCount === 1 ? 'alarm' : 'alarms'} · next at ${nextTime}`
              : `${alarmCount} ${alarmCount === 1 ? 'alarm' : 'alarms'} · all off`}
      </span>
    </span>

    <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--signal-ink)' }} />
  </button>
);
