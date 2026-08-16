import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { ChessGame } from './games/ChessGame';
import { Game2048 } from './games/Game2048';
import { SlidingPuzzle } from './games/SlidingPuzzle';
import { FlowFree } from './games/FlowFree';
import { Swords, LayoutGrid, Image as ImageIcon, GitMerge, ArrowLeft } from 'lucide-react';
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
      color: 'from-rose-500/20 to-rose-950/40 border-rose-500/30',
      iconColor: 'text-rose-400',
      difficulty: 'Dynamic',
    },
    {
      id: 'flow',
      title: 'Flow Free',
      subtitle: 'Pathfinding & Logic',
      icon: GitMerge,
      color: 'from-blue-500/20 to-blue-950/40 border-blue-500/30',
      iconColor: 'text-blue-400',
      difficulty: 'Medium',
    },
    {
      id: 'sliding',
      title: 'Art Puzzle',
      subtitle: 'Spatial Reasoning',
      icon: ImageIcon,
      color: 'from-emerald-500/20 to-emerald-950/40 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      difficulty: 'Medium',
    },
    {
      id: '2048',
      title: '2048 Merge',
      subtitle: 'Numerical Strategy',
      icon: LayoutGrid,
      color: 'from-amber-500/20 to-amber-950/40 border-amber-500/30',
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

            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {games.map((g, index) => {
                const Icon = g.icon;
                return (
                  <motion.button
                    key={g.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      soundFx.playClick();
                      setActiveGame(g.id as GameType);
                    }}
                    className="eb-card eb-raised eb-shine group relative overflow-hidden text-left p-2.5 sm:p-4 cursor-pointer select-none min-w-0"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl eb-card-sunk ${g.iconColor}`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </span>

                    <h3 className="eb-heading text-[11px] sm:text-sm mt-2.5 leading-tight break-words">
                      {g.title}
                    </h3>

                    <p className="hidden sm:block text-[10px] font-mono text-[#8A93A5] mt-1 leading-snug break-words">
                      {g.subtitle}
                    </p>

                    {g.id === 'chess' && (
                      <span className="mt-2 inline-block text-[9px] font-mono font-bold text-[#FFB020]">
                        {profile.chessElo || 1200} ELO
                      </span>
                    )}
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
