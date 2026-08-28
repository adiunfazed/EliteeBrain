import { UserProfile, ModuleId, SessionResult, DailyLog } from '../types';
import { checkAchievements } from './achievements';

const STORAGE_KEY = 'elite_brain_profile_v2';

/**
 * Which account the cached profile belongs to.
 *
 * Kept alongside the profile so a mismatch can be detected on load. Without
 * this there is no way to tell whose data is in the cache.
 */
const OWNER_KEY = 'elite_brain_profile_owner_v1';

/** The signed-in uid, set by the app on every auth change. */
let activeUserId: string | null = null;

/**
 * Tell storage which account is active.
 *
 * When the owner changes, the cached profile belongs to somebody else and is
 * discarded rather than merged — merging would carry one user's trial and
 * streak into another's account.
 */
export function setActiveUser(userId: string | null): void {
  activeUserId = userId;
  if (typeof window === 'undefined') return;

  try {
    const previous = localStorage.getItem(OWNER_KEY);
    const current = userId || 'guest';

    if (previous && previous !== current) {
      // Different account: clear every cached collection so nothing carries
      // across. The cloud copy is the source of truth and will re-populate.
      for (const key of [
        STORAGE_KEY,
        'elitebrain_tasks_v1',
        'elitebrain_focus_v1',
        'elitebrain_goals_v1',
        'elitebrain_habits_v1',
        'elitebrain_habitlogs_v1',
        'elitebrain_routine_blocks_v1',
        'elitebrain_routine_logs_v1',
        'elitebrain_sleep_v1',
        'elitebrain_goal_snapshots_v1',
      ]) {
        localStorage.removeItem(key);
      }
      console.info('Account changed — cleared cached data from the previous user.');
    }

    localStorage.setItem(OWNER_KEY, current);
  } catch {
    /* private mode — the in-memory profile still works */
  }
}

/** True when the cached profile belongs to somebody else. */
function cacheBelongsToOther(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (!owner) return false;
    return owner !== (activeUserId || 'guest');
  } catch {
    return false;
  }
}

export const MODULE_METADATA = [
  {
    id: 'digit-span' as ModuleId,
    name: 'Number Memory Span',
    tagline: 'Short-Term Memory Recall',
    category: 'Memory' as const,
    domain: 'Memory',
    domainColor: 'var(--dom-memory)',
    icon: 'Binary',
    color: 'rose',
    description: 'Memorize and recall digit sequences as they flash faster.',
    isPro: false,
  },
  {
    id: 'stroop' as ModuleId,
    name: 'Color Speed Match',
    tagline: 'Selective Attention Test',
    category: 'Focus' as const,
    domain: 'Focus',
    domainColor: 'var(--dom-focus)',
    icon: 'Zap',
    color: 'violet',
    description: 'Match the actual ink color, ignoring misleading word text.',
    isPro: false,
  },
  {
    id: 'n-back' as ModuleId,
    name: 'Spatial Pattern Recall',
    tagline: 'Working Memory Tracker',
    category: 'Fluid IQ' as const,
    domain: 'Reasoning',
    domainColor: 'var(--dom-reason)',
    icon: 'Layers',
    color: 'emerald',
    description: 'Track if current square position matches N steps backwards.',
    isPro: false,
  },
  {
    id: 'stillness' as ModuleId,
    name: 'Mindful Focus Timer',
    tagline: 'Deep Stillness & Attention',
    category: 'Mindfulness' as const,
    domain: 'Focus',
    domainColor: 'var(--dom-focus)',
    icon: 'Compass',
    color: 'blue',
    description: 'Train uninterrupted mental focus and calm breath stillness.',
    isPro: false,
  },
  {
    id: 'pattern-matrix' as ModuleId,
    name: 'Logic Matrix Puzzles',
    tagline: 'Abstract Pattern Reasoning',
    category: 'Logic' as const,
    domain: 'Reasoning',
    domainColor: 'var(--dom-reason)',
    icon: 'Boxes',
    color: 'amber',
    description: 'Deduce missing shape patterns and logical geometric sequences.',
    isPro: true,
  },
  {
    id: 'cognitive-shift' as ModuleId,
    name: 'Cognitive Switch Speed',
    tagline: 'Task Switching & Flexibility',
    category: 'Flexibility' as const,
    domain: 'Speed',
    domainColor: 'var(--dom-speed)',
    icon: 'Shuffle',
    color: 'indigo',
    description: 'Switch instantly between number and color rules without delay.',
    isPro: true,
  },
  {
    id: 'visuospatial' as ModuleId,
    name: '3D Object Rotation',
    tagline: 'Spatial Geometry Vision',
    category: 'Spatial' as const,
    domain: 'Speed',
    domainColor: 'var(--dom-speed)',
    icon: 'Cuboid',
    color: 'indigo',
    description: 'Rotate complex 3D block structures to verify matching shapes.',
    isPro: true,
  },
  {
    id: 'reaction-inhibitor' as ModuleId,
    name: 'Reflex & Impulse Control',
    tagline: 'High-Speed Reflex Test',
    category: 'Inhibition' as const,
    domain: 'Speed',
    domainColor: 'var(--dom-speed)',
    icon: 'Target',
    color: 'teal',
    description: 'Tap targets with fast reflexes while stopping yourself on red traps.',
    isPro: true,
  },
  {
    id: 'mental-math' as ModuleId,
    name: 'Mental Math Sprint',
    tagline: 'Fast Arithmetic',
    category: 'Logic' as const,
    domain: 'Speed',
    domainColor: 'var(--dom-speed)',
    icon: 'Calculator',
    color: 'violet',
    description: 'Answer ten arithmetic questions against the clock. Gets faster as you improve.',
    isPro: false,
  },
  {
    id: 'vocabulary' as ModuleId,
    name: 'Word Power',
    tagline: 'Vocabulary Builder',
    category: 'Memory' as const,
    domain: 'Memory',
    domainColor: 'var(--dom-memory)',
    icon: 'BookOpen',
    color: 'rose',
    description: 'Learn words and review them on a spaced schedule so they actually stick.',
    isPro: false,
  },
];

