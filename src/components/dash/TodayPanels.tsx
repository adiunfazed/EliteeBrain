import React from 'react';
import { Check, Repeat, Clock, ChevronRight } from 'lucide-react';
import { Task } from '../../types';
import { blockDisplay, BLOCK_DISPLAY_STYLE } from '../../lib/blockTiming';

/**
 * Content panels for the Home dashboard.
 *
 * Each takes its data and its handlers and renders a compact bordered block
 * of hairline-separated rows. They deliberately show only a few items with a
 * link through to the full list — a dashboard panel that grows without limit
 * stops being a dashboard.
 */

interface ActionsPanelProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onOpenAll: () => void;
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({
  tasks,
  onToggle,
  onOpenAll,
}) => {
  const shown = tasks.slice(0, 5);
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="panel-sm dash-span-2">
      <div className="panel-head">
        <span className="panel-title">Today&apos;s actions</span>
        <button onClick={onOpenAll} className="t-meta flex items-center gap-0.5 shrink-0">
          {done}/{tasks.length}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="t-sub py-2">Nothing planned. Add something in Plan.</p>
      ) : (
        <div>
          {shown.map((task) => (
            <div key={task.id} className={`panel-row ${task.completed ? 'row-done' : ''}`}>
              <button
                onClick={() => onToggle(task)}
                aria-label={task.completed ? 'Mark not done' : 'Mark done'}
                className="shrink-0"
              >
                <span
                  className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
                    task.completed
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950 glow-done'
                      : 'border-[var(--rule-strong)]'
                  }`}
                >
                  {task.completed && <Check className="w-2.5 h-2.5 shrink-0 stroke-[3]" />}
                </span>
              </button>

              <span className="row-label text-[14px] min-w-0 flex-1 truncate">{task.title}</span>

              {task.dueTime && <span className="t-meta shrink-0">{task.dueTime}</span>}
              {!task.dueTime && task.estimatedMinutes ? (
                <span className="t-meta shrink-0">{task.estimatedMinutes}m</span>
              ) : null}
            </div>
          ))}

          {tasks.length > shown.length && (
            <button onClick={onOpenAll} className="btn-text mt-1">
              {tasks.length - shown.length} more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface HabitsPanelProps {
  habits: { id: string; title: string; done: boolean; streak: number }[];
  onToggle: (id: string, done: boolean) => void;
  onOpenAll: () => void;
}

export const HabitsPanel: React.FC<HabitsPanelProps> = ({
  habits,
  onToggle,
  onOpenAll,
}) => {
  const shown = habits.slice(0, 5);
  const done = habits.filter((h) => h.done).length;

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Habits</span>
        <button onClick={onOpenAll} className="t-meta flex items-center gap-0.5 shrink-0">
          {done}/{habits.length}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="t-sub py-2">No habits yet.</p>
      ) : (
        <div>
          {shown.map((habit) => (
            <div key={habit.id} className={`panel-row ${habit.done ? 'row-done' : ''}`}>
              <button
                onClick={() => onToggle(habit.id, !habit.done)}
                aria-label={habit.done ? 'Mark not done' : 'Mark done'}
                className="shrink-0"
              >
                <span
                  className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
                    habit.done
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950 glow-done'
                      : 'border-[var(--rule-strong)]'
                  }`}
                >
                  {habit.done && <Check className="w-2.5 h-2.5 shrink-0 stroke-[3]" />}
                </span>
              </button>

              <span className="row-label text-[14px] min-w-0 flex-1 truncate">{habit.title}</span>

              {habit.streak > 0 && (
                <span className="t-meta shrink-0 flex items-center gap-1">
                  <Repeat className="w-3 h-3 shrink-0" />
                  {habit.streak}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface RoutinePanelProps {
  blocks: { id: string; title: string; startTime: string; endTime?: string; state: string }[];
  onOpenAll: () => void;
}

export const RoutinePanel: React.FC<RoutinePanelProps> = ({ blocks, onOpenAll }) => {
  const shown = blocks.slice(0, 5);
  const done = blocks.filter((b) => b.state === 'done').length;

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Routine</span>
        <button onClick={onOpenAll} className="t-meta flex items-center gap-0.5 shrink-0">
          {done}/{blocks.length}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="t-sub py-2">Nothing scheduled today.</p>
      ) : (
        <div>
          {shown.map((block) => {
            const display = blockDisplay(
              block.state as any,
              block.startTime,
              block.endTime
            );
            const style = BLOCK_DISPLAY_STYLE[display];

            return (
              <div
                key={block.id}
                className={`panel-row ${style.strike ? 'row-done' : ''}`}
                style={{ opacity: style.opacity }}
              >
                <Clock
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: style.color || 'var(--ink-dim)' }}
                />
                <span className="t-meta shrink-0 tabular-nums w-10">{block.startTime}</span>
                <span className="row-label text-[14px] min-w-0 flex-1 truncate">
                  {block.title}
                </span>

                {style.label && (
                  <span
                    className="t-meta shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: style.color || 'var(--ink-dim)',
                      background: `color-mix(in oklab, ${style.color} 14%, transparent)`,
                    }}
                  >
                    {style.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
