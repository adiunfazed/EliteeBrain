import type { ModuleId, ModuleState, UserProfile } from '../types';
import { MODULE_METADATA } from '../utils/storage';

/**
 * Personal records and activity metrics.
 *
 * Everything here is DERIVED from data the app already records — module
 * history, daily logs, tasks, focus sessions. Nothing is stored twice and
 * nothing is estimated. If an activity was never logged it shows as zero
 * rather than being inferred, so the numbers always mean what they say.
 */

export interface PersonalRecord {
  moduleId: ModuleId;
  name: string;
  category: string;
  /** Highest score ever recorded. */
  best: number;
  /** Second-highest score, i.e. the mark the best beat. */
  previousBest: number;
  /** Most recent score. */
  lastScore: number;
  attempts: number;
  /** True when the latest attempt set a new best. */
  isNewRecord: boolean;
  lastPlayed?: string;
}

export function buildRecords(profile: UserProfile): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const meta of MODULE_METADATA) {
    const state: ModuleState | undefined = profile.modules?.[meta.id];
    if (!state || !state.totalSessions) continue;

    const history = Array.isArray(state.history) ? state.history : [];
    const scores = history.map((h) => h.score).filter((n) => Number.isFinite(n));
    const sorted = [...scores].sort((a, b) => b - a);

    const best = state.bestScore || sorted[0] || 0;
    const previousBest = sorted[1] ?? 0;
    const last = history[history.length - 1];
    const lastScore = last?.score ?? 0;

    records.push({
      moduleId: meta.id,
      name: meta.name,
      category: meta.category,
      best,
      previousBest,
      lastScore,
      attempts: state.totalSessions,
      // Only a strict improvement counts — matching your best isn't breaking it.
      isNewRecord: scores.length > 1 && lastScore === best && lastScore > previousBest,
      lastPlayed: last?.date,
    });
  }

  return records.sort((a, b) => b.attempts - a.attempts);
}

export interface ActivityStats {
  /** Total module attempts ever. */
  trainingSessions: number;
  /** Distinct modules the user has actually tried. */
  modulesTried: number;
  /** Days with at least one completed module. */
  activeDays: number;
  /** Days elapsed since the account started. */
  daysElapsed: number;
  /** Active days as a percentage of days elapsed, 0-100. */
  consistency: number;
  currentStreak: number;
  personalBests: number;
}

export function buildActivityStats(profile: UserProfile): ActivityStats {
  const modules = Object.values(profile.modules || {}) as ModuleState[];

  const trainingSessions = modules.reduce((sum, m) => sum + (m?.totalSessions || 0), 0);
  const modulesTried = modules.filter((m) => (m?.totalSessions || 0) > 0).length;

  const logs = Object.values(profile.dailyLogs || {});
  const activeDays = logs.filter((l) => (l?.completedModules?.length || 0) > 0).length;

  // Days elapsed comes from the recorded start date, never from a guess.
  let daysElapsed = 1;
  if (profile.startDate) {
    const start = Date.parse(`${profile.startDate}T00:00:00`);
    if (Number.isFinite(start)) {
      daysElapsed = Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1);
    }
  }

  return {
    trainingSessions,
    modulesTried,
    activeDays,
    daysElapsed,
    consistency: Math.min(100, Math.round((activeDays / daysElapsed) * 100)),
    currentStreak: profile.streakDays || 0,
    personalBests: modules.filter((m) => (m?.bestScore || 0) > 0).length,
  };
}
