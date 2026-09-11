import React from 'react';
import { Tier } from '../lib/tiers';

interface Props {
  tier: Tier;
  size?: number;
  /** Dims the emblem for tiers not yet reached. */
  locked?: boolean;
}

/**
 * Rank emblem.
 *
 * A crest silhouette rather than a coloured rectangle with text in it. Drawn
 * as SVG so it stays sharp at any size and each tier can carry its own
 * geometry — the shape changes with rank, not just the colour, so tiers are
 * distinguishable at a glance and even in monochrome.
 *
 * Deliberately restrained: clean geometry and a single accent, no bevels,
 * gloss or drop shadows. It should read as prestigious, not arcade.
 */

/** Crest outline per base tier. Higher tiers gain points and complexity. */
const SHAPES: Record<string, string> = {
  // Bronze — a plain shield.
  BRONZE: 'M50 6 L88 20 V52 Q88 80 50 94 Q12 80 12 52 V20 Z',
  // Silver — shield with a notched top.
  SILVER: 'M50 6 L68 14 L50 20 L32 14 Z M50 22 L88 32 V56 Q88 82 50 94 Q12 82 12 56 V32 Z',
  // Gold — angular crest with shoulders.
  GOLD: 'M50 4 L90 18 L86 30 V54 Q86 80 50 95 Q14 80 14 54 V30 L10 18 Z',
  // Platinum — faceted, with a pointed base.
  PLATINUM: 'M50 4 L92 20 L84 34 V56 Q84 78 50 96 Q16 78 16 56 V34 L8 20 Z M50 14 L28 24 L50 32 L72 24 Z',
  // Diamond — a rhombus set within the crest.
  DIAMOND: 'M50 3 L93 20 L84 36 V56 Q84 79 50 97 Q16 79 16 56 V36 L7 20 Z M50 26 L66 44 L50 62 L34 44 Z',
  // Elite — the most articulated silhouette.
  ELITE: 'M50 2 L96 18 L86 34 V54 Q86 80 50 98 Q14 80 14 54 V34 L4 18 Z M50 20 L36 34 L50 40 L64 34 Z M50 48 L62 60 L50 74 L38 60 Z',
};

export const RankEmblem: React.FC<Props> = ({ tier, size = 40, locked = false }) => {
  const path = SHAPES[tier.base] || SHAPES.BRONZE;
  const id = `rank-${tier.base}-${tier.step}`.toLowerCase();

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${tier.base} ${tier.step}`}
      style={{ opacity: locked ? 0.28 : 1, flexShrink: 0 }}
    >
      <defs>
        {/* Deeper fill than before: a faint wash read as an empty outline at
            the sizes these actually render. */}
        {/* Near-solid at the top so the crest reads as metal rather than a
            dark silhouette, easing to the tier colour at the base. */}
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="18%" stopColor={tier.color} stopOpacity="1" />
          <stop offset="70%" stopColor={tier.color} stopOpacity="0.88" />
          <stop offset="100%" stopColor={tier.color} stopOpacity="0.72" />
        </linearGradient>

        {/* Rim light along the top edge, which is what gives a badge the
            impression of being struck rather than drawn. */}
        {/* Rim light only. The previous version laid black over the lower
            half, which is what made the emblem look mostly dark. */}
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <clipPath id={`${id}-clip`}>
          <path d={path} />
        </clipPath>
      </defs>

      <path d={path} fill={`url(#${id}-fill)`} />

      {/* Inner shading, clipped to the crest so it never spills. */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-rim)`} />
        {/* A diagonal sheen — one band, not a full gloss. */}
        <path d="M-10 36 L110 -4 L110 18 L-10 58 Z" fill="#ffffff" opacity="0.14" />
      </g>

      <path
        d={path}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Step marks — one to three, so Bronze 1 and Bronze 3 differ without
          needing a numeral crammed inside the crest. Filled and outlined so
          they hold up against the deeper background. */}
      {Array.from({ length: tier.step }).map((_, i) => (
        <circle
          key={i}
          cx={50 + (i - (tier.step - 1) / 2) * 14}
          cy={tier.base === 'BRONZE' ? 64 : 77}
          r="4.2"
          fill="#ffffff"
          fillOpacity="0.96"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
};
