import React, { useState, useEffect, useCallback, useRef } from 'react';
import { soundFx } from '../../utils/audio';
import { Zap, ArrowLeft, Play, Timer, Sparkles } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

interface ColorOption {
  name: string;
  hex: string;
  bgClass: string;
}

const COLOR_PALETTE: ColorOption[] = [
  { name: 'RED', hex: '#f43f5e', bgClass: 'bg-rose-500' },
  { name: 'BLUE', hex: '#3b82f6', bgClass: 'bg-blue-500' },
  { name: 'GREEN', hex: '#10b981', bgClass: 'bg-emerald-500' },
  { name: 'YELLOW', hex: '#eab308', bgClass: 'bg-yellow-500' },
  { name: 'PURPLE', hex: '#a855f7', bgClass: 'bg-purple-500' },
  { name: 'CYAN', hex: '#06b6d4', bgClass: 'bg-cyan-500' },
];

export const StroopModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_TRIALS = 12;

  const [phase, setPhase] = useState<'intro' | 'active' | 'feedback' | 'finished'>('intro');
  const [trialIndex, setTrialIndex] = useState(0);

  // Active stimulus state
  const [displayText, setDisplayText] = useState<string>('RED');
  const [inkColor, setInkColor] = useState<ColorOption>(COLOR_PALETTE[0]);
  const [options, setOptions] = useState<ColorOption[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(0);
  const [timerProgress, setTimerProgress] = useState<number>(100);

  // Stats tracking
  const [results, setResults] = useState<{ correct: boolean; reactionTimeMs: number }[]>([]);

  // Difficulty scaling params
  const activeColorCount = Math.min(6, 4 + (currentLevel >= 4 ? 1 : 0) + (currentLevel >= 7 ? 1 : 0));
  const timeLimitMs = 3000; // Fixed 3 seconds per word as requested

  const availableColors = useRef<ColorOption[]>(COLOR_PALETTE.slice(0, activeColorCount));
  availableColors.current = COLOR_PALETTE.slice(0, activeColorCount);

  // Generate a random Stroop trial
  const generateTrial = useCallback(() => {
    const palette = availableColors.current;
    
    // Pick ink color randomly
    const inkIndex = Math.floor(Math.random() * palette.length);
    const ink = palette[inkIndex];

    // High probability of incongruent word text
    let textIndex = Math.floor(Math.random() * palette.length);
    if (Math.random() > 0.25 && palette.length > 1) {
      while (textIndex === inkIndex) {
        textIndex = Math.floor(Math.random() * palette.length);
      }
    }
    const textWord = palette[textIndex].name;

    setDisplayText(textWord);
    setInkColor(ink);
    setOptions([...palette]);
    setTrialStartTime(Date.now());
    setTimerProgress(100);
  }, []);

  const startNextTrial = useCallback(() => {
    generateTrial();
    setPhase('active');
  }, [generateTrial]);

  const handleAnswer = useCallback((selected: ColorOption | null) => {
    if (phase !== 'active') return;

    const reactionTime = Date.now() - trialStartTime;
    const isCorrect = selected !== null && selected.name === inkColor.name;

    if (isCorrect) {
      soundFx.playSuccess();
    } else {
      soundFx.playError();
    }

    const newResults = [...results, { correct: isCorrect, reactionTimeMs: reactionTime }];
    setResults(newResults);

    if (trialIndex + 1 < TOTAL_TRIALS) {
      setTrialIndex((prev) => prev + 1);
      startNextTrial();
    } else {
      // Finished all trials
      setPhase('finished');
      const correctCount = newResults.filter((r) => r.correct).length;
      const accuracyPct = Math.round((correctCount / TOTAL_TRIALS) * 100);
      const validTimes = newResults.filter((r) => r.correct).map((r) => r.reactionTimeMs);
      const avgSpeedMs = validTimes.length > 0 ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : timeLimitMs;

      // Overall Score formula combining speed & accuracy
      const speedScore = Math.max(0, 100 - Math.round((avgSpeedMs / timeLimitMs) * 50));
      const overallScore = Math.round(accuracyPct * 0.7 + speedScore * 0.3);

      onFinishSession({
        score: overallScore,
        accuracy: accuracyPct,
        details: [
          { label: 'Avg Reaction Speed', value: `${avgSpeedMs} ms` },
          { label: 'Time Limit Per Word', value: `3.0s` },
          { label: 'Active Colors', value: `${activeColorCount} Colors` },
          { label: 'Accuracy', value: `${correctCount} / ${TOTAL_TRIALS}` },
        ],
      });
    }
  }, [phase, trialStartTime, inkColor, results, trialIndex, TOTAL_TRIALS, startNextTrial, onFinishSession, timeLimitMs, activeColorCount]);

  // Handle countdown timer for active trial (re-runs on EVERY trialIndex shift)
  useEffect(() => {
    if (phase !== 'active') return;

    setTimerProgress(100);
    const intervalTime = 30;
    const steps = timeLimitMs / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const pct = Math.max(0, 100 - (currentStep / steps) * 100);
      setTimerProgress(pct);

      if (currentStep >= steps) {
        clearInterval(timer);
        // Timeout counts as incorrect answer
        handleAnswer(null);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [phase, trialIndex, timeLimitMs, handleAnswer]);

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
          <Zap className="w-5 h-5 shrink-0 text-violet-400" />
          <h2 className="text-base font-bold text-slate-100">Prefrontal Focus</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-mono border border-violet-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Trial <span className="text-violet-400 font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
        </div>
      </div>

      {/* Main Gameplay Canvas */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 mb-4">
              <Zap className="w-8 h-8 shrink-0" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Prefrontal Stroop Test</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              A word will appear painted in a specific <span className="text-violet-300 font-bold">INK color</span>. Click the button matching the <span className="eb-danger font-bold uppercase underline">INK COLOR</span> of the text—do NOT click the text word!
            </p>

            {/* Visual Example Card */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 mb-6 text-center">
              <span className="text-xs text-slate-500 block mb-2 font-bold">EXAMPLE TRIAL:</span>
              <div className="text-4xl font-black font-mono tracking-widest text-blue-500 mb-3">
                RED
              </div>
              <p className="text-[11px] text-violet-300 font-medium">
                Word says "RED" but Ink is <span className="text-blue-400 font-bold">BLUE</span>. You must click <span className="text-blue-400 font-bold underline">BLUE</span>!
              </p>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setResults([]);
                startNextTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 shrink-0 fill-current" />
              <span>Begin Training</span>
            </button>
          </div>
        )}

        {/* ACTIVE TRIAL PHASE */}
        {phase === 'active' && (
          <div className="w-full text-center">
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="text-violet-400 font-bold uppercase tracking-wider">
                SELECT INK COLOR BELOW
              </span>
              <span className="text-slate-400 font-mono flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                {(timeLimitMs / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Stimulus Card */}
            <div className="relative bg-slate-900 border-2 border-violet-500/60 rounded-3xl p-10 md:p-14 mb-8 shadow-2xl shadow-violet-500/10 overflow-hidden min-h-[160px] flex items-center justify-center">
              <div
                className="text-5xl md:text-7xl font-black font-mono tracking-widest drop-shadow-2xl transition-all"
                style={{ color: inkColor.hex }}
              >
                {displayText}
              </div>

              {/* Timer Progress Line */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-950">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-75"
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
            </div>

            {/* Color Option Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {options.map((option) => (
                <button
                  key={option.name}
                  onClick={() => handleAnswer(option)}
                  className="py-4 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-slate-600 text-slate-100 font-black text-sm md:text-base tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${option.bgClass}`} />
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