export function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function createInitialProfile(): UserProfile {
  const today = getTodayDateString();
  const dailyLogs: Record<number, DailyLog> = {};

  for (let d = 1; d <= 30; d++) {
    dailyLogs[d] = {
      dayNumber: d,
      date: d === 1 ? today : '',
      completedModules: [],
      cognitiveScore: 0,
      status: d === 1 ? 'current' : 'future',
    };
  }

  return {
    currentDay: 1,
    streakDays: 0,
    lastActiveDate: today,
    startDate: today,
    soundEnabled: true,
    isProUser: false,
    unlockedAchievements: {},
    modules: {
      'digit-span': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'stroop': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'n-back': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'stillness': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'pattern-matrix': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'cognitive-shift': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'visuospatial': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'reaction-inhibitor': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'mental-math': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
      'vocabulary': { level: 1, xp: 0, bestScore: 0, totalSessions: 0, completedToday: false, history: [] },
    },
    dailyLogs,
  };
}

/**
 * Admin profile handling.
 *
 * This used to rebuild the profile from scratch on EVERY admin sign-in,
 * preserving only the payment fields — so badges, module progress, daily logs
 * and the streak were wiped on every login and every refresh. It now performs
 * the reset exactly once (guarded by adminResetDone) and otherwise returns the
 * existing profile untouched.
 */
export function resetAdminProfile(existing?: UserProfile): UserProfile {
  // Already reset once: leave the account alone.
  if (existing?.adminResetDone) return existing;

  const fresh = createInitialProfile();
  const resetProf: UserProfile = {
    ...fresh,
    isProUser: existing ? Boolean(existing.isProUser) : true,
    // These drive the entitlement system. Dropping them here meant the next
    // sync wrote lifetimePro:false straight back over an admin grant.
    lifetimePro: existing?.lifetimePro,
    trialStartedAt: existing?.trialStartedAt,
    proExpiresAt: existing?.proExpiresAt,
    proPlanType: existing?.proPlanType,
    proPaidAt: existing?.proPaidAt,
    proAmountPaid: existing?.proAmountPaid,
    proUtrNumber: existing?.proUtrNumber,
    pendingPayment: existing?.pendingPayment,
    // Earned history must survive. Losing badges and module progress on every
    // login is data loss, not a reset.
    unlockedAchievements: existing?.unlockedAchievements || {},
    modules: existing?.modules || fresh.modules,
    dailyLogs: existing?.dailyLogs || fresh.dailyLogs,
    // Recomputed below from the preserved logs — never carry the stored
    // number across, since old values are inflated.
    streakDays: 0,
    currentDay: existing?.currentDay ?? 1,
    startDate: existing?.startDate || fresh.startDate,
    gamesXp: existing?.gamesXp ?? 0,
    chessElo: existing?.chessElo ?? fresh.chessElo,
    displayName: existing?.displayName || fresh.displayName,
    adminResetDone: true,
  };
  resetProf.streakDays = countConsecutiveCompletedDays(resetProf);
  saveProfile(resetProf);
  return resetProf;
}

