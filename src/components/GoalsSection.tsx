import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Target,
  Flame,
  Check,
  Timer,
  Archive,
  X,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Pencil,
  Trash2,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import type { Goal, Habit, HabitLog, Task } from '../types';
import {
  archiveHabit,
  newGoal,
  newHabit,
  patchGoal,
  patchHabit,
  removeHabit,
  removeGoal,
  saveGoal,
  saveHabit,
  setHabitValue,
  subscribeGoals,
  subscribeHabitLogs,
  subscribeHabits,
} from '../lib/goalStore';
import { describeCadence, describeTarget, habitInsight, habitStats } from '../lib/habits';
import {
  GOAL_HEALTH_STYLE,
  daysRemaining,
  goalHealth,
  goalProgress,
  overcommitmentWarning,
} from '../lib/goalSystem';
import { todayISO, newTaskId } from '../lib/tasks';
import { GoalHistoryChart } from './GoalHistoryChart';
import { snapshotGoal, snapshotsFor, subscribeGoalSnapshots } from '../lib/goalStore';
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  tasks?: Task[];
  routineBlocks?: any[];
  routineLogs?: any[];
  onStartFocus?: (title: string, minutes: number, habitId: string) => void;
}

type Pane = 'goals' | 'habits';

export const GoalsSection: React.FC<Props> = ({ userId, tasks = [], routineBlocks = [], routineLogs = [], onStartFocus }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [pane, setPane] = useState<Pane>('goals');
  const [goalDraft, setGoalDraft] = useState('');
  const [habitDraft, setHabitDraft] = useState('');
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => subscribeGoals(userId, setGoals), [userId]);
  useEffect(() => subscribeHabits(userId, setHabits), [userId]);
  useEffect(() => subscribeHabitLogs(userId, setLogs), [userId]);
  useEffect(() => subscribeGoalSnapshots(userId, setSnapshots), [userId]);

  const today = todayISO();
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
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
    setGoals((prev) => [g, ...prev]);
    setGoalDraft('');
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
    if (!window.confirm(`Delete "${habit.title}" and its entire history? Archiving keeps the record instead.`)) return;
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    try {
      await removeHabit(userId, habit.id);
    } catch (e) {
      console.error('Could not delete habit:', e);
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

  const HabitRow: React.FC<{ habit: Habit; compact?: boolean }> = ({ habit, compact }) => {
    const stats = habitStats(habit, logs, today);
    const pct = Math.min(1, stats.todayValue / stats.target);
    const step = habit.metric === 'duration' ? 10 : 1;
    const [msDraft, setMsDraft] = useState('');

    return (
      <div
        className={`rounded-2xl border transition-colors ${
          stats.completedToday
            ? 'bg-emerald-500/[0.07] border-emerald-500/25'
            : 'bg-[#0E1116] border-[#2A313C]'
        }`}
      >
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {editingHabitId === habit.id ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => commitHabitRename(habit)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitHabitRename(habit);
                      if (e.key === 'Escape') setEditingHabitId(null);
                    }}
                    className="bg-[#171B22] border border-[#8B5CF6]/60 rounded-lg px-2 py-1 text-sm text-[#F4F6F8] outline-none min-w-0 flex-1"
                  />
                ) : (
                  <span
                    className={`text-sm font-bold break-words ${
                      stats.completedToday ? 'eb-done' : 'text-[#F4F6F8]'
                    }`}
                  >
                    {habit.title}
                  </span>
                )}
                {stats.currentStreak > 1 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1 shrink-0">
                    <Flame className="w-2.5 h-2.5 shrink-0" />
                    {stats.currentStreak}
                  </span>
                )}
                {habit.status === 'archived' && (
                  <span className="text-[11px] font-mono text-[#7E8899]">Archived</span>
                )}
              </div>

              <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
                {habit.metric === 'yes_no'
                  ? describeCadence(habit)
                  : `${stats.todayValue} / ${describeTarget(habit)} · ${describeCadence(habit)}`}
                {!stats.scheduledToday && ' · not scheduled today'}
              </p>
            </div>

            {habit.metric === 'yes_no' ? (
              <button
                onClick={() => record(habit, stats.completedToday ? 0 : stats.target)}
                aria-label={stats.completedToday ? 'Mark not done' : 'Mark done'}
                className="shrink-0 w-11 h-11 flex items-center justify-center"
              >
                <span
                  className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${
                    stats.completedToday
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'border-[#3A424F] hover:border-emerald-500/60'
                  }`}
                >
                  <AnimatePresence>
                    {stats.completedToday && (
                      <motion.span
                        initial={{ scale: 0, rotate: -25 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      >
                        <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            ) : (
              <div className="relative w-12 h-12 shrink-0">
                <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#171B22" strokeWidth="4" />
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="17"
                    fill="none"
                    stroke={stats.completedToday ? '#10B981' : '#8B5CF6'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 17}
                    initial={false}
                    animate={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - pct) }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-black text-[#F4F6F8] tabular-nums">
                  {Math.round(pct * 100)}%
                </span>
              </div>
            )}
          </div>

          {editingSchedule === habit.id && (
            <div className="mt-3 p-3 rounded-xl eb-card-sunk space-y-3">
              <div>
                <p className="eb-label mb-1.5">How often</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { id: 'daily' as const, label: 'Every day' },
                    { id: 'weekly' as const, label: 'Weekly' },
                    { id: 'selected_days' as const, label: 'Chosen days' },
                  ]).map(({ id: c, label }) => (
                    <button
                      key={c}
                      onClick={() => patchHabit(userId, habit.id, { cadence: c })}
                      className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                        habit.cadence === c ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {habit.cadence === 'selected_days' && (
                <div>
                  <p className="eb-label mb-1.5">On these days</p>
                  <div className="flex items-center gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
                      const on = (habit.weekdays || []).includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const cur = habit.weekdays || [];
                            const next = on ? cur.filter((x) => x !== i) : [...cur, i].sort();
                            patchHabit(userId, habit.id, { weekdays: next });
                          }}
                          className={`eb-press flex-1 h-9 rounded-lg text-[10px] font-mono font-bold border ${
                            on ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38]'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {habit.metric !== 'yes_no' && (
                <div>
                  <p className="eb-label mb-1.5">Daily target</p>
                  <input
                    type="number"
                    min={1}
                    defaultValue={habit.targetValue || 1}
                    onBlur={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      if (v !== habit.targetValue) patchHabit(userId, habit.id, { targetValue: v });
                    }}
                    className="w-24 bg-[#0E1116] border border-[#262C38] rounded-lg px-2.5 py-2 text-xs text-[#F2F4F7] outline-none"
                  />
                </div>
              )}

              {goals.filter((g) => g.status === 'active').length > 0 && (
                <div>
                  <p className="eb-label mb-1.5">Counts toward</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => patchHabit(userId, habit.id, { goalId: undefined })}
                      className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                        !habit.goalId ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38]'
                      }`}
                    >
                      Nothing
                    </button>
                    {goals
                      .filter((g) => g.status === 'active')
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() =>
                            patchHabit(userId, habit.id, {
                              goalId: habit.goalId === g.id ? undefined : g.id,
                            })
                          }
                          className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border max-w-full truncate ${
                            habit.goalId === g.id ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38]'
                          }`}
                        >
                          {g.title}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <button
                onClick={() => record(habit, stats.todayValue + step)}
                className="text-[10px] font-mono font-bold px-3 py-2 rounded-xl bg-[#171B22] hover:bg-[#20252E] border border-[#2A313C] text-[#F4F6F8]"
              >
                +{step}
                {habit.metric === 'duration' ? ' min' : ''}
              </button>
              {stats.todayValue > 0 && (
                <button
                  onClick={() => record(habit, Math.max(0, stats.todayValue - step))}
                  className="text-[10px] font-mono font-bold px-3 py-2 rounded-xl bg-transparent border border-[#2A313C] text-[#7E8899] hover:text-[#98A2B3]"
                >
                  −{step}
                </button>
              )}
              {habit.metric === 'duration' && onStartFocus && (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onStartFocus(
                      habit.title,
                      Math.max(5, stats.target - stats.todayValue),
                      habit.id
                    );
                  }}
                  className="eb-press eb-glow-emerald eb-shine text-[10px] font-mono font-bold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 eb-done hover:bg-emerald-500/20 flex items-center gap-1.5"
                >
                  <Timer className="w-3 h-3 shrink-0" />
                  Start focus
                </button>
              )}
            </div>

          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <button
              onClick={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
              className="eb-press text-[10px] font-mono font-bold text-[#7E8899] hover:text-[#98A2B3] px-2 py-1.5"
            >
              {expandedHabit === habit.id ? '− Hide history' : '+ History'}
            </button>

            <button
              onClick={() => setEditingSchedule(editingSchedule === habit.id ? null : habit.id)}
              aria-label="Change schedule"
              title="Schedule and target"
              className="eb-press w-9 h-9 rounded-lg text-[#7E8899] hover:text-[#F2F4F7] hover:bg-[#171B22] flex items-center justify-center"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            </button>
            <button
              onClick={() => {
                setEditingHabitId(habit.id);
                setEditText(habit.title);
              }}
              aria-label="Rename habit"
              title="Rename"
              className="eb-press ml-auto w-9 h-9 rounded-lg text-[#7E8899] hover:text-[#F4F6F8] hover:bg-[#171B22] flex items-center justify-center"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
            </button>
            {habit.status === 'active' ? (
              <button
                onClick={() => archiveHabit(userId, habit.id)}
                aria-label="Archive habit"
                title="Archive (keeps history)"
                className="eb-press w-9 h-9 rounded-lg text-[#7E8899] hover:eb-warn hover:bg-[#171B22] flex items-center justify-center"
              >
                <Archive className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => patchHabit(userId, habit.id, { status: 'active' })}
                className="eb-press text-[10px] font-mono font-bold px-2.5 py-2 rounded-lg eb-done"
              >
                Restore
              </button>
            )}
            <button
              onClick={() => deleteHabitForever(habit)}
              aria-label="Delete habit"
              title="Delete permanently"
              className="eb-press w-9 h-9 rounded-lg text-[#7E8899] hover:eb-danger hover:bg-rose-500/10 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expandedHabit === habit.id && !compact && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Streak', value: stats.currentStreak },
                    { label: 'Best', value: stats.bestStreak },
                    { label: 'Done', value: stats.totalCompletions },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="eb-card-sunk p-2 text-center"
                    >
                      <p className="text-base font-black font-mono text-[#F4F6F8] tabular-nums leading-none">
                        {s.value}
                      </p>
                      <p className="text-[11px] font-mono text-[#7E8899] mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Heatmap — 12 weeks */}
                <div className="flex flex-wrap gap-[3px]">
                  {stats.history.map((h) => (
                    <span
                      key={h.date}
                      title={`${h.date}: ${h.value}`}
                      className={`w-[9px] h-[9px] rounded-[2px] ${
                        h.complete
                          ? 'bg-emerald-500'
                          : h.value > 0
                            ? 'bg-emerald-500/40'
                            : h.scheduled
                              ? 'bg-[#20252E]'
                              : 'bg-[#141820]'
                      }`}
                    />
                  ))}
                </div>

                {habitInsight(habit, stats) && (
                  <p className="text-[10px] font-mono text-[#98A2B3]">
                    {habitInsight(habit, stats)}
                  </p>
                )}


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
    const progress = goalProgress(goal, habits, logs, today, tasks, routineBlocks, routineLogs);
    const health = goalHealth(goal, progress, today);
    const left = daysRemaining(goal.deadline, today);
    const [msDraft, setMsDraft] = useState('');
    const linked = habits.filter((h) => h.goalId === goal.id);

    return (
      <div className="eb-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {editingGoalId === goal.id ? (
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => commitGoalRename(goal)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitGoalRename(goal);
                  if (e.key === 'Escape') setEditingGoalId(null);
                }}
                className="w-full bg-[#171B22] border border-[#8B5CF6]/60 rounded-lg px-2 py-1 text-sm text-[#F4F6F8] outline-none"
              />
            ) : (
              <h4 className="text-sm font-bold text-[#F4F6F8] break-words">{goal.title}</h4>
            )}
            <p className="text-[10px] font-mono text-[#98A2B3] mt-1">{progress.label}</p>
          </div>
          <span
            className={`text-[11px] font-mono font-bold px-2 py-1 rounded-full border shrink-0 ${GOAL_HEALTH_STYLE[health.health]}`}
          >
            {health.label}
          </span>
        </div>

        <div className="h-1.5 w-full bg-[#171B22] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              health.health === 'at_risk'
                ? 'bg-rose-500'
                : health.health === 'needs_attention'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            initial={false}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <p className="text-[10px] text-[#7E8899] leading-relaxed">{health.reason}</p>

        {left !== null && left >= 0 && (
          <p className="text-[10px] font-mono text-[#98A2B3]">
            {left} day{left === 1 ? '' : 's'} remaining
          </p>
        )}

        {/* Milestones — collapsed by default so a long list doesn't bury the
            rest of the goal card. */}
        {(goal.milestones || []).length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={() =>
                setOpenMilestones((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))
              }
              className="eb-press w-full flex items-center justify-between gap-2 py-1.5 text-left"
            >
              <span className="eb-label">
                Milestones{' '}
                <span className="normal-case tracking-normal text-[#8A93A5]">
                  {(goal.milestones || []).filter((m) => m.done).length} of{' '}
                  {(goal.milestones || []).length} done
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#8A93A5] shrink-0 transition-transform ${
                  openMilestones[goal.id] ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openMilestones[goal.id] &&
              (goal.milestones || []).map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMilestone(goal, m.id)}
                className="w-full flex items-center gap-2.5 text-left"
              >
                <span
                  className={`shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center ${
                    m.done
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'border-[#3A424F]'
                  }`}
                >
                  {m.done && <Check className="w-3 h-3 shrink-0 stroke-[3]" />}
                </span>
                <span
                  className={`text-xs min-w-0 break-words ${
                    m.done ? 'text-[#7E8899] line-through' : 'text-[#F4F6F8]'
                  }`}
                >
                  {m.title}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={msDraft}
            onChange={(e) => setMsDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addMilestone(goal, msDraft);
                setMsDraft('');
              }
            }}
            placeholder="Add a milestone"
            className="flex-1 min-w-0 eb-card-sunk focus:border-[#8B5CF6]/60 rounded-lg px-2.5 py-2 text-[11px] text-[#F4F6F8] placeholder:text-[#7E8899] outline-none"
          />
          <button
            onClick={() => {
              addMilestone(goal, msDraft);
              setMsDraft('');
            }}
            disabled={!msDraft.trim()}
            aria-label="Add milestone"
            className="shrink-0 w-10 h-10 rounded-lg eb-card-sunk disabled:opacity-40 text-[#F4F6F8] flex items-center justify-center"
          >
            <Plus className="w-4 h-4 shrink-0" />
          </button>
        </div>

        <GoalHistoryChart snapshots={snapshotsFor(snapshots, goal.id)} />

        {(() => {
          const blocks = routineBlocks.filter((b: any) => b.goalId === goal.id && b.active);
          const goalTasks = tasks.filter((t) => t.goalId === goal.id);
          const bits: string[] = [];
          if (linked.length) bits.push(`${linked.length} habit${linked.length === 1 ? '' : 's'}`);
          if (blocks.length) bits.push(`${blocks.length} routine block${blocks.length === 1 ? '' : 's'}`);
          if (goalTasks.length) bits.push(`${goalTasks.length} task${goalTasks.length === 1 ? '' : 's'}`);
          return bits.length > 0 ? (
            <p className="text-[10px] font-mono text-[#98A2B3] flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 shrink-0" />
              {bits.join(' · ')} feeding this goal
            </p>
          ) : (
            <p className="text-[10px] text-[#7E8899] leading-relaxed">
              Nothing linked yet. Attach a routine block, habit or task and this goal moves when
              you do the work.
            </p>
          );
        })()}

        {editingGoalSettings === goal.id && (
          <div className="p-3 rounded-xl eb-card-sunk space-y-3">
            <div>
              <p className="eb-label mb-1.5">Deadline</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  defaultValue={goal.deadline || ''}
                  onBlur={(e) =>
                    patchGoal(userId, goal.id, { deadline: e.target.value || undefined })
                  }
                  className="bg-[#0E1116] border border-[#262C38] rounded-lg px-2.5 py-2 text-xs text-[#F2F4F7] outline-none"
                />
                {goal.deadline && (
                  <button
                    onClick={() => patchGoal(userId, goal.id, { deadline: undefined })}
                    className="eb-press text-[10px] font-mono text-[#7E8899] hover:eb-danger"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>

            {(goal.metric === 'number' ||
              goal.metric === 'count' ||
              goal.metric === 'percentage') && (
              <div>
                <p className="eb-label mb-1.5">
                  Target{goal.unit ? ` (${goal.unit})` : ''}
                </p>
                <input
                  type="number"
                  min={1}
                  defaultValue={goal.targetValue || 1}
                  onBlur={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    if (v !== goal.targetValue) patchGoal(userId, goal.id, { targetValue: v });
                  }}
                  className="w-28 bg-[#0E1116] border border-[#262C38] rounded-lg px-2.5 py-2 text-xs text-[#F2F4F7] outline-none"
                />
              </div>
            )}

            <p className="text-[12px] text-[#8A93A5] leading-relaxed">
              Changing the target recalculates progress from your linked work — it never
              discards milestones or history.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() =>
              setEditingGoalSettings(editingGoalSettings === goal.id ? null : goal.id)
            }
            className="eb-press text-[10px] font-mono font-bold px-2.5 py-2 rounded-lg border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            Settings
          </button>
          <button
            onClick={() => {
              setEditingGoalId(goal.id);
              setEditText(goal.title);
            }}
            className="eb-press text-[10px] font-mono font-bold px-2.5 py-2 rounded-lg border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3 shrink-0" />
            Rename
          </button>
          <button
            onClick={() => patchGoal(userId, goal.id, { status: 'archived' })}
            className="eb-press text-[10px] font-mono font-bold px-2.5 py-2 rounded-lg border border-[#2A313C] text-[#7E8899] hover:eb-warn flex items-center gap-1.5"
          >
            <Archive className="w-3 h-3 shrink-0" />
            Archive
          </button>
          <button
            onClick={() => {
              if (!window.confirm(`Delete "${goal.title}" and its milestones? This cannot be undone.`)) return;
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
              removeGoal(userId, goal.id).catch((e) => console.error(e));
            }}
            className="eb-press text-[10px] font-mono font-bold px-2.5 py-2 rounded-lg border border-[#2A313C] text-[#7E8899] hover:eb-danger flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3 shrink-0" />
            Delete
          </button>
        </div>
      </div>
    );
  };

  /* ---------------- render ---------------- */

  const topGoal = activeGoals[0];

  return (
    <div className="space-y-4">
      <div className="eb-tabs w-fit max-w-full overflow-x-auto no-scrollbar">
        {(['goals', 'habits'] as Pane[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              soundFx.playClick();
              setPane(p);
            }}
            className={`eb-press eb-shine text-[11px] font-mono font-bold px-3 py-2 rounded-xl border capitalize ${
              pane === p
                ? 'eb-chip-active'
                : 'text-[#8A93A5] eb-card-sunk hover:border-[var(--signal)] hover:text-[#F2F4F7]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {warning && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 eb-warn shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#98A2B3] leading-relaxed">{warning}</p>
        </div>
      )}

      {/* ---- GOALS ---- */}
      {pane === 'goals' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoal()}
              placeholder="What are you working toward?"
              maxLength={120}
              className="flex-1 min-w-0 eb-card focus:border-[#8B5CF6]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#7E8899] outline-none"
            />
            <button
              onClick={addGoal}
              disabled={!goalDraft.trim()}
              aria-label="Add goal"
              className="eb-btn-primary eb-shine shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            >
              <Plus className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className="text-center py-10 px-6 border border-dashed border-[#2A313C] rounded-2xl">
              <p className="text-sm font-black text-[#F4F6F8] font-mono">Nothing set yet.</p>
              <p className="text-[11px] text-[#98A2B3] mt-1.5">
                Add a goal, then break it into milestones.
              </p>
            </div>
          ) : (
            activeGoals.map((g) => <GoalCard key={g.id} goal={g} />)
          )}
        </div>
      )}

      {/* ---- HABITS ---- */}
      {pane === 'habits' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={habitDraft}
              onChange={(e) => setHabitDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              placeholder="What will you repeat?"
              maxLength={120}
              className="flex-1 min-w-0 eb-card focus:border-[#8B5CF6]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#7E8899] outline-none"
            />
            <button
              onClick={addHabit}
              disabled={!habitDraft.trim()}
              aria-label="Add habit"
              className="eb-btn-primary eb-shine shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            >
              <Plus className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Same controls the habit offers after creation, available up front. */}
          <button
            onClick={() => setShowHabitOptions((v) => !v)}
            className="eb-press text-[11px] font-semibold text-[#8A93A5] hover:text-[#F2F4F7]"
          >
            {showHabitOptions ? '− Fewer options' : '+ How often, target and goal'}
          </button>

          {showHabitOptions && (
            <div className="p-3 rounded-xl eb-card-sunk space-y-3 anim-in">
              <div>
                <p className="eb-label mb-1.5">How often</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { id: 'daily' as const, label: 'Every day' },
                    { id: 'weekly' as const, label: 'Weekly' },
                    { id: 'selected_days' as const, label: 'Chosen days' },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setDraftCadence(id)}
                      className={`text-[11px] font-semibold px-3 py-2 rounded-lg border ${
                        draftCadence === id
                          ? 'eb-chip-active'
                          : 'text-[#8A93A5] border-[var(--rule)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {draftCadence === 'selected_days' && (
                <div>
                  <p className="eb-label mb-1.5">On these days</p>
                  <div className="flex items-center gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
                      const on = draftDays.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() =>
                            setDraftDays((prev) =>
                              on ? prev.filter((x) => x !== i) : [...prev, i].sort()
                            )
                          }
                          className={`flex-1 h-10 rounded-lg text-[11px] font-semibold border ${
                            on ? 'eb-chip-active' : 'text-[#7E8899] border-[var(--rule)]'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="eb-label mb-1.5">Times per day</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDraftTarget((v) => Math.max(1, v - 1))}
                    className="w-10 h-10 rounded-lg border border-[var(--rule)] text-[#F2F4F7]"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-sm font-mono font-bold text-[#F2F4F7] tabular-nums">
                    {draftTarget}
                  </span>
                  <button
                    onClick={() => setDraftTarget((v) => Math.min(99, v + 1))}
                    className="w-10 h-10 rounded-lg border border-[var(--rule)] text-[#F2F4F7]"
                  >
                    +
                  </button>
                  <span className="t-sub">
                    {draftTarget === 1 ? 'Just once — tick it off' : `Counts up to ${draftTarget}`}
                  </span>
                </div>
              </div>

              {goals.filter((g) => g.status === 'active').length > 0 && (
                <div>
                  <p className="eb-label mb-1.5">Counts toward</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setDraftGoalId(undefined)}
                      className={`text-[11px] font-semibold px-3 py-2 rounded-lg border ${
                        !draftGoalId ? 'eb-chip-active' : 'text-[#8A93A5] border-[var(--rule)]'
                      }`}
                    >
                      Nothing
                    </button>
                    {goals
                      .filter((g) => g.status === 'active')
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setDraftGoalId(draftGoalId === g.id ? undefined : g.id)}
                          className={`text-[11px] font-semibold px-3 py-2 rounded-lg border max-w-full truncate ${
                            draftGoalId === g.id
                              ? 'eb-chip-active'
                              : 'text-[#8A93A5] border-[var(--rule)]'
                          }`}
                        >
                          {g.title}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeHabits.length === 0 ? (
            <div className="text-center py-10 px-6 border border-dashed border-[#2A313C] rounded-2xl">
              <p className="text-sm font-black text-[#F4F6F8] font-mono">No habits yet.</p>
              <p className="text-[11px] text-[#98A2B3] mt-1.5">
                Start with one. Consistency beats volume.
              </p>
            </div>
          ) : (
            activeHabits.map((h) => <HabitRow key={h.id} habit={h} />)
          )}

          {habits.some((h) => h.status === 'archived') && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-[10px] font-mono font-bold text-[#7E8899] hover:text-[#98A2B3]"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          )}
        </div>
      )}

      {!userId && (
        <p className="text-[10px] text-[#98A2B3] font-mono text-center">
          Signed out — goals and habits stay on this device until you sign in.
        </p>
      )}
    </div>
  );
};
