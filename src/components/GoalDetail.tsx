import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Repeat, CheckSquare, Clock, Calendar, Target } from 'lucide-react';
import { Goal, Habit, Task, RoutineBlock } from '../types';

interface Props {
  goal: Goal;
  percent: number;
  tasks: Task[];
  habits: Habit[];
  blocks: RoutineBlock[];
  onToggleMilestone: (milestoneId: string) => void;
  onOpenTask?: (taskId: string) => void;
}

function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/**
 * Goal detail.
 *
 * The progress engine already accounts for linked tasks, habits and routine
 * blocks — but nothing ever showed those connections, so a goal looked like a
 * number that moved for no visible reason. This is what makes the link
 * between daily work and the thing you are chasing legible.
 */
export const GoalDetail: React.FC<Props> = ({
  goal,
  percent,
  tasks,
  habits,
  blocks,
  onToggleMilestone,
  onOpenTask,
}) => {
  const linked = useMemo(
    () => ({
      tasks: tasks.filter((t) => t.goalId === goal.id),
      habits: habits.filter((h) => h.goalId === goal.id && h.status === 'active'),
      blocks: blocks.filter((b) => b.goalId === goal.id && b.active),
    }),
    [tasks, habits, blocks, goal.id]
  );

  const milestones = goal.milestones || [];
  const doneTasks = linked.tasks.filter((t) => t.completed).length;
  const left = goal.deadline ? daysUntil(goal.deadline) : null;

  return (
    <div className="pb-2">
      {/* Progress. The headline figure, so it reads first. */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            'linear-gradient(160deg, color-mix(in oklab, var(--signal) 16%, var(--surface)), var(--surface))',
          border: '1px solid color-mix(in oklab, var(--signal) 35%, var(--rule))',
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="eb-label">Progress</p>
          <p className="t-figure" style={{ fontSize: 34, color: 'var(--signal-ink)' }}>
            {percent}%
          </p>
        </div>

        <div
          className="h-2 rounded-full overflow-hidden mt-3"
          style={{ background: 'var(--surface-sunk)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--signal)' }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {left !== null && (
          <p className="t-meta mt-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            {left > 0
              ? `${left} ${left === 1 ? 'day' : 'days'} left`
              : left === 0
                ? 'Due today'
                : `${Math.abs(left)} ${Math.abs(left) === 1 ? 'day' : 'days'} overdue`}
          </p>
        )}
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eb-label">Milestones</p>
            <p className="t-meta shrink-0">
              {milestones.filter((m) => m.done).length}/{milestones.length}
            </p>
          </div>

          <div className="space-y-1.5 mt-3">
            {milestones.map((m) => (
              <button
                key={m.id}
                onClick={() => onToggleMilestone(m.id)}
                className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
              >
                {m.done ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 eb-done" />
                ) : (
                  <Circle className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
                )}
                <span
                  className="text-[15px] min-w-0 flex-1"
                  style={{
                    textDecoration: m.done ? 'line-through' : undefined,
                    color: m.done ? 'var(--ink-dim)' : 'var(--ink)',
                  }}
                >
                  {m.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What feeds this goal. Previously invisible, which is why progress
          appeared to move on its own. */}
      <div className="mt-6">
        <p className="eb-label">What moves this</p>

        {linked.tasks.length === 0 &&
        linked.habits.length === 0 &&
        linked.blocks.length === 0 ? (
          <p className="t-sub mt-2.5 leading-relaxed">
            Nothing is linked yet. Attach a task or habit to this goal and finishing it will
            move the bar.
          </p>
        ) : (
          <div className="space-y-1.5 mt-3">
            {linked.habits.map((h) => (
              <div
                key={h.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
              >
                <Repeat className="w-4 h-4 shrink-0" style={{ color: '#00C2A8' }} />
                <span className="text-[14px] min-w-0 flex-1 truncate">{h.title}</span>
                <span className="t-meta shrink-0">habit</span>
              </div>
            ))}

            {linked.blocks.map((b) => (
              <div
                key={b.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
              >
                <Clock className="w-4 h-4 shrink-0" style={{ color: '#7FD4E8' }} />
                <span className="text-[14px] min-w-0 flex-1 truncate">{b.title}</span>
                <span className="t-meta shrink-0 tabular-nums">{b.startTime}</span>
              </div>
            ))}

            {linked.tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTask?.(t.id)}
                className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
              >
                <CheckSquare
                  className="w-4 h-4 shrink-0"
                  style={{ color: t.completed ? 'var(--done)' : 'var(--signal)' }}
                />
                <span
                  className="text-[14px] min-w-0 flex-1 truncate"
                  style={{
                    textDecoration: t.completed ? 'line-through' : undefined,
                    color: t.completed ? 'var(--ink-dim)' : 'var(--ink)',
                  }}
                >
                  {t.title}
                </span>
                <span className="t-meta shrink-0">task</span>
              </button>
            ))}
          </div>
        )}

        {linked.tasks.length > 0 && (
          <p className="t-meta mt-3">
            {doneTasks} of {linked.tasks.length} linked tasks done
          </p>
        )}
      </div>
    </div>
  );
};
