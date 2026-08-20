import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Clock, MinusCircle, Flame, Target, ArrowRight } from 'lucide-react';
import type { BlockState, Habit, HabitLog, RoutineBlock, RoutineLog, Task } from '../types';
import { setHabitValue, setRoutineState } from '../lib/goalStore';
import { blocksForDate, routineAdherence } from '../lib/routine';
import { habitStats, describeTarget } from '../lib/habits';
import { bucketTasks, todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';
import { useXp } from './XpToast';
import { XP } from '../lib/xp';

interface Props {
  userId: string | null;
  blocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  goals: { id: string; title: string }[];
  onGo: (pane: 'tasks' | 'goals' | 'routine') => void;
}

/**
 * The daily driver: everything scheduled for today in one tick-off list.
 *
 * Previously routine and habits lived on separate screens behind two levels of
 * tabs, so nobody saw their whole day at once. This is the single screen you
 * open in the morning and tick through.
 */
/** One colour per block kind, so a block looks the same everywhere. */
/** Matching hexes for the tile classes, used to tint incomplete habits. */
const TILE_HEX = ['#7C5CFF', '#FF6B57', '#FFB020', '#00C2A8', '#8A93A5'];

const BLOCK_TINT: Record<string, string> = {
  study: '#7C5CFF',
  work: '#4C9AFF',
  exercise: '#FFB020',
  sleep: '#6C7BFF',
  meal: '#00C2A8',
  personal: '#FF6B57',
  custom: '#8A93A5',
};

export const TodayPane: React.FC<Props> = ({
  userId,
  blocks,
  routineLogs,
  habits,
  habitLogs,
  tasks,
  goals,
  onGo,
}) => {
  const today = todayISO();
  const { awardXp } = useXp();
  const [localRoutine, setLocalRoutine] = useState<RoutineLog[]>(routineLogs);
  const [localHabits, setLocalHabits] = useState<HabitLog[]>(habitLogs);

  useEffect(() => setLocalRoutine(routineLogs), [routineLogs]);
  useEffect(() => setLocalHabits(habitLogs), [habitLogs]);

  const day = useMemo(
    () => blocksForDate(blocks, localRoutine, today),
    [blocks, localRoutine, today]
  );
  const adherence = useMemo(
    () => routineAdherence(blocks, localRoutine, today),
    [blocks, localRoutine, today]
  );
  const activeHabits = useMemo(() => habits.filter((h) => h.status === 'active'), [habits]);
  const topTasks = useMemo(() => bucketTasks(tasks).today.slice(0, 3), [tasks]);

  const doneCount =
    day.filter((d) => d.state === 'done').length +
    activeHabits.filter((h) => habitStats(h, localHabits, today).completedToday).length;
  const totalCount = day.length + activeHabits.length;
  const pct = totalCount > 0 ? doneCount / totalCount : 0;

  const cycleBlock = async (block: RoutineBlock, current: BlockState) => {
    const order: BlockState[] = ['pending', 'done', 'partial', 'skipped'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    if (next === 'done') {
      soundFx.playSuccess();
      awardXp(XP.routineBlockDone, block.title);
    } else {
      soundFx.playClick();
    }
    setLocalRoutine((prev) => [
      { id: `${today}__${block.id}`, blockId: block.id, date: today, state: next, updatedAt: '' },
      ...prev.filter((l) => !(l.blockId === block.id && l.date === today)),
    ]);
    try {
      await setRoutineState(userId, block.id, today, next);
    } catch (e) {
      console.error('Could not update block:', e);
    }
  };

  const toggleHabit = async (habit: Habit) => {
    const stats = habitStats(habit, localHabits, today);
    const next = stats.completedToday ? 0 : stats.target;
    if (next > 0) {
      soundFx.playSuccess();
      awardXp(XP.habitMet, habit.title);
    } else {
      soundFx.playClick();
    }
    setLocalHabits((prev) => [
      { id: `${today}__${habit.id}`, habitId: habit.id, date: today, value: next, updatedAt: '' },
      ...prev.filter((l) => !(l.habitId === habit.id && l.date === today)),
    ]);
    try {
      await setHabitValue(userId, habit.id, today, next);
    } catch (e) {
      console.error('Could not update habit:', e);
    }
  };

  const goalTitle = (id?: string) => goals.find((g) => g.id === id)?.title;

  const Tick: React.FC<{ done: boolean; partial?: boolean; onClick: () => void; label: string }> = ({
    done,
    partial,
    onClick,
    label,
  }) => (
    <button
      onClick={onClick}
      aria-label={label}
      className="shrink-0 w-11 h-11 -m-1.5 flex items-center justify-center"
    >
      <span
        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
          done
            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
            : partial
              ? 'bg-amber-500 border-amber-500 text-slate-950'
              : 'border-[#3A424F] hover:border-emerald-500/60'
        }`}
      >
        <AnimatePresence>
          {(done || partial) && (
            <motion.span
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              {done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <MinusCircle className="w-3.5 h-3.5" />}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );

  const empty = totalCount === 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="eb-card p-4 sm:p-5 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
            <circle cx="22" cy="22" r="19" fill="none" stroke="#171B22" strokeWidth="4" />
            <motion.circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke={pct >= 1 ? '#10B981' : '#8B5CF6'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 19}
              initial={false}
              animate={{ strokeDashoffset: 2 * Math.PI * 19 * (1 - pct) }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-black text-[#F4F6F8] tabular-nums">
            {Math.round(pct * 100)}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="eb-label truncate">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="eb-stat text-2xl sm:text-3xl mt-1">
            {doneCount} / {totalCount}
            <span className="text-xs font-bold text-[#5A6472] ml-2">done today</span>
          </p>
        </div>
      </div>

      {empty && (
        <div className="text-center py-12 px-6 border border-dashed border-[#2A313C] rounded-2xl">
          <p className="eb-heading text-base">Nothing scheduled yet.</p>
          <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-sm mx-auto leading-relaxed">
            Build the routine you want to follow each day, then tick it off here. Link blocks to a
            goal and your goal moves as you do the work.
          </p>
          <div className="flex items-center gap-2 justify-center mt-4 flex-wrap">
            <button
              onClick={() => onGo('routine')}
              className="eb-btn-primary eb-shine px-4 py-2.5 rounded-xl text-xs font-mono font-black"
            >
              Build my routine
            </button>
            <button
              onClick={() => onGo('goals')}
              className="eb-btn-ghost px-4 py-2.5 rounded-xl text-xs font-mono font-bold"
            >
              Set a goal
            </button>
          </div>
        </div>
      )}

      {/* Routine */}
      {day.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eb-label">
              Your routine
            </span>
            <span className="text-[10px] font-mono text-[#5A6472] tabular-nums">
              {adherence.done}/{adherence.total}
            </span>
          </div>
          <div className="space-y-2">
            {day.map(({ block, state }) => (
              <motion.div
                key={block.id}
                layout
                style={{ color: BLOCK_TINT[block.kind] || '#8A93A5' }}
                className={`eb-card-tap eb-rail eb-shine relative overflow-hidden rounded-2xl border p-3.5 flex items-center gap-3 ${
                  state === 'done'
                    ? 'bg-emerald-500/[0.09] border-emerald-500/30'
                    : state === 'partial'
                      ? 'bg-amber-500/[0.09] border-amber-500/30'
                      : state === 'skipped'
                        ? 'bg-[#0B0E13] border-[#20252E] opacity-55'
                        : 'eb-tint bg-[#14171F] border-[#262C38]'
                }`}
              >
                <Tick
                  done={state === 'done'}
                  partial={state === 'partial'}
                  onClick={() => cycleBlock(block, state)}
                  label={`Mark ${block.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`eb-heading text-sm break-words relative ${
                      state === 'skipped' ? 'text-[#5A6472] line-through' : 'text-[#F2F4F7]'
                    }`}
                  >
                    {block.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono text-[#98A2B3] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {block.startTime}–{block.endTime}
                    </span>
                    {block.goalId && goalTitle(block.goalId) && (
                      <span className="text-[10px] font-mono text-[#A78BFA] flex items-center gap-1 truncate">
                        <Target className="w-2.5 h-2.5 shrink-0" />
                        {goalTitle(block.goalId)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Habits — colour tiles, scannable at a glance. */}
      {activeHabits.length > 0 && (
        <div>
          <span className="eb-label">Your habits</span>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar mt-2 -mx-1 px-1 pb-1">
            {activeHabits.map((habit, i) => {
              const stats = habitStats(habit, localHabits, today);
              const pct = Math.min(1, stats.todayValue / stats.target);
              const tints = ['eb-tile-violet', 'eb-tile-coral', 'eb-tile-amber', 'eb-tile-teal', 'eb-tile-slate'];
              const tint = tints[i % tints.length];
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit)}
                  style={stats.completedToday ? undefined : { color: TILE_HEX[i % TILE_HEX.length] }}
                  className={`eb-card-tap eb-shine shrink-0 w-[136px] rounded-2xl p-3.5 text-left ${
                    stats.completedToday ? `${tint} eb-raised` : 'eb-tint eb-card-sunk'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 relative">
                    <span className="relative w-9 h-9 shrink-0">
                      {/* Ring doubles as the progress indicator, so a measured
                          habit reads without needing a separate bar. */}
                      <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.22" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 15}
                          strokeDashoffset={2 * Math.PI * 15 * (1 - pct)}
                          style={{ transition: 'stroke-dashoffset 0.45s cubic-bezier(0.22,1,0.36,1)' }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center">
                        {stats.completedToday ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <span className="text-[11px] font-mono font-bold">
                            {Math.round(pct * 100)}%
                          </span>
                        )}
                      </span>
                    </span>
                    {stats.currentStreak > 1 && (
                      <span className="text-[10px] font-mono font-bold flex items-center gap-0.5 opacity-80">
                        <Flame className="w-2.5 h-2.5" />
                        {stats.currentStreak}
                      </span>
                    )}
                  </div>

                  <p
                    className={`eb-heading text-sm mt-3 leading-snug break-words relative ${
                      stats.completedToday ? '' : 'text-[#F2F4F7]'
                    }`}
                  >
                    {habit.title}
                  </p>

                  <p
                    className={`text-[10px] mt-1 relative ${
                      stats.completedToday ? 'opacity-80' : 'text-[#8A93A5]'
                    }`}
                  >
                    {habit.metric === 'yes_no'
                      ? stats.completedToday
                        ? 'Done today'
                        : 'Tap to mark done'
                      : `${stats.todayValue} of ${describeTarget(habit)}`}
                  </p>




                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* Top tasks */}
      {topTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eb-label">
              Top tasks
            </span>
            <button
              onClick={() => onGo('tasks')}
              className="eb-press text-[10px] font-mono font-bold text-[#A78BFA] flex items-center gap-1"
            >
              All tasks
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {topTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onGo('tasks')}
                className="eb-press eb-shine w-full text-left rounded-2xl border border-[#2A313C] bg-[#0E1116] p-3"
              >
                <p className="text-sm text-[#F4F6F8] break-words">{t.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
