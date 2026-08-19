import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Moon } from 'lucide-react';
import type { Task } from '../types';
import { patchTask, todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  tasks: Task[];
  /** Shown from this hour onward — a reset at 9am is meaningless. */
  fromHour?: number;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * End-of-day reset.
 *
 * Answers the four questions the product exists for: what mattered, what got
 * done, what didn't, and what happens next. Everything shown is the user's
 * own data — no scores, no invented insight.
 *
 * Appears only in the evening and only when there was something to review;
 * a reset on an empty day would be noise.
 */
export const DailyReset: React.FC<Props> = ({ userId, tasks, fromHour = 19 }) => {
  const today = todayISO();
  const [moved, setMoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { done, missed } = useMemo(() => {
    const forToday = tasks.filter(
      (t) => t.dueDate === today || (t.completed && (t.completedAt || '').startsWith(today))
    );
    return {
      done: forToday.filter((t) => t.completed),
      missed: forToday.filter((t) => !t.completed && !moved.includes(t.id)),
    };
  }, [tasks, today, moved]);

  const total = done.length + missed.length;
  const isEvening = new Date().getHours() >= fromHour;

  // Nothing planned, or too early to reflect.
  if (!isEvening || total === 0) return null;

  const moveOne = async (task: Task) => {
    if (busy) return;
    setBusy(true);
    setMoved((prev) => [...prev, task.id]);
    soundFx.playClick();
    try {
      await patchTask(userId, task.id, {
        dueDate: tomorrowISO(),
        // Moving a task forward is a postponement; recording it is what lets
        // the app notice a pattern later.
        postponeCount: (task.postponeCount || 0) + 1,
        lastPostponedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Could not move task:', err);
      setMoved((prev) => prev.filter((id) => id !== task.id));
    } finally {
      setBusy(false);
    }
  };

  const allDone = missed.length === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="eb-card p-5 sm:p-6"
    >
      <span className="eb-label flex items-center gap-1.5">
        <Moon className="w-3 h-3" />
        End of day
      </span>

      <h2 className="eb-title mt-2">
        {allDone ? 'Everything done.' : `${done.length} of ${total} finished.`}
      </h2>

      {allDone ? (
        <p className="text-sm text-[#8A93A5] mt-2 leading-relaxed">
          You did what you set out to do today.
        </p>
      ) : (
        <>
          <p className="text-sm text-[#8A93A5] mt-2 leading-relaxed">
            {missed.length === 1
              ? "One thing didn't get done."
              : `${missed.length} things didn't get done.`}{' '}
            Move them to tomorrow, or leave them.
          </p>

          <div className="mt-4 space-y-2">
            {missed.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl eb-card-sunk px-3.5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[#F2F4F7] break-words">{task.title}</span>
                  {(task.postponeCount || 0) > 0 && (
                    <span className="block text-[11px] eb-warn mt-0.5">
                      Moved {task.postponeCount} time{task.postponeCount === 1 ? '' : 's'} already
                    </span>
                  )}
                </span>

                <button
                  onClick={() => moveOne(task)}
                  disabled={busy}
                  className="eb-btn-ghost shrink-0 px-3 py-2 text-[11px] font-mono flex items-center gap-1.5"
                >
                  Tomorrow
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {done.length > 0 && (
        <p className="text-[13px] text-[#8A93A5] mt-4 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 eb-done" />
          {done.length} finished today
        </p>
      )}
    </motion.section>
  );
};
