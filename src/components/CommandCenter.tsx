import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Moon, Timer } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { nextBestAction } from '../lib/taskEngine';
import { BLOCK_META, blocksForDate, formatSleepDuration, minutesOf, sleepStats } from '../lib/routine';
import { todayISO } from '../lib/tasks';
import { isScheduledOn, valueOn } from '../lib/habits';

interface Props {
  input: MomentumInput;
  displayName?: string;
  onOpenHub: (pane: 'today' | 'tasks' | 'goals' | 'routine' | 'focus') => void;
  onStartFocus?: (title: string) => void;
  /** Opens the Sleep pane directly. */
  onOpenSleep: () => void;
}

/**
 * The daily command centre: what's happening today and the single most useful
 * thing to do right now.
 *
 * Deliberately shows ONE next action rather than a ranked list — a list is just
 * the task screen again, and the point of this card is to remove the decision.
 */
export const CommandCenter: React.FC<Props> = ({ input, displayName, onOpenHub, onStartFocus, onOpenSleep }) => {
  const today = todayISO();

  // Live clock so the header reflects the passing day rather than the moment
  // the component happened to mount.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => nextBestAction(input.tasks), [input.tasks]);
  const day = useMemo(
    () => blocksForDate(input.routineBlocks, input.routineLogs, today),
    [input.routineBlocks, input.routineLogs, today]
  );
  const sleep = useMemo(() => sleepStats(input.sleepLogs, today), [input.sleepLogs, today]);
  const lastNight = input.sleepLogs.find((s) => s.date === today);

  // The block that is on right now, or the next one due.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const currentBlock = useMemo(() => {
    const live = day.find(
      (d) => minutesOf(d.block.startTime) <= nowMin && minutesOf(d.block.endTime) > nowMin
    );
    if (live) return { ...live, live: true };
    const upcoming = day.find((d) => minutesOf(d.block.startTime) > nowMin);
    return upcoming ? { ...upcoming, live: false } : null;
  }, [day, nowMin]);

  const greeting =
    nowMin < 12 * 60 ? 'Good morning' : nowMin < 17 * 60 ? 'Good afternoon' : 'Good evening';

  // Today's completion across everything actually scheduled: routine blocks,
  // habits due today, and tasks due today. Nothing is assumed.
  const dayScore = useMemo(() => {
    const parts: { label: string; done: number; total: number }[] = [];

    const blocksDone = day.reduce(
      (n, d) => n + (d.state === 'done' ? 1 : d.state === 'partial' ? 0.5 : 0),
      0
    );
    if (day.length > 0) {
      parts.push({ label: day.length === 1 ? 'routine block' : 'routine blocks', done: blocksDone, total: day.length });
    }

    const dueHabits = input.habits.filter(
      (x) => x.status === 'active' && isScheduledOn(x, today)
    );
    if (dueHabits.length > 0) {
      const met = dueHabits.filter(
        (h) => valueOn(input.habitLogs, h.id, today) >= Math.max(1, h.targetValue || 1)
      ).length;
      parts.push({ label: dueHabits.length === 1 ? 'habit' : 'habits', done: met, total: dueHabits.length });
    }

    const todayTasks = input.tasks.filter(
      (t) => t.dueDate === today || (t.completed && (t.completedAt || '').startsWith(today))
    );
    if (todayTasks.length > 0) {
      const done = todayTasks.filter((t) => t.completed).length;
      parts.push({ label: todayTasks.length === 1 ? 'task' : 'tasks', done, total: todayTasks.length });
    }

    const done = parts.reduce((n, p) => n + p.done, 0);
    const total = parts.reduce((n, p) => n + p.total, 0);

    return { done, total, ratio: total > 0 ? done / total : 0, parts };
  }, [day, input.habits, input.habitLogs, input.tasks, today]);

  return (
    <div className="eb-card relative overflow-hidden p-4 sm:p-5 space-y-4">
      {/* Ambient accent, clipped by the card. Flat radial, no gradient bar. */}
      <div
        className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'var(--signal)' }}
      />

      <div className="relative">
        <p className="eb-label">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        <div className="min-w-0">
          <h2 className="eb-title mt-1 min-w-0">
            {greeting}
            {displayName ? <span className="text-[var(--signal-ink)]">, {displayName.split(' ')[0]}</span> : ''}
          </h2>

        </div>

        {dayScore.total > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="eb-label">Today</span>
              <span className="text-[10px] font-mono text-[var(--ink-muted)]">
                {dayScore.parts
                  .map((p) => `${Math.round(p.done)}/${p.total} ${p.label}`)
                  .join('  ·  ')}
              </span>
            </div>
            <div className="eb-bar mt-1.5">
              <motion.div
                className="eb-bar-fill"
                initial={false}
                animate={{ width: `${dayScore.ratio * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ background: dayScore.ratio >= 1 ? '#00C2A8' : undefined }}
              />
            </div>

            {/* One honest sentence about where the day stands. Derived from
                what was actually scheduled and completed — never invented. */}
            <p className="text-[11px] mt-2 leading-relaxed">
              {dayScore.ratio >= 1 ? (
                <span className="text-[#00C2A8]">
                  Everything you planned today is done.
                </span>
              ) : dayScore.done === 0 ? (
                <span className="text-[var(--ink-muted)]">
                  Nothing ticked off yet. One item is enough to start.
                </span>
              ) : (
                <span className="text-[var(--ink-muted)]">
                  {Math.round(dayScore.ratio * 100)}% of today done ·{' '}
                  {dayScore.total - Math.round(dayScore.done)} still open
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--ink-muted)] mt-2">
            Nothing scheduled today. Add a task or routine block to get started.
          </p>
        )}
      </div>

      {/* ONE next action */}
      {next ? (
        <motion.div
          layout
          className="rounded-2xl border border-[#8B5CF6]/30 bg-[#141020] p-4"
        >
          <span className="text-[10px] font-mono font-bold text-[#A78BFA] tracking-widest uppercase">
            Do this next
          </span>
          <p className="text-sm font-bold text-[var(--ink)] mt-1.5 break-words">{next.title}</p>
          {next.estimatedMinutes ? (
            <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-1">
              ~{next.estimatedMinutes} min
            </p>
          ) : null}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onStartFocus?.(next.title) ?? onOpenHub('focus')}
              className="eb-btn-primary eb-shine px-4 py-2.5 rounded-xl text-xs font-mono font-black flex items-center gap-1.5"
            >
              <Timer className="w-3.5 h-3.5 shrink-0" />
              Start now
            </button>
            <button
              onClick={() => onOpenHub('tasks')}
              className="eb-btn-ghost px-4 py-2.5 rounded-xl text-xs font-mono font-bold"
            >
              See all
            </button>
          </div>
        </motion.div>
      ) : (
        <button
          onClick={() => onOpenHub('tasks')}
          className="eb-press w-full text-left rounded-2xl border border-dashed border-[var(--rule)] p-4"
        >
          <p className="text-sm font-bold text-[var(--ink)] font-mono">Nothing planned.</p>
          <p className="text-[11px] text-[var(--ink-muted)] mt-1">
            Add what matters today and it'll show up here.
          </p>
        </button>
      )}

      {/* Today at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => onOpenHub('routine')}
          className={`eb-press eb-shine text-left rounded-xl p-3.5 min-w-0 border transition-all ${
            currentBlock?.live
              ? 'bg-[#00C2A8]/[0.13] border-[#00C2A8]/50 shadow-[0_0_22px_-6px_#00C2A8]'
              : currentBlock
                ? 'bg-[var(--signal)]/[0.13] border-[var(--signal)]/50 shadow-[0_0_22px_-6px_var(--signal)]'
                : 'eb-card-sunk'
          }`}
        >
          <span
            className="eb-label flex items-center gap-1.5"
            style={{
              color: currentBlock?.live
                ? '#00C2A8'
                : currentBlock
                  ? 'var(--signal-ink)'
                  : undefined,
            }}
          >
            <Clock className="w-3 h-3 shrink-0" />
            {currentBlock?.live ? 'Right now' : 'Next up'}
          </span>
          {currentBlock ? (
            <>
              <p className="text-xs font-bold text-[var(--ink)] mt-1 truncate">
                {currentBlock.block.title}
              </p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-0.5">
                {currentBlock.block.startTime} – {currentBlock.block.endTime} ·{' '}
                {BLOCK_META[currentBlock.block.kind].label}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">No routine set for today</p>
          )}
        </button>

        <button
          onClick={() => onOpenHub('routine')}
          className={`eb-press eb-shine text-left rounded-xl p-3.5 min-w-0 border transition-all ${
            lastNight
              ? 'bg-[#7C9CFF]/[0.11] border-[#7C9CFF]/45 shadow-[0_0_20px_-8px_#7C9CFF]'
              : 'eb-card-sunk'
          }`}
        >
          <span
            className="eb-label flex items-center gap-1.5"
            style={{ color: lastNight ? '#7C9CFF' : undefined }}
          >
            <Moon className="w-3 h-3 shrink-0" />
            Sleep
          </span>
          {lastNight ? (
            <>
              <p className="text-xs font-bold text-[var(--ink)] mt-1">
                {formatSleepDuration(lastNight.minutes)}
              </p>
              <p className="text-[10px] font-mono text-[var(--ink-muted)] mt-0.5">
                {sleep.consistency}% consistency · {sleep.nights} nights
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">Not logged yet</p>
          )}
        </button>
      </div>
    </div>
  );
};
