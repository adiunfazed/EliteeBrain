import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
const ChessGame = lazy(() => import('./games/ChessGame').then((m) => ({ default: m.ChessGame })));
const Game2048 = lazy(() => import('./games/Game2048').then((m) => ({ default: m.Game2048 })));
const SlidingPuzzle = lazy(() => import('./games/SlidingPuzzle').then((m) => ({ default: m.SlidingPuzzle })));
const FlowFree = lazy(() => import('./games/FlowFree').then((m) => ({ default: m.FlowFree })));
import { Swords, LayoutGrid, Image as ImageIcon, GitMerge, ArrowLeft, ChevronRight } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { GameShell } from './games/GameShell';

type GameType = 'chess' | '2048' | 'sliding' | 'flow' | null;

export const GamesSection: React.FC<{ profile: UserProfile; onProfileUpdate?: (p: UserProfile) => void }> = ({
  profile,
  onProfileUpdate,
}) => {
  const [activeGame, setActiveGame] = useState<GameType>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeGame]);

  const games = [
    {
      id: 'chess',
      title: 'Cognitive Chess',
      subtitle: 'Adaptive Grandmaster AI',
      icon: Swords,
      color: 'bg-[#2A1116] border-[#FF6B57]/40', accent: '#FF6B57',
      iconColor: 'eb-danger',
      difficulty: 'Dynamic',
      blurb: 'Play a full game against an engine that adapts to your rating. Every move is timed, and your rating moves with the result.',
      trains: 'Planning · Foresight',
    },
    {
      id: 'flow',
      title: 'Flow Free',
      subtitle: 'Pathfinding & Logic',
      icon: GitMerge,
      color: 'bg-[#0E1B2E] border-[#4C9AFF]/40', accent: '#4C9AFF',
      iconColor: 'text-blue-400',
      difficulty: 'Medium',
      blurb: 'Connect every pair of dots without crossing a line. Later boards need you to see the whole grid before you start.',
      trains: 'Spatial logic',
    },
    {
      id: 'sliding',
      title: 'Art Puzzle',
      subtitle: 'Spatial Reasoning',
      icon: ImageIcon,
      color: 'bg-[#0B241F] border-[#00C2A8]/40', accent: '#00C2A8',
      iconColor: 'eb-done',
      difficulty: 'Medium',
      blurb: 'Slide tiles back into place against the clock. Hints are there when you need a nudge.',
      trains: 'Working memory',
    },
    {
      id: '2048',
      title: '2048 Merge',
      subtitle: 'Numerical Strategy',
      icon: LayoutGrid,
      color: 'bg-[#2A1F08] border-[#FFB020]/40', accent: '#FFB020',
      iconColor: 'eb-warn',
      difficulty: 'Hard',
      blurb: 'Slide tiles back into place against the clock. Hints are there when you need a nudge.',
      trains: 'Working memory',
    },
  ];



  return (
    <div className="w-full pb-20">
      <AnimatePresence mode="wait">
        {!activeGame ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <div className="mb-8">
              <h2 className="eb-title">Games</h2>
            </div>

            {/* Vertical stack: each game gets full width so its colour and
                artwork can actually read, rather than four cramped columns. */}
            <div className="space-y-3">
              {/* Hub header. The chess rating is the only persistent number
                  across the games, so it anchors the section. */}
              <div
                className="rounded-2xl p-4 mb-1"
                style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="eb-label">Chess rating</p>
                    <p className="t-figure text-[28px] mt-1">
                      {profile.chessElo ?? '—'}
                      {profile.chessElo === undefined && (
                        <span className="t-sub ml-2 font-normal">Unrated</span>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="eb-label">Games XP</p>
                    <p className="t-figure text-[20px] mt-1">
                      {(profile.gamesXp || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              {games.map((g, index) => {
                const Icon = g.icon;
                return (
                  <motion.button
                    key={g.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ duration: 0.24, delay: Math.min(index * 0.04, 0.15) }}
                    onClick={() => {
                      soundFx.playClick();
                      setActiveGame(g.id as GameType);
                    }}
                    className="group relative overflow-hidden w-full text-left rounded-2xl p-5 cursor-pointer select-none transition-colors"
                    style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
                  >
                    {/* Oversized glyph, clipped — gives each card its own
                        identity without needing an image asset. */}
                    <Icon
                      className="pointer-events-none absolute -right-8 -bottom-10 w-44 h-44 opacity-[0.08] group-hover:opacity-[0.13] group-hover:scale-105 transition-all duration-500"
                      style={{ color: g.accent }}
                    />

                    <div className="relative z-10">
                      <div className="flex items-start gap-4">
                        <span
                          className="shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-2xl"
                          style={{ backgroundColor: `${g.accent}20`, color: g.accent }}
                        >
                          <Icon className="w-7 h-7 shrink-0" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <h3 className="eb-heading text-xl sm:text-2xl">{g.title}</h3>
                          <p className="text-xs text-[var(--ink-muted)] mt-1">{g.subtitle}</p>
                        </div>

                        <span
                          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                          style={{ borderColor: `${g.accent}55`, color: g.accent }}
                        >
                          {g.difficulty}
                        </span>
                      </div>

                      <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed mt-3.5 max-w-lg">
                        {g.blurb}
                      </p>

                      {/* Stat strip */}
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        {g.id === 'chess' && (
                          <span className="eb-card-sunk px-3 py-2 rounded-xl min-w-0">
                            <span className="eb-label block">Rating</span>
                            <span className="eb-stat block text-base mt-0.5" style={{ color: g.accent }}>
                              {profile.chessElo || 1200}
                            </span>
                          </span>
                        )}
                        <span className="eb-card-sunk px-3 py-2 rounded-xl min-w-0">
                          <span className="eb-label block">Trains</span>
                          <span className="block text-xs font-bold text-[var(--ink)] mt-1">
                            {g.trains}
                          </span>
                        </span>

                        <span
                          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-bold group-hover:gap-2.5 transition-all"
                          style={{ backgroundColor: `${g.accent}20`, color: g.accent }}
                        >
                          Play
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="game-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <div className="mb-6 flex justify-between items-center bg-[var(--surface)] p-2 rounded-2xl border border-[var(--rule)]">
            </div>

            <GameShell
              title={games.find((g) => g.id === activeGame)?.title || 'Game'}
              onExit={() => {
                soundFx.playClick();
                setActiveGame(null);
              }}
            >
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center gap-4 py-24">
                    <span
                      className="w-9 h-9 rounded-full border-2 border-[var(--rule)] animate-spin"
                      style={{ borderTopColor: 'var(--signal)' }}
                    />
                    <p className="t-sub">Loading game…</p>
                  </div>
                }
              >
                {activeGame === 'chess' && <ChessGame profile={profile} onProfileUpdate={onProfileUpdate} />}
                {activeGame === 'flow' && <FlowFree profile={profile} onProfileUpdate={onProfileUpdate} />}
                {activeGame === '2048' && <Game2048 profile={profile} onProfileUpdate={onProfileUpdate} />}
                {activeGame === 'sliding' && <SlidingPuzzle profile={profile} onProfileUpdate={onProfileUpdate} />}
              </Suspense>
            </GameShell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
