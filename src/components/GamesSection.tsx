import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { ChessGame } from './games/ChessGame';
import { Game2048 } from './games/Game2048';
import { SlidingPuzzle } from './games/SlidingPuzzle';
import { FlowFree } from './games/FlowFree';
import { Swords, LayoutGrid, Image as ImageIcon, GitMerge, ArrowLeft, ChevronRight } from 'lucide-react';
import { soundFx } from '../utils/audio';

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
      iconColor: 'text-rose-400',
      difficulty: 'Dynamic',
    },
    {
      id: 'flow',
      title: 'Flow Free',
      subtitle: 'Pathfinding & Logic',
      icon: GitMerge,
      color: 'bg-[#0E1B2E] border-[#4C9AFF]/40', accent: '#4C9AFF',
      iconColor: 'text-blue-400',
      difficulty: 'Medium',
    },
    {
      id: 'sliding',
      title: 'Art Puzzle',
      subtitle: 'Spatial Reasoning',
      icon: ImageIcon,
      color: 'bg-[#0B241F] border-[#00C2A8]/40', accent: '#00C2A8',
      iconColor: 'text-emerald-400',
      difficulty: 'Medium',
    },
    {
      id: '2048',
      title: '2048 Merge',
      subtitle: 'Numerical Strategy',
      icon: LayoutGrid,
      color: 'bg-[#2A1F08] border-[#FFB020]/40', accent: '#FFB020',
      iconColor: 'text-amber-400',
      difficulty: 'Hard',
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
              <h2 className="eb-heading text-2xl sm:text-3xl">Games</h2>
            </div>

            {/* Vertical stack: each game gets full width so its colour and
                artwork can actually read, rather than four cramped columns. */}
            <div className="space-y-3">
              {games.map((g, index) => {
                const Icon = g.icon;
                return (
                  <motion.button
                    key={g.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: Math.min(index * 0.06, 0.24), ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      soundFx.playClick();
                      setActiveGame(g.id as GameType);
                    }}
                    className={`eb-raised eb-shine group relative overflow-hidden w-full text-left rounded-2xl border p-4 sm:p-5 cursor-pointer select-none ${g.color}`}
                  >
                    {/* Oversized watermark glyph, clipped by the card. */}
                    <Icon
                      className="pointer-events-none absolute -right-4 -bottom-6 w-32 h-32 opacity-[0.07]"
                      style={{ color: g.accent }}
                    />

                    <div className="relative z-10 flex items-center gap-4">
                      <span
                        className="shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-2xl"
                        style={{ backgroundColor: `${g.accent}22`, color: g.accent }}
                      >
                        <Icon className="w-7 h-7" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="eb-heading block text-lg sm:text-xl">{g.title}</span>
                        <span className="block text-xs font-mono text-[#8A93A5] mt-1">
                          {g.subtitle}
                        </span>
                      </span>

                      {g.id === 'chess' && (
                        <span
                          className="shrink-0 text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: `${g.accent}22`, color: g.accent }}
                        >
                          {profile.chessElo || 1200}
                        </span>
                      )}

                      <ChevronRight className="w-5 h-5 text-[#8A93A5] shrink-0 group-hover:translate-x-1 transition-transform" />
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
            <div className="mb-6 flex justify-between items-center bg-[#12161F] p-2 rounded-2xl border border-[#2A313C]">
              <button
                onClick={() => {
                  soundFx.playClick();
                  setActiveGame(null);
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-[#1C212B] rounded-xl transition-colors text-white text-sm font-mono font-bold uppercase tracking-wider cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Games
              </button>
            </div>

            {activeGame === 'chess' && <ChessGame profile={profile} onProfileUpdate={onProfileUpdate} />}
            {activeGame === 'flow' && <FlowFree profile={profile} onProfileUpdate={onProfileUpdate} />}
            {activeGame === '2048' && <Game2048 profile={profile} onProfileUpdate={onProfileUpdate} />}
            {activeGame === 'sliding' && <SlidingPuzzle profile={profile} onProfileUpdate={onProfileUpdate} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
