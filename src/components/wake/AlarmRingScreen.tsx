import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { Plus, AlertTriangle } from 'lucide-react';
import {
  Alarm,
  challengeById,
  SKIP_LOCKOUT_SECONDS,
  } from '../../lib/wakeChallenge';
import { soundFx } from '../../utils/audio';

interface Props {
  alarm: Alarm;
  onResolved: (outcome: 'completed' | 'skipped' | 'dismissed', seconds: number) => void;
}

/** Two numbers and an operator, hard enough to need waking up for. */
function makeProblem(): { question: string; answer: number } {
  const a = 11 + Math.floor(Math.random() * 30);
  const b = 3 + Math.floor(Math.random() * 12);
  const times = Math.random() > 0.5;
  return times
    ? { question: `${b} × ${b + 1}`, answer: b * (b + 1) }
    : { question: `${a} + ${a + b}`, answer: a + (a + b) };
}

/**
 * The alarm.
 *
 * Skip is hidden for the first thirty seconds so the challenge is the only
 * thing on screen — that is the whole point of the feature. It is revealed
 * afterwards rather than never, because an alarm that cannot be dismissed is
 * dangerous: someone ill, injured or in the wrong situation has to be able to
 * turn it off. The emergency stop is available throughout for the same reason.
 */
export const AlarmRingScreen: React.FC<Props> = ({ alarm, onResolved }) => {
  const spec = challengeById(alarm.challenge);
  const target = spec ? spec.targets[alarm.difficulty] : 10;

  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [problem, setProblem] = useState(makeProblem);
  const [answer, setAnswer] = useState('');
  const [sequence, setSequence] = useState<number[]>([]);
  const [entered, setEntered] = useState<number[]>([]);

  const startedAt = useRef(Date.now());
  const audioRef = useRef<{ stop: () => void } | null>(null);

  /** Elapsed seconds, driving the lockout. */
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  /** The alarm sound runs until the challenge resolves. */
  useEffect(() => {
    audioRef.current = soundFx.startAlarm?.(alarm.sound) || null;
    return () => audioRef.current?.stop();
  }, [alarm.sound]);

  /** Build a pattern for the tap challenge. */
  useEffect(() => {
    if (alarm.challenge !== 'sequence') return;
    setSequence(Array.from({ length: target }, () => Math.floor(Math.random() * 4)));
  }, [alarm.challenge, target]);

  const skipAvailable = elapsed >= SKIP_LOCKOUT_SECONDS;
  const remaining = Math.max(0, SKIP_LOCKOUT_SECONDS - elapsed);

  const resolve = (outcome: 'completed' | 'skipped' | 'dismissed') => {
    audioRef.current?.stop();
    if (outcome === 'completed') soundFx.playSuccess();
    onResolved(outcome, Math.floor((Date.now() - startedAt.current) / 1000));
  };

  const bump = () => {
    const next = progress + 1;
    setProgress(next);
    soundFx.playClick();
    if (next >= target) resolve('completed');
  };

  const Icon = spec ? (Icons as any)[spec.icon] || Icons.Dumbbell : Icons.Dumbbell;

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--ground)] flex flex-col">
      {/* A slow pulse, because a static screen at 6am reads as frozen. */}
      <motion.div
        className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, color-mix(in oklab, var(--signal) 30%, transparent), transparent 70%)',
        }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center">
        <p className="eb-label" style={{ color: 'var(--signal-ink)' }}>
          Wake Challenge
        </p>
        <p className="t-title mt-2">Start your day with a win.</p>
        <p className="t-meta mt-1">{alarm.label}</p>

        <span
          className="w-14 h-14 rounded-2xl mt-8 flex items-center justify-center"
          style={{ background: 'color-mix(in oklab, var(--signal) 18%, transparent)' }}
        >
          <Icon className="w-7 h-7 shrink-0" style={{ color: 'var(--signal-ink)' }} />
        </span>

        <p className="t-section mt-4 uppercase tracking-wide">{spec?.name}</p>

        {/* Rep-based challenges */}
        {(alarm.challenge === 'pushups' || alarm.challenge === 'squats') && (
          <>
            <p className="t-figure mt-5" style={{ fontSize: 56, lineHeight: 1 }}>
              {progress} / {target}
            </p>
            <p className="t-meta mt-2">{spec?.unit}</p>

            <button
              onClick={bump}
              className="w-full max-w-[280px] h-16 rounded-xl mt-8 text-[16px] font-semibold flex items-center justify-center gap-2"
              style={{
                background: 'color-mix(in oklab, var(--signal) 22%, transparent)',
                border: '1px solid color-mix(in oklab, var(--signal) 50%, var(--rule))',
                color: 'var(--signal-ink)',
              }}
            >
              <Plus className="w-5 h-5 shrink-0" />
              Count one
            </button>
          </>
        )}

        {/* Timed movement */}
        {alarm.challenge === 'movement' && (
          <>
            <p className="t-figure mt-5" style={{ fontSize: 56, lineHeight: 1 }}>
              {Math.max(0, target - elapsed)}
            </p>
            <p className="t-meta mt-2">seconds of moving</p>

            <button
              onClick={() => resolve('completed')}
              disabled={elapsed < target}
              className="btn-lg w-full max-w-[280px] mt-8"
              style={elapsed < target ? { opacity: 0.4 } : undefined}
            >
              {elapsed < target ? 'Keep moving' : 'Done'}
            </button>
          </>
        )}

        {/* Quick maths */}
        {alarm.challenge === 'mental' && (
          <>
            <p className="t-meta mt-5">
              {progress} of {target} solved
            </p>
            <p className="t-figure mt-3" style={{ fontSize: 42 }}>
              {problem.question}
            </p>

            <input
              autoFocus
              inputMode="numeric"
              value={answer}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setAnswer(v);
                if (Number(v) === problem.answer) {
                  const next = progress + 1;
                  setProgress(next);
                  setAnswer('');
                  soundFx.playClick();
                  if (next >= target) resolve('completed');
                  else setProblem(makeProblem());
                }
              }}
              placeholder="?"
              className="w-32 text-center rounded-xl px-3 py-3 mt-5 text-[24px] tabular-nums text-[var(--ink)] outline-none"
              style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
            />
          </>
        )}

        {/* Tap sequence — quiet, for shared rooms */}
        {alarm.challenge === 'sequence' && (
          <>
            <p className="t-meta mt-5">
              {entered.length} of {sequence.length}
            </p>

            <div className="flex items-center gap-2 mt-4 flex-wrap justify-center max-w-[280px]">
              {sequence.map((v, i) => (
                <span
                  key={i}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold"
                  style={{
                    background:
                      i < entered.length
                        ? 'var(--done)'
                        : 'color-mix(in oklab, var(--signal) 14%, transparent)',
                    color: i < entered.length ? '#fff' : 'var(--signal-ink)',
                  }}
                >
                  {v + 1}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-[240px]">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    soundFx.playClick();
                    const next = [...entered, v];

                    // A wrong tap restarts rather than failing — being half
                    // asleep should cost a retry, not the whole challenge.
                    if (sequence[next.length - 1] !== v) {
                      setEntered([]);
                      return;
                    }

                    setEntered(next);
                    if (next.length >= sequence.length) resolve('completed');
                  }}
                  className="h-16 rounded-xl text-[18px] font-bold"
                  style={{
                    background: 'color-mix(in oklab, var(--signal) 16%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--signal) 40%, var(--rule))',
                    color: 'var(--signal-ink)',
                  }}
                >
                  {v + 1}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Skip, revealed only after the lockout. */}
        <div className="mt-10 min-h-[52px] flex flex-col items-center justify-center">
          {!skipAvailable ? (
            <p className="t-meta">Skip available in {remaining}s</p>
          ) : confirmingSkip ? (
            <div
              className="rounded-xl p-4 w-full max-w-[300px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
            >
              <p className="text-[15px] font-semibold">Skip today&apos;s challenge?</p>
              <p className="t-meta mt-1">You won&apos;t earn XP for this challenge.</p>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setConfirmingSkip(false)}
                  className="btn-quiet flex-1"
                >
                  Keep challenge
                </button>
                <button onClick={() => resolve('skipped')} className="btn-lg flex-1">
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmingSkip(true)} className="btn-text">
              Skip today
            </button>
          )}
        </div>
      </div>

      {/* Always available. Someone unwell must be able to stop the noise. */}
      <div className="relative p-4 border-t border-[var(--rule)]">
        <button
          onClick={() => resolve('dismissed')}
          className="w-full flex items-center justify-center gap-1.5 t-meta py-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Stop alarm — I can&apos;t do this safely
        </button>
      </div>
    </div>
  );
};
