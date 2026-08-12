import { UserProfile } from '../types';
import { calculateBrainScore } from './storage';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Streak' | 'Memory' | 'Focus' | 'Logic' | 'Milestones' | 'Mastery';
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
];

export function checkAchievements(profile: UserProfile): {
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