/**
 * Apply a calendar-day rollover to any profile.
 *
 * Resets only what belongs to a single day — module completion flags and the
 * current day's log. Level, XP, rank, streak, badges and history are never
 * touched: those accumulate across days and resetting them would destroy the
 * user's progress.
 *
 * Safe to call repeatedly; it does nothing when the profile is already current.
 */
/**
 * One-time streak rebase, applied to the authoritative profile.
 *
 * Must run AFTER the cloud copy is loaded, never on local data — otherwise
 * each device picks its own reset date and the same account shows a different
 * streak on a phone and a laptop.
 */
export function applyStreakReset(profile: UserProfile): UserProfile {
  if (!profile || profile.streakResetV3) return profile;

  const today = new Date().toISOString().slice(0, 10);
  return {
    ...profile,
    streakDays: 0,
    streakResetAt: today,
    streakResetV3: true,
  };
}

export function applyDayRollover(profile: UserProfile): UserProfile {
  const today = new Date().toISOString().slice(0, 10);
  if (!profile) return profile;
  if (profile.lastActiveDate === today) return profile;

  const next: UserProfile = { ...profile, modules: { ...profile.modules } };

  // Per-day flags reset.
  for (const key of Object.keys(next.modules)) {
    const m = next.modules[key as ModuleId];
    if (m?.completedToday) {
      next.modules[key as ModuleId] = { ...m, completedToday: false };
    }
  }

  next.lastActiveDate = today;
  return next;
}

export function loadProfile(): UserProfile {
  // Never hand back another account's profile. This is what caused a new
  // sign-in to show the previous user's name, streak and trial.
  if (cacheBelongsToOther()) {
    return createInitialProfile();
  }

  if (typeof window === 'undefined') return createInitialProfile();
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = createInitialProfile();
      saveProfile(init);
      return init;
    }
    const parsed: UserProfile = JSON.parse(raw);

    // Safeguard: ensure all 8 modules are present in profile
    const allModuleIds: ModuleId[] = [
      'digit-span',
      'stroop',
      'n-back',
      'stillness',
      'pattern-matrix',
      'cognitive-shift',
      'visuospatial',
      'reaction-inhibitor',
    ];

    if (!parsed.unlockedAchievements) {
      parsed.unlockedAchievements = {};
    }

    if (!parsed.modules) {
      parsed.modules = createInitialProfile().modules;
    } else {
      allModuleIds.forEach((id) => {
        if (!parsed.modules[id]) {
          parsed.modules[id] = {
            level: 1,
            xp: 0,
            bestScore: 0,
            totalSessions: 0,
            completedToday: false,
            history: [],
          };
        }
      });
    }
    
    // Check if new day has passed to update daily streak / currentDay
    const today = getTodayDateString();
    if (parsed.lastActiveDate && parsed.lastActiveDate !== today) {
      const last = new Date(parsed.lastActiveDate).getTime();
      const curr = new Date(today).getTime();
      const diffDays = Math.round((curr - last) / (1000 * 3600 * 24));

      if (diffDays > 0) {
        // A new calendar day always resets per-module completion.
        Object.keys(parsed.modules).forEach((m) => {
          if (parsed.modules[m as ModuleId]) {
            parsed.modules[m as ModuleId].completedToday = false;
          }
        });

        // Close out the day that just ended. Previously this only advanced
        // when four modules were finished, so an incomplete day stayed
        // "current" — and its completed modules carried into the next day,
        // which is why modules appeared already done and the streak grew
        // without any activity.
        const closing = parsed.dailyLogs[parsed.currentDay];
        if (closing) {
          closing.status = (closing.completedModules?.length || 0) >= 4 ? 'completed' : 'missed';
        }

        // Advance one day per calendar day elapsed, marking any fully skipped
        // days as missed so the streak calculation sees the real history.
        for (let i = 0; i < diffDays && parsed.currentDay < 30; i++) {
          parsed.currentDay += 1;
          const log = parsed.dailyLogs[parsed.currentDay];
          if (!log) continue;

          // Every intermediate day was never opened, so it is missed.
          const isToday = i === diffDays - 1;
          log.status = isToday ? 'current' : 'missed';
          log.date = isToday ? today : log.date;
          if (isToday) {
            // Guard against stale entries carried over from a previous cycle.
            log.completedModules = [];
          }
        }

        // Streak is derived from the logs, never incremented. With the days
        // above correctly marked, a skipped day now breaks it as expected.
        parsed.streakDays = countConsecutiveCompletedDays(parsed);

        parsed.lastActiveDate = today;
        saveProfile(parsed);
      }
    }

    // Repair inflated streaks written by the old incrementing counter. Daily
    // logs are the source of truth; a stored number that disagrees with them
    // is wrong by definition.
    if (!parsed.streakRepairedV2) {
      const recomputed = countConsecutiveCompletedDays(parsed);
      if (parsed.streakDays !== recomputed) {
        console.info(
          `Corrected streak: stored ${parsed.streakDays}, actual ${recomputed} completed days.`
        );
        parsed.streakDays = recomputed;
      }
      parsed.streakRepairedV2 = true;
      saveProfile(parsed);
    }

    return parsed;
  } catch (err) {
    console.error('Error loading profile from localStorage:', err);
    return createInitialProfile();
  }
}

