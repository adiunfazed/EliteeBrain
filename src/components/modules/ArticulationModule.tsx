import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, X, Trophy } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { StoryDifficulty, buildWordRun, wordCountFor } from '../../lib/storyWords';

interface Props {
  currentLevel: number;
  /** Best word count previously reached, for the personal-best line. */
  personalBest?: number;
  onFinishSession: (result: {
    score: number;
    accuracy: number;
    details: { label: string; value: string | number }[];
  }) => void;
  onClose: () => void;
}

type Phase = 'setup' | 'running' | 'paused' | 'done';

const DURATIONS = [2, 5, 10] as const;
const INTERVALS = [10, 15, 20, 30] as const;
const DIFFICULTIES: StoryDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * Articulation — timed story building.
 *
 * A word appears; you continue one running story aloud, weaving it in. When
 * the interval expires a new word replaces it and the story must continue.
 *
 * Nothing is recorded or judged. Assessing spoken quality would need speech
 * AI that is unreliable and expensive, and the exercise works without it —
 * the constraint is the timer, not a grader.
 */
export const ArticulationModule: React.FC<Props> = ({
  currentLevel,
  personalBest = 0,
  onFinishSession,
  onClose,
}) => {
  const [phase, setPhase] = useState<Phase>('setup');
  const [duration, setDuration] = useState<number>(5);
  const [interval, setIntervalSecs] = useState<number>(15);
  const [difficulty, setDifficulty] = useState<StoryDifficulty>(
    currentLevel <= 3 ? 'easy' : currentLevel <= 7 ? 'medium' : 'hard'
  );

  const [words, setWords] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [wordLeft, setWordLeft] = useState(0);
  const [sessionLeft, setSessionLeft] = useState(0);


  const reported = useRef(false);
  const totalWords = useMemo(
    () => wordCountFor(duration, interval),
    [duration, interval]
  );

  const start = () => {
    const run = buildWordRun(difficulty, totalWords);
    setWords(run);
    setWordIndex(0);
    setWordLeft(interval);
    setSessionLeft(duration * 60);
    setPhase('running');
    soundFx.playSuccess();
  };

  // One timer drives both clocks, so they can never drift apart.
  useEffect(() => {
    if (phase !== 'running') return;

    const id = window.setInterval(() => {
      setSessionLeft((s) => {
        if (s <= 1) {
          setPhase('done');
          return 0;
        }
        return s - 1;
      });

      setWordLeft((w) => {
        if (w <= 1) {
          setWordIndex((i) => {
            const next = i + 1;
            if (next >= words.length) {
              setPhase('done');
              return i;
            }
            soundFx.playClick();
            return next;
          });
          return interval;
        }
        return w - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase, interval, words.length]);

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;

    const completed = wordIndex + (phase === 'done' ? 1 : 0);
    const elapsed = duration * 60 - sessionLeft;
    const completion = totalWords > 0 ? Math.round((completed / totalWords) * 100) : 0;

    // Difficulty and length both raise the reward, since both raise effort.
    const multiplier = difficulty === 'hard' ? 1.5 : difficulty === 'medium' ? 1.2 : 1;
    const score = Math.round(completed * 8 * multiplier);

    onFinishSession({
      score,
      accuracy: completion,
      details: [
        { label: 'Words', value: `${completed} / ${totalWords}` },
        { label: 'Spoke for', value: `${Math.round(elapsed / 60)} min` },
        { label: 'Difficulty', value: difficulty },
        { label: 'Interval', value: `${interval}s` },
      ],
    });
  }, [wordIndex, phase, duration, sessionLeft, totalWords, difficulty, interval, onFinishSession]);

  useEffect(() => {
    if (phase === 'done') finish();
  }, [phase, finish]);

  const mmss = (secs: number) =>
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  /* ---------------- Setup ---------------- */
  if (phase === 'setup') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--ground)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="t-meta">Articulation</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-xl border border-[var(--rule)] flex items-center justify-center text-[var(--ink-dim)]"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        <div className="max-w-lg mx-auto px-5 pb-12">
          <h1 className="t-display mt-2">Articulation</h1>
          <p className="t-sub mt-3 leading-relaxed">
            A word appears. Start a story out loud. When the word changes, keep the same story
            going and work the new word in. Nothing is recorded or scored — the timer is the
            challenge.
          </p>

          <div className="mt-9">
            <p className="eb-label">Session length</p>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="min-h-[54px] rounded-xl border text-[15px] font-semibold transition-colors"
                  style={{
                    background: duration === d ? 'var(--surface)' : 'transparent',
                    borderColor: duration === d ? 'var(--signal)' : 'var(--rule)',
                    color: duration === d ? 'var(--ink)' : 'var(--ink-dim)',
                  }}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <p className="eb-label">Difficulty</p>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="min-h-[54px] rounded-xl border text-[15px] font-semibold capitalize transition-colors"
                  style={{
                    background: difficulty === d ? 'var(--surface)' : 'transparent',
                    borderColor: difficulty === d ? 'var(--signal)' : 'var(--rule)',
                    color: difficulty === d ? 'var(--ink)' : 'var(--ink-dim)',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="t-sub mt-2.5">
              {difficulty === 'easy'
                ? 'Concrete things — a mountain, a letter, a bicycle.'
                : difficulty === 'medium'
                  ? 'Ideas and situations — a betrayal, a reunion, an apology.'
                  : 'Abstractions that force the story to turn — paradox, ultimatum, inversion.'}
            </p>
          </div>

          <div className="mt-7">
            <p className="eb-label">New word every</p>
            <div className="grid grid-cols-4 gap-2 mt-2.5">
              {INTERVALS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIntervalSecs(i)}
                  className="min-h-[54px] rounded-xl border text-[15px] font-semibold transition-colors"
                  style={{
                    background: interval === i ? 'var(--surface)' : 'transparent',
                    borderColor: interval === i ? 'var(--signal)' : 'var(--rule)',
                    color: interval === i ? 'var(--ink)' : 'var(--ink-dim)',
                  }}
                >
                  {i}s
                </button>
              ))}
            </div>
          </div>

          <div className="mt-9 p-4 rounded-xl eb-card-sunk">
            <p className="t-sub">
              {totalWords} words · {duration} minutes · new word every {interval}s
            </p>
            {personalBest > 0 && (
              <p className="t-sub mt-1.5">
                Personal best: <span className="text-[var(--ink)] font-semibold">{personalBest} words</span>
              </p>
            )}
          </div>

          <button onClick={start} className="btn-lg w-full mt-5">
            <Play className="w-4 h-4 shrink-0" />
            Start speaking
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Summary ---------------- */
  if (phase === 'done') {
    const completed = wordIndex + 1;
    const completion = totalWords > 0 ? Math.round((completed / totalWords) * 100) : 0;
    const isBest = completed > personalBest;

    return (
      <div className="fixed inset-0 z-50 bg-[var(--ground)] flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        {isBest ? (
          <Trophy className="w-10 h-10 shrink-0" style={{ color: '#FFB020' }} />
        ) : (
          <Trophy className="w-10 h-10 shrink-0 text-[var(--signal-ink)]" />
        )}

        <h2 className="t-title mt-4">{isBest ? 'New personal best' : 'Session complete'}</h2>

        <p
          className="font-display font-extrabold tabular-nums mt-6"
          style={{ fontSize: 'clamp(46px, 14vw, 68px)', lineHeight: 1 }}
        >
          {completed}
          <span className="text-[var(--ink-dim)]">/{totalWords}</span>
        </p>
        <p className="t-sub mt-2">words woven in</p>

        <div className="grid grid-cols-2 gap-2.5 mt-8 w-full max-w-xs">
          {[
            { k: 'Completion', v: `${completion}%` },
            { k: 'Length', v: `${duration} min` },
            { k: 'Difficulty', v: difficulty },
            { k: 'Interval', v: `${interval}s` },
          ].map(({ k, v }) => (
            <div key={k} className="eb-card-sunk p-3">
              <p className="eb-label">{k}</p>
              <p className="text-[15px] font-semibold mt-1 capitalize">{v}</p>
            </div>
          ))}
        </div>

        {!isBest && personalBest > 0 && (
          <p className="t-sub mt-5">Your best is {personalBest} words.</p>
        )}

        <button onClick={onClose} className="btn-lg mt-8 w-full max-w-xs">
          Done
        </button>
      </div>
    );
  }

  /* ---------------- Running ---------------- */
  const wordProgress = interval > 0 ? wordLeft / interval : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ground)] flex flex-col">
      <div className="flex items-center justify-between gap-3 p-4 shrink-0">
        <span className="t-meta tabular-nums">{mmss(sessionLeft)} left</span>
        <span className="t-meta tabular-nums">
          {wordIndex + 1} / {totalWords}
        </span>
        <button
          onClick={() => {
            soundFx.playClick();
            setPhase('done');
          }}
          className="text-[13px] font-semibold text-[var(--ink-dim)] px-3 py-2"
        >
          End
        </button>
      </div>

      {/* Session progress */}
      <div className="px-4 shrink-0">
        <div className="h-1 rounded-full bg-[var(--surface-sunk)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${((duration * 60 - sessionLeft) / (duration * 60)) * 100}%`,
              background: 'var(--signal)',
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Countdown ring around the word */}
        <div className="relative w-full max-w-md flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-56 h-56 sm:w-64 sm:h-64 -rotate-90 absolute">
            <circle cx="100" cy="100" r="92" fill="none" stroke="var(--surface-sunk)" strokeWidth="5" />
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke={wordProgress < 0.25 ? 'var(--warn)' : 'var(--signal)'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 92}
              strokeDashoffset={2 * Math.PI * 92 * (1 - wordProgress)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>

          <AnimatePresence mode="wait">
            <motion.p
              key={wordIndex}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="relative font-display font-extrabold text-center px-4 break-words"
              style={{ fontSize: 'clamp(30px, 9vw, 46px)', letterSpacing: '-0.03em' }}
            >
              {words[wordIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <p
          className="t-meta tabular-nums mt-8"
          style={{ color: wordProgress < 0.25 ? 'var(--warn)' : undefined }}
        >
          next word in {wordLeft}s
        </p>

        <p className="t-sub text-center mt-6 max-w-sm leading-relaxed">
          {wordIndex === 0
            ? 'Start your story out loud, using this word.'
            : 'Keep the same story going. Work this word in.'}
        </p>
      </div>

      <div className="p-5 shrink-0 flex items-center gap-2.5 max-w-md mx-auto w-full">
        <button
          onClick={() => {
            soundFx.playClick();
            setPhase(phase === 'paused' ? 'running' : 'paused');
          }}
          className="btn-quiet flex-1"
        >
          {phase === 'paused' ? (
            <>
              <Play className="w-4 h-4 shrink-0" /> Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 shrink-0" /> Pause
            </>
          )}
        </button>
      </div>
    </div>
  );
};
