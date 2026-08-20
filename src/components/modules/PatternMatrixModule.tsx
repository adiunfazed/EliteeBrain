import React, { useState, useEffect, useCallback } from 'react';
import { soundFx } from '../../utils/audio';
import { Boxes, ArrowLeft, Play, Check, X, Sparkles, HelpCircle, Timer } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

interface TileData {
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'diamond';
  color: string;
  rotation: number;
  count: number;
}

interface MatrixProblem {
  grid: TileData[];
  options: TileData[];
  correctIndex: number;
  ruleExplanation: string;
  ruleCategory: 'rotation-permutation' | 'count-progression' | 'color-spectrum' | 'geometry-synergy';
}

const SHAPES: TileData['shape'][] = ['circle', 'square', 'triangle', 'diamond', 'star'];
const PALETTE = ['#22d3ee', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

export const PatternMatrixModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_TRIALS = 6;

  const [phase, setPhase] = useState<'intro' | 'active' | 'feedback' | 'finished'>('intro');
  const [trialIndex, setTrialIndex] = useState(0);
  const [problem, setProblem] = useState<MatrixProblem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [trialResults, setTrialResults] = useState<{ correct: boolean; timeMs: number }[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());

  // Session Stopwatch Timer
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [personalBest, setPersonalBest] = useState<number | null>(() => {
    const saved = localStorage.getItem('elitebrain_pb_patternmatrix');
    return saved ? parseFloat(saved) : null;
  });

  useEffect(() => {
    if (phase !== 'active' && phase !== 'feedback') return;
    const interval = setInterval(() => {
      if (sessionStartTime) {
        setElapsedTime((Date.now() - sessionStartTime) / 1000);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, sessionStartTime]);

  // Generate Matrix Problem with 4 distinct Inductive Rule categories
  const generateProblem = useCallback((): MatrixProblem => {
    const categories: MatrixProblem['ruleCategory'][] = [
      'rotation-permutation',
      'count-progression',
      'color-spectrum',
      'geometry-synergy',
    ];
    const category = categories[Math.floor(Math.random() * categories.length)];

    let grid: TileData[] = [];
    let answerTile: TileData;
    let ruleExplanation = '';

    if (category === 'rotation-permutation') {
      // Shape permutations across rows (A,B,C -> B,C,A -> C,A,B) and rotation shifts (+45deg per step)
      const s0 = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const s1 = SHAPES[(SHAPES.indexOf(s0) + 1) % SHAPES.length];
      const s2 = SHAPES[(SHAPES.indexOf(s0) + 2) % SHAPES.length];

      const c0 = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const c1 = PALETTE[(PALETTE.indexOf(c0) + 1) % PALETTE.length];
      const c2 = PALETTE[(PALETTE.indexOf(c0) + 2) % PALETTE.length];

      // Row 1: s0(0deg), s1(45deg), s2(90deg)
      // Row 2: s1(45deg), s2(90deg), s0(135deg)
      // Row 3: s2(90deg), s0(135deg), [?] => s1(180deg)
      grid = [
        { shape: s0, color: c0, rotation: 0, count: 1 },
        { shape: s1, color: c1, rotation: 45, count: 1 },
        { shape: s2, color: c2, rotation: 90, count: 1 },

        { shape: s1, color: c1, rotation: 45, count: 1 },
        { shape: s2, color: c2, rotation: 90, count: 1 },
        { shape: s0, color: c0, rotation: 135, count: 1 },

        { shape: s2, color: c2, rotation: 90, count: 1 },
        { shape: s0, color: c0, rotation: 135, count: 1 },
        { shape: s1, color: c1, rotation: 180, count: 1 }, // Correct Answer
      ];

      answerTile = grid[8];
      ruleExplanation = 'Row permutation rule: Shape cycles (A→B→C) and rotation increases +45° each step.';
    } else if (category === 'count-progression') {
      // Count increases across columns (1, 2, 3), shapes fixed per row
      const s0 = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const s1 = SHAPES[(SHAPES.indexOf(s0) + 1) % SHAPES.length];
      const s2 = SHAPES[(SHAPES.indexOf(s0) + 2) % SHAPES.length];

      const c0 = PALETTE[0];
      const c1 = PALETTE[1];
      const c2 = PALETTE[2];

      grid = [
        { shape: s0, color: c0, rotation: 0, count: 1 },
        { shape: s0, color: c0, rotation: 0, count: 2 },
        { shape: s0, color: c0, rotation: 0, count: 3 },

        { shape: s1, color: c1, rotation: 45, count: 1 },
        { shape: s1, color: c1, rotation: 45, count: 2 },
        { shape: s1, color: c1, rotation: 45, count: 3 },

        { shape: s2, color: c2, rotation: 90, count: 1 },
        { shape: s2, color: c2, rotation: 90, count: 2 },
        { shape: s2, color: c2, rotation: 90, count: 3 }, // Correct Answer
      ];

      answerTile = grid[8];
      ruleExplanation = 'Additive Count rule: Element count progresses +1 per column (1 → 2 → 3).';
    } else if (category === 'color-spectrum') {
      // Color progresses across row, shapes rotate
      const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      const c0 = '#22d3ee'; // cyan
      const c1 = '#a855f7'; // purple
      const c2 = '#ec4899'; // pink

      grid = [
        { shape: s, color: c0, rotation: 0, count: 1 },
        { shape: s, color: c1, rotation: 0, count: 1 },
        { shape: s, color: c2, rotation: 0, count: 1 },

        { shape: s, color: c0, rotation: 45, count: 1 },
        { shape: s, color: c1, rotation: 45, count: 1 },
        { shape: s, color: c2, rotation: 45, count: 1 },

        { shape: s, color: c0, rotation: 90, count: 1 },
        { shape: s, color: c1, rotation: 90, count: 1 },
        { shape: s, color: c2, rotation: 90, count: 1 }, // Correct Answer
      ];

      answerTile = grid[8];
      ruleExplanation = 'Chromatic shift rule: Columns progress Cyan → Purple → Pink; Rows advance rotation by +45°.';
    } else {
      // Geometry synergy
      const s0 = 'circle';
      const s1 = 'square';
      const s2 = 'triangle';

      grid = [
        { shape: s0, color: PALETTE[0], rotation: 0, count: 1 },
        { shape: s1, color: PALETTE[1], rotation: 30, count: 2 },
        { shape: s2, color: PALETTE[2], rotation: 60, count: 3 },

        { shape: s1, color: PALETTE[1], rotation: 30, count: 2 },
        { shape: s2, color: PALETTE[2], rotation: 60, count: 3 },
        { shape: s0, color: PALETTE[0], rotation: 0, count: 1 },

        { shape: s2, color: PALETTE[2], rotation: 60, count: 3 },
        { shape: s0, color: PALETTE[0], rotation: 0, count: 1 },
        { shape: s1, color: PALETTE[1], rotation: 30, count: 2 }, // Correct Answer
      ];

      answerTile = grid[8];
      ruleExplanation = 'Dual-property Latin square: Each row and column contains exactly one Circle, Square, and Triangle.';
    }

    // Build 3 distinct distractors
    const distractors: TileData[] = [
      {
        shape: SHAPES[(SHAPES.indexOf(answerTile.shape) + 1) % SHAPES.length],
        color: answerTile.color,
        rotation: answerTile.rotation,
        count: answerTile.count,
      },
      {
        shape: answerTile.shape,
        color: PALETTE[(PALETTE.indexOf(answerTile.color) + 2) % PALETTE.length],
        rotation: (answerTile.rotation + 45) % 360,
        count: answerTile.count,
      },
      {
        shape: answerTile.shape,
        color: answerTile.color,
        rotation: answerTile.rotation,
        count: answerTile.count === 3 ? 1 : answerTile.count + 1,
      },
    ];

    const options = [answerTile, ...distractors].sort(() => Math.random() - 0.5);
    const correctIndex = options.findIndex(
      (o) =>
        o.shape === answerTile.shape &&
        o.color === answerTile.color &&
        o.rotation === answerTile.rotation &&
        o.count === answerTile.count
    );

    return {
      grid,
      options,
      correctIndex,
      ruleExplanation,
      ruleCategory: category,
    };
  }, []);

  const startNextTrial = useCallback(() => {
    const p = generateProblem();
    setProblem(p);
    setSelectedIndex(null);
    setPhase('active');
    setTrialStartTime(Date.now());
    soundFx.playTone(600, 0.1);
  }, [generateProblem]);

  const handleSelectOption = (index: number) => {
    if (phase !== 'active' || !problem) return;

    setSelectedIndex(index);
    const isCorrect = index === problem.correctIndex;
    const elapsed = Date.now() - trialStartTime;

    if (isCorrect) soundFx.playSuccess();
    else soundFx.playError();

    const newResults = [...trialResults, { correct: isCorrect, timeMs: elapsed }];
    setTrialResults(newResults);
    setPhase('feedback');

    setTimeout(() => {
      if (trialIndex + 1 < TOTAL_TRIALS) {
        setTrialIndex((prev) => prev + 1);
        startNextTrial();
      } else {
        const correctCount = newResults.filter((r) => r.correct).length;
        const accuracyPct = Math.round((correctCount / TOTAL_TRIALS) * 100);
        const avgTime = Math.round(newResults.reduce((acc, r) => acc + r.timeMs, 0) / TOTAL_TRIALS);
        const totalTimeSec = sessionStartTime ? (Date.now() - sessionStartTime) / 1000 : 0;

        let isNewPB = false;
        let bestVal = personalBest;
        if (!bestVal || totalTimeSec < bestVal) {
          localStorage.setItem('elitebrain_pb_patternmatrix', totalTimeSec.toFixed(2));
          setPersonalBest(totalTimeSec);
          isNewPB = true;
        }

        onFinishSession({
          score: accuracyPct,
          accuracy: accuracyPct,
          details: [
            { label: 'Total Time Consumed', value: `${totalTimeSec.toFixed(1)}s ${isNewPB ? '⚡ NEW BEST!' : bestVal ? `(Best: ${bestVal.toFixed(1)}s)` : ''}` },
            { label: 'Inductive Logic Score', value: `${correctCount} / ${TOTAL_TRIALS} (${accuracyPct}%)` },
            { label: 'Mean Solving Speed', value: `${(avgTime / 1000).toFixed(1)}s avg` },
            { label: 'Matrix Difficulty', value: `Raven Level ${currentLevel}` },
          ],
        });
      }
    }, 1600);
  };

  const renderTileElements = (tile: TileData) => {
    const items = Array.from({ length: tile.count });
    return (
      <div
        className="flex items-center justify-center gap-1 transition-transform duration-300"
        style={{ transform: `rotate(${tile.rotation}deg)` }}
      >
        {items.map((_, idx) => (
          <React.Fragment key={idx}>
            {tile.shape === 'circle' && (
              <div className="w-6 h-6 shrink-0 rounded-full border-2 shadow-sm" style={{ borderColor: tile.color, backgroundColor: `${tile.color}25` }} />
            )}
            {tile.shape === 'square' && (
              <div className="w-6 h-6 shrink-0 border-2 rounded-md shadow-sm" style={{ borderColor: tile.color, backgroundColor: `${tile.color}25` }} />
            )}
            {tile.shape === 'triangle' && (
              <div
                className="w-0 h-0 shrink-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px]"
                style={{ borderBottomColor: tile.color }}
              />
            )}
            {tile.shape === 'diamond' && (
              <div className="w-5 h-5 shrink-0 border-2 rotate-45 shadow-sm" style={{ borderColor: tile.color, backgroundColor: `${tile.color}25` }} />
            )}
            {tile.shape === 'star' && <Sparkles className="w-6 h-6 shrink-0 drop-shadow-sm" style={{ color: tile.color }} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      {/* HUD Header */}
      <div className="flex items-center justify-between p-4 md:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-lg">
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Exit Module</span>
        </button>

        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 shrink-0 text-blue-400" />
          <h2 className="text-base font-bold text-slate-100">Raven Inductive Matrix</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono border border-blue-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {sessionStartTime && (phase === 'active' || phase === 'feedback') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-xs">
              <Timer className="w-3.5 h-3.5 shrink-0 text-blue-400 animate-pulse" />
              <span className="font-black">{elapsedTime.toFixed(1)}s</span>
              {personalBest && (
                <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 ml-0.5">
                  Best: {personalBest.toFixed(1)}s
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-slate-400 font-mono">
            Trial <span className="text-blue-400 font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-4">
              <Boxes className="w-8 h-8 shrink-0" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Dynamic Inductive Logic</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Analyze the 3x3 matrix grid. Infer the underlying relational rule across rows and columns (rotation shifts, count progressions, or chromatic permutations) to select the correct missing tile.
            </p>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setTrialResults([]);
                setSessionStartTime(Date.now());
                setElapsedTime(0);
                startNextTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 shrink-0 fill-current" />
              <span>Begin Logic Induction</span>
            </button>
          </div>
        )}

        {(phase === 'active' || phase === 'feedback') && problem && (
          <div className="w-full text-center">
            <span className="text-xs uppercase tracking-widest text-blue-400 font-bold block mb-4">
              DEDUCE THE MISSING MATRIX TILE
            </span>

            {/* 3x3 Matrix Board */}
            <div className="grid grid-cols-3 gap-3 bg-slate-900/90 border-2 border-blue-500/40 p-4 md:p-6 rounded-3xl shadow-2xl mb-4 max-w-md mx-auto">
              {problem.grid.map((tile, i) => {
                const isTargetMissingSlot = i === 8;
                return (
                  <div
                    key={i}
                    className={`aspect-square flex items-center justify-center rounded-2xl border transition-all ${
                      isTargetMissingSlot
                        ? 'bg-blue-950/60 border-dashed border-blue-400 animate-pulse text-blue-400 font-black text-2xl'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    {isTargetMissingSlot ? <span>?</span> : renderTileElements(tile)}
                  </div>
                );
              })}
            </div>

            {/* Rule Explanation Callout during feedback */}
            {phase === 'feedback' && (
              <div className="bg-slate-900 border border-blue-500/50 p-3 rounded-2xl mb-4 max-w-md mx-auto text-left flex items-start gap-2.5 animate-fadeIn">
                <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-bold text-blue-300 block mb-0.5">MATRIX RULE REASONING:</span>
                  <p className="text-slate-300">{problem.ruleExplanation}</p>
                </div>
              </div>
            )}

            {/* Option Tiles below */}
            <span className="text-[11px] font-bold text-slate-400 block mb-3 uppercase tracking-wider">
              SELECT MATCHING TILE:
            </span>
            <div className="grid grid-cols-4 gap-2.5 max-w-md mx-auto">
              {problem.options.map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                const isCorrect = idx === problem.correctIndex;
                let btnStyle = 'bg-slate-900 border-slate-800 text-slate-200 hover:border-blue-500/50';

                if (phase === 'feedback') {
                  if (isCorrect) btnStyle = 'bg-emerald-950/80 border-emerald-500 eb-done';
                  else if (isSelected) btnStyle = 'bg-rose-950/80 border-rose-500 eb-danger';
                }

                return (
                  <button
                    key={idx}
                    disabled={phase === 'feedback'}
                    onClick={() => handleSelectOption(idx)}
                    className={`aspect-square flex items-center justify-center rounded-2xl border-2 transition-all p-2 cursor-pointer active:scale-95 ${btnStyle}`}
                  >
                    {renderTileElements(opt)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