/**
 * Consecutive days ending today that have a completed daily log.
 *
 * Deriving this is the only way a missed day can reduce the streak — an
 * incrementing counter has no way to notice absence.
 */
export function countConsecutiveCompletedDays(profile: UserProfile): number {
  const logs = profile.dailyLogs || {};
  let streak = 0;

  for (let day = profile.currentDay; day >= 1; day--) {
    const log = logs[day];
    if (log && log.status === 'completed') {
      streak++;
      continue;
    }

    // Today still in progress doesn't break a live streak — the day isn't over.
    // But a day explicitly marked MISSED is a decision, not an absence, and
    // must break it even when that day is today.
    if (day === profile.currentDay && log?.status !== 'missed') continue;
    break;
  }

  return streak;
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving profile to localStorage:', err);
  }
}

// Calculate strict total EXP earned across all modules and games
export function calculateTotalXp(profile: UserProfile): number {
  if (!profile) return 0;
  const mods = profile.modules || {};
  const totalModuleXp = (Object.values(mods) as any[]).reduce(
    (acc: number, m: any) => acc + (m?.xp || 0),
    0
  );
  const gamesXp = profile.gamesXp || 0;
  return totalModuleXp + gamesXp;
}

// Composite Brain Index Score Calculation
export function calculateBrainScore(profile: UserProfile): number {
  const mods = profile.modules;
  let totalScore = 0; // Baseline initialized at 0 for new users

  const allKeys = Object.keys(mods) as ModuleId[];
  allKeys.forEach((k) => {
    if (mods[k]) {
      totalScore += (mods[k].level - 1) * 35;
    }
  });

  // Bonus for streak
  totalScore += Math.min(profile.streakDays * 15, 200);

  return Math.round(totalScore);
}

