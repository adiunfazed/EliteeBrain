import { UserProfile } from '../types';
import { calculateBrainScore } from './storage';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Streak' | 'Memory' | 'Focus' | 'Logic' | 'Milestones' | 'Mastery' | 'Habits' | 'Routine' | 'Goals' | 'Life';
  icon: string; // Lucide icon name
  color: 'amber' | 'emerald' | 'indigo' | 'violet' | 'rose' | 'sky' | 'teal';
  points: number;
  conditionDescription: string;
}

export const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: 'first_session',
    title: 'First Step into Neuro-Gym',
    description: 'Completed your very first cognitive training module.',
    category: 'Milestones',
    icon: 'Zap',
    color: 'indigo',
    points: 50,
    conditionDescription: 'Complete 1 training session in any module',
  },
  {
    id: 'streak_3',
    title: '3-Day Synapse Ignition',
    description: 'Maintained a 3-day consecutive training streak.',
    category: 'Streak',
    icon: 'Flame',
    color: 'amber',
    points: 100,
    conditionDescription: 'Maintain a 3-day streak',
  },
  {
    id: 'streak_7',
    title: '7-Day Streak Master',
    description: 'Built momentum with a 7-day uninterrupted training streak.',
    category: 'Streak',
    icon: 'Flame',
    color: 'rose',
    points: 250,
    conditionDescription: 'Maintain a 7-day streak',
  },
  {
    id: 'streak_14',
    title: 'Fortnight Neuro-Power',
    description: 'Demonstrated dedication with 14 consecutive active days.',
    category: 'Streak',
    icon: 'Sparkles',
    color: 'violet',
    points: 500,
    conditionDescription: 'Maintain a 14-day streak',
  },
  {
    id: 'streak_30',
    title: '30-Day Elite Mind',
    description: 'Completed the full 30-day cognitive evolution protocol!',
    category: 'Streak',
    icon: 'Crown',
    color: 'amber',
    points: 1000,
    conditionDescription: 'Reach Day 30 on the protocol',
  },
  {
    id: 'perfect_digit_span',
    title: 'Perfect Memory Engram Score',
    description: 'Achieved 100% recall accuracy in Number Memory Span.',
    category: 'Memory',
    icon: 'Binary',
    color: 'rose',
    points: 200,
    conditionDescription: 'Score 100% accuracy in Number Memory Span',
  },
  {
    id: 'mastered_n_back',
    title: 'Mastered N-Back',
    description: 'Advanced to Level 3 or higher in Spatial Pattern Recall.',
    category: 'Memory',
    icon: 'Layers',
    color: 'emerald',
    points: 300,
    conditionDescription: 'Reach Level 3+ in Spatial Pattern Recall (N-Back)',
  },
  {
    id: 'stroop_master',
    title: 'Color Speed Match Master',
    description: 'Demonstrated extreme selective attention with 90%+ accuracy.',
    category: 'Focus',
    icon: 'Zap',
    color: 'violet',
    points: 200,
    conditionDescription: 'Score 90%+ accuracy in Color Speed Match',
  },
  {
    id: 'zen_mind',
    title: 'Unshakable Stillness',
    description: 'Completed a Mindful Focus session with 90%+ focus score.',
    category: 'Focus',
    icon: 'Compass',
    color: 'sky',
    points: 200,
    conditionDescription: 'Score 90%+ in Mindful Focus Timer',
  },
  {
    id: 'logic_genius',
    title: 'Matrix Mastermind',
    description: 'Solved complex abstract patterns with 90%+ logic accuracy.',
    category: 'Logic',
    icon: 'Boxes',
    color: 'amber',
    points: 250,
    conditionDescription: 'Score 90%+ accuracy in Logic Matrix Puzzles',
  },
  {
    id: 'cognitive_agility',
    title: 'Flexibility Wizard',
    description: 'Switched cognitive rules seamlessly with 90%+ switch score.',
    category: 'Mastery',
    icon: 'Shuffle',
    color: 'indigo',
    points: 250,
    conditionDescription: 'Score 90%+ accuracy in Cognitive Switch Speed',
  },
  {
    id: 'spatial_3d',
    title: '3D Visionary',
    description: 'Mastered mental geometry rotation with 90%+ spatial accuracy.',
    category: 'Mastery',
    icon: 'Cuboid',
    color: 'indigo',
    points: 250,
    conditionDescription: 'Score 90%+ accuracy in 3D Object Rotation',
  },
  {
    id: 'reflex_ninja',
    title: 'Impulse Control Ninja',
    description: 'Achieved high-speed reflex precision with 90%+ accuracy.',
    category: 'Mastery',
    icon: 'Target',
    color: 'teal',
    points: 250,
    conditionDescription: 'Score 90%+ accuracy in Reflex & Impulse Control',
  },
  {
    id: 'omni_trained',
    title: 'Omni-Trained Specialist',
    description: 'Completed training sessions across all 8 cognitive modules.',
    category: 'Milestones',
    icon: 'Award',
    color: 'emerald',
    points: 400,
    conditionDescription: 'Train at least once in all 8 modules',
  },
  {
    id: 'brain_300',
    title: 'Cognitive Surge',
    description: 'Elevated overall Brain Index score above 300 points.',
    category: 'Milestones',
    icon: 'TrendingUp',
    color: 'sky',
    points: 300,
    conditionDescription: 'Reach an overall Brain Index of 300+',
  },
  {
    id: 'brain_600',
    title: 'Apex Titan Mind',
    description: 'Reached elite status with an overall Brain Index of 600+.',
    category: 'Milestones',
    icon: 'Trophy',
    color: 'amber',
    points: 600,
    conditionDescription: 'Reach an overall Brain Index of 600+',
  },

  /* ---- Habits ---- */
  {
    id: 'habit_first',
    title: 'First Habit',
    description: 'You created a habit worth repeating.',
    category: 'Habits',
    icon: 'Repeat',
    color: 'violet',
    points: 10,
    conditionDescription: 'Create your first habit',
  },
  {
    id: 'habit_week',
    title: 'Seven Straight',
    description: 'A habit kept every scheduled day for a week.',
    category: 'Habits',
    icon: 'Flame',
    color: 'amber',
    points: 30,
    conditionDescription: 'Hit a 7-day streak on any habit',
  },
  {
    id: 'habit_month',
    title: 'Month of Momentum',
    description: 'Thirty days of showing up for the same habit.',
    category: 'Habits',
    icon: 'Award',
    color: 'emerald',
    points: 80,
    conditionDescription: 'Hit a 30-day streak on any habit',
  },
  {
    id: 'habit_three',
    title: 'Stacked',
    description: 'Three habits running at once.',
    category: 'Habits',
    icon: 'Layers',
    color: 'teal',
    points: 25,
    conditionDescription: 'Keep 3 habits active at the same time',
  },

  /* ---- Routine ---- */
  {
    id: 'routine_first',
    title: 'Blocked Out',
    description: 'You gave your day a shape.',
    category: 'Routine',
    icon: 'Clock',
    color: 'sky',
    points: 10,
    conditionDescription: 'Add your first routine block',
  },
  {
    id: 'routine_perfect_day',
    title: 'Clean Sweep',
    description: 'Every block on the schedule, done.',
    category: 'Routine',
    icon: 'CheckCheck',
    color: 'emerald',
    points: 35,
    conditionDescription: 'Complete every routine block in one day',
  },

  /* ---- Focus ---- */
  {
    id: 'focus_first',
    title: 'First Deep Work',
    description: 'One session, no distractions.',
    category: 'Focus',
    icon: 'Timer',
    color: 'indigo',
    points: 10,
    conditionDescription: 'Complete your first focus session',
  },
  {
    id: 'focus_10h',
    title: 'Ten Hours Deep',
    description: 'Ten hours of genuinely focused work.',
    category: 'Focus',
    icon: 'Hourglass',
    color: 'violet',
    points: 60,
    conditionDescription: 'Accumulate 10 hours of focus time',
  },

  /* ---- Tasks & goals ---- */
  {
    id: 'task_50',
    title: 'Fifty Done',
    description: 'Fifty tasks finished, not just planned.',
    category: 'Milestones',
    icon: 'ListChecks',
    color: 'emerald',
    points: 40,
    conditionDescription: 'Complete 50 tasks',
  },
  {
    id: 'goal_first',
    title: 'Something to Aim At',
    description: 'You set a goal worth working toward.',
    category: 'Goals',
    icon: 'Target',
    color: 'rose',
    points: 10,
    conditionDescription: 'Create your first goal',
  },
  {
    id: 'goal_complete',
    title: 'Goal Reached',
    description: 'You finished what you set out to do.',
    category: 'Goals',
    icon: 'Trophy',
    color: 'amber',
    points: 100,
    conditionDescription: 'Complete a goal',
  },

  /* ---- Sleep & consistency ---- */
  {
    id: 'sleep_week',
    title: 'Tracking Rest',
    description: 'A week of recorded nights.',
    category: 'Life',
    icon: 'Moon',
    color: 'indigo',
    points: 25,
    conditionDescription: 'Log sleep on 7 nights',
  },
  {
    id: 'balanced_day',
    title: 'Balanced Day',
    description: 'Trained, focused, and kept your habits — all in one day.',
    category: 'Life',
    icon: 'Scale',
    color: 'teal',
    points: 50,
    conditionDescription: 'Train, focus and hit a habit on the same day',
  },
  {
    id: 'comeback',
    title: 'Back On It',
    description: 'You broke a streak and started another. That is the hard part.',
    category: 'Streak',
    icon: 'RotateCcw',
    color: 'sky',
    points: 30,
    conditionDescription: 'Rebuild a 3-day streak after losing one',
  },
];


