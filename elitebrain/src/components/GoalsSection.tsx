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
} from 'lucide-react';
import type { Goal, Habit, HabitLog, Task } from '../types';
import {
  archiveHabit,
  newGoal,
  newHabit,
  patchGoal,
  patchHabit,
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
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  tasks?: Task[];
  onStartFocus?: (title: string, minutes: number, habitId: string) => void;
}

type Pane = 'today' | 'goals' | 'habits';

export const GoalsSection: React.FC<Props> = ({ userId, onStartFocus }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [pane, setPane] = useState<Pane>('today');
  const [goalDraft, setGoalDraft] = useState('');
  const [habitDraft, setHabitDraft] = useState('');
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => subscribeGoals(userId, setGoals), [userId]);
  useEffect(() => subscribeHabits(userId, setHabits), [userId]);
  useEffect(() => subscribeHabitLogs(userId, setLogs), [userId]);

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
    setHabits((prev) => [h, ...prev]);
    setHabitDraft('');
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
                <span
                  className={`text-sm font-bold break-words ${
                    stats.completedToday ? 'text-emerald-300' : 'text-[#F4F6F8]'
                  }`}
                >
                  {habit.title}
                </span>
                {stats.currentStreak > 1 && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1 shrink-0">
                    <Flame className="w-2.5 h-2.5" />
                    {stats.currentStreak}
                  </span>
                )}
                {habit.status === 'archived' && (
                  <span className="text-[9px] font-mono text-[#5A6472]">Archived</span>
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
                        <Check className="w-4 h-4 stroke-[3]" />
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
                    stroke={stats.completedToday ? '#10B981' : '#5C6CF2'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 17}
                    initial={false}
                    animate={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - pct) }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black text-[#F4F6F8] tabular-nums">
                  {Math.round(pct * 100)}%
                </span>
              </div>
            )}
          </div>

          {habit.metric !== 'yes_no' && (
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
                  className="text-[10px] font-mono font-bold px-3 py-2 rounded-xl bg-transparent border border-[#2A313C] text-[#5A6472] hover:text-[#98A2B3]"
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
                  className="eb-press eb-glow-emerald eb-shine text-[10px] font-mono font-bold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5"
                >
                  <Timer className="w-3 h-3" />
                  Start focus
                </button>
              )}
            </div>
          )}

          {!compact && (
            <button
              onClick={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
              className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-[#98A2B3] mt-2.5"
            >
              {expandedHabit === habit.id ? '− Hide history' : '+ History'}
            </button>
          )}
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
                      className="bg-[#171B22] border border-[#2A313C] rounded-xl p-2 text-center"
                    >
                      <p className="text-base font-black font-mono text-[#F4F6F8] tabular-nums leading-none">
                        {s.value}
                      </p>
                      <p className="text-[9px] font-mono text-[#5A6472] mt-1">{s.label}</p>
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

                {habit.status === 'active' && (
                  <button
                    onClick={() => archiveHabit(userId, habit.id)}
                    className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-amber-300 flex items-center gap-1.5"
                  >
                    <Archive className="w-3 h-3" />
                    Archive (keeps history)
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
    const progress = goalProgress(goal, habits, logs, today);
    const health = goalHealth(goal, progress, today);
    const left = daysRemaining(goal.deadline, today);
    const [msDraft, setMsDraft] = useState('');
    const linked = habits.filter((h) => h.goalId === goal.id);

    return (
      <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[#F4F6F8] break-words">{goal.title}</h4>
            <p className="text-[10px] font-mono text-[#98A2B3] mt-1">{progress.label}</p>
          </div>
          <span
            className={`text-[9px] font-mono font-bold px-2 py-1 rounded-full border shrink-0 ${GOAL_HEALTH_STYLE[health.health]}`}
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

        <p className="text-[10px] font-mono text-[#5A6472] leading-relaxed">{health.reason}</p>

        {left !== null && left >= 0 && (
          <p className="text-[10px] font-mono text-[#98A2B3]">
            {left} day{left === 1 ? '' : 's'} remaining
          </p>
        )}

        {/* Milestones */}
        {(goal.milestones || []).length > 0 && (
          <div className="space-y-1.5">
            {(goal.milestones || []).map((m) => (
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
                  {m.done && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                <span
                  className={`text-xs min-w-0 break-words ${
                    m.done ? 'text-[#5A6472] line-through' : 'text-[#F4F6F8]'
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
            className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-lg px-2.5 py-2 text-[11px] text-[#F4F6F8] placeholder:text-[#5A6472] outline-none"
          />
          <button
            onClick={() => {
              addMilestone(goal, msDraft);
              setMsDraft('');
            }}
            disabled={!msDraft.trim()}
            aria-label="Add milestone"
            className="shrink-0 w-10 h-10 rounded-lg bg-[#171B22] border border-[#2A313C] disabled:opacity-40 text-[#F4F6F8] flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {linked.length > 0 && (
          <p className="text-[10px] font-mono text-[#98A2B3] flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            {linked.length} habit{linked.length === 1 ? '' : 's'} supporting this
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => patchGoal(userId, goal.id, { status: 'archived' })}
            className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-amber-300"
          >
            Archive
          </button>
          <button
            onClick={() => {
              setGoals((prev) => prev.filter((g) => g.id !== goal.id));
              removeGoal(userId, goal.id).catch((e) => console.error(e));
            }}
            className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-rose-300"
          >
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
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['today', 'goals', 'habits'] as Pane[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              soundFx.playClick();
              setPane(p);
            }}
            className={`eb-press eb-shine text-[11px] font-mono font-bold px-3 py-2 rounded-xl border capitalize ${
              pane === p
                ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/40'
                : 'text-[#98A2B3] bg-[#0E1116] border-[#2A313C] hover:border-[#3A424F]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {warning && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#98A2B3] leading-relaxed">{warning}</p>
        </div>
      )}

      {/* ---- TODAY ---- */}
      {pane === 'today' && (
        <div className="space-y-4">
          {topGoal && (
            <div>
              <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase mb-2">
                Top goal
              </p>
              <GoalCard goal={topGoal} />
            </div>
          )}

          <div>
            <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase mb-2">
              Habits today
            </p>
            {todaysHabits.length === 0 ? (
              <div className="text-center py-10 px-6 border border-dashed border-[#2A313C] rounded-2xl">
                <p className="text-sm font-black text-[#F4F6F8] font-mono">No habits yet.</p>
                <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
                  Pick one thing worth repeating. One habit you keep beats five you abandon.
                </p>
                <button
                  onClick={() => setPane('habits')}
                  className="eb-lift eb-glow-indigo eb-shine mt-4 px-4 py-2.5 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] text-white text-xs font-mono font-black inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add habit
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysHabits.map((h) => (
                  <HabitRow key={h.id} habit={h} compact />
                ))}
              </div>
            )}
          </div>

          {activeGoals.length === 0 && (
            <div className="text-center py-10 px-6 border border-dashed border-[#2A313C] rounded-2xl">
              <Target className="w-7 h-7 text-[#5A6472] mx-auto mb-2.5" />
              <p className="text-sm font-black text-[#F4F6F8] font-mono">No goal set.</p>
              <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
                A goal gives your habits somewhere to point.
              </p>
              <button
                onClick={() => setPane('goals')}
                className="eb-lift eb-glow-indigo eb-shine mt-4 px-4 py-2.5 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] text-white text-xs font-mono font-black inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add goal
              </button>
            </div>
          )}
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
              className="flex-1 min-w-0 bg-[#0E1116] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none"
            />
            <button
              onClick={addGoal}
              disabled={!goalDraft.trim()}
              aria-label="Add goal"
              className="eb-lift eb-glow-indigo eb-shine shrink-0 w-11 h-11 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] disabled:opacity-40 text-white flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
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
              className="flex-1 min-w-0 bg-[#0E1116] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none"
            />
            <button
              onClick={addHabit}
              disabled={!habitDraft.trim()}
              aria-label="Add habit"
              className="eb-lift eb-glow-indigo eb-shine shrink-0 w-11 h-11 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] disabled:opacity-40 text-white flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

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
              className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-[#98A2B3]"
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
