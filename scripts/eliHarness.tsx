/** Mounts the real ELI component for browser testing. Not shipped. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EliCoach } from '../src/components/eli/EliCoach';

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const withNews = new URLSearchParams(location.search).get('mode') !== 'empty';

const task = (id: string, dueDate: string) => ({
  id, title: 'Edit YouTube videos', priority: 'high', completed: false, dueDate,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
});

const context: any = {
  tasks: withNews ? [task('a', iso)] : [task('a', '2099-01-01')],
  habits: [], habitLogs: [], focusSessions: [], routineBlocks: [], routineLogs: [],
  goals: [], workouts: [], records: {},
  profile: { questLog: { date: iso, id: 'q', title: 'q', xp: 1 } },
};

(window as any).__asked = 0;
createRoot(document.getElementById('root')!).render(
  <EliCoach
    userId="harness"
    context={context}
    ready={false}
    onAction={() => {}}
    onAsk={() => { (window as any).__asked++; }}
  />
);
