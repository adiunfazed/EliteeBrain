import React, { useEffect, useMemo, useState , useRef} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CalendarDays, Target, Repeat,
  Plus,
  Flame,
  Check,
  Archive,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import type { Goal, Habit, HabitLog, Milestone, Task } from '../types';
import {
  newGoal,
  newHabit,
  patchGoal,
  patchHabit,
  removeHabit,
  saveGoal,
  saveHabit,
  setHabitValue,
  subscribeGoals,
  subscribeHabitLogs,
  subscribeHabits,
} from '../lib/goalStore';
import { describeCadence, describeTarget, habitStats } from '../lib/habits';
import {
  daysRemaining,
  goalProgress,
  overcommitmentWarning,
} from '../lib/goalSystem';
import { todayISO, newTaskId } from '../lib/tasks';
import { GoalHistoryChart } from './GoalHistoryChart';
import { snapshotGoal, subscribeGoalSnapshots } from '../lib/goalStore';
import { soundFx } from '../utils/audio';
import { offerUndo } from '../lib/undo';
import { EmptyState } from './EmptyState';
import { ComposerSheet } from './ComposerSheet';
import { HabitComposer } from './HabitComposer';
import { HabitHistory } from './HabitHistory';
import { GoalDetail } from './GoalDetail';
import { AddButton } from './AddButton';

interface Props {
  userId: string | null;
  /** Which view to render. Controlled by the Plan tab bar. */
  pane?: Pane;
  tasks?: Task[];
  routineBlocks?: any[];
  routineLogs?: any[];
  onStartFocus?: (title: string, minutes: number, habitId: string) => void;
}

type Pane = 'goals' | 'habits';