// Process Module Completion & Level Adjustment
export function processModuleResult(
  profile: UserProfile,
  moduleId: ModuleId,
  score: number, // 0 - 100
  accuracy: number, // 0 - 100
  customDetails: { label: string; value: string | number }[] = []
): SessionResult {
  const modState = profile.modules[moduleId];
  const levelBefore = modState.level;
  let levelAfter = levelBefore;
  let levelChange: 'up' | 'down' | 'same' = 'same';

  // Adaptive Difficulty Algorithm:
  // Accuracy >= 80% or high score -> level increases (+1 or +0.5)
  // Accuracy < 50% -> level drops (-0.5, minimum 1)
  if (accuracy >= 80 && score >= 75) {
    levelAfter = Math.min(20, Math.round((levelBefore + 1) * 2) / 2);
    levelChange = 'up';
  } else if (accuracy < 50) {
    levelAfter = Math.max(1, Math.round((levelBefore - 0.5) * 2) / 2);
    levelChange = levelAfter < levelBefore ? 'down' : 'same';
  }

  // Balanced, competitive XP calculation (~20 - 50 XP per training session)
  const xpGained = Math.round((score * 0.25) + (accuracy * 0.25) + (levelBefore * 2));

  // Update module state
  modState.level = levelAfter;
  modState.xp += xpGained;
  modState.totalSessions += 1;
  modState.bestScore = Math.max(modState.bestScore, Math.round(score));
  modState.completedToday = true;

  const today = getTodayDateString();
  modState.history.push({
    date: today,
    timestamp: Date.now(),
    score: Math.round(score),
    accuracy: Math.round(accuracy),
    level: levelAfter,
  });

  // Update Daily Log
  const dayLog = profile.dailyLogs[profile.currentDay];
  if (dayLog) {
    if (!dayLog.completedModules.includes(moduleId)) {
      dayLog.completedModules.push(moduleId);
    }
    dayLog.cognitiveScore = calculateBrainScore(profile);

    // Mark the day complete once, and only once. This previously incremented
    // the streak on EVERY module finished past the fourth, so replaying
    // modules in a single day inflated the streak by a day each time.
    if (dayLog.completedModules.length >= 4 && dayLog.status !== 'completed') {
      dayLog.status = 'completed';

      // Derive the streak from consecutive completed days rather than
      // incrementing a counter. A counter cannot detect a missed day, so it
      // only ever grew.
      profile.streakDays = countConsecutiveCompletedDays(profile);
    }
  }

  // Evaluate unlockable achievements
  const { updatedProfile, newlyUnlocked } = checkAchievements(profile);
  profile.unlockedAchievements = updatedProfile.unlockedAchievements;

  saveProfile(profile);

  return {
    moduleId,
    score: Math.round(score),
    accuracy: Math.round(accuracy),
    levelBefore,
    levelAfter,
    levelChange,
    xpGained,
    details: customDetails,
    newlyUnlockedAchievements: newlyUnlocked.map((a) => a.id),
  };
}

// Seed realistic demo data for instant full-featured testing
export function seedDemoProfile(): UserProfile {
  const profile = createInitialProfile();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14); // 14 days ago

  profile.startDate = startDate.toISOString().split('T')[0];
  profile.currentDay = 15;
  profile.streakDays = 14;
  profile.lastActiveDate = getTodayDateString();

  const moduleIds: ModuleId[] = ['digit-span', 'stroop', 'n-back', 'stillness'];

  // Seed 14 days of realistic historical progress
  for (let d = 1; d <= 14; d++) {
    const logDate = new Date(startDate);
    logDate.setDate(logDate.getDate() + (d - 1));
    const dateStr = logDate.toISOString().split('T')[0];

    const dayScore = 520 + d * 28 + Math.floor(Math.random() * 20);
    profile.dailyLogs[d] = {
      dayNumber: d,
      date: dateStr,
      completedModules: [...moduleIds],
      cognitiveScore: dayScore,
      status: 'completed',
    };

    // Progressively level up modules
    moduleIds.forEach((mId, idx) => {
      const mod = profile.modules[mId];
      const lvl = Math.min(10, 1 + Math.floor(d / (idx + 2)));
      mod.level = lvl;
      mod.totalSessions = d;
      mod.bestScore = 80 + Math.floor(d * 1.2);
      mod.xp = d * 180;
      mod.history.push({
        date: dateStr,
        timestamp: logDate.getTime(),
        score: 75 + Math.floor(Math.random() * 20),
        accuracy: 80 + Math.floor(Math.random() * 18),
        level: lvl,
      });
    });
  }

  // Day 15 is current
  profile.dailyLogs[15] = {
    dayNumber: 15,
    date: getTodayDateString(),
    completedModules: ['digit-span'], // 1 completed today so far
    cognitiveScore: calculateBrainScore(profile),
    status: 'current',
  };
  profile.modules['digit-span'].completedToday = true;

  saveProfile(profile);
  return profile;
}
