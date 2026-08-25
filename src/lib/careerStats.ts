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

let cached: { at: number; data: Omit<CareerStats, 'authoritative'> } | null = null;
const TTL_MS = 60_000;

export function useCareerStats(fallbackXp: number): CareerStats {
  const [stats, setStats] = useState<CareerStats>(() => ({
    careerXp: cached?.data.careerXp ?? fallbackXp,
    weeklyXp: cached?.data.weeklyXp ?? 0,
    level: cached?.data.level ?? 1,
    rank: cached?.data.rank ?? null,
    totalMembers: cached?.data.totalMembers ?? 0,
    authoritative: !!cached,
  }));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Serve a warm cache immediately; the network call still runs so a
      // stale figure is corrected within the minute.
      if (cached && Date.now() - cached.at < TTL_MS) {
        if (!cancelled) setStats({ ...cached.data, authoritative: true });
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

        cached = { at: Date.now(), data };
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
  }, [fallbackXp]);

  return stats;
}
