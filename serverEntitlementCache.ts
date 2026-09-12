import { resolveEntitlement } from './serverEntitlement';

/**
 * Entitlement cache.
 *
 * Every authenticated request was reading the user's Firestore profile. That
 * made a database hiccup break authentication itself — the coach, the
 * leaderboard and the rank all failed together whenever one read failed, even
 * though the token had already proved who the user was.
 *
 * The token is the proof of identity. Entitlement changes rarely — a purchase,
 * a trial ending — so caching it for a few minutes removes Firestore from the
 * hot path entirely and leaves one read per user per window.
 *
 * The last known value is kept indefinitely as a fallback. A paying customer
 * locked out by a transient read failure is a far worse outcome than someone
 * briefly keeping access they just lost.
 */

interface Entry {
  isPro: boolean;
  status: string;
  at: number;
  /** True when this came from a failed read rather than a successful one. */
  stale: boolean;
}

/** How long a successful lookup is trusted before being refreshed. */
const TTL_MS = 5 * 60 * 1000;

/** Bounded, so a large user base cannot grow this without limit. */
const MAX_ENTRIES = 5000;

const cache = new Map<string, Entry>();

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Oldest first — a Map preserves insertion order.
  const excess = cache.size - MAX_ENTRIES;
  let n = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++n >= excess) break;
  }
}

/**
 * The user's entitlement, reading Firestore only when the cache is cold.
 *
 * `read` is the actual lookup. If it throws, the last known value is used;
 * if there is none, the user is treated as free but still authenticated.
 */
export async function getEntitlement(
  uid: string,
  read: () => Promise<any>
): Promise<{ isPro: boolean; status: string; fromCache: boolean; degraded: boolean }> {
  const hit = cache.get(uid);

  if (hit && !hit.stale && Date.now() - hit.at < TTL_MS) {
    return { isPro: hit.isPro, status: hit.status, fromCache: true, degraded: false };
  }

  try {
    const data = await read();
    const resolved = resolveEntitlement(data);

    cache.set(uid, {
      isPro: resolved.isPro,
      status: resolved.status,
      at: Date.now(),
      stale: false,
    });
    evictIfNeeded();

    return { isPro: resolved.isPro, status: resolved.status, fromCache: false, degraded: false };
  } catch (err) {
    console.warn('Entitlement read failed for', uid, (err as Error)?.message);

    // Serve the last known value rather than locking anyone out.
    if (hit) {
      return { isPro: hit.isPro, status: hit.status, fromCache: true, degraded: true };
    }

    return { isPro: false, status: 'free', fromCache: false, degraded: true };
  }
}

/** Drop a user's cached entitlement — called when a purchase is approved. */
export function invalidateEntitlement(uid: string): void {
  cache.delete(uid);
}
