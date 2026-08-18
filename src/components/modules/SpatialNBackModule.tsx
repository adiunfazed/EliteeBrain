import React, { useState, useEffect, useCallback, useRef } from 'react';
import { soundFx } from '../../utils/audio';
import { Grid, ArrowLeft, Play, Check, XCircle, Sparkles, HelpCircle } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

export const SpatialNBackModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_FLASHES = 16;

  // N value scales with level: Lvl 1-2 -> 1-Back, Lvl 3-4 -> 2-Back, Lvl 5+ -> 3-Back
  const nValue = Math.min(4, 1 + Math.floor((currentLevel - 1) / 2));
  const flashIntervalMs = Math.max(1100, 2200 - (currentLevel - 1) * 140);

  const [phase, setPhase] = useState<'intro' | 'playing' | 'finished'>('intro');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [activeSquare, setActiveSquare] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  
  // Track user matches per step: stepIndex -> userClaimedMatch boolean
  const [userMatches, setUserMatches] = useState<Record<number, boolean>>({});
  const [matchPressedCurrentStep, setMatchPressedCurrentStep] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate sequence with controlled ~30% match probability
  const generateSequence = useCallback(() => {
    const seq: number[] = [];
    for (let i = 0; i < TOTAL_FLASHES; i++) {
      if (i >= nValue && Math.random() < 0.35) {
        // Force match
        seq.push(seq[i - nValue]);
      } else {
        // Random square (0..8)
        let sq = Math.floor(Math.random() * 9);
        if (i >= nValue && sq === seq[i - nValue]) {
          sq = (sq + 1) % 9;
        }
        seq.push(sq);
      }
    }
    return seq;
  }, [TOTAL_FLASHES, nValue]);

  const startGame = () => {
    const seq = generateSequence();
    setHistory(seq);
    setUserMatches({});
    setCurrentStep(0);
    setActiveSquare(seq[0]);
    setMatchPressedCurrentStep(false);
    setPhase('playing');
    soundFx.playTone(520, 0.15);
  };

  // Main stimulus step loop
  useEffect(() => {
    if (phase !== 'playing') return;

    timerRef.current = setTimeout(() => {
      const nextStep = currentStep + 1;

      if (nextStep < history.length) {
        setCurrentStep(nextStep);
        setActiveSquare(history[nextStep]);
        setMatchPressedCurrentStep(false);
        soundFx.playTone(480 + history[nextStep] * 30, 0.12);
      } else {
        // Game finished!
        setPhase('finished');
        setActiveSquare(null);

        // Calculate hits, false alarms, misses
        let hits = 0;
        let falseAlarms = 0;
        let totalTargets = 0;

        history.forEach((square, idx) => {
          if (idx >= nValue) {
            const isActualMatch = square === history[idx - nValue];
            if (isActualMatch) totalTargets++;

            const userSaidMatch = !!userMatches[idx];
            if (isActualMatch && userSaidMatch) {
              hits++;
            } else if (!isActualMatch && userSaidMatch) {
              falseAlarms++;
            }
          }
        });

        const misses = totalTargets - hits;
        const totalEvaluated = history.length - nValue;
        const correctRejections = totalEvaluated - totalTargets - falseAlarms;
        const totalCorrect = hits + correctRejections;
        const accuracyPct = Math.round((totalCorrect / Math.max(1, totalEvaluated)) * 100);

        onFinishSession({
          score: accuracyPct,
          accuracy: accuracyPct,
          details: [
            { label: 'N-Back Factor', value: `${nValue}-Back` },
            { label: 'Pacing Interval', value: `${(flashIntervalMs / 1000).toFixed(1)}s` },
            { label: 'Match Targets Hit', value: `${hits} / ${totalTargets}` },
            { label: 'False Alarms', value: `${falseAlarms}` },
          ],
        });
      }
    }, flashIntervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, currentStep, history, nValue, userMatches, flashIntervalMs, onFinishSession]);

  // Handle user clicking "MATCH"
  const handleMatchClick = useCallback(() => {
    if (phase !== 'playing' || matchPressedCurrentStep) return;

    soundFx.playClick();
    setMatchPressedCurrentStep(true);
    setUserMatches((prev) => ({ ...prev, [currentStep]: true }));
  }, [phase, matchPressedCurrentStep, currentStep]);

  // Keyboard shortcut (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleMatchClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMatchClick]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      {/* HUD Top Bar */}
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
          <Grid className="w-5 h-5 eb-done" />
          <h2 className="text-base font-bold text-slate-100">Fluid IQ ({nValue}-Back)</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 eb-done font-mono border border-emerald-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Flash <span className="eb-done font-bold">{currentStep + 1}</span> / {TOTAL_FLASHES}
        </div>
      </div>

      {/* Main Gameplay Screen */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 eb-done mb-4">
              <Grid className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Spatial {nValue}-Back Working Memory</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Squares will flash sequentially in a 3x3 grid. Click <span className="eb-done font-bold">MATCH</span> (or press <span className="eb-done font-bold underline">SPACEBAR</span>) if the current square position is identical to the square position <span className="eb-done font-bold">{nValue} step{nValue > 1 ? 's' : ''} ago</span>!
            </p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs mb-6 space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>N-Back Factor:</span>
                <span className="font-bold eb-done">{nValue}-Back</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Pacing Interval:</span>
                <span className="font-bold text-slate-200">{(flashIntervalMs / 1000).toFixed(1)}s</span>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                startGame();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Begin Training</span>
            </button>
          </div>
        )}

        {/* ACTIVE PLAYING PHASE */}
        {phase === 'playing' && (
          <div className="w-full text-center">
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="eb-done font-bold uppercase tracking-wider">
                WATCH POSITIONS • PRESS MATCH IF SAME AS {nValue}-STEP AGO
              </span>
              <span className="text-slate-400 font-mono">
                Step {currentStep + 1}/{TOTAL_FLASHES}
              </span>
            </div>

            {/* 3x3 Matrix Grid */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-900 border-2 border-slate-800 rounded-3xl mb-8 max-w-xs mx-auto shadow-2xl">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
                const isActive = activeSquare === index;
                return (
                  <div
                    key={index}
                    className={`aspect-square rounded-2xl transition-all duration-150 flex items-center justify-center ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-500/40 border-2 border-emerald-300 scale-105'
                        : 'bg-slate-950 border border-slate-800/80'
                    }`}
                  >
                    {isActive && (
                      <span className="h-4 w-4 rounded-full bg-slate-950/40 animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Match Button */}
            <div className="max-w-xs mx-auto">
              <button
                onClick={handleMatchClick}
                disabled={matchPressedCurrentStep}
                className={`w-full py-4 rounded-2xl font-black text-base tracking-wider uppercase transition-all active:scale-95 cursor-pointer shadow-xl select-none touch-manipulation flex items-center justify-center gap-2 ${
                  matchPressedCurrentStep
                    ? 'bg-emerald-500/20 eb-done border border-emerald-500/50'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>{matchPressedCurrentStep ? 'MATCH REGISTERED' : 'POSITION MATCH (SPACEBAR)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
