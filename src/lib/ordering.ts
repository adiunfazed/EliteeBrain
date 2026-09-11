/**
 * Manual ordering.
 *
 * Positions are sparse rather than sequential: an item dropped between two
 * others takes the midpoint of their values, so a move writes ONE row instead
 * of renumbering the list. That matters on Firestore, where renumbering fifty
 * tasks is fifty writes against a quota.
 */

/** Gap between freshly assigned positions. Large enough for many midpoints. */
const STEP = 1024;

/**
 * A position for an item dropped at `index` in `ordered`.
 *
 * Midpoints halve the available gap each time, so after roughly ten moves
 * into the same slot the values collide. `needsRebalance` detects that and
 * the caller renumbers — rare enough to be worth the saved writes.
 */
export function positionFor(
  ordered: { manualOrder?: number }[],
  index: number
): number {
  const before = index > 0 ? ordered[index - 1]?.manualOrder : undefined;
  const after = index < ordered.length ? ordered[index]?.manualOrder : undefined;

  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return (after as number) - STEP;
  if (after === undefined) return (before as number) + STEP;

  return (before + after) / 2;
}

/** True when gaps have collapsed and the list needs renumbering. */
export function needsRebalance(ordered: { manualOrder?: number }[]): boolean {
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1].manualOrder;
    const b = ordered[i].manualOrder;
    if (a === undefined || b === undefined) continue;
    // Below 1 there is no room left for another midpoint.
    if (Math.abs(b - a) < 1) return true;
  }
  return false;
}

/** Evenly spaced positions for a whole list. */
export function rebalance<T>(ordered: T[]): { item: T; manualOrder: number }[] {
  return ordered.map((item, i) => ({ item, manualOrder: (i + 1) * STEP }));
}

/**
 * Sort by manual position, falling back to the given comparator.
 *
 * Items never dragged have no position and must not all pile at the top, so
 * they keep their natural order below the ones that were placed deliberately.
 */
export function byManualOrder<T extends { manualOrder?: number }>(
  items: T[],
  fallback: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const ao = a.manualOrder;
    const bo = b.manualOrder;

    if (ao !== undefined && bo !== undefined) return ao - bo;
    // A placed item outranks an unplaced one; that is the point of placing it.
    if (ao !== undefined) return -1;
    if (bo !== undefined) return 1;
    return fallback(a, b);
  });
}
