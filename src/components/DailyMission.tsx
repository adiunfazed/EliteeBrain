import React from 'react';
import { motion } from 'motion/react';
import { Brain, CheckSquare, Timer, Check } from 'lucide-react';
import { formatDuration } from '../lib/focus';

interface MissionProps {
  /** Cognitive modules finished today. */
  modulesDone: number;
  modulesTarget: number;
  /** Tasks ticked off today. */
  tasksDone: number;
  tasksTarget: number;
  /** Focus sessions logged today. */
  focusSessions: number;
  focusSecondsToday: number;
  onGoTrain: () => void;
  /** Each row opens its own destination, not a shared landing tab. */
  onGoTasks: () => void;
  onGoFocus: () => void;
}

/**
 * Answers one question on open: what should I do today?
 *
 * Deliberately reuses the numbers already tracked elsewhere rather than keeping
 * its own counters — a second source of truth for "did you train today" would
 * drift from the modules themselves within a day.
 */
export const DailyMission: React.FC<MissionProps> = ({
  modulesDone,
  modulesTarget,
  tasksDone,
  tasksTarget,
  focusSessions,
  focusSecondsToday,
  onGoTrain,
  onGoTasks,
  onGoFocus,
}) => {
  const goals = [
    {
      key: 'train',
      icon: Brain,
      label: 'Train your mind',
      detail: `${modulesDone} of ${modulesTarget} modules`,
      done: modulesDone >= modulesTarget,
      action: onGoTrain,
      tint: 'text-[#A78BFA]',
    },
    {
      key: 'tasks',
      icon: CheckSquare,
      label: 'Clear your top tasks',
      detail: tasksTarget === 0 ? 'No tasks yet — add one' : `${tasksDone} of ${tasksTarget} done`,
      // With no tasks there is nothing to complete, so this is not "done".
      done: tasksTarget > 0 && tasksDone >= tasksTarget,
      action: onGoTasks,
      tint: 'text-emerald-400',
    },
    {
      key: 'focus',
      icon: Timer,
      label: 'One focused session',
      detail:
        focusSecondsToday > 0 ? `${formatDuration(focusSecondsToday)} today` : 'Not started',
      done: focusSessions >= 1,
      action: onGoFocus,
      tint: 'text-amber-400',
    },
  ];

  const complete = goals.filter((g) => g.done).length;
  const allDone = complete === goals.length;

  return (
    <div className="eb-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-black text-[#F4F6F8] font-mono tracking-tight">
            Today's mission
          </h3>
          <p className="text-[11px] text-[#98A2B3] mt-0.5">
            {allDone
              ? 'All three done. Anything else today is a bonus.'
              : 'Three things. Finish them and today counts.'}
          </p>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            allDone
              ? 'eb-chip-active'
              : 'text-[#98A2B3] bg-[#171B22] border-[#2A313C]'
          }`}
        >
          {complete} / {goals.length}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full bg-[#171B22] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-[#8B5CF6]'}`}
          initial={false}
          animate={{ width: `${(complete / goals.length) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {goals.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.key}
              onClick={g.action}
              className={`eb-press eb-shine eb-lift ${
                g.done ? 'eb-glow-emerald' : 'eb-glow-brand'
              } w-full text-left px-3 py-2.5 rounded-xl border flex items-center gap-3 ${
                g.done
                  ? 'bg-emerald-500/10 border-emerald-500/25'
                  : 'bg-[#171B22] border-[#2A313C] hover:border-[#3A424F]'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  g.done ? 'bg-emerald-500 text-slate-950' : 'bg-[#0E1116]'
                }`}
              >
                {g.done ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <Icon className={`w-4 h-4 ${g.tint}`} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-xs font-bold truncate ${
                    g.done ? 'text-emerald-300' : 'text-[#F4F6F8]'
                  }`}
                >
                  {g.label}
                </span>
                <span className="block text-[10px] font-mono text-[#98A2B3] mt-0.5">
                  {g.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
