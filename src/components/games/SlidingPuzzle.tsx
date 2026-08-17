import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, RotateCcw, Image as ImageIcon, Check, Lightbulb } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { UserProfile } from '../../types';
import { nextHint, isSolvable, isSolved } from '../../lib/puzzle';

interface Tile {
  id: number;
  currentPos: number; // 0 to gridSize * gridSize - 1
  correctPos: number;
}

const CATEGORIES = ['nature', 'mountains', 'space', 'architecture', 'animals', 'abstract art', 'cyberpunk', 'minimalism', 'geometry', 'landscape'];

export const SlidingPuzzle: React.FC<{ profile: UserProfile, onProfileUpdate?: (p: UserProfile) => void }> = ({ profile, onProfileUpdate }) => {
  const [gridSize, setGridSize] = useState<number>(3);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [seed, setSeed] = useState(Math.random());
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintBusy, setHintBusy] = useState(false);

  // Fetch new image
  const getNewImage = useCallback(() => {
    const id = Math.floor(Math.random() * 1000);
    setImageUrl(`https://picsum.photos/seed/${id}/600/600`);
  }, []);

  useEffect(() => {
    getNewImage();
  }, [getNewImage]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (isPlaying && !isWon) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isWon]);

  /** Flat board for the solver: index = position, value = tile id. */
  const toBoard = useCallback((): number[] => {
    const board = new Array(gridSize * gridSize).fill(0);
    for (const t of tiles) board[t.currentPos] = t.id;
    return board;
  }, [tiles, gridSize]);

  const handleHint = useCallback(() => {
    if (isWon || hintBusy || tiles.length === 0) return;
    setHintBusy(true);
    soundFx.playClick();

    // Deferred a frame so the button's pressed state paints before the search.
    setTimeout(() => {
      try {
        const hint = nextHint(toBoard(), gridSize);
        if (hint) {
          setHintIndex(hint.index);
          setHintsUsed((n) => n + 1);
        }
      } catch (err) {
        console.error('Hint failed:', err);
      } finally {
        setHintBusy(false);
      }
    }, 16);
  }, [isWon, hintBusy, tiles, toBoard, gridSize]);

  const initGame = useCallback(() => {
    const totalTiles = gridSize * gridSize;
    let initialTiles: Tile[] = Array.from({ length: totalTiles - 1 }).map((_, i) => ({
      id: i,
      currentPos: i,
      correctPos: i,
    }));
    
    // Add empty tile at the end
    initialTiles.push({
      id: totalTiles - 1,
      currentPos: totalTiles - 1,
      correctPos: totalTiles - 1,
    });

    // Shuffle by making random valid moves
    let emptyPos = totalTiles - 1;
    const shuffleMoves = gridSize * gridSize * 10;
    
    for (let i = 0; i < shuffleMoves; i++) {
      const emptyRow = Math.floor(emptyPos / gridSize);
      const emptyCol = emptyPos % gridSize;
      const validMoves: number[] = [];
      
      if (emptyRow > 0) validMoves.push(emptyPos - gridSize);
      if (emptyRow < gridSize - 1) validMoves.push(emptyPos + gridSize);
      if (emptyCol > 0) validMoves.push(emptyPos - 1);
      if (emptyCol < gridSize - 1) validMoves.push(emptyPos + 1);
      
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      
      // Swap emptyPos and randomMove in initialTiles
      const tile1 = initialTiles.find(t => t.currentPos === randomMove)!;
      const tile2 = initialTiles.find(t => t.currentPos === emptyPos)!;
      
      tile1.currentPos = emptyPos;
      tile2.currentPos = randomMove;
      emptyPos = randomMove;
    }

    // Safety net. Shuffling by legal moves is solvable by construction, but a
    // parity check costs nothing and guarantees a player is never handed an
    // impossible board. Also reject a shuffle that landed back on solved.
    const board = new Array(totalTiles).fill(0);
    for (const t of initialTiles) board[t.currentPos] = t.id;
    if (!isSolvable(board, gridSize) || isSolved(board)) {
      setSeed(Math.random());
      return;
    }

    setTiles(initialTiles);
    setMoves(0);
    setTime(0);
    setIsWon(false);
    setIsPlaying(true);
    setHintIndex(null);
    setHintsUsed(0);
  }, [gridSize, seed]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleTileClick = (tile: Tile) => {
    if (isWon || !isPlaying) return;
    
    const emptyTile = tiles.find((t) => t.id === gridSize * gridSize - 1)!;
    
    const row = Math.floor(tile.currentPos / gridSize);
    const col = tile.currentPos % gridSize;
    const emptyRow = Math.floor(emptyTile.currentPos / gridSize);
    const emptyCol = emptyTile.currentPos % gridSize;

    // Check if adjacent
    const isAdjacent = (Math.abs(row - emptyRow) === 1 && col === emptyCol) || 
                       (Math.abs(col - emptyCol) === 1 && row === emptyRow);

    if (isAdjacent) {
      soundFx.playClick();
      setTiles((prev) => {
        const newTiles = prev.map(t => ({ ...t }));
        const t1 = newTiles.find((t) => t.id === tile.id)!;
        const t2 = newTiles.find((t) => t.id === emptyTile.id)!;
        
        const tempPos = t1.currentPos;
        t1.currentPos = t2.currentPos;
        t2.currentPos = tempPos;
        
        return newTiles;
      });
      setMoves(m => m + 1);
      // A hint is spent once acted on, so it never lingers on a stale square.
      setHintIndex(null);

    }
  };

  // Win detection runs as an effect on the committed tile state. Doing it
  // inside a setTiles updater meant the side effects could run twice or be
  // dropped, and the old 100ms timeout raced the state update — which is why
  // a finished puzzle sometimes never registered.
  useEffect(() => {
    if (isWon || tiles.length === 0) return;
    const won = tiles.every((t) => t.currentPos === t.correctPos);
    if (!won) return;

    setIsWon(true);
    setIsPlaying(false);
    setHintIndex(null);
    soundFx.playSuccess();
    if (onProfileUpdate) {
      const base = gridSize === 3 ? 15 : gridSize === 4 ? 25 : 40;
      // Hints are allowed, but a fully hinted solve shouldn't pay full XP.
      const xpGained = Math.max(5, Math.round(base * (hintsUsed > 0 ? 0.6 : 1)));
      onProfileUpdate({ ...profile, gamesXp: (profile.gamesXp || 0) + xpGained });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, isWon, gridSize]);


  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full">
      <div className="flex justify-between w-full mb-6 items-end">
        <div>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-white leading-none">Sliding Puzzle</h2>
          <p className="text-slate-400 text-sm mt-1">Restore the masterpiece.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-[#12161F] border border-[#2A313C] rounded-xl px-3 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Moves</span>
            <span className="font-mono font-bold text-white">{moves}</span>
          </div>
          <div className="bg-[#12161F] border border-[#2A313C] rounded-xl px-3 py-2 flex flex-col items-center min-w-[60px]">
            <span className="text-[10px] uppercase font-bold text-slate-400">Time</span>
            <span className="font-mono font-bold text-white">{formatTime(time)}</span>
          </div>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mb-6 gap-2 flex-wrap">
        <div className="flex bg-[#12161F] border border-[#2A313C] rounded-xl p-1">
          {[3, 4, 5].map((size) => (
            <button
              key={size}
              onClick={() => {
                setGridSize(size);
                setSeed(Math.random());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                gridSize === size ? 'bg-[#2A313C] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {size}x{size}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              getNewImage();
              setSeed(Math.random());
            }}
            className="flex items-center gap-2 px-3 py-2 bg-[#12161F] border border-[#2A313C] text-white rounded-xl hover:bg-[#1C212B] transition-colors text-xs font-bold"
          >
            <ImageIcon className="w-3 h-3" /> New Image
          </button>
          <button
            onClick={() => setSeed(Math.random())}
            className="eb-press flex items-center gap-2 px-3 py-2 bg-[#12161F] border border-[#2A313C] text-white rounded-xl hover:bg-[#1C212B] text-xs font-bold"
          >
            <RotateCcw className="w-3 h-3" /> Restart
          </button>
          <button
            onClick={handleHint}
            disabled={isWon || hintBusy}
            title="Highlight the next tile to move"
            className="eb-press eb-glow-emerald flex items-center gap-2 px-3 py-2 bg-emerald-500/12 border border-emerald-500/35 text-emerald-300 rounded-xl hover:bg-emerald-500/20 disabled:opacity-40 text-xs font-bold"
          >
            <Lightbulb className="w-3 h-3" />
            {hintBusy ? 'Thinking…' : 'Hint'}
            {hintsUsed > 0 && <span className="opacity-60">({hintsUsed})</span>}
          </button>
        </div>
      </div>

      <div className="w-full max-w-[500px] aspect-square bg-[#0D1117] border border-[#2A313C] rounded-2xl p-2 relative shadow-2xl">
        <div className="w-full h-full relative overflow-hidden rounded-xl bg-[#171B22]">
          <AnimatePresence>
            {tiles.map((tile) => {
              const isEmpty = tile.id === gridSize * gridSize - 1;
              const currentRow = Math.floor(tile.currentPos / gridSize);
              const currentCol = tile.currentPos % gridSize;
              
              const correctRow = Math.floor(tile.correctPos / gridSize);
              const correctCol = tile.correctPos % gridSize;
              
              const sizePct = 100 / gridSize;

              if (isEmpty && !isWon) return null; // Don't render empty tile unless won

              const isHinted = hintIndex !== null && tile.currentPos === hintIndex;

              return (
                <motion.div
                  key={tile.id}
                  initial={false}
                  animate={{
                    x: `${currentCol * 100}%`,
                    y: `${currentRow * 100}%`,
                    opacity: 1
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute cursor-pointer p-0.5"
                  style={{
                    width: `${sizePct}%`,
                    height: `${sizePct}%`,
                  }}
                  onClick={() => handleTileClick(tile)}
                >
                  <div
                    className={`w-full h-full rounded-lg overflow-hidden relative group transition-shadow ${
                      isHinted
                        ? 'shadow-[0_0_0_3px_rgba(16,185,129,0.9),0_0_22px_rgba(16,185,129,0.65)]'
                        : 'shadow-sm'
                    }`}
                  >
                    <div 
                      className="w-full h-full bg-cover bg-no-repeat transition-all"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                        backgroundPosition: `${(correctCol / (gridSize - 1)) * 100}% ${(correctRow / (gridSize - 1)) * 100}%`
                      }}
                    />
                    {!isWon && !isEmpty && (
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    )}
                    {isHinted && (
                      <motion.div
                        className="absolute inset-0 bg-emerald-400/25 pointer-events-none rounded-lg"
                        animate={{ opacity: [0.35, 0.75, 0.35] }}
                        transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                    {/* Outline for tiles */}
                    <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Win Overlay */}
        <AnimatePresence>
          {isWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl"
            >
              <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-full mb-4">
                <Check className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-display font-black text-white mb-2 uppercase tracking-wide">
                Masterpiece Restored!
              </h3>
              <p className="text-emerald-400 font-mono font-bold mb-6">
                +{gridSize === 3 ? 100 : gridSize === 4 ? 300 : 800} EXP
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setSeed(Math.random())}
                  className="px-6 py-3 bg-[#171B22] border border-[#2A313C] text-white font-bold rounded-xl hover:bg-[#1C212B] transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={() => {
                    getNewImage();
                    setSeed(Math.random());
                  }}
                  className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  New Image
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
