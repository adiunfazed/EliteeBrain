import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RankEmblem } from './RankEmblem';
import { TIERS, tierFor, tierLabel, Tier } from '../lib/tiers';
import { soundFx } from '../utils/audio';

interface Props {
  careerXp: number;
}

/**
 * Level-up moment.
 *
 * Crossing a rank previously did nothing visible — XP incremented and the
 * label quietly changed, so the single most motivating event in the loop
 * passed unnoticed.
 *
 * Deliberately brief and non-blocking: it does not interrupt what the user is
 * doing, because a modal for every rank step would become an obstacle.
 */
export const LevelUpToast: React.FC<Props> = ({ careerXp }) => {
  const [shown, setShown] = useState<Tier | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const tier = tierFor(careerXp);
    const key = `${tier.base}-${tier.step}`;

    // The first reading establishes a baseline. Without this, opening the app
    // would announce a "level up" to whatever rank the user already held.
    if (previous.current === null) {
      previous.current = key;
      return;
    }

    if (previous.current === key) return;

    // Only celebrate upward movement. XP can fall when a leaderboard recount
    // corrects an inflated figure, and that is not an achievement.
    const previousTier = TIERS.find((t) => `${t.base}-${t.step}` === previous.current);
    previous.current = key;
    if (previousTier && tier.min <= previousTier.min) return;
    setShown(tier);
    soundFx.playLevelUp();

    const timer = window.setTimeout(() => setShown(null), 4200);
    return () => window.clearTimeout(timer);
  }, [careerXp]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed left-3 right-3 z-[87] pointer-events-none"
          style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
          role="status"
        >
          <div
            className="max-w-sm mx-auto rounded-xl p-3.5 flex items-center gap-3.5"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklab, ${shown.color} 22%, var(--surface)), var(--surface))`,
              border: `1px solid color-mix(in oklab, ${shown.color} 50%, var(--rule))`,
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset',
            }}
          >
            <motion.span
              initial={{ scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
              className="shrink-0"
            >
              <RankEmblem tier={shown} size={42} />
            </motion.span>

            <div className="min-w-0 flex-1">
              <p className="eb-label" style={{ color: shown.color }}>
                Rank up
              </p>
              <p className="t-section mt-0.5">{tierLabel(shown)}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
