import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, RotateCcw, Activity, Play } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { UserProfile } from '../../types';

interface Point {
  r: number;
  c: number;
}

interface Path {
  colorIndex: number;
  points: Point[]; // The actual generated path for this color
}

interface UserPath {
  colorIndex: number;
  points: Point[];
}

const COLORS = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow/Orange
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#D946EF', // Fuchsia
];

export const FlowFree: React.FC<{ profile: UserProfile, onProfileUpdate?: (p: UserProfile) => void }> = ({ profile, onProfileUpdate }) => {
  const [gridSize, setGridSize] = useState<number>(5);
  const [targetPaths, setTargetPaths] = useState<Path[]>([]);
  const [userPaths, setUserPaths] = useState<UserPath[]>([]);
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [moves, setMoves] = useState(0);
  const [seed, setSeed] = useState(Math.random());
  
  const boardRef = useRef<HTMLDivElement>(null);

  // Procedural Generation
  const generatePuzzle = useCallback(() => {
    let bestPaths: Path[] = [];
    let bestFillCount = 0;
    
    // Try multiple times to get a dense board
    for (let attempts = 0; attempts < 50; attempts++) {
      const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(-1));
      const paths: Path[] = [];
      let colorIndex = 0;

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (grid[r][c] === -1) {
            // Start a new path
            if (colorIndex >= COLORS.length) continue;
            
            let currR = r;
            let currC = c;
            const pathPoints: Point[] = [{ r: currR, c: currC }];
            grid[currR][currC] = colorIndex;

            // Random walk
            let length = 1;
            const targetLength = 3 + Math.floor(Math.random() * (gridSize * 2));
            
            while (length < targetLength) {
              const neighbors: Point[] = [];
              if (currR > 0 && grid[currR - 1][currC] === -1) neighbors.push({ r: currR - 1, c: currC });
              if (currR < gridSize - 1 && grid[currR + 1][currC] === -1) neighbors.push({ r: currR + 1, c: currC });
              if (currC > 0 && grid[currR][currC - 1] === -1) neighbors.push({ r: currR, c: currC - 1 });
              if (currC < gridSize - 1 && grid[currR][currC + 1] === -1) neighbors.push({ r: currR, c: currC + 1 });

              if (neighbors.length === 0) break;
              
              const next = neighbors[Math.floor(Math.random() * neighbors.length)];
              
              // To prevent paths getting tangled too easily, maybe we check if it borders itself?
              // Simple approach: just walk.
              currR = next.r;
              currC = next.c;
              grid[currR][currC] = colorIndex;
              pathPoints.push({ r: currR, c: currC });
              length++;
            }

            if (length > 1) {
              paths.push({ colorIndex, points: pathPoints });
              colorIndex++;
            } else {
              // Revert if length is 1 (can't have a path of length 1)
              grid[r][c] = -1;
            }
          }
        }
      }

      const fillCount = paths.reduce((sum, p) => sum + p.points.length, 0);
      if (fillCount > bestFillCount) {
        bestFillCount = fillCount;
        bestPaths = paths;
      }
      
      // If we filled more than 85% of the board, it's good enough
      if (fillCount >= gridSize * gridSize * 0.85) {
        break;
      }
    }

    setTargetPaths(bestPaths);
    setUserPaths(bestPaths.map(p => ({ colorIndex: p.colorIndex, points: [] })));
    setMoves(0);
    setIsWon(false);
  }, [gridSize, seed]);

  useEffect(() => {
    generatePuzzle();
  }, [generatePuzzle]);

  // Interaction handlers
  const getCellFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    if (!boardRef.current) return null;
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
    
    const cellW = rect.width / gridSize;
    const cellH = rect.height / gridSize;
    
    const c = Math.floor(x / cellW);
    const r = Math.floor(y / cellH);
    
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      return { r, c };
    }
    return null;
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isWon) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    
    // Check if clicked on a dot
    const targetPath = targetPaths.find(p => 
      (p.points[0].r === cell.r && p.points[0].c === cell.c) || 
      (p.points[p.points.length - 1].r === cell.r && p.points[p.points.length - 1].c === cell.c)
    );

    if (targetPath) {
      setActiveColor(targetPath.colorIndex);
      setUserPaths(prev => {
        const newPaths = [...prev];
        const pIndex = newPaths.findIndex(p => p.colorIndex === targetPath.colorIndex);
        if (pIndex >= 0) {
          // Reset this path and start from this dot
          newPaths[pIndex] = { colorIndex: targetPath.colorIndex, points: [cell] };
        }
        return newPaths;
      });
      soundFx.playClick();
      setMoves(m => m + 1);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (activeColor === null || isWon) return;
    
    const cell = getCellFromEvent(e);
    if (!cell) return;
    
    setUserPaths(prev => {
      const newPaths = [...prev];
      const pIndex = newPaths.findIndex(p => p.colorIndex === activeColor);
      if (pIndex === -1) return prev;
      
      const pathPoints = newPaths[pIndex].points;
      if (pathPoints.length === 0) return prev;
      
      const lastPoint = pathPoints[pathPoints.length - 1];
      
      // Only add if it's an adjacent cell
      const isAdjacent = Math.abs(lastPoint.r - cell.r) + Math.abs(lastPoint.c - cell.c) === 1;
      
      if (!isAdjacent) return prev;
      
      // If moving backwards on our own path, backtrack
      if (pathPoints.length >= 2) {
        const prevPoint = pathPoints[pathPoints.length - 2];
        if (prevPoint.r === cell.r && prevPoint.c === cell.c) {
          newPaths[pIndex] = {
            ...newPaths[pIndex],
            points: pathPoints.slice(0, -1)
          };
          return newPaths;
        }
      }
      
      // Check if we hit another path, if so, break that path
      let conflict = false;
      for (let i = 0; i < newPaths.length; i++) {
        if (i !== pIndex) {
          const conflictIdx = newPaths[i].points.findIndex(pt => pt.r === cell.r && pt.c === cell.c);
          if (conflictIdx !== -1) {
             // Break the other path up to the conflict
             newPaths[i] = {
               ...newPaths[i],
               points: newPaths[i].points.slice(0, conflictIdx)
             };
          }
        }
      }
      
      // Check if we hit our own dot or the other dot of the same color
      const targetPath = targetPaths.find(p => p.colorIndex === activeColor)!;
      const dot1 = targetPath.points[0];
      const dot2 = targetPath.points[targetPath.points.length - 1];
      
      // Can't cross our own starting dot
      if (pathPoints[0].r === cell.r && pathPoints[0].c === cell.c) return newPaths;
      
      // If we hit the other dot, complete it
      const targetDot = (pathPoints[0].r === dot1.r && pathPoints[0].c === dot1.c) ? dot2 : dot1;
      
      if (cell.r === targetDot.r && cell.c === targetDot.c) {
        // We reached the end!
        newPaths[pIndex] = {
          ...newPaths[pIndex],
          points: [...pathPoints, cell]
        };
        setActiveColor(null);
        return newPaths;
      }
      
      // Cannot move into OTHER color's dots
      for (const tp of targetPaths) {
        if (tp.colorIndex !== activeColor) {
          const d1 = tp.points[0];
          const d2 = tp.points[tp.points.length - 1];
          if ((cell.r === d1.r && cell.c === d1.c) || (cell.r === d2.r && cell.c === d2.c)) {
            return newPaths; // block
          }
        }
      }
      
      // Add the new point
      newPaths[pIndex] = {
        ...newPaths[pIndex],
        points: [...pathPoints, cell]
      };
      
      return newPaths;
    });
  };

  const handlePointerUp = () => {
    setActiveColor(null);
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (activeColor !== null) {
        e.preventDefault(); // Prevent scrolling while drawing
        handlePointerMove(e);
      }
    };
    const onTouchEnd = () => handlePointerUp();
    
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mouseup', onTouchEnd);
    
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mouseup', onTouchEnd);
    };
  }, [activeColor]);

  useEffect(() => {
    if (isWon || targetPaths.length === 0) return;
    
    let isAllConnected = true;
    for (const tp of targetPaths) {
      const up = userPaths.find(u => u.colorIndex === tp.colorIndex);
      if (!up || up.points.length === 0) {
        isAllConnected = false;
        break;
      }
      const d1 = tp.points[0];
      const d2 = tp.points[tp.points.length - 1];
      
      const upStart = up.points[0];
      const upEnd = up.points[up.points.length - 1];
      
      const connected1 = (upStart.r === d1.r && upStart.c === d1.c && upEnd.r === d2.r && upEnd.c === d2.c);
      const connected2 = (upStart.r === d2.r && upStart.c === d2.c && upEnd.r === d1.r && upEnd.c === d1.c);
      
      if (!connected1 && !connected2) {
        isAllConnected = false;
        break;
      }
    }
    
    if (isAllConnected) {
      setIsWon(true);
      soundFx.playSuccess();
      if (onProfileUpdate) {
        const xp = gridSize * 3;
        onProfileUpdate({ ...profile, gamesXp: (profile.gamesXp || 0) + xp });
      }
    }
  }, [userPaths, targetPaths, isWon, gridSize, profile, onProfileUpdate]);

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full select-none">
      <div className="flex justify-between w-full mb-6 items-end">
        <div>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-white leading-none">Flow Free</h2>
          <p className="text-slate-400 text-sm mt-1">Connect the dots.</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-xl px-4 py-2 flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Moves</span>
          <span className="font-mono font-bold text-white text-lg">{moves}</span>
        </div>
      </div>

      <div className="w-full flex justify-between items-center mb-6 gap-2 flex-wrap">
        <div className="flex bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-1">
          {[5, 6, 7, 8].map((size) => (
            <button
              key={size}
              onClick={() => {
                setGridSize(size);
                setSeed(Math.random());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                gridSize === size ? 'bg-[var(--rule)] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {size}x{size}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setSeed(Math.random())}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--rule)] text-white rounded-xl hover:bg-[#1C212B] transition-colors text-xs font-bold"
        >
          <RotateCcw className="w-4 h-4 shrink-0" /> Reset
        </button>
      </div>

      <div className="w-full max-w-[500px] aspect-square bg-[#0D1117] border-2 border-[var(--rule)] rounded-3xl p-3 sm:p-4 shadow-2xl relative">
        <div 
          ref={boardRef}
          className="w-full h-full relative"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchStart={handlePointerDown}
          // touch move is handled in useEffect to prevent scrolling
        >
          {/* Grid lines */}
          <div 
            className="absolute inset-0 grid" 
            style={{ 
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
              <div key={i} className="border border-[#1C212B]/50" />
            ))}
          </div>

          {/* Paths (Lines) */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            {userPaths.map((up, i) => {
              if (up.points.length < 2) return null;
              
              const pointsStr = up.points.map(pt => {
                const x = ((pt.c + 0.5) / gridSize) * 100;
                const y = ((pt.r + 0.5) / gridSize) * 100;
                return `${x},${y}`;
              }).join(' L ');
              
              return (
                <motion.path
                  key={i}
                  d={`M ${pointsStr}`}
                  fill="none"
                  stroke={COLORS[up.colorIndex]}
                  strokeWidth={50 / gridSize}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-lg"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.1 }}
                />
              );
            })}
          </svg>

          {/* Dots */}
          {targetPaths.map((tp, i) => {
            const d1 = tp.points[0];
            const d2 = tp.points[tp.points.length - 1];
            return (
              <React.Fragment key={i}>
                <div 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_15px_currentColor]"
                  style={{
                    left: `${((d1.c + 0.5) / gridSize) * 100}%`,
                    top: `${((d1.r + 0.5) / gridSize) * 100}%`,
                    width: `${50 / gridSize}%`,
                    height: `${50 / gridSize}%`,
                    backgroundColor: COLORS[tp.colorIndex],
                    color: COLORS[tp.colorIndex]
                  }}
                />
                <div 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_15px_currentColor]"
                  style={{
                    left: `${((d2.c + 0.5) / gridSize) * 100}%`,
                    top: `${((d2.r + 0.5) / gridSize) * 100}%`,
                    width: `${50 / gridSize}%`,
                    height: `${50 / gridSize}%`,
                    backgroundColor: COLORS[tp.colorIndex],
                    color: COLORS[tp.colorIndex]
                  }}
                />
              </React.Fragment>
            );
          })}
        </div>

        {/* Win Overlay */}
        <AnimatePresence>
          {isWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-[#0D1117]/80 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl"
            >
              <h3 className="text-4xl font-display font-black text-white mb-2 uppercase tracking-wide">
                Flow Complete
              </h3>
              <p className="eb-done font-mono font-bold mb-6">
                +{gridSize * 20} EXP
              </p>
              <button
                onClick={() => setSeed(Math.random())}
                className="px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl flex items-center gap-2 hover:bg-slate-200 transition-colors shadow-xl shadow-white/10"
              >
                <Play className="w-5 h-5 shrink-0" /> Next Level
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
