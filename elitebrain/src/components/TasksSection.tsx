import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Plus,
  Trash2,
  Calendar,
  Pencil,
  X,
  ChevronsUp,
  Minus,
  ChevronDown,
  AlertTriangle,
  Timer,
  Star,
  Clock,
  Sparkles,
  Battery,
  Search,
  Repeat,
  ListChecks,
} from 'lucide-react';
import type { Task, TaskCategory, TaskEnergy, TaskPriority } from '../types';
import {
  bucketTasks,
  makeTask,
  patchTask,
  removeTask,
  saveTask,
  subscribeTasks,
  toggleTask,
  todayISO,
} from '../lib/tasks';
import { buildNextInSeries, describeRecurrence, searchTasks, subtaskProgress } from '../lib/recurrence';
import {
  CATEGORY_META,
  DURATION_PRESETS,
  ENERGY_META,
  MAX_PINNED,
  nextBestAction,
  parseQuickEntry,
  priorityProgress,
  rankTasks,
} from '../lib/taskEngine';
import { soundFx } from '../utils/audio';
import { TaskDetailSheet } from './TaskDetailSheet';

interface Props {
  userId: string | null;
  /** Hand a task to the Focus screen. */
  onStartFocus?: (task: Task) => void;
}

type TabId = 'today' | 'upcoming' | 'completed';

const PRIORITY_STYLE: Record<
  TaskPriority,
  { label: string; chip: string; icon: typeof ChevronsUp; bar: string }
> = {
  critical: {
    label: 'Critical',
    chip: 'text-rose-200 bg-rose-500/20 border-rose-500/40',
    icon: AlertTriangle,
    bar: 'bg-rose-400',
  },
  high: {
    label: 'High',
    chip: 'text-rose-300 bg-rose-500/12 border-rose-500/25',
    icon: ChevronsUp,
    bar: 'bg-rose-500/80',
  },
  normal: {
    label: 'Normal',
    chip: 'text-[#818CF8] bg-[#5C6CF2]/12 border-[#5C6CF2]/25',
    icon: Minus,
    bar: 'bg-[#5C6CF2]',
  },
  low: {
    label: 'Low',
    chip: 'text-slate-400 bg-slate-700/25 border-slate-600/30',
    icon: ChevronDown,
    bar: 'bg-slate-600',
  },
};

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function prettyDate(iso?: string): string {
  if (!iso) return '';
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === shiftDate(1)) return 'Tomorrow';
  if (iso < today) return 'Overdue';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

interface ToastItem {
  id: number;
  message: string;
  undo?: () => void;
}

