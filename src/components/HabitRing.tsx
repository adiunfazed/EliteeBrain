import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  /** 0–1. How much of today's target is done. */
  progress: number;
  done: boolean;
  /** Reps or minutes logged today, shown inside a partly-filled ring. */
  value?: number;
  /** A yes/no habit has nothing to count, so the ring shows no number. */
  showValue?: boolean;
  size?: number;
  onClick?: () => void;
  label?: string;
}

/**
 * The completion control for a habit.
 *
 * A ring rather than a checkbox, because a habit is rarely binary: "read 10
 * pages" can be six pages in, and a checkbox has no way to say so. The arc is
 * the day's progress, the number inside is what has actually been logged, and
 * only a genuinely finished habit becomes a solid tick.
 *
 * Sized generously — this is the one thing on the row you press.
 */
export const HabitRing: React.FC<Props> = ({
  progress,
  done,
  value = 0,
  showValue = false,
  size = 42,
  onClick,
  label,
}) => {
  const stroke = 3;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  // A started habit always shows a visible sliver, so "a bit done" never
  // renders identically to "not started".
  const shown = pct > 0 && pct < 0.04 ? 0.04 : pct;

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="habit-ring"
      data-done={done ? 'true' : 'false'}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rule-strong)"
          strokeWidth={stroke}
          opacity={0.55}
        />
        {!done && shown > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - shown)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        )}
      </svg>

      <span className="habit-ring-core" data-done={done ? 'true' : 'false'}>
        {done ? (
          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
        ) : showValue && value > 0 ? (
          <span className="habit-ring-value">{value}</span>
        ) : null}
      </span>
    </button>
  );
};
