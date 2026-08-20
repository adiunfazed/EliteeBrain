import React, { useState, useEffect, useCallback, useRef } from 'react';
import { soundFx } from '../../utils/audio';
import { Target, ArrowLeft, Play, Zap, ShieldAlert, Award, Timer } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

type ModuleMode = 'SPEED_TESTER' | 'NOGO_INHIBITOR';

export const ReactionInhibitorModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const [selectedMode, setSelectedMode] = useState<ModuleMode>('SPEED_TESTER');
  const [phase, setPhase] = useState<'intro' | 'waiting' | 'ready' | 'too_early' | 'feedback' | 'finished'>('intro');

  const TOTAL_TRIALS = 5;
  const [trialIndex, setTrialIndex] = useState(0);

  // Speed tester state
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Start Speed Tester Trial (Red -> Green)
  const startSpeedTrial = useCallback(() => {
    setPhase('waiting');
    setLastMs(null);

    // Random delay guaranteed between 1.5s and 3.8s (always < 5s)
    const randomDelay = 1500 + Math.random() * 2300;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      startTimeRef.current = performance.now();
      setPhase('ready');
    }, randomDelay);
  }, []);

  const handleClick = useCallback(() => {
    if (phase === 'waiting') {
      // Clicked too early before green
      if (timerRef.current) clearTimeout(timerRef.current);
      soundFx.playError();
      setPhase('too_early');
    } else if (phase === 'ready') {
      // Clicked on green!
      const elapsed = Math.round(performance.now() - startTimeRef.current);
      setLastMs(elapsed);
      soundFx.playSuccess();

      const newTimes = [...reactionTimes, elapsed];
      setReactionTimes(newTimes);
      setPhase('feedback');

      setTimeout(() => {
        if (trialIndex + 1 < TOTAL_TRIALS) {
          setTrialIndex((prev) => prev + 1);
          startSpeedTrial();
        } else {
          // Finish session
          setPhase('finished');
          const avgMs = Math.round(newTimes.reduce((a, b) => a + b, 0) / TOTAL_TRIALS);
          const bestMs = Math.min(...newTimes);

          // Rating tiers
          let rating = 'Standard';
          if (avgMs < 190) rating = 'Cyberpunk Reflex (<190ms)';
          else if (avgMs < 220) rating = 'Elite Athlete (<220ms)';
          else if (avgMs < 260) rating = 'High Speed (<260ms)';

          onFinishSession({
            score: Math.max(10, Math.min(100, Math.round(100 - (avgMs - 150) * 0.4))),
            accuracy: 100,
            details: [
              { label: 'Mean Reaction Speed', value: `${avgMs} ms` },
              { label: 'Peak Single Reflex', value: `${bestMs} ms` },
              { label: 'Reflex Tier', value: rating },
            ],
          });
        }
      }, 1200);
    } else if (phase === 'too_early') {
      // Reset trial
      startSpeedTrial();
    }
  }, [phase, reactionTimes, trialIndex, TOTAL_TRIALS, startSpeedTrial, onFinishSession]);

  // Clean up timer ONLY on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Keyboard shortcut (Spacebar or Click)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClick]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-y-auto">
      {/* HUD Bar */}
      <div className="flex items-center justify-between p-4 md:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-lg">
        <button
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            soundFx.playClick();
            onClose();
          }}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Exit Module</span>
        </button>

        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 shrink-0 text-teal-400" />
          <h2 className="text-base font-bold text-slate-100">Reaction Speed & Impulse Control</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 font-mono border border-teal-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Trial <span className="text-teal-400 font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 mb-4">
              <Zap className="w-8 h-8 shrink-0" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Visual Reaction Speed Tester</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              When you click Start, the screen will turn <span className="eb-danger font-bold">RED</span>. Wait patiently. The instant the screen turns <span className="eb-done font-bold">BRIGHT GREEN</span>, click or hit Spacebar as fast as humanly possible!
            </p>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setReactionTimes([]);
                startSpeedTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 shrink-0 fill-current" />
              <span>Start Reaction Speed Test</span>
            </button>
          </div>
        )}

        {/* WAITING PHASE (RED SCREEN) */}
        {phase === 'waiting' && (
          <div
            onClick={handleClick}
            onTouchStart={(e) => {
              e.preventDefault();
              handleClick();
            }}
            className="w-full h-80 rounded-3xl bg-rose-600 border-4 border-rose-400 flex flex-col items-center justify-center p-8 text-center cursor-pointer shadow-2xl shadow-rose-600/30 select-none touch-manipulation active:scale-95 transition-all"
          >
            <div className="w-16 h-16 shrink-0 rounded-full bg-rose-950/40 border border-rose-300 flex items-center justify-center mb-4 animate-pulse">
              <Timer className="w-8 h-8 shrink-0 text-white" />
            </div>
            <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">WAIT FOR GREEN...</h3>
            <p className="text-xs text-rose-100 font-semibold">Do not click yet! Hold your impulse.</p>
          </div>
        )}

        {/* READY PHASE (GREEN SCREEN - TAP NOW) */}
        {phase === 'ready' && (
          <div
            onClick={handleClick}
            onTouchStart={(e) => {
              e.preventDefault();
              handleClick();
            }}
            className="w-full h-80 rounded-3xl bg-emerald-500 border-4 border-emerald-300 flex flex-col items-center justify-center p-8 text-center cursor-pointer shadow-2xl shadow-emerald-500/50 select-none touch-manipulation active:scale-95 transition-all"
          >
            <div className="w-20 h-20 shrink-0 rounded-full bg-white flex items-center justify-center mb-4 animate-ping">
              <Zap className="w-10 h-10 shrink-0 text-emerald-600 fill-current" />
            </div>
            <h3 className="text-4xl font-black text-slate-950 mb-2 uppercase tracking-widest">CLICK NOW!</h3>
            <p className="text-xs text-slate-950 font-extrabold uppercase">STRIKE SPACEBAR OR SCREEN!</p>
          </div>
        )}

        {/* TOO EARLY WARNING */}
        {phase === 'too_early' && (
          <div
            onClick={handleClick}
            className="w-full h-80 rounded-3xl bg-amber-950/90 border-4 border-amber-500 flex flex-col items-center justify-center p-8 text-center cursor-pointer shadow-2xl select-none"
          >
            <ShieldAlert className="w-16 h-16 shrink-0 eb-warn mb-3" />
            <h3 className="text-2xl font-black eb-warn mb-2 uppercase">TOO EARLY!</h3>
            <p className="text-xs text-slate-300 mb-6">You clicked while the screen was still Red. Click anywhere to retry this trial.</p>
            <button className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">
              Retry Trial
            </button>
          </div>
        )}

        {/* FEEDBACK PHASE */}
        {phase === 'feedback' && lastMs && (
          <div className="w-full h-80 rounded-3xl bg-slate-900 border-2 border-teal-500/50 flex flex-col items-center justify-center p-8 text-center shadow-2xl">
            <div className="inline-flex p-3 rounded-full bg-teal-500/10 text-teal-400 mb-3">
              <Award className="w-8 h-8 shrink-0" />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 block uppercase mb-1">
              REACTION SPEED MEASURED
            </span>
            <div className="text-6xl font-black font-mono text-teal-300 mb-2">{lastMs} ms</div>
            <p className="text-xs text-slate-400">
              {lastMs < 200 ? '⚡ Cyberpunk Speed (<200ms)!' : lastMs < 240 ? 'Pro Athlete Level!' : '👍 Good Reflexes!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
