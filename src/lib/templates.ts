import { Habit } from '../types';

/**
 * Setup templates.
 *
 * A new account lands on empty screens with no idea what to put in them.
 * Rather than a tour explaining the app, a template fills it with a working
 * plan in one tap — the fastest route from signing up to seeing the point.
 *
 * Everything created is ordinary, editable data. Nothing here is special-cased
 * elsewhere in the app, so a template is only ever a head start.
 */

export interface TemplateBlock {
  title: string;
  kind: string;
  startTime: string;
  endTime: string;
}

export interface TemplateHabit {
  title: string;
  cadence: Habit['cadence'];
  targetValue: number;
  metric: Habit['metric'];
}

export interface Template {
  id: string;
  name: string;
  who: string;
  icon: string;
  accent: string;
  goal: { title: string; milestones: string[] } | null;
  habits: TemplateHabit[];
  blocks: TemplateBlock[];
  tasks: string[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'exam',
    name: 'Exam preparation',
    who: 'JEE, NEET, UPSC, boards — any long study campaign',
    icon: 'GraduationCap',
    accent: '#7C5CFF',
    goal: {
      title: 'Clear my exam',
      milestones: ['Finish the syllabus once', 'Complete 10 mock tests', 'Revise every weak topic'],
    },
    habits: [
      { title: 'Study 3 hours', cadence: 'daily', targetValue: 3, metric: 'count' },
      { title: 'Revise yesterday’s topics', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
      { title: 'Solve a practice set', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
    ],
    blocks: [
      { title: 'Morning study', kind: 'work', startTime: '06:30', endTime: '09:00' },
      { title: 'Afternoon practice', kind: 'work', startTime: '15:00', endTime: '17:00' },
      { title: 'Evening revision', kind: 'work', startTime: '20:00', endTime: '21:30' },
    ],
    tasks: ['Make a syllabus checklist', 'Find last year’s question papers'],
  },
  {
    id: 'fitness',
    name: 'Get fit',
    who: 'Building a training habit that survives a bad week',
    icon: 'Dumbbell',
    accent: '#00C2A8',
    goal: {
      title: 'Get properly fit',
      milestones: ['Train 12 times', 'Hold a routine for a month', 'Beat my starting numbers'],
    },
    habits: [
      { title: 'Train', cadence: 'selected_days', targetValue: 1, metric: 'yes_no' },
      { title: 'Walk 8000 steps', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
      { title: 'Drink 3 litres of water', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
    ],
    blocks: [
      { title: 'Workout', kind: 'health', startTime: '06:30', endTime: '07:30' },
      { title: 'Evening walk', kind: 'health', startTime: '19:00', endTime: '19:30' },
    ],
    tasks: ['Plan this week’s training split', 'Buy what I need for the week'],
  },
  {
    id: 'deepwork',
    name: 'Deep work',
    who: 'Freelancers, builders and anyone shipping something',
    icon: 'Target',
    accent: '#FFB020',
    goal: {
      title: 'Ship my project',
      milestones: ['Define what "done" means', 'Build the core', 'Put it in front of real users'],
    },
    habits: [
      { title: 'Two focus sessions', cadence: 'daily', targetValue: 2, metric: 'count' },
      { title: 'Plan tomorrow before bed', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
    ],
    blocks: [
      { title: 'Deep work', kind: 'work', startTime: '09:00', endTime: '12:00' },
      { title: 'Admin and messages', kind: 'work', startTime: '16:00', endTime: '17:00' },
    ],
    tasks: ['Write down what I am actually building', 'List the first three steps'],
  },
  {
    id: 'reset',
    name: 'Daily reset',
    who: 'Just want structure — no big goal attached',
    icon: 'Sunrise',
    accent: '#7FD4E8',
    goal: null,
    habits: [
      { title: 'Read 10 pages', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
      { title: 'Move for 30 minutes', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
      { title: 'In bed by 11', cadence: 'daily', targetValue: 1, metric: 'yes_no' },
    ],
    blocks: [
      { title: 'Morning routine', kind: 'personal', startTime: '07:00', endTime: '08:00' },
      { title: 'Wind down', kind: 'personal', startTime: '22:00', endTime: '23:00' },
    ],
    tasks: ['Decide what my mornings look like'],
  },
];

export function templateById(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) || null;
}
