import React, { useState, useEffect, useRef, useCallback } from 'react';
import { soundFx } from '../../utils/audio';
import { Compass, ArrowLeft, Play, AlertTriangle, ShieldCheck, RefreshCw, Eye } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

export const StillnessModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  // Configurable target duration (default 5 minutes = 300 seconds for full requirement)
  const [targetDurationSec, setTargetDurationSec] = useState<number>(300);

  const [phase, setPhase] = useState<'intro' | 'active' | 'violation' | 'finished'>('intro');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(targetDurationSec);
  const [resetCount, setResetCount] = useState<number>(0);
  const [stabilityPct, setStabilityPct] = useState<number>(100);

  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = () => {
    setPhase('active');
    setSecondsRemaining(targetDurationSec);
    setResetCount(0);
    setStabilityPct(100);
    lastPos.current = null;
    soundFx.playTone(400, 0.2);
  };

  const triggerViolation = useCallback(() => {
    if (phase !== 'active') return;

    soundFx.playStillnessAlert();
    setPhase('violation');
    setResetCount((prev) => prev + 1);
    setSecondsRemaining(targetDurationSec); // Reset timer as requested!

    violationTimeoutRef.current = setTimeout(() => {
      setPhase('active');
      lastPos.current = null;
    }, 1200);
  }, [phase, targetDurationSec]);

  // Main Stillness Countdown Timer
  useEffect(() => {
    if (phase !== 'active') return;

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase('finished');

          // Score based on reset count
          const finalScore = Math.max(20, 100 - resetCount * 25);
          onFinishSession({
            score: finalScore,
            accuracy: finalScore,
            details: [
              { label: 'Focus Duration', value: `${Math.round(targetDurationSec / 60)} Minutes` },
              { label: 'Movement Violations', value: `${resetCount} Resets` },
              { label: 'Attentional Stability', value: `${Math.max(0, 100 - resetCount * 20)}%` },
            ],
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, targetDurationSec, resetCount, onFinishSession]);

  // Mouse Movement Listener for Stillness Detection
  useEffect(() => {
    if (phase !== 'active') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!lastPos.current) {
        lastPos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const dx = Math.abs(e.clientX - lastPos.current.x);
      const dy = Math.abs(e.clientY - lastPos.current.y);
      const movement = Math.sqrt(dx * dx + dy * dy);

      // Movement tolerance threshold (18 pixels displacement triggers reset)
      if (movement > 18) {
        triggerViolation();
      } else {
        lastPos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleTouchMove = () => {
      triggerViolation();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [phase, triggerViolation]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 overflow-y-auto ${
      phase === 'violation' ? 'bg-rose-950/90 text-rose-100' : 'bg-slate-950 text-slate-100'
    }`}>
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
          <Compass className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">Gray Matter Stillness</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono border border-amber-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="text-xs text-amber-400 font-mono font-bold">
          {resetCount > 0 ? `${resetCount} Resets` : 'Zero Movement'}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Deep Focus & Physical Stillness</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Inhibit impulsive micro-movements to strengthen prefrontal cortex attentional regulation. Keep your cursor <span className="text-amber-300 font-bold underline">completely STILL</span>. If you move your mouse, the timer flashes red and resets!
            </p>

            {/* Target Duration Selector */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-left">
              <span className="text-xs font-bold text-slate-400 block mb-2">
                SELECT MEDITATION / STILLNESS DURATION:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {[
                  { sec: 60, label: '1 Min' },
                  { sec: 180, label: '3 Min' },
                  { sec: 300, label: '5 Min' },
                  { sec: 600, label: '10 Min' },
                  { sec: 900, label: '15 Min' },
                  { sec: 1200, label: '20 Min' },
                  { sec: 1800, label: '30 Min' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    onClick={() => {
                      soundFx.playClick();
                      setTargetDurationSec(item.sec);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      targetDurationSec === item.sec
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Minutes Input */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 font-medium">Custom Minutes:</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={Math.round(targetDurationSec / 60)}
                  onChange={(e) => {
                    const mins = Math.max(1, Math.min(120, parseInt(e.target.value) || 1));
                    setTargetDurationSec(mins * 60);
                  }}
                  className="w-20 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs font-bold text-amber-400">({Math.round(targetDurationSec / 60)} Minutes Selected)</span>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playClick();
                startSession();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Begin Stillness Focus</span>
            </button>
          </div>
        )}

        {/* ACTIVE / VIOLATION STILLNESS CANVAS */}
        {(phase === 'active' || phase === 'violation') && (
          <div className="w-full text-center">
            {phase === 'violation' ? (
              <div className="bg-rose-950 border-2 border-rose-500 rounded-3xl p-8 mb-6 animate-bounce text-rose-200 shadow-2xl">
                <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-2" />
                <h3 className="text-2xl font-black uppercase tracking-wider">MOVEMENT DETECTED!</h3>
                <p className="text-xs text-rose-300 mt-1">Timer reset back to {formatTime(targetDurationSec)}</p>
              </div>
            ) : (
              <div className="relative bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-10 md:p-14 mb-8 shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col items-center justify-center min-h-[260px]">
                
                {/* Concentric Stillness Pulsing Rings */}
                <div className="absolute w-48 h-48 rounded-full border border-amber-500/20 animate-ping opacity-30 pointer-events-none" />
                <div className="absolute w-32 h-32 rounded-full border border-amber-400/30 animate-pulse pointer-events-none" />

                <span className="text-xs uppercase tracking-widest text-amber-400 font-bold block mb-2">
                  MAINTAIN ABSOLUTE STILLNESS
                </span>

                <div className="text-6xl md:text-8xl font-black font-mono tracking-widest text-slate-100 my-2 drop-shadow-2xl">
                  {formatTime(secondsRemaining)}
                </div>

                <p className="text-xs text-slate-400 font-medium">
                  DO NOT MOVE YOUR CURSOR OR TOUCH THE SCREEN
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
