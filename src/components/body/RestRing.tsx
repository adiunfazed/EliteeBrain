import React from 'react';

interface Props {
  /** Seconds remaining. */
  left: number;
  /** Seconds the rest started at, so the ring knows what full looks like. */
  total: number;
  size?: number;
}

/**
 * The rest countdown, as a ring that empties.
 *
 * Small enough to sit inside the rest strip rather than take a screen of its
 * own, and readable at a glance from arm's length — which is the whole point,
 * since the phone is usually on a bench while this runs. The number stays,
 * because "37" is precise in a way a three-quarters-full ring is not.
 */
export const RestRing: React.FC<Props> = ({ left, total, size = 30 }) => {
  const stroke = size >= 60 ? 5 : 3;
  const r = (size - stroke) / 2 - 0.5;
  const c = 2 * Math.PI * r;
  const span = Math.max(1, total);
  const fraction = Math.max(0, Math.min(1, left / span));

  return (
    <span className="rest-ring" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rule-strong)"
          strokeWidth={stroke}
          opacity={0.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--signal)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          // Drains anticlockwise from the top as the seconds run out.
          strokeDashoffset={c * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 900ms linear' }}
        />
      </svg>
      {/* Seconds up to 99, then m:ss — four digits inside a 30px ring is
          unreadable, and "1:45" is how anyone would say it anyway. */}
      <span
        className="rest-ring-value tabular-nums"
        style={{
          fontSize: size >= 60 ? (left >= 100 ? 21 : 24) : left >= 100 ? 9.5 : 11,
          fontWeight: size >= 60 ? 800 : 700,
        }}
      >
        {left >= 100 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : left}
      </span>
    </span>
  );
};
