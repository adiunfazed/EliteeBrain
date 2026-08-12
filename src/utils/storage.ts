import { UserProfile, ModuleId, SessionResult, DailyLog } from '../types';
import { checkAchievements } from './achievements';

const STORAGE_KEY = 'elite_brain_profile_v2';

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
    },
    dailyLogs,
  };
}

export function resetAdminProfile(existing?: UserProfile): UserProfile {
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
    adminResetDone: true,
  };
  saveProfile(resetProf);
  return resetProf;
}

export function loadProfile(): UserProfile {
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
        // Reset completedToday flag on modules for new calendar day
        Object.keys(parsed.modules).forEach((m) => {
          if (parsed.modules[m as ModuleId]) {
            parsed.modules[m as ModuleId].completedToday = false;
          }
        });

        if (diffDays === 1) {
          // Check if yesterday had at least 4 modules completed
          const currentDayLog = parsed.dailyLogs[parsed.currentDay];
          const allDone = currentDayLog && currentDayLog.completedModules.length >= 4;
          
          if (allDone && parsed.currentDay < 30) {
            parsed.currentDay += 1;
            parsed.dailyLogs[parsed.currentDay].status = 'current';
            parsed.dailyLogs[parsed.currentDay].date = today;
          }
        } else if (diffDays > 1) {
          // Missed one or more days
          const currentLog = parsed.dailyLogs[parsed.currentDay];
          if (currentLog && currentLog.completedModules.length < 4) {
            currentLog.status = 'missed';
          }
          if (parsed.currentDay < 30) {
            parsed.currentDay += 1;
            parsed.dailyLogs[parsed.currentDay].status = 'current';
            parsed.dailyLogs[parsed.currentDay].date = today;
          }
          // Reset streak if gap > 1 day
          parsed.streakDays = 0;
        }
        parsed.lastActiveDate = today;
        saveProfile(parsed);
      }
    }
    
    return parsed;
  } catch (err) {
    console.error('Error loading profile from localStorage:', err);
    return createInitialProfile();
  }
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

    // If all 4 modules are completed today!
    if (dayLog.completedModules.length >= 4) {
      dayLog.status = 'completed';
      profile.streakDays += 1;
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