export const GoalsSection: React.FC<Props> = ({ userId, pane: controlledPane, tasks = [], routineBlocks = [], routineLogs = [], onStartFocus }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [, setSnapshots] = useState<any[]>([]);
  const pane: Pane = controlledPane ?? 'goals';
  const [goalDraft, setGoalDraft] = useState('');
  const goalInputRef = useRef<HTMLInputElement>(null);
  const [goalComposerOpen, setGoalComposerOpen] = useState(false);
  const [habitComposerOpen, setHabitComposerOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [goalDeadline, setGoalDeadline] = useState<string | undefined>();
  const [goalMilestones, setGoalMilestones] = useState<Milestone[]>([]);
  const habitInputRef = useRef<HTMLInputElement>(null);
  const [habitDraft, setHabitDraft] = useState('');
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openGoalActions, setOpenGoalActions] = useState<Record<string, boolean>>({});
  const [showArchivedGoals, setShowArchivedGoals] = useState(false);

  useEffect(() => subscribeGoals(userId, setGoals), [userId]);
  useEffect(() => subscribeHabits(userId, setHabits), [userId]);
  useEffect(() => subscribeHabitLogs(userId, setLogs), [userId]);
  useEffect(() => subscribeGoalSnapshots(userId, setSnapshots), [userId]);

  const today = todayISO();
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const archivedGoals = useMemo(() => goals.filter((g) => g.status === 'archived'), [goals]);
  const activeHabits = useMemo(
    () => habits.filter((h) => (showArchived ? true : h.status === 'active')),
    [habits, showArchived]
  );
  const todaysHabits = useMemo(
    () => habits.filter((h) => h.status === 'active'),
    [habits]
  );
  const warning = useMemo(() => overcommitmentWarning(habits, today), [habits, today]);

  /* ---------------- actions ---------------- */

  // Record where each active goal stands today so the history graph has points
  // to draw. snapshotGoal skips the write when the value is unchanged.
  useEffect(() => {
    if (goals.length === 0) return;
    for (const g of goals.filter((x) => x.status === 'active')) {
      const p = goalProgress(g, habits, logs, today, tasks, routineBlocks, routineLogs);
      snapshotGoal(userId, g.id, today, p.percent).catch((e) =>
        console.warn('Goal snapshot notice:', e)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, habits, logs, tasks, today, userId]);

  const addGoal = async () => {
    const title = goalDraft.trim();
    if (!title) return;
    const g = newGoal(title);
    if (goalDeadline) g.deadline = goalDeadline;
    // Blank rows are noise, so only milestones with a title are kept.
    const filled = goalMilestones.filter((m) => m.title.trim());
    if (filled.length > 0) g.milestones = filled;
    setGoals((prev) => [g, ...prev]);
    setGoalDraft('');
    setGoalDeadline(undefined);
    setGoalMilestones([]);
    setGoalComposerOpen(false);
    soundFx.playClick();
    try {
      await saveGoal(userId, g);
    } catch (e) {
      console.error('Could not save goal:', e);
      setGoals((prev) => prev.filter((x) => x.id !== g.id));
    }
  };

  const addHabit = async () => {
    const title = habitDraft.trim();
    if (!title) return;

    const h = newHabit(title);
    h.cadence = draftCadence;
    if (draftCadence === 'selected_days' && draftDays.length > 0) h.weekdays = [...draftDays].sort();
    if (draftTarget > 1) {
      h.metric = 'count';
      h.targetValue = draftTarget;
    }
    if (draftGoalId) h.goalId = draftGoalId;

    setHabits((prev) => [h, ...prev]);
    setHabitDraft('');
    setHabitComposerOpen(false);
    // Reset the composer so the next habit starts from defaults rather than
    // silently inheriting the last one's settings.
    setDraftCadence('daily');
    setDraftDays([]);
    setDraftTarget(1);
    setDraftGoalId(undefined);
    setShowHabitOptions(false);
    soundFx.playClick();
    try {
      await saveHabit(userId, h);
    } catch (e) {
      console.error('Could not save habit:', e);
      setHabits((prev) => prev.filter((x) => x.id !== h.id));
    }
  };

  /** Write an absolute value for today. Overwrites, so nothing double-counts. */
  const record = async (habit: Habit, value: number) => {
    const next = Math.max(0, value);
    const stats = habitStats(habit, logs, today);
    if (next >= stats.target && stats.todayValue < stats.target) soundFx.playSuccess();
    else soundFx.playClick();

    setLogs((prev) => [
      { id: `${today}__${habit.id}`, habitId: habit.id, date: today, value: next, updatedAt: '' },
      ...prev.filter((l) => !(l.habitId === habit.id && l.date === today)),
    ]);

    try {
      await setHabitValue(userId, habit.id, today, next);
    } catch (e) {
      console.error('Could not record habit:', e);
    }
  };

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [openMilestones, setOpenMilestones] = useState<Record<string, boolean>>({});
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editingGoalSettings, setEditingGoalSettings] = useState<string | null>(null);
  const [showHabitOptions, setShowHabitOptions] = useState(false);
  const [draftCadence, setDraftCadence] = useState<'daily' | 'weekly' | 'selected_days'>('daily');
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [draftTarget, setDraftTarget] = useState(1);
  const [draftGoalId, setDraftGoalId] = useState<string | undefined>();

  const commitHabitRename = async (habit: Habit) => {
    const title = editText.trim();
    setEditingHabitId(null);
    if (!title || title === habit.title) return;
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, title } : h)));
    try {
      await patchHabit(userId, habit.id, { title });
    } catch (e) {
      console.error('Could not rename habit:', e);
    }
  };

  const commitGoalRename = async (goal: Goal) => {
    const title = editText.trim();
    setEditingGoalId(null);
    if (!title || title === goal.title) return;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, title } : g)));
    try {
      await patchGoal(userId, goal.id, { title });
    } catch (e) {
      console.error('Could not rename goal:', e);
    }
  };

  /**
   * Deleting a habit destroys its streak history, which is the whole point of
   * tracking one — so it asks first. Archiving stays the gentle default.
   */
  const deleteHabitForever = async (habit: Habit) => {
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    try {
      await removeHabit(userId, habit.id);
      offerUndo('Habit deleted', async () => {
        setHabits((prev) => [habit, ...prev]);
        await saveHabit(userId, habit);
      });
    } catch (e) {
      console.error('Could not delete habit:', e);
      // Restore: the delete failed, so the list must not claim otherwise.
      setHabits((prev) => [habit, ...prev]);
    }
  };

  const toggleMilestone = async (goal: Goal, msId: string) => {
    const ms = (goal.milestones || []).map((m) =>
      m.id === msId
        ? { ...m, done: !m.done, completedAt: !m.done ? new Date().toISOString() : undefined }
        : m
    );
    soundFx.playClick();
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, milestones: ms } : g)));
    try {
      await patchGoal(userId, goal.id, { milestones: ms });
    } catch (e) {
      console.error('Could not update milestone:', e);
    }
  };

  const addMilestone = async (goal: Goal, title: string) => {
    const t = title.trim();
    if (!t) return;
    const ms = [...(goal.milestones || []), { id: newTaskId(), title: t, done: false }];
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, milestones: ms } : g)));
    try {
      await patchGoal(userId, goal.id, { milestones: ms });
    } catch (e) {
      console.error('Could not add milestone:', e);
    }
  };

  /* ---------------- pieces ---------------- */

  /**
   * A habit as a compact card.
   *
   * Name and category on the top row, frequency under it, then seven day
   * marks in a single grid row, then streak and actions. Editing, day
   * selection and history live in their own sheets — inlining all of that is
   * what made this four hundred lines and half a screen tall.
   */
  const HabitRow: React.FC<{ habit: Habit; compact?: boolean }> = ({ habit }) => {
    const stats = habitStats(habit, logs, today);
    const pct = Math.min(1, stats.todayValue / Math.max(1, stats.target));

    /** The last seven days, oldest first, so the row reads left to right. */
    const week = useMemo(() => {
      const out: { iso: string; label: string; value: number; due: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(`${today}T00:00:00`);
        d.setDate(d.getDate() - i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        const log = logs.find((l) => l.habitId === habit.id && l.date === iso);
        const due =
          habit.cadence === 'daily' ||
          habit.cadence === 'weekly' ||
          (habit.weekdays || []).includes(d.getDay());
        out.push({
          iso,
          label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
          value: log?.value || 0,
          due,
        });
      }
      return out;
    }, [habit, logs, today]);

    const target = Math.max(1, habit.targetValue || 1);

    return (
      <div className="rounded-2xl eb-card p-4">
        {/* Top row: name, then the completion control on the right. */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={`text-[15px] font-semibold leading-snug line-clamp-1 ${
                habit.status === 'archived' ? 'text-[var(--ink-dim)]' : ''
              }`}
            >
              {habit.title}
            </p>
            <p className="t-meta mt-0.5 truncate">
              {describeCadence(habit)}
              {habit.metric !== 'yes_no' ? ` · ${stats.todayValue}/${describeTarget(habit)}` : ''}
            </p>
          </div>

          {habit.metric === 'yes_no' ? (
            <button
              onClick={() => record(habit, stats.completedToday ? 0 : stats.target)}
              aria-label={stats.completedToday ? 'Mark not done' : 'Mark done'}
              className="shrink-0 w-10 h-10 flex items-center justify-center"
            >
              <span
                className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-all ${
                  stats.completedToday
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950 glow-done'
                    : 'border-[var(--rule-strong)]'
                }`}
              >
                {stats.completedToday && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => record(habit, Math.max(0, stats.todayValue - (habit.metric === 'duration' ? 10 : 1)))}
                aria-label="Less"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-sunk)', color: 'var(--ink-dim)' }}
              >
                −
              </button>
              <span className="t-figure text-[15px] w-8 text-center">{stats.todayValue}</span>
              <button
                onClick={() => record(habit, stats.todayValue + (habit.metric === 'duration' ? 10 : 1))}
                aria-label="More"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-sunk)', color: 'var(--ink-dim)' }}
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Seven days in one grid row. A grid cannot wrap, so these never
            stack vertically however narrow the screen gets. */}
        <div className="grid grid-cols-7 gap-1.5 mt-3.5">
          {week.map((d, i) => {
            const met = d.value >= target;
            const isToday = i === 6;
            // Today is still in progress, so an unfinished habit today is not
            // a miss — marking it red would be wrong and discouraging.
            const missed = !met && d.due && !isToday;

            return (
              <div key={d.iso} className="flex flex-col items-center gap-1 min-w-0">
                <span className="t-meta leading-none">{d.label}</span>
                <span
                  className={`w-full rounded-full ${
                    met ? 'glow-done' : isToday ? 'glow-today' : missed ? 'glow-missed' : ''
                  }`}
                  style={{
                    aspectRatio: '1 / 1',
                    maxWidth: 28,
                    background: met
                      ? 'var(--done)'
                      : missed
                        ? 'color-mix(in oklab, var(--danger) 55%, transparent)'
                        : d.due
                          ? 'var(--surface-sunk)'
                          : 'transparent',
                    border: isToday
                      ? '2px solid var(--signal)'
                      : d.due && !met && !missed
                        ? '1px solid var(--rule)'
                        : '1px solid transparent',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Progress for counted habits, where the number alone is not enough. */}
        {habit.metric !== 'yes_no' && (
          <div
            className="h-1 rounded-full overflow-hidden mt-3"
            style={{ background: 'var(--surface-sunk)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct * 100}%`, background: 'var(--done)' }}
            />
          </div>
        )}

        {/* Streak and actions on one line. */}
        <div className="flex items-center gap-2 mt-3">
          {stats.currentStreak > 0 && (
            <span className="t-meta flex items-center gap-1 min-w-0">
              <Flame className="w-3.5 h-3.5 shrink-0 eb-warn" />
              {stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}
            </span>
          )}

          <span className="flex-1" />

          <button
            onClick={() => {
              soundFx.playClick();
              setHistoryHabit(habit);
            }}
            aria-label="History"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: 'var(--ink-dim)' }}
          >
            <CalendarDays className="w-4 h-4 shrink-0" />
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setEditingHabit(habit);
              setHabitComposerOpen(true);
            }}
            aria-label="Edit habit"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: 'var(--ink-dim)' }}
          >
            <Pencil className="w-4 h-4 shrink-0" />
          </button>

          <button
            onClick={() =>
              patchHabit(userId, habit.id, {
                status: habit.status === 'active' ? 'archived' : 'active',
              })
            }
            aria-label={habit.status === 'active' ? 'Archive' : 'Restore'}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: 'var(--ink-dim)' }}
          >
            <Archive className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    );
  };

  /**
   * A goal as a compact progress card.
   *
   * Title, progress, deadline and a way in. The milestone list, linked work
   * and settings all live in the detail sheet, which is what keeps this a
   * card you can scan rather than a screen you have to read.
   */
  const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
    const progress = goalProgress(goal, habits, logs, today, tasks, routineBlocks, routineLogs);
    const left = daysRemaining(goal.deadline, today);
    const milestones = goal.milestones || [];
    const doneMilestones = milestones.filter((m) => m.done).length;

    return (
      <button
        onClick={() => {
          soundFx.playClick();
          setDetailGoal(goal);
        }}
        className="w-full text-left rounded-2xl eb-card p-4"
      >
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--signal) 16%, transparent)' }}
          >
            <Target className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug line-clamp-1">{goal.title}</p>
            <p className="t-meta mt-0.5 truncate">
              {milestones.length > 0
                ? `${doneMilestones}/${milestones.length} milestones`
                : 'No milestones yet'}
              {left !== null
                ? left > 0
                  ? ` · ${left} days left`
                  : left === 0
                    ? ' · due today'
                    : ` · ${Math.abs(left)} days over`
                : ''}
            </p>
          </div>

          <span
            className="t-figure shrink-0"
            style={{ fontSize: 20, color: 'var(--signal-ink)' }}
          >
            {progress.percent}%
          </span>
        </div>

        <div
          className="h-1.5 rounded-full overflow-hidden mt-3"
          style={{ background: 'var(--surface-sunk)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${progress.percent}%`,
              background: progress.percent >= 100 ? 'var(--done)' : 'var(--signal)',
            }}
          />
        </div>
      </button>
    );
  };

  /* ---------------- render ---------------- */

  const topGoal = activeGoals[0];

  return (
    <div className="space-y-4">
      {warning && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 eb-warn shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">{warning}</p>
        </div>
      )}

      {/* ---- GOALS ---- */}
      {pane === 'goals' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="t-title">Goals</h1>
            {activeGoals.length > 0 && (
              <span className="t-meta shrink-0">
                {activeGoals.length} active
              </span>
            )}
          </div>

          <AddButton label="Add goal" onClick={() => setGoalComposerOpen(true)} />

          <ComposerSheet
            open={goalComposerOpen}
            title="New goal"
            onClose={() => setGoalComposerOpen(false)}
          >
            <input
              ref={goalInputRef}
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
              placeholder="What are you working toward?"
              maxLength={120}
              className="w-full rounded-xl px-4 py-3.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
              style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
            />
            <p className="t-sub mt-2.5 leading-snug">
              Something you are working toward over weeks. Break it into milestones afterwards.
            </p>

            <p className="eb-label mt-5 mb-2">Milestones</p>
            <p className="t-sub mb-3 leading-snug">
              The steps that make this goal done. Progress is measured against these.
            </p>

            <div className="space-y-1.5">
              {goalMilestones.map((ms, i) => (
                <div key={ms.id} className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center t-meta"
                    style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                  >
                    {i + 1}
                  </span>

                  <input
                    value={ms.title}
                    onChange={(e) =>
                      setGoalMilestones((prev) =>
                        prev.map((x) => (x.id === ms.id ? { ...x, title: e.target.value } : x))
                      )
                    }
                    placeholder={`Milestone ${i + 1}`}
                    maxLength={100}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none"
                    style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                  />

                  <button
                    onClick={() =>
                      setGoalMilestones((prev) => prev.filter((x) => x.id !== ms.id))
                    }
                    aria-label="Remove milestone"
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ color: 'var(--ink-dim)' }}
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setGoalMilestones((prev) => [
                  ...prev,
                  { id: `ms_${Date.now()}_${prev.length}`, title: '', done: false },
                ])
              }
              className="btn-text mt-2 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Add a milestone
            </button>

            <p className="eb-label mt-5 mb-2">Deadline</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'No deadline', days: null },
                { label: '1 month', days: 30 },
                { label: '3 months', days: 90 },
                { label: '6 months', days: 180 },
              ].map((option) => {
                const value =
                  option.days === null
                    ? undefined
                    : (() => {
                        const d = new Date();
                        d.setDate(d.getDate() + option.days);
                        return d.toISOString().slice(0, 10);
                      })();

                return (
                  <button
                    key={option.label}
                    onClick={() => setGoalDeadline(value)}
                    className="chip"
                    data-active={
                      option.days === null ? !goalDeadline : goalDeadline === value
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <button onClick={addGoal} disabled={!goalDraft.trim()} className="btn-lg w-full mt-6">
              <Plus className="w-4 h-4 shrink-0" />
              Add goal
            </button>
          </ComposerSheet>

          {activeGoals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              body="A goal is something you are working toward over weeks. Break it into milestones and link habits to it."
              actionLabel="Add a goal"
              onAction={() => goalInputRef.current?.focus()}
              hint="For example: Clear my exam · Get properly fit · Ship my project"
            />
          ) : (
            activeGoals.map((g) => <GoalCard key={g.id} goal={g} />)
          )}

          {/* Archived goals. Hidden until asked for, but reachable — an
              archive with no way out is just a delete with extra steps. */}
          {archivedGoals.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowArchivedGoals((v) => !v)}
                className="btn-text flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5 shrink-0" />
                {showArchivedGoals
                  ? 'Hide archived'
                  : `Archived (${archivedGoals.length})`}
              </button>

              {showArchivedGoals && (
                <div className="space-y-2 mt-3">
                  {archivedGoals.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
                    >
                      <span className="text-[14px] min-w-0 flex-1 truncate text-[var(--ink-dim)]">
                        {g.title}
                      </span>

                      <button
                        onClick={() => {
                          soundFx.playClick();
                          patchGoal(userId, g.id, { status: 'active' });
                          setGoals((prev) =>
                            prev.map((x) =>
                              x.id === g.id ? { ...x, status: 'active' as const } : x
                            )
                          );
                        }}
                        className="chip shrink-0"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- HABITS ---- */}
      {detailGoal && (
        <ComposerSheet
          open={!!detailGoal}
          title={detailGoal.title}
          onClose={() => setDetailGoal(null)}
        >
          <GoalDetail
            goal={detailGoal}
            percent={
              goalProgress(
                detailGoal,
                habits,
                logs,
                today,
                tasks,
                routineBlocks,
                routineLogs
              ).percent
            }
            tasks={tasks}
            habits={habits}
            blocks={routineBlocks}
            onToggleMilestone={(msId) => toggleMilestone(detailGoal, msId)}
          />
          <button onClick={() => setDetailGoal(null)} className="btn-quiet w-full mt-6">
            Close
          </button>
        </ComposerSheet>
      )}

      {historyHabit && (
        <ComposerSheet
          open={!!historyHabit}
          title={historyHabit.title}
          onClose={() => setHistoryHabit(null)}
        >
          <HabitHistory habit={historyHabit} logs={logs} />
          <button onClick={() => setHistoryHabit(null)} className="btn-quiet w-full mt-6">
            Close
          </button>
        </ComposerSheet>
      )}

      {pane === 'habits' && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="t-title">Habits</h1>
            {activeHabits.length > 0 && (
              <span className="t-meta shrink-0">
                {activeHabits.filter((h) => habitStats(h, logs, today).completedToday).length}/
                {activeHabits.length} done today
              </span>
            )}
          </div>

          <AddButton label="Add habit" onClick={() => setHabitComposerOpen(true)} />

          <ComposerSheet
            open={habitComposerOpen}
            title={editingHabit ? 'Edit habit' : 'New habit'}
            onClose={() => {
              setHabitComposerOpen(false);
              setEditingHabit(null);
            }}
          >
            <HabitComposer
              habit={editingHabit}
              goals={goals.map((g) => ({ id: g.id, title: g.title }))}
              onCancel={() => {
                setHabitComposerOpen(false);
                setEditingHabit(null);
              }}
              onSave={async (fields) => {
                if (editingHabit) {
                  const updated = {
                    ...editingHabit,
                    ...fields,
                    updatedAt: new Date().toISOString(),
                  };
                  setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
                  await saveHabit(userId, updated);
                } else {
                  const habit = newHabit(fields.title);
                  Object.assign(habit, fields);
                  setHabits((prev) => [habit, ...prev]);
                  await saveHabit(userId, habit);
                }
                setHabitComposerOpen(false);
                setEditingHabit(null);
              }}
            />
          </ComposerSheet>


          {activeHabits.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No habits yet"
              body="Habits repeat on a schedule and build streaks. Start with one — consistency beats volume."
              actionLabel="Add a habit"
              onAction={() => habitInputRef.current?.focus()}
              hint="For example: Read 10 pages · Train · In bed by 11"
            />
          ) : (
            activeHabits.map((h) => <HabitRow key={h.id} habit={h} />)
          )}

          {habits.some((h) => h.status === 'archived') && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="t-meta hover:text-[var(--ink-muted)]"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          )}
        </div>
      )}

      {!userId && (
        <p className="t-meta text-center">
          Signed out — goals and habits stay on this device until you sign in.
        </p>
      )}
    </div>
  );
};
