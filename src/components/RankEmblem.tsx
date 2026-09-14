import React from 'react';
import { Tier } from '../lib/tiers';

interface Props {
  tier: Tier;
  size?: number;
}

/**
 * Rank emblem.
 *
 * Each tier has its own silhouette rather than one shield in six colours —
 * the shape should be recognisable before the colour registers, and a
 * progression you can see at a glance is the point of having ranks.
 *
 * The geometry grows in complexity with the tier: a blunt wedge at the
 * bottom, a layered crown at the top.
 */

/** Base tiers in ascending order, so a shape maps to a name not a position. */
const BASE_ORDER = ['DRIFTER', 'SEEKER', 'BUILDER', 'FORGED', 'RELENTLESS', 'SOVEREIGN'];

/** Outline per tier, drawn in a 100×100 box. */
const SHAPES: string[] = [
  // Drifter: a plain wedge — unformed.
  'M50 8 L86 32 L86 70 L50 92 L14 70 L14 32 Z',
  // Seeker: a pointed compass rose.
  'M50 6 L64 34 L94 50 L64 66 L50 94 L36 66 L6 50 L36 34 Z',
  // Builder: a stepped block, squared off.
  'M22 20 L78 20 L78 44 L88 44 L88 78 L62 78 L62 58 L38 58 L38 78 L12 78 L12 44 L22 44 Z',
  // Forged: a struck anvil form.
  'M50 6 L78 22 L92 50 L78 78 L50 94 L22 78 L8 50 L22 22 Z M50 24 L34 50 L50 76 L66 50 Z',
  // Relentless: interlocking chevrons.
  'M50 4 L92 28 L92 50 L50 26 L8 50 L8 28 Z M50 40 L92 64 L92 86 L50 62 L8 86 L8 64 Z',
  // Sovereign: a crown.
  'M14 74 L14 34 L30 50 L50 18 L70 50 L86 34 L86 74 Z',
];

export const RankEmblem: React.FC<Props> = ({ tier, size = 24 }) => {
  const id = React.useId();
  const shape = SHAPES[BASE_ORDER.indexOf(tier.base)] ?? SHAPES[0];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Bright at the top easing to the tier colour, so the form reads as
            metal catching light rather than a flat silhouette. */}
        <linearGradient id={`${id}-fill`} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="30%" stopColor={tier.color} stopOpacity="1" />
          <stop offset="100%" stopColor={tier.color} stopOpacity="0.7" />
        </linearGradient>

        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={shape}
        fill={`url(#${id}-fill)`}
        fillRule="evenodd"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Rim light along the upper edge. */}
      <path
        d={shape}
        fill="none"
        fillRule="evenodd"
        stroke={`url(#${id}-rim)`}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* Step pips: how far through the tier, so two people at the same rank
          are still distinguishable. */}
      {(tier.step ?? 0) > 0 &&
        Array.from({ length: 3 }).map((_, i) => (
          <circle
            key={i}
            cx={34 + i * 16}
            cy={94}
            r={5}
            fill={i < (tier.step ?? 0) ? '#ffffff' : 'transparent'}
            stroke="#ffffff"
            strokeOpacity={i < (tier.step ?? 0) ? 1 : 0.35}
            strokeWidth="2"
          />
        ))}
    </svg>
  );
};
