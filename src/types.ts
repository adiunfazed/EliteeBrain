export type ModuleId =
  | 'digit-span'
  | 'stroop'
  | 'n-back'
  | 'stillness'
  | 'pattern-matrix'
  | 'cognitive-shift'
  | 'visuospatial'
  | 'reaction-inhibitor'
  | 'mental-math'
  | 'vocabulary';

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
  /** Permanent: this account has claimed its one free trial. Never cleared. */
  trialEverStarted?: boolean;
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
  /** Rated games played — drives the provisional K-factor. */
  chessGames?: number;
  adminResetDone?: boolean;
  /** One-time flag: the inflated streak counter has been recomputed. */
  streakRepairedV2?: boolean;
  /** One-time flag: streaks reset to a clean slate. */
  streakResetV3?: boolean;
  /** Activity before this date does not count toward the streak. */
  streakResetAt?: string;
  /** Today's completed quest. Date-keyed so it resets at midnight naturally. */
  questLog?: { date: string; id: string; title: string; xp: number };
  /** Recent quest ids, to avoid immediate repeats. */
  recentQuestIds?: string[];
  /** Spaced-review state, keyed by word. Belongs to the signed-in user. */
  vocabStore?: Record<string, any>;
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
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskCategory = 'study' | 'work' | 'personal' | 'fitness' | 'other';
export type TaskEnergy = 'low' | 'medium' | 'high';
export type TaskReflection = 'harder' | 'expected' | 'easier';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Repeat every N periods. 1 = every day/week/month. */
  interval: number;
  /** For weekly: 0=Sun..6=Sat. Empty means "same weekday as the due date". */
  weekdays?: number[];
}

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

  // --- Execution layer. All optional so existing tasks stay valid. ---
  category?: TaskCategory;
  /** HH:MM, 24h. Only meaningful alongside dueDate. */
  dueTime?: string;
  /** What the user expects it to take. */
  estimatedMinutes?: number;
  energy?: TaskEnergy;
  /** One of the user's up-to-three daily priorities. */
  pinned?: boolean;
  subtasks?: Subtask[];
  /** Answered after completing a pinned task. Never mandatory. */
  reflection?: TaskReflection;

  /** Goal this task contributes to, if any. */
  goalId?: string;
  /** How many times the due date has been pushed forward. */
  postponeCount?: number;
  /** ISO timestamp of the most recent postponement. */
  lastPostponedAt?: string;
  recurrence?: Recurrence;
  /** Id of the recurring task this one was generated from. */
  seriesId?: string;
  /** Set on the parent once its successor exists, so we never spawn twice. */
  spawnedNextAt?: string;
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

/* ------------------------------------------------------------------ */
/* Goals & Habits                                                      */
/* ------------------------------------------------------------------ */

export type GoalMetric = 'number' | 'percentage' | 'count' | 'completion' | 'habit';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type GoalHealth = 'on_track' | 'needs_attention' | 'at_risk' | 'done';

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  /** YYYY-MM-DD. Optional. */
  dueDate?: string;
  completedAt?: string;
}

/** users/{uid}/goals/{goalId} */
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: TaskCategory;
  metric: GoalMetric;
  /** Target value. Ignored for 'completion' goals, which use milestones. */
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  /** YYYY-MM-DD */
  deadline?: string;
  milestones?: Milestone[];
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** Written once, after the goal is completed. Optional. */
  reflection?: string;
}

export type HabitCadence = 'daily' | 'weekly' | 'selected_days';
export type HabitMetric = 'yes_no' | 'count' | 'duration';
export type HabitStatus = 'active' | 'paused' | 'archived';

/** users/{uid}/habits/{habitId} */
export interface Habit {
  id: string;
  title: string;
  category?: TaskCategory;
  cadence: HabitCadence;
  /** For selected_days: 0=Sun..6=Sat. For weekly: how many times per week. */
  weekdays?: number[];
  timesPerWeek?: number;
  metric: HabitMetric;
  /** Target per scheduled day. Count of reps, or minutes for duration. */
  targetValue: number;
  unit?: string;
  /** Optional link to a goal this habit supports. */
  goalId?: string;
  status: HabitStatus;
  createdAt: string;
  updatedAt: string;
}

/** users/{uid}/habitLogs/{YYYY-MM-DD__habitId} — one row per habit per day. */
export interface HabitLog {
  id: string;
  habitId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Progress recorded for that day. Minutes for duration habits. */
  value: number;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Routines, Sleep & Life Momentum                                     */
/* ------------------------------------------------------------------ */

export type BlockKind =
  | 'study' | 'work' | 'exercise' | 'sleep' | 'meal' | 'personal' | 'custom';

export type BlockState = 'pending' | 'done' | 'partial' | 'skipped';

/** users/{uid}/routineBlocks/{id} — the recurring definition. */
export interface RoutineBlock {
  id: string;
  title: string;
  kind: BlockKind;
  /** HH:MM, 24h. */
  startTime: string;
  endTime: string;
  /** 0=Sun..6=Sat. Empty means every day. */
  weekdays?: number[];
  /** Optional links into the rest of the system. */
  habitId?: string;
  goalId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** users/{uid}/routineLogs/{YYYY-MM-DD__blockId} — one row per occurrence. */
export interface RoutineLog {
  id: string;
  blockId: string;
  date: string;
  state: BlockState;
  updatedAt: string;
}

/**
 * users/{uid}/goalSnapshots/{goalId__YYYY-MM-DD}
 * One row per goal per day, so progress over time can be graphed. Without
 * these, only the current value exists and history is unrecoverable.
 */
export interface GoalSnapshot {
  id: string;
  goalId: string;
  date: string;
  /** 0-100 at the time of capture. */
  percent: number;
  updatedAt: string;
}

/** users/{uid}/sleepLogs/{YYYY-MM-DD} — keyed by the WAKE date. */
export interface SleepLog {
  id: string;
  /** YYYY-MM-DD of the morning the user woke. */
  date: string;
  /** HH:MM the night before. */
  bedtime: string;
  wakeTime: string;
  /** Derived and stored so history stays stable if the rules change. */
  minutes: number;
  note?: string;
  updatedAt: string;
}
