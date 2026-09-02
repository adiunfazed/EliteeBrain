import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Activity } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { UserProfile } from '../../types';

interface Tile {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

export const Game2048: React.FC<{ profile: UserProfile, onProfileUpdate?: (p: UserProfile) => void }> = ({ profile, onProfileUpdate }) => {
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  
  const GRID_SIZE = 4;
  const touchStartRef = useRef<{x: number, y: number} | null>(null);

  const initGame = useCallback(() => {
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    const newBoard = generateNewTile(generateNewTile([]));
    setBoard(newBoard);
  }, []);

  useEffect(() => {
    // Load best score from local storage or profile if available
    const savedBest = localStorage.getItem('2048_best_score');
    if (savedBest) setBestScore(parseInt(savedBest, 10));
    initGame();
  }, [initGame]);

  const generateNewTile = (currentBoard: Tile[]): Tile[] => {
    const emptyCells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!currentBoard.find(t => t.row === r && t.col === c)) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return currentBoard;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newValue = Math.random() < 0.9 ? 2 : 4;
    
    return [
      ...currentBoard,
      {
        id: Math.random().toString(36).substr(2, 9),
        value: newValue,
        row: randomCell.r,
        col: randomCell.c,
        isNew: true
      }
    ];
  };

  const moveTiles = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    let hasMoved = false;
    let newScore = score;
    let currentBoard = [...board].map(t => ({ ...t, isNew: false, isMerged: false }));

    const getTilesInLine = (lineIndex: number, isRow: boolean) => {
      return currentBoard
        .filter(t => (isRow ? t.row === lineIndex : t.col === lineIndex))
        .sort((a, b) => {
          if (direction === 'left' || direction === 'up') {
            return isRow ? a.col - b.col : a.row - b.row;
          } else {
            return isRow ? b.col - a.col : b.row - a.row;
          }
        });
    };

    const processLine = (lineTiles: Tile[], lineIndex: number, isRow: boolean) => {
      const newLine: Tile[] = [];
      let i = 0;
      let pos = direction === 'left' || direction === 'up' ? 0 : GRID_SIZE - 1;
      const step = direction === 'left' || direction === 'up' ? 1 : -1;

      while (i < lineTiles.length) {
        if (i + 1 < lineTiles.length && lineTiles[i].value === lineTiles[i + 1].value) {
          // Merge
          const mergedValue = lineTiles[i].value * 2;
          newLine.push({
            id: lineTiles[i].id, // Keep one ID for stable animation
            value: mergedValue,
            row: isRow ? lineIndex : pos,
            col: isRow ? pos : lineIndex,
            isMerged: true
          });
          newScore += mergedValue;
          hasMoved = true;
          i += 2;
          pos += step;
        } else {
          // Move
          const tile = lineTiles[i];
          const newRow = isRow ? lineIndex : pos;
          const newCol = isRow ? pos : lineIndex;
          if (tile.row !== newRow || tile.col !== newCol) {
            hasMoved = true;
          }
          newLine.push({
            ...tile,
            row: newRow,
            col: newCol
          });
          i += 1;
          pos += step;
        }
      }
      return newLine;
    };

