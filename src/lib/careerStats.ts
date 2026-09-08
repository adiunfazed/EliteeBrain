import { useEffect, useState } from 'react';
import { getIdToken } from './firebase';

/**
 * Career XP, from the server.
 *
 * The client can compute XP locally, and did — but it only sees data that has
 * synced to this device, so a phone and the leaderboard disagreed: 900 XP in
 * one place, 2,000 in another. The server reads the full history from
 * Firestore and is what every other user sees, so it is the authority.
 *
 * The local figure is kept only as a fallback while the request is in flight,
 * so the UI never shows an empty state.
 */

export interface CareerStats {
  careerXp: number;
  weeklyXp: number;
  level: number;
  rank: number | null;
  totalMembers: number;
  /** False until the server figure has arrived. */
  authoritative: boolean;
}

const TTL_MS = 60_000;
const STORE_KEY = 'elitebrain_career_stats';

type Cached = { at: number; uid: string; data: Omit<CareerStats, 'authoritative'> };

let cached: Cached | null = null;

/** Read the last known figures from disk so rank paints on first frame. */
function loadCached(uid: string | null): Cached | null {
  if (cached && (!uid || cached.uid === uid)) return cached;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    // Keyed by uid: showing one account's rank to another would be worse
    // than showing nothing.
    if (uid && parsed.uid !== uid) return null;
    cached = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function saveCached(entry: Cached): void {
  cached = entry;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(entry));
  } catch {
    /* private mode — the in-memory copy still serves this session */
  }
}

export function useCareerStats(fallbackXp: number, uid?: string | null): CareerStats {
  const [stats, setStats] = useState<CareerStats>(() => {
    const stored = loadCached(uid ?? null);
    return {
      careerXp: stored?.data.careerXp ?? fallbackXp,
      weeklyXp: stored?.data.weeklyXp ?? 0,
      level: stored?.data.level ?? 1,
      rank: stored?.data.rank ?? null,
      totalMembers: stored?.data.totalMembers ?? 0,
      // Treated as authoritative on sight: a figure from the last session is
      // far closer to the truth than a local estimate, and it is corrected
      // within the minute anyway.
      authoritative: !!stored,
    };
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Serve a warm cache immediately; the network call still runs so a
      // stale figure is corrected within the minute.
      const stored = loadCached(uid ?? null);
      if (stored && Date.now() - stored.at < TTL_MS) {
        if (!cancelled) setStats({ ...stored.data, authoritative: true });
      }

      try {
        const token = await getIdToken();
        if (!token) return;

        const res = await fetch('/api/leaderboard?mode=career', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const page = await res.json();
        const you = page?.yourEntry;
        if (!you) return;

        const data = {
          careerXp: you.careerXp ?? 0,
          weeklyXp: you.weeklyXp ?? 0,
          level: you.level ?? 1,
          rank: page.yourRank ?? null,
          totalMembers: page.totalMembers ?? 0,
        };

        saveCached({ at: Date.now(), uid: uid ?? you.uid ?? '', data });
        if (!cancelled) setStats({ ...data, authoritative: true });
      } catch {
        // Keep the local fallback rather than showing nothing.
      }
    };

    load();
    const id = setInterval(load, TTL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fallbackXp, uid]);

  return stats;
}


/**
 * Fetch and cache the rank figures ahead of first render.
 *
 * Called during the splash. The leaderboard endpoint reads every user
 * document, so on a cold instance it is the slowest thing in the startup
 * path — starting it while the logo is still on screen removes most of the
 * wait rather than hiding it.
 */
export async function prefetchCareerStats(uid: string): Promise<void> {
  try {
    const token = await getIdToken();
    if (!token) return;

    const res = await fetch('/api/leaderboard?mode=career', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const page = await res.json();
    const you = page?.yourEntry;
    if (!you) return;

    saveCached({
      at: Date.now(),
      uid,
      data: {
        careerXp: you.careerXp ?? 0,
        weeklyXp: you.weeklyXp ?? 0,
        level: you.level ?? 1,
        rank: page.yourRank ?? null,
        totalMembers: page.totalMembers ?? 0,
      },
    });
  } catch {
    // A failed prefetch is not an error: the hook retries on mount.
  }
}
