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

  const renderGameBgWatermark = (id: string) => {
    switch (id) {
      case 'chess':
        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
            <svg className="absolute -right-4 -bottom-6 w-56 h-56 text-rose-400" viewBox="0 0 100 100" fill="currentColor">
              {/* Chessboard grid & Knight silhouette */}
              <rect x="0" y="0" width="25" height="25" opacity="0.3" />
              <rect x="50" y="0" width="25" height="25" opacity="0.3" />
              <rect x="25" y="25" width="25" height="25" opacity="0.3" />
              <rect x="75" y="25" width="25" height="25" opacity="0.3" />
              <rect x="0" y="50" width="25" height="25" opacity="0.3" />
              <rect x="50" y="50" width="25" height="25" opacity="0.3" />
              <rect x="25" y="75" width="25" height="25" opacity="0.3" />
              <rect x="75" y="75" width="25" height="25" opacity="0.3" />
              {/* Crown / Knight outline */}
              <path d="M35 85 L65 85 L60 65 L70 50 L55 50 L50 35 L45 50 L30 50 L40 65 Z" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
        );
      case 'flow':
        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
            <svg className="absolute -right-6 -bottom-6 w-56 h-56 text-blue-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
              {/* Interconnected flow lines */}
              <path d="M10 20 H50 V60 H90" strokeDasharray="4 4" />
              <path d="M20 80 V40 H80 V90" />
              <circle cx="10" cy="20" r="6" fill="#60A5FA" />
              <circle cx="90" cy="60" r="6" fill="#60A5FA" />
              <circle cx="20" cy="80" r="6" fill="#3B82F6" />
              <circle cx="80" cy="90" r="6" fill="#3B82F6" />
            </svg>
          </div>
        );
      case 'sliding':
        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
            <svg className="absolute -right-4 -bottom-4 w-52 h-52 text-emerald-400" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3">
              {/* Puzzle grid tiles */}
              <rect x="10" y="10" width="25" height="25" rx="4" />
              <rect x="40" y="10" width="25" height="25" rx="4" />
              <rect x="70" y="10" width="25" height="25" rx="4" />
              <rect x="10" y="40" width="25" height="25" rx="4" />
              <rect x="40" y="40" width="25" height="25" rx="4" fill="currentColor" fillOpacity="0.2" />
              <rect x="70" y="40" width="25" height="25" rx="4" />
              <rect x="10" y="70" width="25" height="25" rx="4" />
              <rect x="40" y="70" width="25" height="25" rx="4" />
            </svg>
          </div>
        );
      case '2048':
        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
            <svg className="absolute -right-2 -bottom-2 w-52 h-52 text-amber-400" viewBox="0 0 100 100" fill="currentColor">
              {/* 2048 matrix tiles */}
              <rect x="5" y="5" width="42" height="42" rx="8" opacity="0.3" />
              <text x="26" y="32" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor">2</text>
              <rect x="53" y="5" width="42" height="42" rx="8" opacity="0.4" />
              <text x="74" y="32" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor">4</text>
              <rect x="5" y="53" width="42" height="42" rx="8" opacity="0.5" />
              <text x="26" y="80" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor">2048</text>
              <rect x="53" y="53" width="42" height="42" rx="8" opacity="0.3" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

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
              <h2 className="text-3xl font-display font-black text-white">Games Dashboard</h2>
              <p className="text-[#98A2B3] font-mono text-sm mt-2">Engage in extended cognitive challenges</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              {games.map((g, index) => {
                const Icon = g.icon;
                return (
                  <motion.button
                    key={g.id}
                    initial={{ opacity: 0, y: 22, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: false, amount: 0.08 }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 22,
                      delay: Math.min(index * 0.04, 0.2),
                    }}
                    onClick={() => {
                      soundFx.playClick();
                      setActiveGame(g.id as GameType);
                    }}
                    className={`relative overflow-hidden text-left bg-gradient-to-br ${g.color} border rounded-3xl p-6 transition-all hover:shadow-[0_15px_30px_-5px_rgba(255,255,255,0.12)] hover:border-white/30 group cursor-pointer select-none`}
                  >
                    {/* Game-specific Background Watermark */}
                    {renderGameBgWatermark(g.id)}

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-2xl bg-[#0D1117]/90 backdrop-blur-md border border-[#2A313C] shadow-lg ${g.iconColor}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 bg-[#0D1117]/90 backdrop-blur-md border border-[#2A313C] rounded-full text-[10px] font-mono font-bold text-white uppercase tracking-wider shadow-sm">
                          {g.difficulty}
                        </span>
                      </div>

                      <div className="bg-[#0D1117]/50 backdrop-blur-xs p-3.5 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="text-2xl font-display font-extrabold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-all">
                            {g.title}
                          </h3>
                          {g.id === 'chess' && (
                            <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 rounded-xl text-[11px] font-mono font-black text-amber-300 shadow-sm">
                              {profile.chessElo || 1200} ELO
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono font-semibold text-[#98A2B3]">
                          {g.subtitle}
                        </p>
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
