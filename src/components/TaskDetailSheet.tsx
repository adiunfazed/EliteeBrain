import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Check,
  Trash2,
  Timer,
  Repeat,
  Calendar,
  Clock,
  StickyNote,
  Target,
} from 'lucide-react';
import type { Recurrence, RecurrenceFreq, Subtask, Task, TaskReflection } from '../types';
import { describeRecurrence, subtaskProgress } from '../lib/recurrence';
import { formatDuration } from '../lib/focus';
import { CATEGORY_META } from '../lib/taskEngine';
import { newTaskId } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  task: Task | null;
  /** Active goals a task can be attached to. */
  goals?: { id: string; title: string }[];
  onClose: () => void;
  onPatch: (changes: Partial<Task>) => void;
  onDelete: () => void;
  onStartFocus?: (task: Task) => void;
}

const REFLECTIONS: { id: TaskReflection; label: string; emoji: string }[] = [
  { id: 'harder', label: 'Harder than expected', emoji: '😐' },
  { id: 'expected', label: 'About right', emoji: '🙂' },
  { id: 'easier', label: 'Easier than expected', emoji: '🔥' },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Full detail for one task. Renders as a bottom sheet on mobile and a centred
 * panel on larger screens — the same component either way, so the two can't
 * drift apart.
 */
export const TaskDetailSheet: React.FC<Props> = ({
  task,
  goals = [],
  onClose,
  onPatch,
  onDelete,
  onStartFocus,
}) => {
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(task?.notes || '');
    setSubtaskDraft('');
  }, [task?.id]);

  // Escape closes, matching every other dismissable surface in the app.
  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task, onClose]);

  if (!task) return null;

  const subs = task.subtasks || [];
  const progress = subtaskProgress(task);

  const addSubtask = () => {
    const title = subtaskDraft.trim();
    if (!title) return;
    const next: Subtask = { id: newTaskId(), title, done: false };
    onPatch({ subtasks: [...subs, next] });
    setSubtaskDraft('');
    soundFx.playClick();
  };

  const toggleSub = (id: string) => {
    soundFx.playClick();
    onPatch({ subtasks: subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  };

  const removeSub = (id: string) => {
    onPatch({ subtasks: subs.filter((s) => s.id !== id) });
  };

  const setRecurrence = (rec: Recurrence | undefined) => {
    soundFx.playClick();
    onPatch({ recurrence: rec });
  };

  const toggleWeekday = (day: number) => {
    const rec = task.recurrence;
    if (!rec || rec.freq !== 'weekly') return;
    const days = new Set(rec.weekdays || []);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    setRecurrence({ ...rec, weekdays: Array.from(days).sort((a, b) => a - b) });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      >
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-[#0E1116] border border-[#2A313C] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-4"
        >
          {/* Grab handle, mobile only */}
          <div className="sm:hidden w-10 h-1 rounded-full bg-[#2A313C] mx-auto" />

          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-black text-[#F4F6F8] font-mono tracking-tight break-words min-w-0">
              {task.title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 rounded-xl hover:bg-[#171B22] text-[#98A2B3] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                icon: Calendar,
                label: 'Due',
                value: task.dueDate
                  ? `${task.dueDate}${task.dueTime ? ` · ${task.dueTime}` : ''}`
                  : 'Unscheduled',
              },
              {
                icon: Clock,
                label: 'Estimated',
                value: task.estimatedMinutes ? `${task.estimatedMinutes} min` : '—',
              },
              {
                icon: Timer,
                label: 'Actual focus',
                value: task.focusSeconds ? formatDuration(task.focusSeconds) : '—',
              },
              {
                icon: StickyNote,
                label: 'Category',
                value: task.category ? CATEGORY_META[task.category].label : '—',
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.label}
                  className="bg-[#171B22] border border-[#2A313C] rounded-xl p-2.5 min-w-0"
                >
                  <span className="text-[9px] font-mono font-bold text-[#5A6472] tracking-widest uppercase flex items-center gap-1">
                    <Icon className="w-2.5 h-2.5" />
                    {f.label}
                  </span>
                  <p className="text-[11px] font-mono text-[#F4F6F8] mt-1 truncate">{f.value}</p>
                </div>
              );
            })}
          </div>

          {/* Estimate vs actual — only when both exist */}
          {task.estimatedMinutes && (task.focusSeconds || 0) > 60 && (
            <p className="text-[11px] font-mono text-[#98A2B3] bg-[#171B22] border border-[#2A313C] rounded-xl p-2.5">
              {(() => {
                const actual = Math.round((task.focusSeconds || 0) / 60);
                const diff = actual - task.estimatedMinutes;
                if (Math.abs(diff) < 5) return `Estimated ${task.estimatedMinutes}, took ${actual}. Close.`;
                return diff > 0
                  ? `Estimated ${task.estimatedMinutes} min, took ${actual}. ${diff} over.`
                  : `Estimated ${task.estimatedMinutes} min, took ${actual}. ${Math.abs(diff)} under.`;
              })()}
            </p>
          )}

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
                Subtasks
              </span>
              {progress.total > 0 && (
                <span className="text-[10px] font-mono text-[#5A6472]">
                  {progress.done} / {progress.total}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1.5">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 group">
                  <button
                    onClick={() => toggleSub(s.id)}
                    aria-label={s.done ? 'Mark subtask undone' : 'Mark subtask done'}
                    className="shrink-0 w-10 h-10 -m-2 flex items-center justify-center"
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center ${
                        s.done
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                          : 'border-[#3A424F]'
                      }`}
                    >
                      {s.done && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </button>
                  <span
                    className={`text-xs flex-1 min-w-0 break-words ${
                      s.done ? 'text-[#5A6472] line-through' : 'text-[#F4F6F8]'
                    }`}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={() => removeSub(s.id)}
                    aria-label="Remove subtask"
                    className="shrink-0 w-9 h-9 rounded-lg text-[#5A6472] hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSubtask();
                }}
                placeholder="Add a step"
                maxLength={120}
                className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-lg px-2.5 py-2 text-xs text-[#F4F6F8] placeholder:text-[#5A6472] outline-none"
              />
              <button
                onClick={addSubtask}
                disabled={!subtaskDraft.trim()}
                aria-label="Add subtask"
                className="shrink-0 w-10 h-10 rounded-lg bg-[#171B22] hover:bg-[#20252E] border border-[#2A313C] disabled:opacity-40 text-[#F4F6F8] flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Repeat */}
          <div>
            <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase flex items-center gap-1.5">
              <Repeat className="w-3 h-3" />
              Repeat
            </span>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <button
                onClick={() => setRecurrence(undefined)}
                className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                  !task.recurrence
                    ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/30'
                    : 'text-[#5A6472] border-[#2A313C]'
                }`}
              >
                Never
              </button>
              {(['daily', 'weekly', 'monthly'] as RecurrenceFreq[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setRecurrence({ freq: f, interval: 1 })}
                  className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border capitalize ${
                    task.recurrence?.freq === f
                      ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/30'
                      : 'text-[#5A6472] border-[#2A313C]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {task.recurrence?.freq === 'weekly' && (
              <div className="flex items-center gap-1 mt-2">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleWeekday(i)}
                    aria-label={`Toggle day ${i}`}
                    className={`w-9 h-9 rounded-lg text-[10px] font-mono font-bold border ${
                      task.recurrence?.weekdays?.includes(i)
                        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                        : 'text-[#5A6472] border-[#2A313C]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {task.recurrence && (
              <p className="text-[10px] font-mono text-[#5A6472] mt-2">
                {describeRecurrence(task.recurrence)} · the next one is created when you
                complete this.
              </p>
            )}
          </div>

          {/* Goal link */}
          {goals.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase flex items-center gap-1.5">
                <Target className="w-3 h-3" />
                Counts toward
              </span>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  onClick={() => onPatch({ goalId: undefined })}
                  className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                    !task.goalId
                      ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/30'
                      : 'text-[#5A6472] border-[#2A313C]'
                  }`}
                >
                  Nothing
                </button>
                {goals.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => onPatch({ goalId: task.goalId === g.id ? undefined : g.id })}
                    className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border max-w-full truncate ${
                      task.goalId === g.id
                        ? 'text-[#A78BFA] bg-[#8B5CF6]/15 border-[#8B5CF6]/35'
                        : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                    }`}
                  >
                    {g.title}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-[#5A6472] mt-1.5">
                Completing this moves the goal forward.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (task.notes || '')) onPatch({ notes });
              }}
              rows={3}
              placeholder="Anything worth remembering"
              className="w-full mt-2 bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2 text-xs text-[#F4F6F8] placeholder:text-[#5A6472] outline-none resize-none"
            />
          </div>

          {/* Reflection — only after completion, never mandatory */}
          {task.completed && (
            <div>
              <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
                How did that go?
              </span>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {REFLECTIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      soundFx.playClick();
                      onPatch({ reflection: task.reflection === r.id ? undefined : r.id });
                    }}
                    className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 ${
                      task.reflection === r.id
                        ? 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30'
                        : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                    }`}
                  >
                    <span>{r.emoji}</span>
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#5A6472] font-mono mt-1.5">Optional.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {onStartFocus && !task.completed && (
              <button
                onClick={() => {
                  onStartFocus(task);
                  onClose();
                }}
                className="flex-1 min-w-[120px] py-3 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] text-white text-xs font-mono font-black flex items-center justify-center gap-1.5"
              >
                <Timer className="w-3.5 h-3.5" />
                Start focus
              </button>
            )}
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="py-3 px-4 rounded-xl bg-transparent hover:bg-rose-500/10 border border-[#2A313C] hover:border-rose-500/40 text-[#98A2B3] hover:text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