    let newBoard: Tile[] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      const isRow = direction === 'left' || direction === 'right';
      const lineTiles = getTilesInLine(i, isRow);
      const processedLine = processLine(lineTiles, i, isRow);
      newBoard = [...newBoard, ...processedLine];
    }

    if (hasMoved) {
      soundFx.playClick();
      newBoard = generateNewTile(newBoard);
      setBoard(newBoard);
      setScore(newScore);

      if (newScore > bestScore) {
        setBestScore(newScore);
        localStorage.setItem('2048_best_score', newScore.toString());
      }

      // Check win condition
      if (!gameWon && newBoard.some(t => t.value === 2048)) {
        setGameWon(true);
        soundFx.playSuccess();
        if (onProfileUpdate) {
          onProfileUpdate({ ...profile, gamesXp: (profile.gamesXp || 0) + 35 });
        }
      }

      // Check game over
      if (newBoard.length === GRID_SIZE * GRID_SIZE) {
        let canMove = false;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const current = newBoard.find(t => t.row === r && t.col === c);
            const right = newBoard.find(t => t.row === r && t.col === c + 1);
            const down = newBoard.find(t => t.row === r + 1 && t.col === c);
            if ((right && right.value === current?.value) || (down && down.value === current?.value)) {
              canMove = true;
              break;
            }
          }
          if (canMove) break;
        }
        if (!canMove) {
          setGameOver(true);
          soundFx.playError();
        }
      }
    }
  }, [board, gameOver, score, bestScore, gameWon, onProfileUpdate, profile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': moveTiles('up'); break;
        case 'ArrowDown': moveTiles('down'); break;
        case 'ArrowLeft': moveTiles('left'); break;
        case 'ArrowRight': moveTiles('right'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveTiles]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > 30) {
        moveTiles(deltaX > 0 ? 'right' : 'left');
      }
    } else {
      if (Math.abs(deltaY) > 30) {
        moveTiles(deltaY > 0 ? 'down' : 'up');
      }
    }
    touchStartRef.current = null;
  };

  const getTileColor = (value: number) => {
    const colors: Record<number, string> = {
      2: 'bg-slate-100 text-slate-800',
      4: 'bg-slate-200 text-slate-800',
      8: 'bg-orange-200 text-orange-900',
      16: 'bg-orange-400 text-white',
      32: 'bg-red-400 text-white',
      64: 'bg-red-500 text-white',
      128: 'bg-yellow-400 text-white',
      256: 'bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.5)]',
      512: 'bg-yellow-600 text-white shadow-[0_0_25px_rgba(202,138,4,0.6)]',
      1024: 'bg-amber-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.7)]',
      2048: 'bg-amber-400 text-white shadow-[0_0_40px_rgba(251,191,36,0.8)]'
    };
    return colors[value] || 'bg-slate-800 text-white shadow-[0_0_50px_rgba(255,255,255,0.3)]';
  };

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto w-full">
      <div className="flex justify-between w-full mb-6 items-end">
        <div>
          <h2 className="text-4xl font-display font-black text-white leading-none">2048</h2>
          <p className="text-slate-400 text-sm mt-1">Join the numbers.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-xl px-4 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
            <span className="font-mono font-bold text-white text-lg">{score}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-xl px-4 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">Best</span>
            <span className="font-mono font-bold text-white text-lg">{bestScore}</span>
          </div>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mb-6">
        <button
          onClick={initGame}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--rule)] text-white rounded-xl hover:bg-[#1C212B] transition-colors text-sm font-bold"
        >
          <RotateCcw className="w-4 h-4 shrink-0" /> New Game
        </button>
      </div>

      <div 
        className="w-full aspect-square bg-[#0D1117] border border-[var(--rule)] rounded-2xl p-2 relative overflow-hidden shadow-2xl touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background Grid */}
        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full absolute inset-2 pr-4 pb-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-[var(--surface-sunk)] rounded-xl w-full h-full" />
          ))}
        </div>

        {/* Tiles */}
        <div className="absolute inset-2 pr-4 pb-4">
          <AnimatePresence>
            {board.map(tile => (
              <motion.div
                key={tile.id}
                initial={tile.isNew ? { scale: 0, opacity: 0 } : false}
                animate={{
                  x: `${tile.col * 100}%`,
                  y: `${tile.row * 100}%`,
                  scale: tile.isMerged ? [1, 1.2, 1] : 1,
                  opacity: 1
                }}
                transition={{
                  type: 'tween',
                  duration: 0.15,
                  ease: 'easeOut'
                }}
                className={`absolute w-1/4 h-1/4 p-1`}
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center font-display font-black text-2xl sm:text-4xl transition-colors duration-200 ${getTileColor(tile.value)}`}>
                  {tile.value}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Game Over / Won Overlay */}
        <AnimatePresence>
          {(gameOver || gameWon) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl"
            >
              <h3 className={`text-4xl font-display font-black mb-4 ${gameWon ? 'eb-warn' : 'text-white'}`}>
                {gameWon ? 'You Win!' : 'Game Over'}
              </h3>
              <p className="text-slate-300 font-mono mb-6">Score: {score}</p>
              <button
                onClick={initGame}
                className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <p className="text-slate-500 text-xs mt-6 text-center max-w-xs">
        <strong>HOW TO PLAY:</strong> Use your <strong>arrow keys</strong> or <strong>swipe</strong> to move the tiles. Tiles with the same number merge into one when they touch. Add them up to reach <strong>2048!</strong>
      </p>
    </div>
  );
};
