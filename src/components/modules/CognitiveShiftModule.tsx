import React, { useState, useEffect, useCallback } from 'react';
import { soundFx } from '../../utils/audio';
import { Shuffle, ArrowLeft, Play, Zap, Keyboard, Timer } from 'lucide-react';

interface Props {
  currentLevel: number;
  onFinishSession: (result: { score: number; accuracy: number; details: { label: string; value: string | number }[] }) => void;
  onClose: () => void;
}

type RuleType = 'PARITY' | 'MAGNITUDE' | 'COLOR';

interface Stimulus {
  number: number;
  color: 'cyan' | 'violet';
  rule: RuleType;
}

export const CognitiveShiftModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const TOTAL_TRIALS = 12;

  const [phase, setPhase] = useState<'intro' | 'active' | 'feedback' | 'finished'>('intro');
  const [trialIndex, setTrialIndex] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState<Stimulus | null>(null);
  const [trialResults, setTrialResults] = useState<{ correct: boolean; responseMs: number; ruleSwitched: boolean }[]>([]);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [lastRule, setLastRule] = useState<RuleType | null>(null);

  // Session Stopwatch Timer
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [personalBest, setPersonalBest] = useState<number | null>(() => {
    const saved = localStorage.getItem('elitebrain_pb_cognitiveshift');
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

  const generateStimulus = useCallback((prevRule: RuleType | null): Stimulus => {
    const availableRules: RuleType[] = ['PARITY', 'MAGNITUDE', 'COLOR'];
    let rule: RuleType;
    if (!prevRule) {
      rule = availableRules[Math.floor(Math.random() * availableRules.length)];
    } else {
      // 70% chance of switching rule to challenge set-shifting flexibility
      if (Math.random() < 0.7) {
        const remaining = availableRules.filter((r) => r !== prevRule);
        rule = remaining[Math.floor(Math.random() * remaining.length)];
      } else {
        rule = prevRule;
      }
    }

    const num = Math.floor(Math.random() * 9) + 1; // 1-9
    const color = Math.random() > 0.5 ? 'cyan' : 'violet';

    return { number: num, color, rule };
  }, []);

  const startNextTrial = useCallback(() => {
    const s = generateStimulus(lastRule);
    setLastRule(s.rule);
    setCurrentStimulus(s);
    setPhase('active');
    setTrialStartTime(Date.now());
    soundFx.playTone(700, 0.1);
  }, [generateStimulus, lastRule]);

  const handleResponse = useCallback((answer: string) => {
    if (phase !== 'active' || !currentStimulus) return;

    const responseMs = Date.now() - trialStartTime;
    let isCorrect = false;

    if (currentStimulus.rule === 'PARITY') {
      const isEven = currentStimulus.number % 2 === 0;
      isCorrect = (answer === 'EVEN' && isEven) || (answer === 'ODD' && !isEven);
    } else if (currentStimulus.rule === 'MAGNITUDE') {
      const isGreater = currentStimulus.number > 5;
      isCorrect = (answer === 'GREATER' && isGreater) || (answer === 'LESS' && !isGreater) || (currentStimulus.number === 5 && answer === 'LESS');
    } else if (currentStimulus.rule === 'COLOR') {
      isCorrect = answer.toLowerCase() === currentStimulus.color;
    }

    if (isCorrect) soundFx.playSuccess();
    else soundFx.playError();

    const isRuleSwitch = lastRule !== null && lastRule !== currentStimulus.rule;
    const newResults = [...trialResults, { correct: isCorrect, responseMs, ruleSwitched: isRuleSwitch }];
    setTrialResults(newResults);
    setPhase('feedback');

    setTimeout(() => {
      if (trialIndex + 1 < TOTAL_TRIALS) {
        setTrialIndex((prev) => prev + 1);
        startNextTrial();
      } else {
        const correctCount = newResults.filter((r) => r.correct).length;
        const accuracyPct = Math.round((correctCount / TOTAL_TRIALS) * 100);
        const meanLatency = Math.round(newResults.reduce((acc, r) => acc + r.responseMs, 0) / TOTAL_TRIALS);
        const switches = newResults.filter((r) => r.ruleSwitched).length;
        const totalTimeSec = sessionStartTime ? (Date.now() - sessionStartTime) / 1000 : 0;

        let isNewPB = false;
        let bestVal = personalBest;
        if (!bestVal || totalTimeSec < bestVal) {
          localStorage.setItem('elitebrain_pb_cognitiveshift', totalTimeSec.toFixed(2));
          setPersonalBest(totalTimeSec);
          isNewPB = true;
        }

        onFinishSession({
          score: accuracyPct,
          accuracy: accuracyPct,
          details: [
            { label: 'Total Time Consumed', value: `${totalTimeSec.toFixed(1)}s ${isNewPB ? '⚡ NEW BEST!' : bestVal ? `(Best: ${bestVal.toFixed(1)}s)` : ''}` },
            { label: 'Set-Shifting Accuracy', value: `${correctCount} / ${TOTAL_TRIALS} (${accuracyPct}%)` },
            { label: 'Mean Shift Latency', value: `${meanLatency} ms` },
            { label: 'Cognitive Set Switches', value: `${switches} Shift Transitions` },
          ],
        });
      }
    }, 600);
  }, [phase, currentStimulus, trialStartTime, lastRule, trialResults, trialIndex, TOTAL_TRIALS, startNextTrial, onFinishSession]);

  // Keyboard shortcut binding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'active' || !currentStimulus) return;
      if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStimulus.rule === 'PARITY') handleResponse('EVEN');
        else if (currentStimulus.rule === 'MAGNITUDE') handleResponse('GREATER');
        else if (currentStimulus.rule === 'COLOR') handleResponse('CYAN');
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStimulus.rule === 'PARITY') handleResponse('ODD');
        else if (currentStimulus.rule === 'MAGNITUDE') handleResponse('LESS');
        else if (currentStimulus.rule === 'COLOR') handleResponse('VIOLET');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentStimulus, handleResponse]);

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
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Exit Module</span>
        </button>

        <div className="flex items-center gap-2">
          <Shuffle className="w-5 h-5 shrink-0 eb-danger" />
          <h2 className="text-base font-bold text-slate-100">Cognitive Shift & Flexibility</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 eb-danger font-mono border border-rose-500/30">
            Lvl {currentLevel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {sessionStartTime && (phase === 'active' || phase === 'feedback') && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 eb-danger font-mono text-xs">
              <Timer className="w-3.5 h-3.5 shrink-0 eb-danger animate-pulse" />
              <span className="font-black">{elapsedTime.toFixed(1)}s</span>
              {personalBest && (
                <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 ml-0.5">
                  Best: {personalBest.toFixed(1)}s
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-slate-400 font-mono">
            Trial <span className="eb-danger font-bold">{trialIndex + 1}</span> / {TOTAL_TRIALS}
          </div>
        </div>
      </div>

      {/* Main Screen */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full">
        {phase === 'intro' && (
          <div className="text-center bg-slate-900/80 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl w-full">
            <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 eb-danger mb-4">
              <Shuffle className="w-8 h-8 shrink-0" />
            </div>
            <h3 className="text-2xl font-black text-slate-100 mb-2">Tri-Rule Set-Shifting</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              The active rule banner will dynamically shift between 3 cognitive rules:
              <br />
              1. <span className="eb-warn font-bold">PARITY</span> (Even or Odd)
              <br />
              2. <span className="eb-done font-bold">MAGNITUDE</span> (Greater or Less than 5)
              <br />
              3. <span className="text-cyan-300 font-bold">COLOR</span> (Cyan or Violet)
              <br />
              Use <span className="eb-danger font-bold">Keys 1 / 2</span> or <span className="eb-danger font-bold">Arrow Keys</span> for rapid decision speed.
            </p>

            <button
              onClick={() => {
                soundFx.playClick();
                setTrialIndex(0);
                setTrialResults([]);
                setLastRule(null);
                setSessionStartTime(Date.now());
                setElapsedTime(0);
                startNextTrial();
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-black text-sm tracking-wide cursor-pointer shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 shrink-0 fill-current" />
              <span>Begin Cognitive Shift</span>
            </button>
          </div>
        )}

        {(phase === 'active' || phase === 'feedback') && currentStimulus && (
          <div className="w-full text-center">
            {/* Rule Banner */}
            <div
              className={`p-4 rounded-2xl border-2 mb-6 transition-all shadow-xl ${
                currentStimulus.rule === 'PARITY'
                  ? 'bg-amber-950/50 border-amber-500 eb-warn'
                  : currentStimulus.rule === 'MAGNITUDE'
                  ? 'bg-emerald-950/50 border-emerald-500 eb-done'
                  : 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
              }`}
            >
              <span className="text-[10px] font-mono tracking-widest uppercase block mb-1">
                ACTIVE RULE CONDITION
              </span>
              <h3 className="text-2xl font-black tracking-wide">
                {currentStimulus.rule === 'PARITY' && 'PARITY: EVEN [1] or ODD [2]?'}
                {currentStimulus.rule === 'MAGNITUDE' && 'MAGNITUDE: > 5 [1] or ≤ 5 [2]?'}
                {currentStimulus.rule === 'COLOR' && 'COLOR: CYAN [1] or VIOLET [2]?'}
              </h3>
            </div>

            {/* Stimulus Card */}
            <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-10 md:p-12 mb-8 shadow-2xl flex items-center justify-center min-h-[180px]">
              <span
                className={`text-7xl font-black font-mono drop-shadow-2xl ${
                  currentStimulus.color === 'cyan' ? 'text-cyan-400' : 'text-violet-400'
                }`}
              >
                {currentStimulus.number}
              </span>
            </div>

            {/* Action Choice Buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {currentStimulus.rule === 'PARITY' && (
                <>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('EVEN')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black text-base transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    EVEN [Key 1 / ←]
                  </button>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('ODD')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black text-base transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    ODD [Key 2 / →]
                  </button>
                </>
              )}

              {currentStimulus.rule === 'MAGNITUDE' && (
                <>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('GREATER')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 border border-slate-700 font-black text-base transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    GREATER &gt; 5 [1 / ←]
                  </button>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('LESS')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 border border-slate-700 font-black text-base transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    LESS ≤ 5 [2 / →]
                  </button>
                </>
              )}

              {currentStimulus.rule === 'COLOR' && (
                <>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('CYAN')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 border border-slate-700 font-black text-base text-cyan-400 hover:text-slate-950 transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    CYAN [1 / ←]
                  </button>
                  <button
                    disabled={phase === 'feedback'}
                    onClick={() => handleResponse('VIOLET')}
                    className="py-4 rounded-2xl bg-slate-900 hover:bg-violet-500 hover:text-white border border-slate-700 font-black text-base text-violet-400 hover:text-white transition-all active:scale-95 cursor-pointer shadow-lg"
                  >
                    VIOLET [2 / →]
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
