import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Check, X, BookOpen, ArrowRight } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { VocabWord } from '../../lib/vocabData';
import {
  VocabStore,
  buildSession,
  recordAnswer,
  vocabStats,
  tierForLevel,
  meaningQuestion,
  blankQuestion,
  McqQuestion,
} from '../../lib/vocabProgress';

interface Props {
  currentLevel: number;
  /** Persisted per user; passed in and saved by the caller. */
  store: VocabStore;
  onStoreChange: (store: VocabStore) => void;
  onFinishSession: (result: {
    score: number;
    accuracy: number;
    details: { label: string; value: string | number }[];
  }) => void;
  onClose: () => void;
}

type Stage = 'learn' | 'meaning' | 'blank' | 'done';

const SESSION_SIZE = 8;

/**
 * Speak a word using the browser's own voice.
 *
 * No API and no audio files. Falls back silently when unavailable — Firefox
 * on some platforms and older Android have no voices installed, and a broken
 * speaker button is worse than no speaker button.
 */
function speak(text: string): boolean {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85;
    utter.lang = 'en-GB';
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export const VocabularyModule: React.FC<Props> = ({
  currentLevel,
  store,
  onStoreChange,
  onFinishSession,
  onClose,
}) => {
  const tier = tierForLevel(currentLevel);

  const [session] = useState<VocabWord[]>(() => buildSession(store, tier, SESSION_SIZE));
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('learn');
  const [answered, setAnswered] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [askedCount, setAskedCount] = useState(0);
  const [canSpeak, setCanSpeak] = useState(true);

  const working = useRef<VocabStore>(store);
  const reported = useRef(false);

  const word = session[index];

  const question: McqQuestion | null = useMemo(() => {
    if (!word) return null;
    if (stage === 'meaning') return meaningQuestion(word, tier);
    if (stage === 'blank') return blankQuestion(word, tier);
    return null;
  }, [word, stage, tier]);

  useEffect(() => {
    setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const answer = (choice: string) => {
    if (!question || answered) return;

    const isCorrect = choice === question.answer;
    setAnswered(choice);
    setAskedCount((n) => n + 1);
    if (isCorrect) setCorrectCount((n) => n + 1);
    isCorrect ? soundFx.playSuccess() : soundFx.playError();

    // Record on BOTH questions. Saving only on the second meant a session
    // abandoned partway stored nothing, so the same words came back the next
    // day. The recall question still carries more weight because it decides
    // the streak; the recognition question at least schedules the word.
    working.current = recordAnswer(working.current, word.word, isCorrect);
    onStoreChange(working.current);

    window.setTimeout(() => {
      setAnswered(null);
      if (stage === 'meaning') {
        setStage('blank');
      } else if (index + 1 >= session.length) {
        setStage('done');
      } else {
        setIndex((i) => i + 1);
        setStage('learn');
      }
    }, 900);
  };

  const finish = useCallback(() => {
    if (reported.current) return;
    reported.current = true;

    const accuracy = askedCount > 0 ? Math.round((correctCount / askedCount) * 100) : 0;
    const stats = vocabStats(working.current, tier);

    onFinishSession({
      score: correctCount * 12,
      accuracy,
      details: [
        { label: 'Correct', value: `${correctCount} / ${askedCount}` },
        { label: 'Words', value: session.length },
        { label: 'Learned', value: stats.learned },
        { label: 'Due tomorrow', value: stats.dueToday },
      ],
    });
  }, [askedCount, correctCount, session.length, tier, onFinishSession]);

  useEffect(() => {
    if (stage === 'done') finish();
  }, [stage, finish]);

  // Nothing to study — every word is scheduled for a later day.
  if (session.length === 0) {
    const stats = vocabStats(store, tier);
    return (
      <div className="fixed inset-0 z-50 bg-[var(--ground)] flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="w-10 h-10 shrink-0 text-[var(--signal-ink)]" />
        <h2 className="t-title mt-4">Nothing due today</h2>
        <p className="t-sub mt-2 max-w-sm">
          You have learned {stats.learned} of {stats.poolSize} words. Reviews are spaced out, so
          come back tomorrow.
        </p>
        <button onClick={onClose} className="btn-lg mt-8 w-full max-w-xs">
          Done
        </button>
      </div>
    );
  }

  if (stage === 'done') {
    const stats = vocabStats(working.current, tier);
    return (
      <div className="fixed inset-0 z-50 bg-[var(--ground)] flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="w-10 h-10 shrink-0 text-[var(--signal-ink)]" />
        <h2 className="t-title mt-4">Session complete</h2>
        <p
          className="font-display font-extrabold tabular-nums mt-6"
          style={{ fontSize: 'clamp(42px, 13vw, 60px)', lineHeight: 1 }}
        >
          {correctCount}
          <span className="text-[#7E8899]">/{askedCount}</span>
        </p>
        <p className="t-sub mt-4">
          {stats.learned} words learned · {stats.accuracy}% lifetime accuracy
        </p>
        <button onClick={onClose} className="btn-lg mt-8 w-full max-w-xs">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ground)] flex flex-col overflow-y-auto overscroll-contain">
      <div className="flex items-center justify-between gap-3 p-4 shrink-0">
        <span className="t-meta">
          {index + 1} of {session.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Quit"
          className="w-10 h-10 rounded-xl border border-[var(--rule)] flex items-center justify-center text-[#7E8899]"
        >
          <X className="w-4 h-4 shrink-0" />
        </button>
      </div>

      <div className="px-3 shrink-0">
        <div className="h-1.5 rounded-full bg-[var(--surface-sunk)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--signal)' }}
            initial={false}
            animate={{ width: `${((index + (stage === 'blank' ? 0.5 : 0)) / session.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-5 pb-10 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* ---------- Teach ---------- */}
          {stage === 'learn' && (
            <motion.div
              key={`learn-${word.word}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="font-display font-extrabold leading-none"
                  style={{ fontSize: 'clamp(34px, 10vw, 52px)', letterSpacing: '-0.03em' }}
                >
                  {word.word}
                </h1>
                {canSpeak && (
                  <button
                    onClick={() => {
                      if (!speak(word.word)) setCanSpeak(false);
                    }}
                    aria-label={`Hear ${word.word}`}
                    className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center border border-[var(--rule)] text-[var(--signal-ink)]"
                  >
                    <Volume2 className="w-5 h-5 shrink-0" />
                  </button>
                )}
              </div>

              <p className="t-meta mt-2">
                {word.say} · {word.part}
              </p>

              <p className="t-body mt-6 leading-relaxed">{word.definition}</p>

              <p className="t-body text-[#96A0B0] mt-5 italic leading-relaxed">
                “{word.example}”
              </p>

              <div className="flex items-center gap-1.5 mt-6 flex-wrap">
                {word.synonyms.map((s) => (
                  <span
                    key={s}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'color-mix(in oklab, var(--signal) 14%, transparent)',
                      color: 'var(--signal-ink)',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              <button onClick={() => setStage('meaning')} className="btn-lg w-full mt-9">
                Got it
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </motion.div>
          )}

          {/* ---------- Test ---------- */}
          {question && (stage === 'meaning' || stage === 'blank') && (
            <motion.div
              key={`${stage}-${word.word}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
            >
              <p className="t-meta">
                {stage === 'meaning' ? 'Meaning' : 'Fill the blank'}
              </p>
              <h2 className="t-title mt-3 leading-snug break-words">{question.prompt}</h2>

              <div className="space-y-2.5 mt-7">
                {question.options.map((opt) => {
                  const isChosen = answered === opt;
                  const isAnswer = opt === question.answer;
                  const revealed = answered !== null;

                  return (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      disabled={revealed}
                      className="w-full text-left rounded-2xl border p-4 text-[15px] leading-snug transition-colors"
                      style={{
                        background: revealed && isAnswer
                          ? 'color-mix(in oklab, var(--done) 14%, transparent)'
                          : revealed && isChosen
                            ? 'color-mix(in oklab, var(--danger) 14%, transparent)'
                            : 'var(--surface)',
                        borderColor: revealed && isAnswer
                          ? 'var(--done)'
                          : revealed && isChosen
                            ? 'var(--danger)'
                            : 'var(--rule)',
                      }}
                    >
                      <span className="flex items-start gap-2.5">
                        <span className="flex-1 min-w-0">{opt}</span>
                        {revealed && isAnswer && (
                          <Check className="w-4 h-4 shrink-0 eb-done stroke-[3] mt-0.5" />
                        )}
                        {revealed && isChosen && !isAnswer && (
                          <X className="w-4 h-4 shrink-0 eb-danger mt-0.5" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
