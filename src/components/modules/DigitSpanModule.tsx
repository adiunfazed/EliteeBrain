import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SessionResult } from '../../types';
import { soundFx } from '../../utils/audio';
import { Brain, ArrowLeft, Play, Eye, Delete, Check, RotateCcw, FastForward } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

export const DigitSpanModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_TRIALS = 5;

  const [phase, setPhase] = useState<'intro' | 'memorize' | 'recall' | 'feedback' | 'finished'>('intro');
  const [trialIndex, setTrialIndex] = useState(0);
  const [currentSequence, setCurrentSequence] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [trialResults, setTrialResults] = useState<{ target: string; input: string; correct: boolean }[]>([]);
  const [countdownProgress, setCountdownProgress] = useState(100);

  const [pacingMultiplier, setPacingMultiplier] = useState<number>(1.5); // Default Relaxed for clear reading
  const [getReadyCount, setGetReadyCount] = useState<number | null>(null);

  // Difficulty scaling params with generous readable exposure
  const sequenceLength = Math.min(12, 3 + Math.floor(currentLevel / 1.3));
  const baseDuration = Math.max(1800, 2600 + sequenceLength * 350 - (currentLevel - 1) * 100);
  const exposureDurationMs = Math.round(baseDuration * pacingMultiplier);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSkipTimer = useCallback(() => {
    soundFx.playClick();
    setGetReadyCount(null);
    setPhase('recall');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Generate random digits
  const generateSequence = useCallback(() => {
    let result = '';
    for (let i = 0; i < sequenceLength; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  }, [sequenceLength]);

  const startNextTrial = useCallback(() => {
    const seq = generateSequence();
    setCurrentSequence(seq);
    setUserInput('');
    
    // Quick 2-second Get Ready countdown before flashing digits
    setGetReadyCount(2);
    setPhase('memorize');
    soundFx.playTone(500, 0.1);
  }, [generateSequence]);

  // Handle Get Ready Countdown
  useEffect(() => {
    if (phase !== 'memorize' || getReadyCount === null) return;

    if (getReadyCount > 0) {
      const timer = setTimeout(() => {
        soundFx.playTone(500 + (3 - getReadyCount) * 100, 0.1);
        setGetReadyCount((prev) => (prev !== null ? prev - 1 : null));
      }, 700);
      return () => clearTimeout(timer);
    } else if (getReadyCount === 0) {
      setGetReadyCount(null);
      setCountdownProgress(100);
      soundFx.playTone(800, 0.2);
    }
  }, [phase, getReadyCount]);

  // Handle countdown during memorize sequence display phase
  useEffect(() => {
    if (phase !== 'memorize' || getReadyCount !== null) return;

    const intervalTime = 50;
    const steps = exposureDurationMs / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const pct = Math.max(0, 100 - (currentStep / steps) * 100);
      setCountdownProgress(pct);

      if (currentStep >= steps) {
        clearInterval(timer);
        setPhase('recall');
        soundFx.playTone(400, 0.1);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [phase, getReadyCount, exposureDurationMs]);

  const handleSubmitInput = useCallback(() => {
    if (phase !== 'recall') return;

    const isCorrect = userInput.trim() === currentSequence;
    if (isCorrect) {
      soundFx.playSuccess();
    } else {
      soundFx.playError();
    }

    const newResults = [...trialResults, { target: currentSequence, input: userInput.trim(), correct: isCorrect }];
    setTrialResults(newResults);
    setPhase('feedback');

    setTimeout(() => {
      if (trialIndex + 1 < TOTAL_TRIALS) {
        setTrialIndex((prev) => prev + 1);
        startNextTrial();
      } else {
        // Complete session
        const correctCount = newResults.filter((r) => r.correct).length;
        const accuracyPct = Math.round((correctCount / TOTAL_TRIALS) * 100);
        const scoreVal = accuracyPct;

        onFinishSession({
          score: scoreVal,
          accuracy: accuracyPct,
          details: [
            { label: 'Digit Length', value: `${sequenceLength} Digits` },
            { label: 'Exposure Time', value: `${(exposureDurationMs / 1000).toFixed(1)}s` },
            { label: 'Trials Correct', value: `${correctCount} / ${TOTAL_TRIALS}` },
          ],
        });
      }
    }, 1200);
  }, [phase, userInput, currentSequence, trialResults, trialIndex, TOTAL_TRIALS, startNextTrial, onFinishSession, sequenceLength, exposureDurationMs]);

  // Keyboard handler for physical keyboard typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'recall') return;

      if (/^[0-9]$/.test(e.key)) {
        if (userInput.length < sequenceLength + 2) {
          soundFx.playClick();
          setUserInput((prev) => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        soundFx.playClick();
        setUserInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleSubmitInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, userInput, sequenceLength, handleSubmitInput]);

  const handleVirtualKey = (num: string) => {
    if (phase !== 'recall') return;
    soundFx.playClick();
    if (userInput.length < sequenceLength + 2) {
      setUserInput((prev) => prev + num);
    }
  };

  const handleVirtualDelete = () => {
    if (phase !== 'recall') return;
    soundFx.playClick();
    setUserInput((prev) => prev.slice(0, -1));
  };

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
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Exit Module</span>
        </button>

        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 shrink-0 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100">Memory Engram</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Trial <span className="text-cyan-400 font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
        </div>
      </div>

      {/* Main Gameplay Screen */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4">
              <Eye className="w-8 h-8 shrink-0" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Memory Engram Challenge</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              A sequence of <span className="text-cyan-300 font-bold">{sequenceLength} digits</span> will flash on screen for{' '}
              <span className="text-cyan-300 font-bold">{(exposureDurationMs / 1000).toFixed(1)} seconds</span>. Focus your mind, memorize the exact pattern, and type it from memory once hidden.
            </p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs mb-6 space-y-3">
              <div className="flex justify-between items-center text-slate-400">
                <span>Sequence Length:</span>
                <span className="font-bold text-slate-200">{sequenceLength} Digits</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Exposure Duration:</span>
                <span className="font-bold text-cyan-300">{(exposureDurationMs / 1000).toFixed(1)}s</span>
              </div>

              {/* Reading Pace Control */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 block mb-2">READING SPEED / PACING:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mult: 1.8, label: 'Relaxed (Long)' },
                    { mult: 1.2, label: 'Standard' },
                    { mult: 0.8, label: 'Fast Sprint' },
                  ].map((p) => (
                    <button
                      key={p.mult}
                      onClick={() => {
                        soundFx.playClick();
                        setPacingMultiplier(p.mult);
                      }}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        pacingMultiplier === p.mult
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setTrialResults([]);
                startNextTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 shrink-0 fill-current" />
              <span>Begin Training</span>
            </button>
          </div>
        )}

        {/* MEMORIZE PHASE */}
        {phase === 'memorize' && (
          <div className="w-full text-center">
            {getReadyCount !== null ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 text-center animate-pulse shadow-xl flex flex-col items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-3">
                  GET READY TO READ
                </span>
                <div className="text-6xl font-black text-cyan-400 font-mono mb-6">
                  {getReadyCount > 0 ? getReadyCount : 'FOCUS!'}
                </div>
                <button
                  onClick={handleSkipTimer}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-all active:scale-95 touch-manipulation flex items-center justify-center gap-2"
                >
                  <FastForward className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>Skip Ready Timer</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                    MEMORIZE SEQUENCE NOW ({(exposureDurationMs / 1000).toFixed(1)}s)
                  </span>

                  {/* Skip Timer button */}
                  <button
                    onClick={handleSkipTimer}
                    className="py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-all active:scale-95 touch-manipulation flex items-center gap-1.5 shadow-md"
                  >
                    <FastForward className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>Skip Timer → Enter Answer</span>
                  </button>
                </div>

                {/* Sequence Flash Box */}
                <div className="relative bg-slate-900 border-2 border-cyan-500/60 rounded-3xl p-8 md:p-12 mb-6 shadow-2xl shadow-cyan-500/10 overflow-hidden">
                  <div className="text-4xl md:text-6xl font-black font-mono tracking-[0.3em] text-slate-100 drop-shadow-lg pl-[0.3em]">
                    {currentSequence}
                  </div>

                  {/* Countdown Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-950">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-75"
                      style={{ width: `${countdownProgress}%` }}
                    />
                  </div>
                </div>

                {/* Additional Prominent Skip Button */}
                <button
                  onClick={handleSkipTimer}
                  className="w-full py-3 px-5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-all active:scale-95 touch-manipulation flex items-center justify-center gap-2 shadow-lg"
                >
                  <FastForward className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>I'm Ready → Skip to Type Answer</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* RECALL PHASE */}
        {(phase === 'recall' || phase === 'feedback') && (
          <div className="w-full text-center">
            <span className="text-xs uppercase tracking-widest text-violet-400 font-bold block mb-4">
              {phase === 'recall' ? 'RECALL & ENTER SEQUENCE' : 'EVALUATING MEMORY...'}
            </span>

            {/* Input Display Box */}
            <div
              className={`bg-slate-900 border-2 rounded-3xl p-6 md:p-8 mb-6 shadow-xl transition-all ${
                phase === 'feedback'
                  ? trialResults[trialResults.length - 1]?.correct
                    ? 'border-emerald-500/80 bg-emerald-950/20 eb-done'
                    : 'border-rose-500/80 bg-rose-950/20 eb-danger'
                  : 'border-slate-700 text-slate-100'
              }`}
            >
              <div className="text-3xl md:text-5xl font-black font-mono tracking-widest min-h-[50px] flex items-center justify-center">
                {userInput || <span className="text-slate-600 animate-pulse">_ _ _ _</span>}
              </div>

              {phase === 'feedback' && (
                <div className="mt-3 text-xs font-bold flex items-center justify-center gap-2">
                  {trialResults[trialResults.length - 1]?.correct ? (
                    <span className="eb-done">Correct Engram Recorded!</span>
                  ) : (
                    <span className="eb-danger">Incorrect. Target was: {currentSequence}</span>
                  )}
                </div>
              )}
            </div>

            {/* On-Screen Virtual Keypad */}
            {phase === 'recall' && (
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-3xl">
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleVirtualKey(num)}
                      className="py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xl font-bold font-mono text-slate-200 active:scale-95 transition-all cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={handleVirtualDelete}
                    className="py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    <Delete className="w-5 h-5 shrink-0" />
                  </button>
                  <button
                    onClick={() => handleVirtualKey('0')}
                    className="py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xl font-bold font-mono text-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    onClick={handleSubmitInput}
                    disabled={userInput.length === 0}
                    className="py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 flex items-center justify-center font-bold active:scale-95 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    <Check className="w-6 h-6 shrink-0 stroke-[3]" />
                  </button>
                </div>

                <p className="text-[10px] text-slate-500">
                  You can also type numbers directly on your physical keyboard
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
