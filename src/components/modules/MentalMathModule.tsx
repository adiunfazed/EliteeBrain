import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Calculator } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { generateRound, secondsForLevel, operationsForLevel, ArithmeticQuestion } from '../../lib/arithmetic';

interface Props {
  currentLevel: number;
  onFinishSession: (result: {
    score: number;
    accuracy: number;
    details: { label: string; value: string | number }[];
  }) => void;
  onClose: () => void;
}

const QUESTIONS = 10;

/**
 * Mental arithmetic under time pressure.
 *
 * Ten questions, four options each, one clock per question. Running out of
 * time counts as wrong and advances — the pressure is the point, so pausing
 * on a hard question would defeat it.
 */
export const MentalMathModule: React.FC<Props> = ({ currentLevel, onFinishSession, onClose }) => {
  const perQuestion = secondsForLevel(currentLevel);

  const [questions] = useState<ArithmeticQuestion[]>(() => generateRound(currentLevel, QUESTIONS));
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(perQuestion);
  const [phase, setPhase] = useState<'playing' | 'done'>('playing');
  const [times, setTimes] = useState<number[]>([]);

  // Guards against a late timer firing after the answer was given.
  const lockedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  const question = questions[index];

  const advance = useCallback(
    (wasCorrect: boolean, elapsed: number) => {
      if (wasCorrect) setCorrect((c) => c + 1);
      setTimes((t) => [...t, elapsed]);

      // Brief pause so the result is visible before moving on.
      window.setTimeout(() => {
        if (index + 1 >= QUESTIONS) {
          setPhase('done');
        } else {
          setIndex((i) => i + 1);
          setAnswered(null);
          setTimeLeft(perQuestion);
          lockedRef.current = false;
          startedAtRef.current = Date.now();
        }
      }, 650);
    },
    [index, perQuestion]
  );

  const choose = (value: number) => {
    if (lockedRef.current || phase !== 'playing') return;
    lockedRef.current = true;

    const elapsed = (Date.now() - startedAtRef.current) / 1000;
    const isCorrect = value === question.answer;

    setAnswered(value);
    isCorrect ? soundFx.playSuccess() : soundFx.playError();
    advance(isCorrect, elapsed);
  };

  // Per-question countdown. Timing out is a wrong answer, not a pause.
  useEffect(() => {
    if (phase !== 'playing') return;

    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          if (!lockedRef.current) {
            lockedRef.current = true;
            setAnswered(-1);
            soundFx.playError();
            advance(false, perQuestion);
          }
          return 0;
        }
        return t - 0.1;
      });
    }, 100);

    return () => window.clearInterval(id);
  }, [phase, advance, perQuestion]);

  const stats = useMemo(() => {
    const accuracy = Math.round((correct / QUESTIONS) * 100);
    const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

    // Speed matters, but only on questions answered correctly — rushing
    // through wrong answers should not score well.
    const speedBonus = avg > 0 ? Math.max(0, Math.round((perQuestion - avg) * 4)) : 0;
    const score = Math.round(correct * 10 + (speedBonus * correct) / QUESTIONS);

    return { accuracy, avg, score };
  }, [correct, times, perQuestion]);

  // Report once, when the round ends.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'done' || reportedRef.current) return;
    reportedRef.current = true;

    onFinishSession({
      score: stats.score,
      accuracy: stats.accuracy,
      details: [
        { label: 'Correct', value: `${correct} / ${QUESTIONS}` },
        { label: 'Avg time', value: `${stats.avg.toFixed(1)}s` },
        { label: 'Limit', value: `${perQuestion}s` },
        { label: 'Operations', value: operationsForLevel(currentLevel).join(' ') },
      ],
    });
  }, [phase, stats, correct, perQuestion, currentLevel, onFinishSession]);

  if (phase === 'done') {
    return (
      <div className="text-center py-10">
        <Calculator className="w-10 h-10 shrink-0 mx-auto text-[var(--signal-ink)]" />
        <h2 className="t-title mt-4">Round complete</h2>
        <p className="t-sub mt-2">
          {correct} of {QUESTIONS} correct · {stats.avg.toFixed(1)}s average
        </p>
        <button onClick={onClose} className="btn-lg mt-8">
          Done
        </button>
      </div>
    );
  }

  const timeFraction = Math.max(0, timeLeft / perQuestion);

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress and clock */}
      <div className="flex items-center justify-between gap-3">
        <span className="t-meta">
          {index + 1} of {QUESTIONS}
        </span>
        <span
          className="t-meta tabular-nums"
          style={{ color: timeFraction < 0.3 ? 'var(--warn)' : undefined }}
        >
          {timeLeft.toFixed(1)}s
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--surface-sunk)] overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${timeFraction * 100}%`,
            background: timeFraction < 0.3 ? 'var(--warn)' : 'var(--signal)',
          }}
        />
      </div>

      {/* The question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
          className="panel text-center py-10 mt-5"
        >
          <p className="t-display tabular-nums">{question.prompt}</p>
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        {question.options.map((opt) => {
          const isChosen = answered === opt;
          const isAnswer = opt === question.answer;
          const revealed = answered !== null;

          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={revealed}
              className={`min-h-[64px] rounded-2xl border text-xl font-bold tabular-nums transition-colors ${
                revealed && isAnswer
                  ? 'border-[var(--done)] bg-[color-mix(in_oklab,var(--done)_16%,transparent)] eb-done'
                  : revealed && isChosen
                    ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_16%,transparent)] eb-danger'
                    : 'border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--signal)]'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {opt}
                {revealed && isAnswer && <Check className="w-4 h-4 shrink-0" />}
                {revealed && isChosen && !isAnswer && <X className="w-4 h-4 shrink-0" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="t-sub text-center mt-5">
        {correct} correct so far · {operationsForLevel(currentLevel).join('  ')}
      </p>
    </div>
  );
};
