import React, { useState, useEffect, useCallback } from 'react';
import { soundFx } from '../../utils/audio';
import { Box, ArrowLeft, Play, RefreshCw, Check, X, HelpCircle, Compass, Eye, Sparkles, Timer, Trophy } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

interface ShapeBlock {
  blocks: { x: number; y: number }[];
}

export const VisuospatialModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_TRIALS = 5;

  const [phase, setPhase] = useState<'intro' | 'active' | 'feedback' | 'finished'>('intro');
  const [trialIndex, setTrialIndex] = useState(0);

  const [baseShape, setBaseShape] = useState<{ x: number; y: number }[]>([]);
  const [targetShape, setTargetShape] = useState<{ x: number; y: number }[]>([]);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isSame, setIsSame] = useState<boolean>(true);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const [trialResults, setTrialResults] = useState<{ correct: boolean; responseMs: number }[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());

  // Session Stopwatch Timer
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [personalBest, setPersonalBest] = useState<number | null>(() => {
    const saved = localStorage.getItem('elitebrain_pb_visuospatial');
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

  // Generate 2D Polyomino grid representation
  const generateTrial = useCallback(() => {
    // 5 connected block shapes
    const shapes = [
      [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }], // U shape
      [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }], // Z shape
      [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }], // Cross shape
      [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 1 }, { x: 3, y: 1 }], // L shape
    ];

    const chosen = shapes[Math.floor(Math.random() * shapes.length)];
    const same = Math.random() > 0.5;
    const angles = [90, 180, 270];
    const rot = angles[Math.floor(Math.random() * angles.length)];

    let transformed = [...chosen];
    if (!same) {
      // Mirror x coordinates to create a non-matching mirror distractor
      transformed = chosen.map((b) => ({ x: 4 - b.x, y: b.y }));
    }

    setBaseShape(chosen);
    setTargetShape(transformed);
    setRotationAngle(rot);
    setIsSame(same);
    setShowGuide(false);
  }, []);

  const startNextTrial = useCallback(() => {
    generateTrial();
    setPhase('active');
    setTrialStartTime(Date.now());
    soundFx.playTone(600, 0.1);
  }, [generateTrial]);

  const handleUserChoice = (userThinksSame: boolean) => {
    if (phase !== 'active') return;

    const correct = userThinksSame === isSame;
    const elapsed = Date.now() - trialStartTime;

    if (correct) soundFx.playSuccess();
    else soundFx.playError();

    const newResults = [...trialResults, { correct, responseMs: elapsed }];
    setTrialResults(newResults);
    setPhase('feedback');

    setTimeout(() => {
      if (trialIndex + 1 < TOTAL_TRIALS) {
        setTrialIndex((prev) => prev + 1);
        startNextTrial();
      } else {
        const correctCount = newResults.filter((r) => r.correct).length;
        const accuracyPct = Math.round((correctCount / TOTAL_TRIALS) * 100);
        const meanTime = Math.round(newResults.reduce((acc, r) => acc + r.responseMs, 0) / TOTAL_TRIALS);
        const totalTimeSec = sessionStartTime ? (Date.now() - sessionStartTime) / 1000 : 0;

        let isNewPB = false;
        let bestVal = personalBest;
        if (!bestVal || totalTimeSec < bestVal) {
          localStorage.setItem('elitebrain_pb_visuospatial', totalTimeSec.toFixed(2));
          setPersonalBest(totalTimeSec);
          isNewPB = true;
        }

        onFinishSession({
          score: accuracyPct,
          accuracy: accuracyPct,
          details: [
            { label: 'Total Time Consumed', value: `${totalTimeSec.toFixed(1)}s ${isNewPB ? '⚡ NEW BEST!' : bestVal ? `(Best: ${bestVal.toFixed(1)}s)` : ''}` },
            { label: 'Spatial Accuracy', value: `${correctCount} / ${TOTAL_TRIALS}` },
            { label: 'Mental Rotation Speed', value: `${(meanTime / 1000).toFixed(1)}s avg` },
            { label: 'Parietal Matrix', value: `Lvl ${currentLevel}` },
          ],
        });
      }
    }, 2200);
  };

  const renderShapeGrid = (blocks: { x: number; y: number }[], rotation: number, isTarget: boolean = false) => {
    const grid = Array(16).fill(false);
    blocks.forEach((b) => {
      const idx = (b.y - 1) * 4 + (b.x - 1);
      if (idx >= 0 && idx < 16) grid[idx] = true;
    });

    // Anchor block is the first block in array
    const anchor = blocks[0];
    const anchorIdx = anchor ? (anchor.y - 1) * 4 + (anchor.x - 1) : -1;

    return (
      <div
        className="grid grid-cols-4 gap-1.5 p-3 bg-slate-950 border border-slate-800 rounded-2xl transition-transform duration-700 relative"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {grid.map((filled, i) => {
          const isAnchor = i === anchorIdx;
          return (
            <div
              key={i}
              className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${
                filled
                  ? isAnchor && showGuide
                    ? 'bg-amber-500 border-amber-300 shadow-lg shadow-amber-500/50 animate-bounce'
                    : 'bg-indigo-500 border-indigo-400 shadow-md shadow-indigo-500/30'
                  : 'bg-slate-900/40 border-slate-800/40'
              }`}
            >
              {filled && isAnchor && showGuide && <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-current" />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      {/* HUD Bar */}
      <div className="flex items-center justify-between p-4 md:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-lg">
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Module</span>
        </button>

        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-slate-100">3D Visuospatial Rotation</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {sessionStartTime && (phase === 'active' || phase === 'feedback') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs">
              <Timer className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="font-black">{elapsedTime.toFixed(1)}s</span>
              {personalBest && (
                <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 ml-0.5">
                  Best: {personalBest.toFixed(1)}s
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-slate-400 font-mono">
            Trial <span className="text-indigo-400 font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
          </div>
        </div>
      </div>

      {/* Main Screen */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-4">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Visuospatial Mental Rotation</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Compare two polyomino block structures. Mentally rotate the right-side shape to determine if it is an <span className="text-indigo-300 font-bold">IDENTICAL MATCH</span> or a <span className="text-indigo-300 font-bold">MIRRORED DIFFERENT</span> structure.
            </p>

            {/* Step-by-Step Educational Guide Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/30 mb-6 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Compass className="w-4 h-4" />
                <span>HOW TO SOLVE MENTAL ROTATIONS:</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4 font-medium">
                <li>
                  <strong className="text-indigo-300">1. Pick an Anchor Block:</strong> Focus on a single distinct corner or branch (e.g., the top-left tip).
                </li>
                <li>
                  <strong className="text-indigo-300">2. Mentally Spin:</strong> Rotate the anchor in your mind by the specified angle ({rotationAngle || 90}°).
                </li>
                <li>
                  <strong className="text-indigo-300">3. Check Hand Orientation (Chirality):</strong> If the branch points in the same relative side after rotation, it is <span className="eb-done font-bold">MATCHING</span>. If it flips to the opposite side, it is <span className="eb-danger font-bold">MIRRORED DIFFERENT</span>!
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setTrialResults([]);
                setSessionStartTime(Date.now());
                setElapsedTime(0);
                startNextTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Begin Mental Rotation</span>
            </button>
          </div>
        )}

        {(phase === 'active' || phase === 'feedback') && (
          <div className="w-full text-center">
            <div className="flex items-center justify-between max-w-md mx-auto mb-3">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">
                ARE THESE SHAPES IDENTICAL WHEN ROTATED?
              </span>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-1 text-[10px] font-bold eb-warn hover:eb-warn px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>{showGuide ? 'Hide Anchor Tip' : 'Show Anchor Tip'}</span>
              </button>
            </div>

            {/* Side-by-side shape comparison */}
            <div className="grid grid-cols-2 gap-4 bg-slate-900 border-2 border-indigo-500/40 p-6 rounded-3xl shadow-2xl mb-4 max-w-md mx-auto items-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Reference Shape</span>
                {renderShapeGrid(baseShape, 0)}
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase mb-2">Rotated ({rotationAngle}°)</span>
                {renderShapeGrid(targetShape, rotationAngle, true)}
              </div>
            </div>

            {/* Feedback & Reasoning Banner */}
            {phase === 'feedback' && (
              <div className="bg-slate-900 border border-indigo-500/50 p-3 rounded-2xl mb-4 max-w-md mx-auto text-left flex items-start gap-2.5 animate-fadeIn">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-bold text-indigo-300 block mb-0.5">MENTAL ROTATION STEP-BY-STEP:</span>
                  <p className="text-slate-300">
                    The right shape was rotated <strong className="text-indigo-400">{rotationAngle}°</strong>.{' '}
                    {isSame ? (
                      <span className="eb-done font-semibold">
                        All block relationships remain in identical relative orientation (MATCHING!).
                      </span>
                    ) : (
                      <span className="eb-danger font-semibold">
                        The shape was also reflected across the Y-axis, inverting its orientation (MIRRORED DIFFERENT!).
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Answer choice buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <button
                disabled={phase === 'feedback'}
                onClick={() => handleUserChoice(true)}
                className="py-4 rounded-2xl bg-slate-900 hover:bg-indigo-500 hover:text-white border border-slate-700 font-black text-sm tracking-wider uppercase transition-all active:scale-95 cursor-pointer shadow-lg select-none touch-manipulation flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5 eb-done" />
                <span>MATCHING (SAME)</span>
              </button>
              <button
                disabled={phase === 'feedback'}
                onClick={() => handleUserChoice(false)}
                className="py-4 rounded-2xl bg-slate-900 hover:bg-rose-500 hover:text-white border border-slate-700 font-black text-sm tracking-wider uppercase transition-all active:scale-95 cursor-pointer shadow-lg select-none touch-manipulation flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5 eb-danger" />
                <span>DIFFERENT (MIRROR)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
