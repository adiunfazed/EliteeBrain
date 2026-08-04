export type ModuleId =
  | 'digit-span'
  | 'stroop'
  | 'n-back'
  | 'stillness'
  | 'pattern-matrix'
  | 'cognitive-shift'
  | 'visuospatial'
  | 'reaction-inhibitor';

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  tagline: string;
  category: 'Memory' | 'Focus' | 'Fluid IQ' | 'Mindfulness' | 'Logic' | 'Flexibility' | 'Spatial' | 'Inhibition';
  domain?: string;
  domainColor?: string;
  icon: string;
  color: 'indigo' | 'violet' | 'emerald' | 'amber' | 'blue' | 'rose' | 'teal' | (string & {});
  description: string;
  isPro?: boolean;
}

export interface SessionResult {
  moduleId: ModuleId;
  score: number; // Raw score or accuracy percentage (0-100)
  accuracy: number; // 0 - 100%
  levelBefore: number;
  levelAfter: number;
  levelChange: 'up' | 'down' | 'same';
  xpGained: number;
  details: {
    label: string;
    value: string | number;
  }[];
  newlyUnlockedAchievements?: string[]; // Achievement IDs
}

export interface ModuleHistoryEntry {
  date: string; // YYYY-MM-DD
  timestamp: number;
  score: number;
  accuracy: number;
  level: number;
}

export interface ModuleState {
  level: number;
  xp: number;
  bestScore: number;
  totalSessions: number;
  completedToday: boolean;
  history: ModuleHistoryEntry[];
}

export interface DailyLog {
  dayNumber: number; // 1 - 30
  date: string; // YYYY-MM-DD
  completedModules: ModuleId[];
  cognitiveScore: number; // Calculated overall brain index for the day
  status: 'completed' | 'current' | 'missed' | 'future';
}

export interface PendingPaymentInfo {
  utrNumber: string;
  plan: 'monthly' | 'annual' | 'lifetime';
  amountINR: number;
  submittedAt: string;
}

export interface UserProfile {
  displayName?: string;
  currentDay: number; // 1 - 30
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  soundEnabled: boolean;
  isProUser?: boolean;
  proExpiresAt?: string;
  proPlanType?: 'monthly' | 'annual' | 'lifetime';
  proPaidAt?: string;
  proAmountPaid?: number;
  proUtrNumber?: string;
  pendingPayment?: PendingPaymentInfo;
  unlockedAchievements?: Record<string, number>; // id -> timestamp
  modules: Record<ModuleId, ModuleState>;
  dailyLogs: Record<number, DailyLog>;
  gamesXp?: number;
  chessElo?: number;
  adminResetDone?: boolean;
}

export interface CoachChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
}

