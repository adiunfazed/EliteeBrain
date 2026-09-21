import React from 'react';
import { Check, Flame, Clock, ChevronRight } from 'lucide-react';
import { Task } from '../../types';
import { blockDisplay, BLOCK_DISPLAY_STYLE } from '../../lib/blockTiming';

/**
 * Content panels for the Home dashboard.
 *
 * Every panel shows everything it has.
 *
 * They used to cut at five with no way to see the rest, so a sixth habit was
 * invisible while the header counted it — the panel said "1/6" and listed
 * five, and the missing one could not be reached from this screen at all. A
 * count that disagrees with the list under it is worse than a long list, so
 * the rows were made compact instead and nothing is hidden.
 */

/** A tick that reads at a glance without taking a whole row's height. */
const Tick: React.FC<{ done: boolean; onClick: () => void; label: string }> = ({
  done,
  onClick,
  label,
}) => (
  <button onClick={onClick} aria-label={label} aria-pressed={done} className="panel-tick">
    <span className="panel-tick-mark" data-state={done ? 'done' : 'open'}>
      {done && <Check className="w-2.5 h-2.5 shrink-0 stroke-[3]" />}
    </span>
  </button>
);

interface ActionsPanelProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onOpenAll: () => void;
}

export const ActionsPanel: React.FC<ActionsPanelProps> = ({ tasks, onToggle, onOpenAll }) => {
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="panel-sm dash-span-2">
      <div className="panel-head">
        <span className="panel-title">Today&apos;s actions</span>
        <button onClick={onOpenAll} className="panel-count" aria-label="Open all tasks">
          {tasks.length > 0 && <span>{done}/{tasks.length}</span>}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="t-sub py-2">Nothing planned. Add something in Plan.</p>
      ) : (
        <div>
          {tasks.map((task) => (
            <div key={task.id} className={`panel-row ${task.completed ? 'row-done' : ''}`}>
              <Tick
                done={task.completed}
                onClick={() => onToggle(task)}
                label={`${task.title}: ${task.completed ? 'mark not done' : 'mark done'}`}
              />

              <span className="row-label min-w-0 flex-1 truncate">{task.title}</span>

              {task.dueTime ? (
                <span className="t-meta shrink-0">{task.dueTime}</span>
              ) : task.estimatedMinutes ? (
                <span className="t-meta shrink-0">{task.estimatedMinutes}m</span>
              ) : null}
            </div>
          ))}
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

export const HabitsPanel: React.FC<HabitsPanelProps> = ({ habits, onToggle, onOpenAll }) => {
  const done = habits.filter((h) => h.done).length;

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Habits</span>
        <button onClick={onOpenAll} className="panel-count" aria-label="Open all habits">
          {habits.length > 0 && <span>{done}/{habits.length}</span>}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {habits.length === 0 ? (
        <p className="t-sub py-2">Nothing due today.</p>
      ) : (
        <div>
          {habits.map((habit) => (
            <div key={habit.id} className={`panel-row ${habit.done ? 'row-done' : ''}`}>
              <Tick
                done={habit.done}
                onClick={() => onToggle(habit.id, !habit.done)}
                label={`${habit.title}: ${habit.done ? 'mark not done' : 'mark done'}`}
              />

              <span className="row-label min-w-0 flex-1 truncate">{habit.title}</span>

              {habit.streak > 0 && (
                <span className="t-meta shrink-0 flex items-center gap-1 eb-warn">
                  <Flame className="w-3 h-3 shrink-0" />
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
  const done = blocks.filter((b) => b.state === 'done').length;

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Routine</span>
        <button onClick={onOpenAll} className="panel-count" aria-label="Open routine">
          {blocks.length > 0 && <span>{done}/{blocks.length}</span>}
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="t-sub py-2">Nothing scheduled today.</p>
      ) : (
        <div>
          {blocks.map((block) => {
            const display = blockDisplay(block.state as any, block.startTime, block.endTime);
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
                <span className="row-label min-w-0 flex-1 truncate">{block.title}</span>

                {style.label && (
                  <span
                    className="panel-tag"
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
