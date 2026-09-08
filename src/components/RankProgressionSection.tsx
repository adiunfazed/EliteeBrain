import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { calculateTotalXp } from '../utils/storage';
import { RankProgress } from './RankProgress';
import { tierFor, tierProgress } from '../lib/tiers';


interface RankProgressionSectionProps {
  /** True while the authoritative figures are still loading. */
  statsPending?: boolean;
  /** Activity-derived streak, so this never disagrees with the Home card. */
  derivedStreak?: number;
  /** Unified career XP including habits, tasks, routine, focus and sleep. */
  lifeXp?: number;
  profile: UserProfile;
  onLaunchModule: (id: any) => void;
  onOpenBadgesGallery?: () => void;
}


export const RankProgressionSection: React.FC<RankProgressionSectionProps> = ({
  profile,
  derivedStreak,
  statsPending,
  lifeXp,
  onLaunchModule,
  onOpenBadgesGallery,
}) => {
  // Only one view remains; the switcher and its other panels were removed.
  const activeSubTab = 'rank' as const;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSubTab]);

  // Calculate total EXP strictly across modules and games
  // Same total the Level system uses, so Rank and Level can never disagree
  // about how much a user has done.
  const careerXp = lifeXp ?? calculateTotalXp(profile);

  // Derived from the shared tier table. A second local copy here meant the
  // same rank rendered in a different colour depending on the screen.
  const currentTier = tierFor(careerXp);
  const progressPercent = Math.round(tierProgress(careerXp) * 100);


  return (
    <div className="space-y-6 select-none font-sans">
      <AnimatePresence mode="wait">
        {activeSubTab === 'rank' && (
          <motion.div
            key="rank-tab"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            {/* HERO RANK CARD (Directly matching screenshot layout) */}
            <RankProgress careerXp={careerXp} pending={statsPending} />

            <div className="stat-strip grid-cols-3">
              {[
                {
                  label: 'Total XP',
                  value: careerXp.toLocaleString(),
                  sub: 'earned so far',
                  color: 'var(--ink)',
                },
                {
                  label: 'Streak',
                  value: `${derivedStreak ?? profile.streakDays}`,
                  sub: (derivedStreak ?? profile.streakDays) === 1 ? 'day' : 'days',
                  color: '#FFB020',
                },
                {
                  label: 'Badges',
                  value: `${Object.keys(profile.unlockedAchievements || {}).length}`,
                  sub: 'unlocked',
                  color: '#00C2A8',
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <span className="eb-label block">{stat.label}</span>

                  {/* Fluid size with a floor: a long tier name shrinks to fit
                      rather than being cut off, and wraps if it still needs to. */}
                  {statsPending ? (
                    <span className="block h-6 w-16 rounded bg-[var(--surface-sunk)] animate-pulse mt-2" />
                  ) : (
                    <span
                      className="t-figure block mt-1.5"
                      style={{ color: stat.color, fontSize: 'clamp(18px, 5.2vw, 24px)' }}
                    >
                      {stat.value}
                    </span>
                  )}

                  <span className="text-[12px] text-[var(--ink-muted)] mt-1.5 leading-snug break-words">
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>

            {/* Tier progress — one bar rather than a six-card ladder. */}
            <div className="eb-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="eb-label">Progress to next rank</span>
                <span className="t-meta" style={{ color: currentTier.color }}>
                  {progressPercent}%
                </span>
              </div>
              <div className="eb-bar mt-2">
                <motion.div
                  className="eb-bar-fill"
                  initial={false}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ background: currentTier.color }}
                />
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
