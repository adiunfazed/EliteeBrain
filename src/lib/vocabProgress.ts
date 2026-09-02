import { VocabWord, wordsForTier } from './vocabData';
import { todayISO } from './tasks';

/**
 * Spaced review.
 *
 * A simplified SM-2: each word carries an interval that grows when you recall
 * it and collapses when you do not. Words are only shown when due, so review
 * effort concentrates on what you actually keep forgetting rather than
 * cycling evenly through everything.
 */

export interface WordProgress {
  word: string;
  /** Times seen. */
  seen: number;
  correct: number;
  /** Consecutive correct answers — drives the interval. */
  streak: number;
  /** Days until the next review. */
  intervalDays: number;
  /** ISO date this word is next due. */
  dueDate: string;
  lastSeen: string;
}

export type VocabStore = Record<string, WordProgress>;

/** Intervals in days. Reaching the end means the word is considered learned. */
const LADDER = [1, 2, 4, 8, 16, 32];

/** A word is "learned" once it survives the full ladder. */
export const LEARNED_STREAK = LADDER.length;

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Record an answer and schedule the next review.
 *
 * A wrong answer drops the interval to 1 day rather than resetting the whole
 * history — the streak resets, but the fact you have seen it 20 times is still
 * useful information and shouldn't be thrown away.
 */
export function recordAnswer(
  store: VocabStore,
  word: string,
  wasCorrect: boolean,
  today: string = todayISO()
): VocabStore {
  const prev: WordProgress = store[word] || {
    word,
    seen: 0,
    correct: 0,
    streak: 0,
    intervalDays: 0,
    dueDate: today,
    lastSeen: today,
  };

  const streak = wasCorrect ? prev.streak + 1 : 0;
  const intervalDays = wasCorrect
    ? LADDER[Math.min(streak - 1, LADDER.length - 1)]
    : 1;

  return {
    ...store,
    [word]: {
      word,
      seen: prev.seen + 1,
      correct: prev.correct + (wasCorrect ? 1 : 0),
      streak,
      intervalDays,
      dueDate: shiftDate(today, intervalDays),
      lastSeen: today,
    },
  };
}

/** Words due for review today, most overdue first. */
export function dueWords(
  store: VocabStore,
  maxTier: 1 | 2 | 3,
  today: string = todayISO()
): VocabWord[] {
  return wordsForTier(maxTier)
    .filter((w) => {
      const p = store[w.word];
      return p ? p.dueDate <= today : false;
    })
    .sort((a, b) => (store[a.word]?.dueDate || '').localeCompare(store[b.word]?.dueDate || ''));
}

/**
 * Words never seen before, in varied order.
 *
 * Returning the pool in array order meant every session started with the same
 * first eight words. Shuffling keeps sessions distinct even before any review
 * history exists.
 */
export function newWords(store: VocabStore, maxTier: 1 | 2 | 3): VocabWord[] {
  return wordsForTier(maxTier)
    .filter((w) => !store[w.word])
    .sort(() => Math.random() - 0.5);
}

/**
 * Build a session: reviews first, then new words.
 *
 * Reviews come first deliberately — a word you are about to forget is worth
 * more than a word you have never met, and leaving reviews until last means
 * they get skipped when someone runs out of time.
 */
export function buildSession(
  store: VocabStore,
  maxTier: 1 | 2 | 3,
  size = 8,
  today: string = todayISO()
): VocabWord[] {
  const due = dueWords(store, maxTier, today);
  const fresh = newWords(store, maxTier);

  // Cap reviews at two thirds so a session always teaches something new,
  // otherwise a large backlog would stall progress entirely.
  const reviewCount = Math.min(due.length, Math.ceil(size * 0.67));
  const session = [...due.slice(0, reviewCount)];

  for (const w of fresh) {
    if (session.length >= size) break;
    session.push(w);
  }

  // Backfill from remaining reviews if there were not enough new words.
  for (const w of due.slice(reviewCount)) {
    if (session.length >= size) break;
    session.push(w);
  }

  return session;
}

export interface VocabStats {
  learned: number;
  learning: number;
  totalSeen: number;
  accuracy: number;
  dueToday: number;
  poolSize: number;
}

export function vocabStats(
  store: VocabStore,
  maxTier: 1 | 2 | 3,
  today: string = todayISO()
): VocabStats {
  const entries = Object.values(store);
  const seen = entries.reduce((n, e) => n + e.seen, 0);
  const correct = entries.reduce((n, e) => n + e.correct, 0);

  return {
    learned: entries.filter((e) => e.streak >= LEARNED_STREAK).length,
    learning: entries.filter((e) => e.streak > 0 && e.streak < LEARNED_STREAK).length,
    totalSeen: entries.length,
    accuracy: seen > 0 ? Math.round((correct / seen) * 100) : 0,
    dueToday: dueWords(store, maxTier, today).length,
    poolSize: wordsForTier(maxTier).length,
  };
}

/** Difficulty tier from the user's module level. */
export function tierForLevel(level: number): 1 | 2 | 3 {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
}

/* ------------------------------------------------------------------ */
/* Question generation                                                 */
/* ------------------------------------------------------------------ */

export interface McqQuestion {
  kind: 'meaning' | 'blank';
  prompt: string;
  options: string[];
  answer: string;
}

function pickDistinct<T>(pool: T[], exclude: T, count: number): T[] {
  const out: T[] = [];
  const shuffled = pool.filter((p) => p !== exclude).sort(() => Math.random() - 0.5);
  for (const item of shuffled) {
    if (out.length >= count) break;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * A multiple-choice question for a word.
 *
 * Distractors are drawn from real definitions in the same tier, so a wrong
 * option is plausible. Three obviously-wrong choices would let someone score
 * without knowing the word.
 */
export function meaningQuestion(word: VocabWord, maxTier: 1 | 2 | 3): McqQuestion {
  const pool = wordsForTier(maxTier).map((w) => w.definition);
  const options = [word.definition, ...pickDistinct(pool, word.definition, 3)];

  return {
    kind: 'meaning',
    prompt: `What does "${word.word}" mean?`,
    options: options.sort(() => Math.random() - 0.5),
    answer: word.definition,
  };
}

/** Fill-in-the-blank, using the word's own example sentence. */
export function blankQuestion(word: VocabWord, maxTier: 1 | 2 | 3): McqQuestion {
  const pattern = new RegExp(`\\b${word.word}\\b`, 'i');
  // Fall back to the definition prompt if the example does not contain the
  // word in a matchable form — better than rendering a blank-free sentence.
  if (!pattern.test(word.example)) return meaningQuestion(word, maxTier);

  const pool = wordsForTier(maxTier).map((w) => w.word);
  const options = [word.word, ...pickDistinct(pool, word.word, 3)];

  return {
    kind: 'blank',
    prompt: word.example.replace(pattern, '_____'),
    options: options.sort(() => Math.random() - 0.5),
    answer: word.word,
  };
}