export interface LifeContext {
  habitCount?: number;
  bestHabitStreak?: number;
  routineBlockCount?: number;
  perfectRoutineDay?: boolean;
  focusSessions?: number;
  focusMinutesTotal?: number;
  tasksCompleted?: number;
  goalCount?: number;
  goalsCompleted?: number;
  sleepNights?: number;
  trainedToday?: boolean;
  focusedToday?: boolean;
  habitHitToday?: boolean;
  /** True once a streak has been lost and rebuilt to 3+. */
  rebuiltStreak?: boolean;
}

export function checkAchievements(
  profile: UserProfile,
  life: LifeContext = {}
): {
  updatedProfile: UserProfile;
  newlyUnlocked: Achievement[];
} {
  const currentUnlocked = profile.unlockedAchievements || {};
  const newlyUnlocked: Achievement[] = [];
  const updatedUnlocked = { ...currentUnlocked };
  const now = Date.now();

  const totalSessionsAllModules = Object.values(profile.modules).reduce(
    (acc, m) => acc + (m.totalSessions || 0),
    0
  );

  const brainScore = calculateBrainScore(profile);

  ACHIEVEMENTS_LIST.forEach((achievement) => {
    // Skip if already unlocked
    if (updatedUnlocked[achievement.id]) return;

    let unlocked = false;

    switch (achievement.id) {
      case 'first_session':
        if (totalSessionsAllModules >= 1) unlocked = true;
        break;

      case 'streak_3':
        if (profile.streakDays >= 3) unlocked = true;
        break;

      case 'streak_7':
        if (profile.streakDays >= 7) unlocked = true;
        break;

      case 'streak_14':
        if (profile.streakDays >= 14) unlocked = true;
        break;

      case 'streak_30':
        if (profile.streakDays >= 30 || profile.currentDay >= 30) unlocked = true;
        break;

      case 'perfect_digit_span': {
        const mod = profile.modules['digit-span'];
        if (mod && mod.history.some((h) => h.accuracy >= 100)) unlocked = true;
        break;
      }

      case 'mastered_n_back': {
        const mod = profile.modules['n-back'];
        if (mod && mod.level >= 3) unlocked = true;
        break;
      }

      case 'stroop_master': {
        const mod = profile.modules['stroop'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'zen_mind': {
        const mod = profile.modules['stillness'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'logic_genius': {
        const mod = profile.modules['pattern-matrix'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'cognitive_agility': {
        const mod = profile.modules['cognitive-shift'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'spatial_3d': {
        const mod = profile.modules['visuospatial'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'reflex_ninja': {
        const mod = profile.modules['reaction-inhibitor'];
        if (mod && mod.history.some((h) => h.accuracy >= 90)) unlocked = true;
        break;
      }

      case 'omni_trained': {
        const allTrained = Object.values(profile.modules).every((m) => m.totalSessions >= 1);
        if (allTrained) unlocked = true;
        break;
      }

      case 'brain_300':
        if (brainScore >= 300) unlocked = true;
        break;

      case 'brain_600':
        if (brainScore >= 600) unlocked = true;
        break;

      /* ---- Habits ---- */
      case 'habit_first':
        if ((life.habitCount || 0) >= 1) unlocked = true;
        break;
      case 'habit_week':
        if ((life.bestHabitStreak || 0) >= 7) unlocked = true;
        break;
      case 'habit_month':
        if ((life.bestHabitStreak || 0) >= 30) unlocked = true;
        break;
      case 'habit_three':
        if ((life.habitCount || 0) >= 3) unlocked = true;
        break;

      /* ---- Routine ---- */
      case 'routine_first':
        if ((life.routineBlockCount || 0) >= 1) unlocked = true;
        break;
      case 'routine_perfect_day':
        if (life.perfectRoutineDay) unlocked = true;
        break;

      /* ---- Focus ---- */
      case 'focus_first':
        if ((life.focusSessions || 0) >= 1) unlocked = true;
        break;
      case 'focus_10h':
        if ((life.focusMinutesTotal || 0) >= 600) unlocked = true;
        break;

      /* ---- Tasks & goals ---- */
      case 'task_50':
        if ((life.tasksCompleted || 0) >= 50) unlocked = true;
        break;
      case 'goal_first':
        if ((life.goalCount || 0) >= 1) unlocked = true;
        break;
      case 'goal_complete':
        if ((life.goalsCompleted || 0) >= 1) unlocked = true;
        break;

      /* ---- Life ---- */
      case 'sleep_week':
        if ((life.sleepNights || 0) >= 7) unlocked = true;
        break;
      case 'balanced_day':
        if (life.trainedToday && life.focusedToday && life.habitHitToday) unlocked = true;
        break;
      case 'comeback':
        if (life.rebuiltStreak) unlocked = true;
        break;
    }

    if (unlocked) {
      updatedUnlocked[achievement.id] = now;
      newlyUnlocked.push(achievement);
    }
  });

  const updatedProfile: UserProfile = {
    ...profile,
    unlockedAchievements: updatedUnlocked,
  };

  return { updatedProfile, newlyUnlocked };
}
