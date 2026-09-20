import React, { useEffect, useMemo, useState , useRef} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X, CalendarDays, Target, Repeat, Plus, Flame, Check, Archive, AlertTriangle, Pencil, Minus, ChevronDown } from 'lucide-react';
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
import {
  describeCadence,
  describeTarget,
  groupHabitsForDay,
  habitStats,
  isScheduledOn,
  nextScheduledDate,
  shiftISO,
  valueOn,
} from '../lib/habits';
import { HabitRing } from './HabitRing';
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

/** "tomorrow" / "Fri" — for saying when an out-of-scope habit comes round. */
function prettyDay(iso: string, today: string): string {
  if (iso === shiftISO(today, 1)) return 'tomorrow';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

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
  /** Habits scheduled for another day, kept collapsed. */
  const [showOtherDays, setShowOtherDays] = useState(false);
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

  /** What today actually asks for, split from what it does not. */
  const habitGroups = useMemo(
    () => groupHabitsForDay(habits, logs, today),
    [habits, logs, today]
  );
  const otherDayHabits = useMemo(
    () => habitGroups.find((g) => g.id === 'other')?.habits ?? [],
    [habitGroups]
  );

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
  /**
   * A habit as a check-in row.
   *
   * Deliberately plain: the name, what today asks for, and one tick. A habit
   * list is read as "what did I do and what didn't I" — rings, week dots and
   * progress bars on every row turned that glance into a dashboard. All of
   * that still exists, one tap away, where there is room for it.
   */
  const HabitRow: React.FC<{ habit: Habit; muted?: boolean }> = ({ habit, muted = false }) => {
    const stats = habitStats(habit, logs, today);
    const counted = habit.metric !== 'yes_no';
    const step = habit.metric === 'duration' ? 10 : 1;
    const upcoming = muted ? nextScheduledDate(habit, today) : null;

    return (
      <div className="habit-strip" data-done={stats.completedToday ? 'true' : 'false'}>
        <div className="flex items-start gap-2.5 px-2.5 py-2.5">
          <button
            onClick={() => {
              soundFx.playClick();
              setHistoryHabit(habit);
            }}
            aria-label={`${habit.title} history`}
            className="task-icon mt-[1px]"
            data-done={stats.completedToday ? 'true' : 'false'}
          >
            <Repeat className="w-[15px] h-[15px] shrink-0" />
          </button>

          <div className="flex-1 min-w-0">
            <button
              onClick={() => {
                soundFx.playClick();
                setHistoryHabit(habit);
              }}
              className="block w-full text-left"
            >
              <span className="task-name" data-done={stats.completedToday ? 'true' : 'false'}>
                {habit.title}
              </span>
            </button>

            <div className="task-meta">
              {counted && (
                <span className="task-meta-item">
                  {stats.todayValue}/{describeTarget(habit)}
                </span>
              )}

              {stats.currentStreak > 0 && (
                <span className="task-meta-item" data-tone="warn">
                  <Flame className="w-[13px] h-[13px] shrink-0" />
                  {stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}
                </span>
              )}

              {upcoming ? (
                <span className="task-meta-item">
                  <CalendarDays className="w-[13px] h-[13px] shrink-0" />
                  Next {prettyDay(upcoming, today)}
                </span>
              ) : (
                <span className="task-meta-item">{describeCadence(habit)}</span>
              )}
            </div>
          </div>

          {/* One tick, the same one the task list uses. Tapping a counted
              habit adds a step; tapping a finished one clears the day. */}
          <button
            onClick={() => {
              if (stats.completedToday) record(habit, 0);
              else record(habit, counted ? stats.todayValue + step : stats.target);
            }}
            aria-label={
              stats.completedToday
                ? `${habit.title}: mark not done`
                : counted
                  ? `${habit.title}: add ${step}`
                  : `${habit.title}: mark done`
            }
            aria-pressed={stats.completedToday}
            className="task-check"
          >
            <span
              className="task-check-mark"
              data-state={stats.completedToday ? 'done' : 'open'}
            >
              {stats.completedToday && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
            </span>
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
        className="w-full text-left rounded-xl eb-card p-4"
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
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
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
            goal={goals.find((g) => g.id === detailGoal.id) || detailGoal}
            percent={
              goalProgress(
                goals.find((g) => g.id === detailGoal.id) || detailGoal,
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
            onToggleMilestone={(msId) =>
              toggleMilestone(goals.find((g) => g.id === detailGoal.id) || detailGoal, msId)
            }
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
          {/* Today, in full: the ring, the week, and the controls for
              counted habits. All of this used to be on every row. */}
          {(() => {
            const habit = historyHabit;
            const stats = habitStats(habit, logs, today);
            const target = Math.max(1, stats.target);
            const counted = habit.metric !== 'yes_no';
            const step = habit.metric === 'duration' ? 10 : 1;

            const week: { iso: string; value: number; due: boolean; today: boolean }[] = [];
            for (let i = 6; i >= 0; i--) {
              const iso = shiftISO(today, -i);
              week.push({
                iso,
                value: valueOn(logs, habit.id, iso),
                due: isScheduledOn(habit, iso),
                today: i === 0,
              });
            }

            return (
              <div className="habit-detail">
                <div className="flex items-center gap-4">
                  <HabitRing
                    size={72}
                    progress={Math.min(1, stats.todayValue / target)}
                    done={stats.completedToday}
                    value={stats.todayValue}
                    showValue={counted}
                    label={stats.completedToday ? 'Mark not done' : 'Mark done'}
                    onClick={() => {
                      if (stats.completedToday) record(habit, 0);
                      else record(habit, counted ? stats.todayValue + step : stats.target);
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="eb-label">Today</p>
                    <p className="t-section mt-0.5">
                      {counted
                        ? `${stats.todayValue} of ${describeTarget(habit)}`
                        : stats.completedToday
                          ? 'Done'
                          : 'Not yet'}
                    </p>

                    {counted && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => record(habit, Math.max(0, stats.todayValue - step))}
                          disabled={stats.todayValue <= 0}
                          aria-label={`Remove ${step}`}
                          className="step-btn"
                        >
                          <Minus className="w-4 h-4 shrink-0" />
                        </button>
                        <button
                          onClick={() => record(habit, stats.todayValue + step)}
                          aria-label={`Add ${step}`}
                          className="step-btn"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* The last seven days. Filled means met, hollow means it was
                    due and missed, faint means it was never scheduled. */}
                <div className="habit-week-row">
                  {week.map((d) => (
                    <div key={d.iso} className="habit-week-cell">
                      <span className="habit-week-label">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(`${d.iso}T00:00:00`).getDay()]}
                      </span>
                      <span
                        className="habit-week-dot"
                        data-state={
                          d.value >= target
                            ? 'met'
                            : !d.due
                              ? 'off'
                              : d.today
                                ? 'today'
                                : 'missed'
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="habit-stat-row">
                  <div>
                    <span className="eb-label block">Streak</span>
                    <span className="t-figure block mt-1" style={{ fontSize: 20 }}>
                      {stats.currentStreak}
                    </span>
                  </div>
                  <div>
                    <span className="eb-label block">Best</span>
                    <span className="t-figure block mt-1" style={{ fontSize: 20 }}>
                      {stats.bestStreak}
                    </span>
                  </div>
                  <div>
                    <span className="eb-label block">Done</span>
                    <span className="t-figure block mt-1" style={{ fontSize: 20 }}>
                      {stats.completionRate}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <HabitHistory habit={historyHabit} logs={logs} />

          {/* The actions that used to sit on every row. One habit at a time,
              where there is room to label them. */}
          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => {
                soundFx.playClick();
                setEditingHabit(historyHabit);
                setHistoryHabit(null);
                setHabitComposerOpen(true);
              }}
              className="btn-quiet flex-1"
            >
              <Pencil className="w-4 h-4 shrink-0 inline mr-1.5" />
              Edit
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                patchHabit(userId, historyHabit.id, {
                  status: historyHabit.status === 'active' ? 'archived' : 'active',
                });
                setHabits((prev) =>
                  prev.map((x) =>
                    x.id === historyHabit.id
                      ? { ...x, status: x.status === 'active' ? 'archived' : 'active' }
                      : x
                  )
                );
                setHistoryHabit(null);
              }}
              className="btn-quiet flex-1"
            >
              <Archive className="w-4 h-4 shrink-0 inline mr-1.5" />
              {historyHabit.status === 'active' ? 'Archive' : 'Restore'}
            </button>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              const habit = historyHabit;
              setHistoryHabit(null);
              deleteHabitForever(habit);
            }}
            className="btn-quiet w-full mt-2"
            style={{ color: 'var(--danger, #FF6B7E)' }}
          >
            <Trash2 className="w-4 h-4 shrink-0 inline mr-1.5" />
            Delete habit
          </button>

          <button onClick={() => setHistoryHabit(null)} className="btn-lg w-full mt-4">
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
            <div className="space-y-5">
              {habitGroups
                .filter((g) => g.id !== 'other')
                .map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-baseline gap-2 px-0.5">
                      <span className="eb-label">{group.label}</span>
                      <span className="t-meta" style={{ fontSize: 11 }}>
                        {group.habits.length}
                      </span>
                      <span className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
                    </div>

                    {group.habits.map((h) => (
                      <HabitRow key={h.id} habit={h} />
                    ))}
                  </div>
                ))}

              {/* Everything today does not ask for. Out of the way by
                  default: a habit set for Saturday sitting among Monday's
                  work reads as something you have failed to do. */}
              {otherDayHabits.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setShowOtherDays((v) => !v);
                    }}
                    className="sort-pill"
                    aria-expanded={showOtherDays}
                  >
                    <ChevronDown
                      className="w-3.5 h-3.5 shrink-0 transition-transform"
                      style={{ transform: showOtherDays ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    />
                    Other days
                    <span style={{ opacity: 0.6 }}>{otherDayHabits.length}</span>
                  </button>

                  {showOtherDays &&
                    otherDayHabits.map((h) => <HabitRow key={h.id} habit={h} muted />)}
                </div>
              )}

              {/* Nothing due, but habits exist: say so rather than showing
                  an empty screen that looks broken. */}
              {habitGroups.every((g) => g.id === 'other') && (
                <div
                  className="text-center py-8 px-6 rounded-xl"
                  style={{ border: '1px dashed var(--rule)' }}
                >
                  <p className="t-section">Nothing due today.</p>
                  <p className="t-meta mt-1.5">
                    Your habits are scheduled for other days. A rest day is part of the plan.
                  </p>
                </div>
              )}
            </div>
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
