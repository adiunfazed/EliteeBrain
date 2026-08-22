/**
 * Mental arithmetic question generation.
 *
 * Kept separate from the component so the difficulty curve and the answer
 * options can be tested. A generator that occasionally produces an impossible
 * question, a duplicate option, or a distractor equal to the answer would be
 * invisible in a component but obvious here.
 */

export type Operation = '+' | '-' | '×' | '÷';

export interface ArithmeticQuestion {
  prompt: string;
  answer: number;
  /** Four options, shuffled, always containing exactly one correct value. */
  options: number[];
  operation: Operation;
}

/** Seconds allowed per question at a given level. Faster as skill grows. */
export function secondsForLevel(level: number): number {
  if (level <= 2) return 12;
  if (level <= 5) return 10;
  if (level <= 8) return 8;
  return 6;
}

/** Which operations are in play at a given level. */
export function operationsForLevel(level: number): Operation[] {
  if (level <= 1) return ['+'];
  if (level <= 2) return ['+', '-'];
  if (level <= 4) return ['+', '-', '×'];
  return ['+', '-', '×', '÷'];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Operand ranges widen with level.
 *
 * Division always divides evenly and subtraction never goes negative — both
 * are mental-arithmetic drills, not a test of whether the player can handle
 * remainders or negative numbers under a six-second clock.
 */
function operandsFor(operation: Operation, level: number): [number, number] {
  const tier = Math.min(10, Math.max(1, level));

  switch (operation) {
    case '+': {
      const max = 10 + tier * 12;
      return [randomInt(2, max), randomInt(2, max)];
    }
    case '-': {
      const max = 10 + tier * 12;
      const a = randomInt(5, max);
      // Never negative: the second operand is bounded by the first.
      return [a, randomInt(1, a)];
    }
    case '×': {
      const maxA = Math.min(12, 3 + tier);
      const maxB = Math.min(20, 4 + tier * 2);
      return [randomInt(2, maxA), randomInt(2, maxB)];
    }
    case '÷': {
      // Build from the answer so the division is always exact.
      const divisor = randomInt(2, Math.min(12, 3 + tier));
      const quotient = randomInt(2, Math.min(20, 4 + tier * 2));
      return [divisor * quotient, divisor];
    }
  }
}

function compute(a: number, b: number, operation: Operation): number {
  switch (operation) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return a / b;
  }
}

/**
 * Plausible wrong answers.
 *
 * Distractors sit near the true answer so the question tests arithmetic
 * rather than estimation — three wildly wrong options would let a player
 * score without calculating.
 */
function buildOptions(answer: number, operation: Operation): number[] {
  const options = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(Math.abs(answer) * 0.15));

  // Errors people actually make, so the options feel earned.
  const candidates: number[] = [
    answer + 1,
    answer - 1,
    answer + spread,
    answer - spread,
    answer + 10,
    answer - 10,
  ];
  if (operation === '×') candidates.push(answer + randomInt(1, 9), answer - randomInt(1, 9));

  const shuffledCandidates = candidates.sort(() => Math.random() - 0.5);
  for (const c of shuffledCandidates) {
    if (options.size >= 4) break;
    // Negative or duplicate options would give the answer away.
    if (c < 0 || options.has(c)) continue;
    options.add(c);
  }

  // Fall back to nearby integers if the above produced too few.
  let step = 2;
  while (options.size < 4) {
    const candidate = answer + step;
    if (candidate >= 0 && !options.has(candidate)) options.add(candidate);
    step = step > 0 ? -step : -step + 1;
  }

  return Array.from(options).sort(() => Math.random() - 0.5);
}

export function generateQuestion(level: number): ArithmeticQuestion {
  const operation = pick(operationsForLevel(level));
  const [a, b] = operandsFor(operation, level);
  const answer = compute(a, b, operation);

  return {
    prompt: `${a} ${operation} ${b}`,
    answer,
    options: buildOptions(answer, operation),
    operation,
  };
}

/** A full round. Consecutive duplicates are avoided so it doesn't feel lazy. */
export function generateRound(level: number, count = 10): ArithmeticQuestion[] {
  const out: ArithmeticQuestion[] = [];
  let lastPrompt = '';

  for (let i = 0; i < count; i++) {
    let q = generateQuestion(level);
    let guard = 0;
    while (q.prompt === lastPrompt && guard < 10) {
      q = generateQuestion(level);
      guard++;
    }
    lastPrompt = q.prompt;
    out.push(q);
  }

  return out;
}
