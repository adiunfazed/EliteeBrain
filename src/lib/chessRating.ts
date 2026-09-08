/**
 * Chess rating.
 *
 * Follows the same shape as FIDE and Chess.com: a provisional period where
 * the rating moves fast, then progressively smaller adjustments as it settles.
 *
 * Two deliberate choices:
 *
 *   1. A new player is UNRATED, not zero. Elo is a comparison between two
 *      players — a rating of 0 against a 1500 bot predicts a loss so certain
 *      that a single win would swing hundreds of points. Instead the first
 *      game sets the rating from the opponent's strength and the result,
 *      which is how real federations seed a new player.
 *
 *   2. The K-factor drops as games are played and as rating rises, so early
 *      games move quickly and a settled rating stops swinging on one result.
 */

export type MatchResult = 'win' | 'draw' | 'loss';

/** Games before a rating is considered established. */
export const PROVISIONAL_GAMES = 20;

export interface RatingState {
  /** Null until the first rated game is played. */
  rating: number | null;
  gamesPlayed: number;
}

export interface RatingChange {
  rating: number;
  delta: number;
  gamesPlayed: number;
  /** True while the rating is still settling. */
  provisional: boolean;
  kFactor: number;
}

/**
 * How much a single result can move the rating.
 *
 * Mirrors the standard tiers: high while provisional, 20 for most players,
 * 10 once strong — a 2400 player does not lose 40 points to one upset.
 */
export function kFactorFor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < PROVISIONAL_GAMES) return 40;
  if (rating >= 2400) return 10;
  return 20;
}

/** Probability of scoring against an opponent, from the rating difference. */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

function scoreOf(result: MatchResult): number {
  return result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
}

/**
 * Seed a rating from a first game.
 *
 * Performance-based, as federations do it: beating an opponent places you
 * roughly 400 above them, losing places you 400 below, a draw matches them.
 * The result is clamped so one game against a very strong bot cannot mint an
 * implausible rating.
 */
function seedRating(opponentRating: number, result: MatchResult): number {
  const offset = result === 'win' ? 400 : result === 'loss' ? -400 : 0;
  return Math.max(RATING_FLOOR, Math.min(2200, Math.round(opponentRating + offset)));
}

/** No rating goes below this, matching common practice. */
export const RATING_FLOOR = 100;

/**
 * Apply one result and return the new rating.
 *
 * Pure, so the outcome is reproducible and testable — a rating system that
 * cannot be verified is one players are right to distrust.
 */
export function applyResult(
  state: RatingState,
  opponentRating: number,
  result: MatchResult
): RatingChange {
  const gamesPlayed = state.gamesPlayed + 1;

  // First ever rated game: seed rather than adjust.
  if (state.rating === null) {
    const rating = seedRating(opponentRating, result);
    return {
      rating,
      delta: 0,
      gamesPlayed,
      provisional: gamesPlayed < PROVISIONAL_GAMES,
      kFactor: 40,
    };
  }

  const k = kFactorFor(state.rating, state.gamesPlayed);
  const expected = expectedScore(state.rating, opponentRating);
  const delta = Math.round(k * (scoreOf(result) - expected));
  const rating = Math.max(RATING_FLOOR, state.rating + delta);

  return {
    rating,
    // Report the delta actually applied, which the floor may have reduced.
    delta: rating - state.rating,
    gamesPlayed,
    provisional: gamesPlayed < PROVISIONAL_GAMES,
    kFactor: k,
  };
}

/** Rating band, for display. */
export function ratingTitle(rating: number | null): string {
  if (rating === null) return 'Unrated';
  if (rating < 600) return 'Beginner';
  if (rating < 1000) return 'Novice';
  if (rating < 1400) return 'Intermediate';
  if (rating < 1800) return 'Advanced';
  if (rating < 2200) return 'Expert';
  return 'Master';
}
