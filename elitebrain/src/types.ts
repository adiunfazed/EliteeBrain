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
  proPlanType?: 'monthly' | 'annual' | 'lifetime' | 'trial';
  /** ISO timestamp when the 1-month free trial began. Set once, never reset. */
  trialStartedAt?: string;
  /** True only for a paid or admin-granted lifetime unlock. Never expires. */
  lifetimePro?: boolean;
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
  /** Goal chosen during onboarding — see lib/goals.ts. */
  focusGoal?: string;
  dailyMinutes?: number;
}

export interface CoachChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
}



/** A single to-do item. Stored per user at users/{uid}/tasks/{taskId}. */
export type TaskPriority = 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: TaskPriority;
  /** YYYY-MM-DD. Absent means unscheduled. */
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Total seconds of focus time logged against this task. */
  focusSeconds?: number;
}


/** One completed or abandoned focus block. users/{uid}/focusSessions/{id} */
export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  /** Minutes the user planned to focus for. */
  plannedMinutes: number;
  /** Seconds actually focused, excluding paused time. */
  focusedSeconds: number;
  startedAt: string;
  endedAt: string;
  /** True when the full planned duration elapsed. */
  completed: boolean;
}
