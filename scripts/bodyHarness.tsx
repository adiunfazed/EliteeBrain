/** Mounts the real Body Training section for browser testing. Not shipped. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BodyTrainingSection } from '../src/components/body/BodyTrainingSection';
import { XpProvider } from '../src/components/XpToast';
import { normaliseTemplate, itemFromCustom, itemFromExercise } from '../src/lib/workoutTemplates';
import { exerciseById } from '../src/lib/bodyTraining';

const iso = new Date().toISOString().slice(0, 10);

const push = normaliseTemplate({
  id: 'tpl_push',
  name: 'Push day',
  items: [
    itemFromCustom('Bench press', 'reps', {
      restSeconds: 120,
      plan: [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
        { weight: 70, reps: 8 },
      ],
    }),
    itemFromCustom('Overhead press', 'reps', {
      restSeconds: 90,
      plan: [
        { weight: 35, reps: 10 },
        { weight: 35, reps: 10 },
        { weight: 40, reps: 8 },
      ],
    }),
    itemFromExercise(exerciseById('pushups')!, { sets: 3, target: 20 }),
  ],
  lastUsedAt: new Date(Date.now() - 86400000).toISOString(),
});

const legs = normaliseTemplate({
  id: 'tpl_legs',
  name: 'Leg day',
  items: [
    itemFromCustom('Back squat', 'reps', {
      restSeconds: 180,
      plan: Array.from({ length: 5 }, () => ({ weight: 100, reps: 5 })),
    }),
    itemFromCustom('Romanian deadlift', 'reps', {
      plan: Array.from({ length: 3 }, () => ({ weight: 80, reps: 10 })),
    }),
    itemFromExercise(exerciseById('plank')!, { sets: 2, target: 60 }),
  ],
});

// A one-set workout, so an automated run can finish a whole session quickly.
const tiny = normaliseTemplate({
  id: 'tpl_tiny',
  name: 'Quick test',
  items: [
    itemFromCustom('Barbell row', 'reps', {
      restSeconds: 5,
      plan: [
        { weight: 50, reps: 2 },
        { weight: 55, reps: 2 },
      ],
    }),
    itemFromCustom('Farmer carry', 'hold', { sets: 1, target: 5, restSeconds: 5 }),
  ],
});

const params = new URLSearchParams(location.search);
const tinyMode = params.get('tiny') === '1';
const emptyMode = params.get('empty') === '1';

localStorage.setItem(
  'elitebrain_workout_templates_v1',
  JSON.stringify(emptyMode ? [] : tinyMode ? [tiny] : [push, legs])
);
if (emptyMode) {
  localStorage.setItem('elitebrain_records_v1', '{}');
  localStorage.setItem('elitebrain_workouts_v1', '[]');
}

if (!emptyMode) localStorage.setItem(
  'elitebrain_records_v1',
  JSON.stringify({
    'custom_bench-press': {
      exerciseId: 'custom_bench-press',
      value: 0,
      achievedAt: '',
      name: 'Bench press',
      weight: 65,
      weightReps: 8,
      e1rm: 82.3,
      weightAt: '',
    },
    pushups: { exerciseId: 'pushups', value: 24, achievedAt: '' },
  })
);
if (!emptyMode) localStorage.setItem(
  'elitebrain_workouts_v1',
  JSON.stringify([
    {
      id: 'w1',
      date: iso,
      templateName: 'Push day',
      items: [
        { exerciseId: 'custom_bench-press', name: 'Bench press', metric: 'reps', sets: 3, target: 10, difficulty: 'easy', weight: 65 },
        { exerciseId: 'pushups', sets: 3, target: 20, difficulty: 'easy' },
      ],
      completed: { 'custom_bench-press': 3, pushups: 3 },
      results: { 'custom_bench-press': [10, 10, 8], pushups: [20, 20, 20] },
      sets: {
        'custom_bench-press': [
          { weight: 60, reps: 10 },
          { weight: 60, reps: 10 },
          { weight: 65, reps: 8 },
        ],
        pushups: [
          { weight: 0, reps: 20 },
          { weight: 0, reps: 20 },
          { weight: 0, reps: 20 },
        ],
      },
      startedAt: new Date(Date.now() - 3000000).toISOString(),
      finishedAt: new Date(Date.now() - 300000).toISOString(),
      xpAwarded: 35,
    },
  ])
);

createRoot(document.getElementById('root')!).render(
  <XpProvider>
    <div className="p-4" style={{ background: 'var(--ground)', minHeight: '100vh' }}>
      <BodyTrainingSection userId={null} profile={{}} />
    </div>
  </XpProvider>
);
