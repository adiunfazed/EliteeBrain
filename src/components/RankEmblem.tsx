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
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tier.color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={tier.color} stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <path
        d={path}
        fill={`url(#${id}-fill)`}
        stroke={tier.color}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Step marks — one to three, so Bronze 1 and Bronze 3 differ without
          needing a numeral crammed inside the crest. */}
      {Array.from({ length: tier.step }).map((_, i) => (
        <circle
          key={i}
          cx={50 + (i - (tier.step - 1) / 2) * 13}
          cy={tier.base === 'BRONZE' ? 62 : 76}
          r="3.6"
          fill={tier.color}
        />
      ))}
    </svg>
  );
};