export const TasksSection: React.FC<Props> = ({ userId, onStartFocus }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<TabId>('today');
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [draftPriority] = useState<TaskPriority>('normal');
  const [draftCategory, setDraftCategory] = useState<TaskCategory | undefined>();
  const [draftEnergy, setDraftEnergy] = useState<TaskEnergy | undefined>();
  const [draftMinutes, setDraftMinutes] = useState<number | undefined>();
  const [timeFilter, setTimeFilter] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => subscribeTasks(userId, setTasks), [userId]);

  const applyLocal = (fn: (list: Task[]) => Task[]) => setTasks((prev) => fn(prev));

  // Shortcuts are a convenience, never the only route to a feature.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      if (e.key === 'n') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pushToast = (message: string, undo?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  const parsed = useMemo(() => (draft.trim() ? parseQuickEntry(draft) : null), [draft]);
  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);
  const progress = useMemo(() => {
    const today = todayISO();
    const done = tasks.filter((t) => t.completed && t.completedAt?.startsWith(today)).length;
    return { done, total: done + buckets.today.length };
  }, [tasks, buckets.today.length]);
  const priorities = useMemo(() => priorityProgress(tasks), [tasks]);
  const overdue = useMemo(
    () => buckets.today.filter((t) => t.dueDate && t.dueDate < todayISO()),
    [buckets.today]
  );
  const nextAction = useMemo(
    () => nextBestAction(tasks, { availableMinutes: timeFilter }),
    [tasks, timeFilter]
  );

  const visible = useMemo(() => {
    let base = buckets[tab];
    if (tab !== 'completed' && timeFilter !== undefined) {
      base = rankTasks(base, { availableMinutes: timeFilter });
    }
    return searchTasks(base, search);
  }, [buckets, tab, timeFilter, search]);

  const detailTask = useMemo(
    () => tasks.find((t) => t.id === detailId) || null,
    [tasks, detailId]
  );

  const pinnedCount = tasks.filter((t) => t.pinned && !t.completed).length;

  /* ---------------- actions ---------------- */

  const handleAdd = async () => {
    if (!parsed?.title || busy) return;
    setBusy(true);

    const task = makeTask(parsed.title, parsed.priority || draftPriority, parsed.dueDate);
    if (parsed.dueTime) task.dueTime = parsed.dueTime;
    const cat = parsed.category || draftCategory;
    if (cat) task.category = cat;
    const mins = parsed.estimatedMinutes ?? draftMinutes;
    if (mins) task.estimatedMinutes = mins;
    if (draftEnergy) task.energy = draftEnergy;

    applyLocal((list) => [task, ...list]);
    setDraft('');
    setDraftCategory(undefined);
    setDraftEnergy(undefined);
    setDraftMinutes(undefined);
    soundFx.playClick();

    try {
      await saveTask(userId, task);
    } catch (err) {
      console.error('Could not save task:', err);
      applyLocal((list) => list.filter((t) => t.id !== task.id));
      pushToast('Could not save that task.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const handleToggle = async (task: Task) => {
    const completed = !task.completed;
    if (completed) soundFx.playSuccess();
    else soundFx.playClick();

    applyLocal((list) =>
      list.map((t) =>
        t.id === task.id
          ? { ...t, completed, completedAt: completed ? new Date().toISOString() : undefined }
          : t
      )
    );

    try {
      await toggleTask(userId, task);

      // Recurring: create the successor ONLY on completion, and only once.
      // spawnedNextAt is written back so a repeat call can never duplicate it.
      if (completed && task.recurrence && !task.spawnedNextAt) {
        const next = buildNextInSeries({ ...task, completed: true });
        if (next) {
          await patchTask(userId, task.id, { spawnedNextAt: new Date().toISOString() });
          applyLocal((list) => [next, ...list]);
          await saveTask(userId, next);
          pushToast(`Done. Next one due ${prettyDate(next.dueDate)}.`);
        }
      } else if (completed) {
        pushToast('Task completed.', () => handleToggle({ ...task, completed: true }));
      }
    } catch (err) {
      console.error('Could not update task:', err);
      applyLocal((list) => list.map((t) => (t.id === task.id ? task : t)));
      pushToast('Could not update that task.');
    }
  };

  const patch = async (task: Task, changes: Partial<Task>, note?: string) => {
    applyLocal((list) => list.map((t) => (t.id === task.id ? { ...t, ...changes } : t)));
    try {
      await patchTask(userId, task.id, changes);
      if (note) pushToast(note);
    } catch (err) {
      console.error('Could not update task:', err);
      applyLocal((list) => list.map((t) => (t.id === task.id ? task : t)));
      pushToast('Could not update that task.');
    }
  };

  const togglePin = async (task: Task) => {
    if (!task.pinned && pinnedCount >= MAX_PINNED) {
      pushToast(`Keep it to ${MAX_PINNED} priorities. Unpin one first.`);
      return;
    }
    soundFx.playClick();
    await patch(task, { pinned: !task.pinned });
  };

  const handleDelete = async (task: Task) => {
    soundFx.playClick();
    applyLocal((list) => list.filter((t) => t.id !== task.id));
    try {
      await removeTask(userId, task.id);
      pushToast('Task deleted.', async () => {
        applyLocal((list) => [task, ...list]);
        await saveTask(userId, task);
      });
    } catch (err) {
      console.error('Could not delete task:', err);
      applyLocal((list) => [task, ...list]);
      pushToast('Could not delete that task.');
    }
  };

  const commitEdit = async (task: Task) => {
    const title = editingText.trim();
    setEditingId(null);
    if (!title || title === task.title) return;
    await patch(task, { title });
  };

  const cyclePriority = async (task: Task) => {
    const order: TaskPriority[] = ['critical', 'high', 'normal', 'low'];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    soundFx.playClick();
    await patch(task, { priority: next });
  };

  /* ---------------- render ---------------- */

  const pct = progress.total > 0 ? progress.done / progress.total : 0;
  const dayComplete = progress.total > 0 && progress.done === progress.total;

  const renderCard = (task: Task, highlight = false) => {
    const pri = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.normal;
    const PriIcon = pri.icon;
    const isOverdue = !!task.dueDate && task.dueDate < todayISO() && !task.completed;

    return (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.18 }}
        className={`group relative overflow-hidden rounded-2xl border transition-colors ${
          task.completed
            ? 'bg-[#0B0E13] border-[#20252E]'
            : highlight
              ? 'bg-[#10141C] border-[#5C6CF2]/35'
              : 'bg-[#0E1116] border-[#2A313C] hover:border-[#3A424F]'
        }`}
      >
        {!task.completed && (
          <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${pri.bar}`} />
        )}
        <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" />

        <div className="p-3 pl-4 flex items-start gap-3">
          <button
            onClick={() => handleToggle(task)}
            aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
            className="shrink-0 w-10 h-10 -m-2 flex items-center justify-center"
          >
            <span
              className={`w-[22px] h-[22px] rounded-lg border flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                  : 'border-[#3A424F] hover:border-emerald-500/60'
              }`}
            >
              <AnimatePresence>
                {task.completed && (
                  <motion.span
                    initial={{ scale: 0, rotate: -25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>

          <div className="flex-1 min-w-0">
            {editingId === task.id ? (
              <input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => commitEdit(task)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(task);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full bg-[#171B22] border border-[#5C6CF2]/60 rounded-lg px-2 py-1 text-sm text-[#F4F6F8] outline-none"
              />
            ) : (
              <button
                onClick={() => setDetailId(task.id)}
                className={`text-left text-sm leading-snug break-words w-full ${
                  task.completed ? 'text-[#5A6472] line-through' : 'text-[#F4F6F8]'
                }`}
              >
                {task.pinned && !task.completed && (
                  <Star className="inline w-3 h-3 mb-0.5 mr-1 text-amber-400 fill-amber-400" />
                )}
                {task.title}
              </button>
            )}

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {!task.completed && (
                <button
                  onClick={() => cyclePriority(task)}
                  title="Change priority"
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${pri.chip}`}
                >
                  <PriIcon className="w-2.5 h-2.5" />
                  {pri.label}
                </button>
              )}
              {task.category && (
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${CATEGORY_META[task.category].tint}`}
                >
                  {CATEGORY_META[task.category].label}
                </span>
              )}
              {task.estimatedMinutes ? (
                <span className="text-[9px] font-mono text-[#98A2B3] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />~{task.estimatedMinutes}m
                </span>
              ) : null}
              {task.energy && (
                <span className="text-[9px] font-mono text-[#98A2B3] hidden sm:flex items-center gap-1">
                  <Battery className="w-2.5 h-2.5" />
                  {ENERGY_META[task.energy].label}
                </span>
              )}
              {(task.subtasks?.length || 0) > 0 && (
                <span className="text-[9px] font-mono text-[#98A2B3] flex items-center gap-1">
                  <ListChecks className="w-2.5 h-2.5" />
                  {subtaskProgress(task).done}/{subtaskProgress(task).total}
                </span>
              )}
              {task.recurrence && (
                <span className="text-[9px] font-mono text-[#98A2B3] flex items-center gap-1">
                  <Repeat className="w-2.5 h-2.5" />
                  {describeRecurrence(task.recurrence)}
                </span>
              )}
              {task.dueDate && (
                <span
                  className={`text-[9px] font-mono flex items-center gap-1 ${
                    isOverdue ? 'text-amber-300' : 'text-[#98A2B3]'
                  }`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  {prettyDate(task.dueDate)}
                  {task.dueTime ? ` · ${task.dueTime}` : ''}
                </span>
              )}
            </div>

            {!task.completed && (isOverdue || tab === 'today') && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {[
                  { label: 'Today', value: shiftDate(0) },
                  { label: 'Tomorrow', value: shiftDate(1) },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() =>
                      patch(task, { dueDate: o.value }, `Moved to ${o.label.toLowerCase()}.`)
                    }
                    className="text-[9px] font-mono px-2 py-1 rounded-full border border-[#2A313C] text-[#5A6472] hover:text-[#98A2B3] hover:border-[#3A424F] transition-colors"
                  >
                    {o.label}
                  </button>
                ))}
                {onStartFocus && (
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartFocus(task);
                    }}
                    className="text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                  >
                    <Timer className="w-2.5 h-2.5" />
                    Focus
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {!task.completed && (
              <>
                <button
                  onClick={() => togglePin(task)}
                  aria-label={task.pinned ? 'Unpin' : 'Pin as priority'}
                  className="w-10 h-10 rounded-lg hover:bg-[#171B22] text-[#98A2B3] hover:text-amber-300 flex items-center justify-center transition-colors"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${task.pinned ? 'fill-amber-400 text-amber-400' : ''}`}
                  />
                </button>
                <button
                  onClick={() => {
                    setEditingId(task.id);
                    setEditingText(task.title);
                  }}
                  aria-label="Edit task"
                  className="w-10 h-10 rounded-lg hover:bg-[#171B22] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center justify-center transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => handleDelete(task)}
              aria-label="Delete task"
              className="w-10 h-10 rounded-lg hover:bg-rose-500/15 text-[#98A2B3] hover:text-rose-300 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* TODAY header */}
      <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4 sm:p-5 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
            <circle cx="22" cy="22" r="19" fill="none" stroke="#171B22" strokeWidth="4" />
            <motion.circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke={dayComplete ? '#10B981' : '#5C6CF2'}
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

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase truncate">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="text-xl sm:text-2xl font-black font-mono text-[#F4F6F8] tabular-nums mt-0.5">
            {progress.done} / {progress.total}
            <span className="text-xs font-bold text-[#5A6472] ml-2">complete</span>
          </p>
          {priorities.total > 0 && (
            <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
              Priorities {priorities.done}/{priorities.total}
              {priorities.allDone && <span className="text-emerald-300"> · all done</span>}
            </p>
          )}
        </div>
      </div>

      {/* Next best action */}
      {nextAction && tab === 'today' && (
        <motion.div
          layout
          className="rounded-2xl border border-[#5C6CF2]/30 bg-[#10141C] p-4"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#818CF8]" />
            <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
              Next best action
            </span>
          </div>
          <p className="text-sm font-bold text-[#F4F6F8] mt-2 break-words">{nextAction.title}</p>
          <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
            {(PRIORITY_STYLE[nextAction.priority] || PRIORITY_STYLE.normal).label}
            {nextAction.estimatedMinutes ? ` · ~${nextAction.estimatedMinutes} min` : ''}
            {nextAction.dueDate ? ` · ${prettyDate(nextAction.dueDate)}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {onStartFocus && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  onStartFocus(nextAction);
                }}
                className="eb-lift eb-glow-indigo eb-shine px-4 py-2.5 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] text-white text-xs font-mono font-black flex items-center gap-1.5"
              >
                <Timer className="w-3.5 h-3.5" />
                Start focus
              </button>
            )}
            <button
              onClick={() => handleToggle(nextAction)}
              className="px-4 py-2.5 rounded-xl bg-[#171B22] hover:bg-[#20252E] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono font-bold transition-colors"
            >
              Mark done
            </button>
          </div>
        </motion.div>
      )}

      {/* Needs attention */}
      {overdue.length > 0 && tab === 'today' && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-300 tracking-widest uppercase">
              Needs attention
            </span>
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-1">
            {overdue.length} task{overdue.length === 1 ? '' : 's'} passed their date. Move or
            finish.
          </p>
        </div>
      )}

      {/* Quick add */}
      <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setDraft('');
            }}
            placeholder="Physics DPP tomorrow 6pm !high 45m #study"
            maxLength={180}
            className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none transition-colors"
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleAdd}
            disabled={!parsed?.title || busy}
            aria-label="Add task"
            className="eb-lift eb-glow-indigo eb-shine shrink-0 w-11 h-11 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        <AnimatePresence>
          {parsed && parsed.detected.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="text-[10px] font-mono text-[#5A6472] mt-2">
                Understood:{' '}
                <span className="text-emerald-300">{parsed.detected.join(' · ')}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-mono font-bold text-[#5A6472] hover:text-[#98A2B3] mt-2.5 transition-colors"
        >
          {expanded ? '− Fewer options' : '+ More options'}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(CATEGORY_META) as TaskCategory[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraftCategory(draftCategory === c ? undefined : c)}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                        draftCategory === c
                          ? CATEGORY_META[c].tint
                          : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                      }`}
                    >
                      {CATEGORY_META[c].label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setDraftMinutes(draftMinutes === m ? undefined : m)}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border transition-all ${
                        draftMinutes === m
                          ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/30'
                          : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                      }`}
                    >
                      {m < 60 ? `${m}m` : `${m / 60}h`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(ENERGY_META) as TaskEnergy[]).map((e) => (
                    <button
                      key={e}
                      onClick={() => setDraftEnergy(draftEnergy === e ? undefined : e)}
                      title={ENERGY_META[e].hint}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
                        draftEnergy === e
                          ? 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30'
                          : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                      }`}
                    >
                      <Battery className="w-2.5 h-2.5" />
                      {ENERGY_META[e].label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A6472] pointer-events-none" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearch('');
              searchRef.current?.blur();
            }
          }}
          placeholder="Search tasks"
          className="w-full bg-[#0E1116] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl pl-9 pr-9 py-2.5 text-xs text-[#F4F6F8] placeholder:text-[#5A6472] outline-none transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-[#5A6472] hover:text-[#F4F6F8] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs + time filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: 'today' as TabId, label: 'Today', count: buckets.today.length },
          { id: 'upcoming' as TabId, label: 'Upcoming', count: buckets.upcoming.length },
          { id: 'completed' as TabId, label: 'Done', count: buckets.completed.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              soundFx.playClick();
              setTab(t.id);
            }}
            className={`eb-press eb-shine text-[11px] font-mono font-bold px-3 py-2 rounded-xl border flex items-center gap-1.5 ${
              tab === t.id
                ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/40'
                : 'text-[#98A2B3] bg-[#0E1116] border-[#2A313C] hover:border-[#3A424F]'
            }`}
          >
            {t.label}
            <span className="text-[9px] opacity-70">{t.count}</span>
          </button>
        ))}

        {tab !== 'completed' && (
          <div className="flex items-center gap-1 ml-auto">
            {[15, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => setTimeFilter(timeFilter === m ? undefined : m)}
                title={`Show what fits in ${m} minutes`}
                className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                  timeFilter === m
                    ? 'text-emerald-300 bg-emerald-500/12 border-emerald-500/30'
                    : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-[#2A313C] rounded-2xl">
          <p className="text-base font-black text-[#F4F6F8] font-mono tracking-tight">
            {tab === 'today'
              ? 'Clear day.'
              : tab === 'upcoming'
                ? 'Nothing scheduled.'
                : 'Nothing finished yet.'}
          </p>
          <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
            {tab === 'today'
              ? 'Nothing is waiting on you. Add what matters and start.'
              : tab === 'upcoming'
                ? 'Give a task a date and it waits here until the day arrives.'
                : 'Completed work collects here so you can see what you got done.'}
          </p>
          {tab !== 'completed' && (
            <button
              onClick={() => inputRef.current?.focus()}
              className="eb-lift eb-glow-indigo eb-shine mt-4 px-4 py-2.5 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] text-white text-xs font-mono font-black inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tab === 'today' && visible.some((t) => t.pinned) && (
            <p className="text-[10px] font-mono font-bold text-amber-300/80 tracking-widest uppercase pt-1">
              Today's priorities
            </p>
          )}
          <AnimatePresence initial={false}>
            {visible.filter((t) => t.pinned).map((t) => renderCard(t, true))}
          </AnimatePresence>

          {tab === 'today' &&
            visible.some((t) => t.pinned) &&
            visible.some((t) => !t.pinned) && (
              <p className="text-[10px] font-mono font-bold text-[#5A6472] tracking-widest uppercase pt-2">
                Everything else
              </p>
            )}
          <AnimatePresence initial={false}>
            {visible.filter((t) => !t.pinned).map((t) => renderCard(t))}
          </AnimatePresence>
        </div>
      )}

      {!userId && (
        <p className="text-[10px] text-[#98A2B3] font-mono text-center">
          Signed out — tasks stay on this device until you sign in.
        </p>
      )}

      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailId(null)}
        onPatch={(changes) => detailTask && patch(detailTask, changes)}
        onDelete={() => detailTask && handleDelete(detailTask)}
        onStartFocus={onStartFocus}
      />

      {/* Toasts */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="pointer-events-auto bg-[#171B22] border border-[#2A313C] rounded-xl px-3.5 py-2.5 shadow-xl flex items-center gap-3"
            >
              <span className="text-[11px] text-[#F4F6F8] flex-1 min-w-0">{t.message}</span>
              {t.undo && (
                <button
                  onClick={() => {
                    t.undo!();
                    setToasts((list) => list.filter((x) => x.id !== t.id));
                  }}
                  className="text-[11px] font-mono font-black text-[#818CF8] hover:text-[#A5B4FC] shrink-0"
                >
                  UNDO
                </button>
              )}
              <button
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
                className="w-9 h-9 rounded-lg hover:bg-[#20252E] text-[#5A6472] flex items-center justify-center shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
