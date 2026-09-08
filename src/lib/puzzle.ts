/**
 * Sliding-puzzle logic: solvability, win detection and hints.
 *
 * A board is represented as a flat array where each index is a position and the
 * value is the tile id at that position. The blank is the highest id
 * (size*size - 1).
 */

export type Board = number[];

export function solvedBoard(size: number): Board {
  return Array.from({ length: size * size }, (_, i) => i);
}

export function isSolved(board: Board): boolean {
  return board.every((tile, i) => tile === i);
}

/**
 * Half of all random arrangements of a sliding puzzle are mathematically
 * unsolvable, so validity must be checked by inversion parity rather than
 * assumed. Generating by random legal moves is already safe, but this exists so
 * any board can be verified before it is handed to a player.
 */
export function isSolvable(board: Board, size: number): boolean {
  const blank = size * size - 1;
  const tiles = board.filter((t) => t !== blank);

  let inversions = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inversions++;
    }
  }

  if (size % 2 === 1) {
    // Odd width: solvable when inversions are even.
    return inversions % 2 === 0;
  }

  // Even width: parity depends on the blank's row counted from the bottom.
  const blankIndex = board.indexOf(blank);
  const blankRowFromBottom = size - Math.floor(blankIndex / size);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

/** Positions the blank can legally swap with. */
export function neighbours(blankIndex: number, size: number): number[] {
  const row = Math.floor(blankIndex / size);
  const col = blankIndex % size;
  const out: number[] = [];
  if (row > 0) out.push(blankIndex - size);
  if (row < size - 1) out.push(blankIndex + size);
  if (col > 0) out.push(blankIndex - 1);
  if (col < size - 1) out.push(blankIndex + 1);
  return out;
}

export function applyMove(board: Board, tileIndex: number): Board {
  const next = board.slice();
  const blank = board.length - 1;
  const blankIndex = board.indexOf(blank);
  next[blankIndex] = board[tileIndex];
  next[tileIndex] = blank;
  return next;
}

/** Sum of Manhattan distances of every tile from its home square. */
export function manhattan(board: Board, size: number): number {
  const blank = size * size - 1;
  let total = 0;
  for (let pos = 0; pos < board.length; pos++) {
    const tile = board[pos];
    if (tile === blank) continue;
    total +=
      Math.abs(Math.floor(pos / size) - Math.floor(tile / size)) +
      Math.abs((pos % size) - (tile % size));
  }
  return total;
}

/**
 * Shuffle by walking random legal moves back from the solved state. This is
 * solvable by construction — no parity check needed — and it never returns an
 * already-solved board.
 */
export function shuffleBoard(size: number, steps?: number, rng: () => number = Math.random): Board {
  let board = solvedBoard(size);
  const blank = size * size - 1;
  const moves = steps ?? size * size * 12;

  let previousBlank = -1;
  for (let i = 0; i < moves; i++) {
    const blankIndex = board.indexOf(blank);
    // Don't immediately undo the last move; it wastes shuffle depth.
    const options = neighbours(blankIndex, size).filter((n) => n !== previousBlank);
    const pick = options[Math.floor(rng() * options.length)];
    previousBlank = blankIndex;
    board = applyMove(board, pick);
  }

  // Vanishingly rare, but a solved board is not a puzzle.
  if (isSolved(board)) return shuffleBoard(size, moves, rng);
  return board;
}

/**
 * IDA* with the Manhattan heuristic. Returns the full optimal move list, or
 * null if the node budget runs out.
 *
 * 3×3 solves instantly. 4×4 usually solves but can be expensive from a deep
 * scramble, which is why there is a budget and a fallback rather than a hang.
 */
export function solve(board: Board, size: number, nodeBudget = 200_000): number[] | null {
  if (isSolved(board)) return [];

  const blank = size * size - 1;
  let nodes = 0;
  let bound = manhattan(board, size);
  const path: number[] = [];

  const search = (current: Board, g: number, lastBlank: number): number | true => {
    const h = manhattan(current, size);
    const f = g + h;
    if (f > bound) return f;
    if (h === 0) return true;
    if (++nodes > nodeBudget) return Infinity;

    let min = Infinity;
    const blankIndex = current.indexOf(blank);

    // Order moves by resulting heuristic so promising branches go first.
    const options = neighbours(blankIndex, size)
      .filter((n) => n !== lastBlank)
      .map((n) => ({ n, score: manhattan(applyMove(current, n), size) }))
      .sort((a, b) => a.score - b.score);

    for (const { n } of options) {
      path.push(n);
      const result = search(applyMove(current, n), g + 1, blankIndex);
      if (result === true) return true;
      if (typeof result === 'number' && result < min) min = result;
      path.pop();
    }
    return min;
  };

  while (true) {
    nodes = 0;
    const result = search(board, 0, -1);
    if (result === true) return path.slice();
    if (result === Infinity) return null;
    bound = result as number;
    if (bound > 200) return null;
  }
}

/**
 * Bounded lookahead: explore every legal sequence up to `depth` moves and pick
 * the first move of whichever line reaches the lowest Manhattan distance.
 *
 * Used instead of a full search on 4×4 and 5×5, where IDA* can take seconds
 * from a deep scramble — freezing the UI is worse than a slightly suboptimal
 * hint. This returns in a few milliseconds.
 */
function lookaheadMove(board: Board, size: number, depth: number): number | null {
  const blank = size * size - 1;
  const blankIndex = board.indexOf(blank);
  const options = neighbours(blankIndex, size);
  if (options.length === 0) return null;

  let best: number | null = null;
  let bestScore = Infinity;

  const explore = (b: Board, d: number, lastBlank: number): number => {
    const h = manhattan(b, size);
    if (d === 0 || h === 0) return h;
    let min = Infinity;
    const bi = b.indexOf(blank);
    for (const n of neighbours(bi, size)) {
      if (n === lastBlank) continue;
      const score = explore(applyMove(b, n), d - 1, bi);
      if (score < min) min = score;
    }
    return min === Infinity ? h : min;
  };

  for (const n of options) {
    const next = applyMove(board, n);
    // Solving in one move always wins.
    if (isSolved(next)) return n;
    const score = explore(next, depth - 1, blankIndex);
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }

  return best;
}

/**
 * The position the player should tap next.
 *
 * On a 3×3 the optimal solution is found instantly, so the hint is genuinely
 * the best move. On larger boards a bounded lookahead is used instead: not
 * guaranteed optimal, but legal, helpful, and returned fast enough that the
 * board never stalls.
 */
export function nextHint(board: Board, size: number): { index: number; optimal: boolean } | null {
  if (isSolved(board)) return null;

  if (size <= 3) {
    const solution = solve(board, size, 200_000);
    if (solution && solution.length > 0) return { index: solution[0], optimal: true };
  }

  const depth = size === 4 ? 7 : 6;
  const move = lookaheadMove(board, size, depth);
  return move === null ? null : { index: move, optimal: false };
}
