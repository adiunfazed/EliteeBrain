import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Moon, Target, Timer } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { nextBestAction } from '../lib/taskEngine';
import { BLOCK_META, blocksForDate, formatSleepDuration, minutesOf, sleepStats } from '../lib/routine';
import { todayISO } from '../lib/tasks';

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

  const next = useMemo(() => nextBestAction(input.tasks), [input.tasks]);
  const day = useMemo(
    () => blocksForDate(input.routineBlocks, input.routineLogs, today),
    [input.routineBlocks, input.routineLogs, today]
  );
  const sleep = useMemo(() => sleepStats(input.sleepLogs, today), [input.sleepLogs, today]);
  const lastNight = input.sleepLogs.find((s) => s.date === today);

  // The block that is on right now, or the next one due.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
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
        <h2 className="eb-heading text-2xl sm:text-3xl mt-1">
          {greeting}
          {displayName ? <span className="text-[var(--signal-ink)]">, {displayName.split(' ')[0]}</span> : ''}
        </h2>
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
          <p className="text-sm font-bold text-[#F4F6F8] mt-1.5 break-words">{next.title}</p>
          {next.estimatedMinutes ? (
            <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
              ~{next.estimatedMinutes} min
            </p>
          ) : null}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => onStartFocus?.(next.title) ?? onOpenHub('focus')}
              className="eb-btn-primary eb-shine px-4 py-2.5 rounded-xl text-xs font-mono font-black flex items-center gap-1.5"
            >
              <Timer className="w-3.5 h-3.5" />
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
          className="eb-press w-full text-left rounded-2xl border border-dashed border-[#2A313C] p-4"
        >
          <p className="text-sm font-bold text-[#F4F6F8] font-mono">Nothing planned.</p>
          <p className="text-[11px] text-[#98A2B3] mt-1">
            Add what matters today and it'll show up here.
          </p>
        </button>
      )}

      {/* Today at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => onOpenHub('routine')}
          className="eb-press eb-shine text-left rounded-xl bg-[#171B22] border border-[#2A313C] p-3 min-w-0"
        >
          <span className="text-[9px] font-mono font-bold text-[#5A6472] tracking-widest uppercase flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {currentBlock?.live ? 'Right now' : 'Next up'}
          </span>
          {currentBlock ? (
            <>
              <p className="text-xs font-bold text-[#F4F6F8] mt-1 truncate">
                {currentBlock.block.title}
              </p>
              <p className="text-[10px] font-mono text-[#98A2B3] mt-0.5">
                {currentBlock.block.startTime} – {currentBlock.block.endTime} ·{' '}
                {BLOCK_META[currentBlock.block.kind].label}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[#98A2B3] mt-1">No routine set for today</p>
          )}
        </button>

        <button
          onClick={() => onOpenHub('routine')}
          className="eb-press eb-shine text-left rounded-xl bg-[#171B22] border border-[#2A313C] p-3 min-w-0"
        >
          <span className="text-[9px] font-mono font-bold text-[#5A6472] tracking-widest uppercase flex items-center gap-1">
            <Moon className="w-2.5 h-2.5" />
            Sleep
          </span>
          {lastNight ? (
            <>
              <p className="text-xs font-bold text-[#F4F6F8] mt-1">
                {formatSleepDuration(lastNight.minutes)}
              </p>
              <p className="text-[10px] font-mono text-[#98A2B3] mt-0.5">
                {sleep.consistency}% consistency · {sleep.nights} nights
              </p>
            </>
          ) : (
            <p className="text-[11px] text-[#98A2B3] mt-1">Not logged yet</p>
          )}
        </button>
      </div>
    </div>
  );
};
