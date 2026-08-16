import type { Habit, HabitLog, RoutineBlock, RoutineLog, SleepLog, Task, UserProfile } from '../types';
import type { FocusSession } from '../types';
import { todayISO } from './tasks';
import { isScheduledOn, valueOn } from './habits';
import { blocksForDate } from './routine';

/**
 * Experience points.
 *
 * Design rules, chosen deliberately:
 *
 *   1. XP is awarded for FINISHING things, never for opening the app, tapping
 *      around, or "checking in". Rewarding presence teaches people to open the
 *      app; rewarding completion teaches them to do the work.
 *
 *   2. Every source is capped per day. Without caps the optimal strategy is to
 *      create fifty trivial tasks and tick them, which is both gameable and
 *      teaches exactly the wrong habit.
 *
 *   3. XP is DERIVED from stored activity, not a running counter. A counter
 *      drifts on re-sync and can be inflated; a derived value always matches
 *      what actually happened.
 *
 *   4. Nothing is ever taken away. Losing points for a missed day is a
 *      punishment mechanic, and this app is meant to help people restart, not
 *      to make restarting feel expensive.
 */

export const XP = {
  taskCompleted: 10,
  taskDailyCap: 60,

  habitMet: 15,
  habitDailyCap: 75,

  routineBlockDone: 12,
  routineDailyCap: 60,

  /** Per 25 minutes of genuinely focused time. */
  focusPerBlock: 20,
  focusDailyCap: 100,

  sleepLogged: 8,

  /** All of today's scheduled items finished. */
  perfectDayBonus: 50,

  goalCompleted: 150,
  milestoneCompleted: 25,
} as const;

export interface DayXp {
  date: string;
  tasks: number;
  habits: number;
  routine: number;
  focus: number;
  sleep: number;
  bonus: number;
  total: number;
  /** True when every scheduled item for the day was completed. */
  perfect: boolean;
}

export interface XpInput {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  sleepLogs: SleepLog[];
}

/** XP earned on a single day. Pure, so it can be tested and replayed. */
export function xpForDate(input: XpInput, iso: string): DayXp {
  let scheduled = 0;
  let completed = 0;

  // --- Tasks ---
  const doneTasks = input.tasks.filter(
    (t) => t.completed && (t.completedAt || '').startsWith(iso)
  ).length;
  const dueTasks = input.tasks.filter((t) => t.dueDate === iso).length;
  scheduled += dueTasks;
  completed += Math.min(doneTasks, dueTasks);
  const tasks = Math.min(doneTasks * XP.taskCompleted, XP.taskDailyCap);

  // --- Habits ---
  const dueHabits = input.habits.filter(
    (h) => h.status === 'active' && isScheduledOn(h, iso)
  );
  const metHabits = dueHabits.filter(
    (h) => valueOn(input.habitLogs, h.id, iso) >= Math.max(1, h.targetValue || 1)
  ).length;
  scheduled += dueHabits.length;
  completed += metHabits;
  const habits = Math.min(metHabits * XP.habitMet, XP.habitDailyCap);

  // --- Routine ---
  const day = blocksForDate(input.routineBlocks, input.routineLogs, iso);
  const doneBlocks = day.filter((d) => d.state === 'done').length;
  scheduled += day.length;
  completed += doneBlocks;
  const routine = Math.min(doneBlocks * XP.routineBlockDone, XP.routineDailyCap);

  // --- Focus: per completed 25-minute block, so a 10-minute session that was
  //     abandoned earns nothing and a long session is still capped. ---
  const focusMinutes = Math.round(
    input.focusSessions
      .filter((s) => s.startedAt.startsWith(iso))
      .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0) / 60
  );
  const focus = Math.min(Math.floor(focusMinutes / 25) * XP.focusPerBlock, XP.focusDailyCap);

  // --- Sleep ---
  const sleep = input.sleepLogs.some((l) => l.date === iso) ? XP.sleepLogged : 0;

  // --- Perfect day: only meaningful if something was actually scheduled. ---
  const perfect = scheduled >= 3 && completed >= scheduled;
  const bonus = perfect ? XP.perfectDayBonus : 0;

  return {
    date: iso,
    tasks,
    habits,
    routine,
    focus,
    sleep,
    bonus,
    total: tasks + habits + routine + focus + sleep + bonus,
    perfect,
  };
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Total life XP across recorded history.
 *
 * Bounded by the earliest record rather than a fixed window, so it neither
 * caps out for long-term users nor wastes work on new ones.
 */
export function lifetimeXp(input: XpInput, today: string = todayISO()): number {
  let earliest = today;
  const consider = (iso?: string) => {
    if (!iso) return;
    const d = iso.slice(0, 10);
    if (d.length === 10 && d < earliest) earliest = d;
  };

  for (const t of input.tasks) consider(t.completedAt || t.createdAt);
  for (const s of input.focusSessions) consider(s.startedAt);
  for (const l of input.routineLogs) consider(l.date);
  for (const l of input.sleepLogs) consider(l.date);
  for (const l of input.habitLogs) consider(l.date);

  const a = Date.parse(`${earliest}T00:00:00`);
  const b = Date.parse(`${today}T00:00:00`);
  const span = Number.isFinite(a) && Number.isFinite(b)
    ? Math.min(400, Math.max(0, Math.round((b - a) / 86400000)) + 1)
    : 1;

  let total = 0;
  for (let i = 0; i < span; i++) {
    total += xpForDate(input, shift(today, -i)).total;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/**
 * Level thresholds grow steadily rather than exponentially. A curve that
 * doubles each level makes late levels unreachable and the whole system stops
 * meaning anything after a few weeks.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // 120, 300, 540, 840, ... — each level costs 60 XP more than the last.
  return 30 * (level - 1) * (level + 2);
}

export interface LevelInfo {
  level: number;
  currentXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** 0-1 progress through the current level. */
  progress: number;
  xpToNext: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  while (level < 200 && totalXp >= xpForLevel(level + 1)) level++;

  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelStartXp);

  return {
    level,
    currentXp: totalXp,
    levelStartXp,
    nextLevelXp,
    progress: Math.max(0, Math.min(1, (totalXp - levelStartXp) / span)),
    xpToNext: Math.max(0, nextLevelXp - totalXp),
  };
}

/** Combined career XP: training and games plus everything else the user does. */
export function careerXp(profile: UserProfile, input: XpInput, today: string = todayISO()): number {
  const training = Object.values(profile.modules || {}).reduce(
    (sum: number, m: any) => sum + (m.totalXp || 0),
    0
  );
  return training + (profile.gamesXp || 0) + lifetimeXp(input, today);
}
