import type { ModuleId, UserProfile } from '../types';
import { MODULE_METADATA } from '../utils/storage';
import { todayISO } from './tasks';

/**
 * The daily challenge.
 *
 * The module is chosen deterministically from the date, so it stays the same
 * across reloads and devices and can't be rerolled by refreshing until an easy
 * one appears. Completion is DERIVED from the module's own history rather than
 * stored separately — a second "did you do the challenge" flag would drift from
 * the module records within a day.
 */

/** Stable 32-bit hash of a date string. */
function hashDate(dateISO: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateISO.length; i++) {
    h ^= dateISO.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export interface DailyChallenge {
  date: string;
  moduleId: ModuleId;
  name: string;
  tagline: string;
  category: string;
  isPro: boolean;
  /** Score recorded for this module today, if any. */
  todayScore: number | null;
  completed: boolean;
  /** Best score ever, excluding today's attempt. */
  previousBest: number;
  /** Best score ever, including today. */
  best: number;
  attempts: number;
  /** True when today's attempt beat everything before it. */
  beatRecord: boolean;
}

/**
 * Pick today's challenge. Free modules are preferred so the challenge is a real
 * daily reason to return rather than a locked advert.
 */
export function getDailyChallenge(
  profile: UserProfile,
  date: string = todayISO()
): DailyChallenge | null {
  const pool = MODULE_METADATA.filter((m) => !m.isPro);
  const candidates = pool.length > 0 ? pool : MODULE_METADATA;
  if (candidates.length === 0) return null;

  const meta = candidates[hashDate(date) % candidates.length];
  const state = profile.modules?.[meta.id];
  const history = Array.isArray(state?.history) ? state!.history : [];

  const todayEntries = history.filter((h) => h.date === date);
  const earlier = history.filter((h) => h.date !== date);

  const todayScore = todayEntries.length
    ? Math.max(...todayEntries.map((h) => h.score))
    : null;
  const previousBest = earlier.length ? Math.max(...earlier.map((h) => h.score)) : 0;
  const best = Math.max(previousBest, todayScore ?? 0, state?.bestScore ?? 0);

  return {
    date,
    moduleId: meta.id,
    name: meta.name,
    tagline: meta.tagline,
    category: meta.category,
    isPro: meta.isPro,
    todayScore,
    completed: todayScore !== null,
    previousBest,
    best,
    attempts: state?.totalSessions ?? 0,
    beatRecord: todayScore !== null && earlier.length > 0 && todayScore > previousBest,
  };
}

/** Consecutive days ending today on which the day's challenge was completed. */
export function challengeStreak(profile: UserProfile, today: string = todayISO()): number {
  let streak = 0;
  for (let back = 0; back < 60; back++) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);

    const ch = getDailyChallenge(profile, iso);
    if (!ch) break;

    const history = profile.modules?.[ch.moduleId]?.history || [];
    const done = history.some((h) => h.date === iso);

    // Today not being done yet shouldn't break a streak that's still alive.
    if (!done) {
      if (back === 0) continue;
      break;
    }
    streak++;
  }
  return streak;
}
