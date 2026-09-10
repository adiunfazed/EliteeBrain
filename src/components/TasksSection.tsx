import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Target,
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
  Battery,
  Search,
  Repeat,
  ListChecks,
} from 'lucide-react';
import type { Task, TaskCategory, TaskEnergy, TaskPriority } from '../types';
import { addDays,
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
  parseQuickEntry,
  priorityProgress,
  rankTasks,
} from '../lib/taskEngine';
import { soundFx } from '../utils/audio';
import { ComposerSheet } from './ComposerSheet';
import { AddButton } from './AddButton';
import { TaskComposer } from './TaskComposer';
import { TaskDetailSheet } from './TaskDetailSheet';
import { StuckTaskCard } from './StuckTaskCard';
import { mostStuckTask } from '../lib/adaptive';
import { useXp } from './XpToast';
import { XP } from '../lib/xp';

interface Props {
  userId: string | null;
  goals?: { id: string; title: string }[];
  /** Hand a task to the Focus screen. */
  onStartFocus?: (task: Task) => void;
}

type TabId = 'today' | 'overdue' | 'upcoming' | 'completed';

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
    chip: 'eb-danger bg-rose-500/12 border-rose-500/25',
    icon: ChevronsUp,
    bar: 'bg-rose-500/80',
  },
  normal: {
    label: 'Normal',
    chip: 'text-[var(--signal-ink)] bg-[var(--signal)]/12 border-[var(--signal)]/25',
    icon: Minus,
    bar: 'bg-[var(--signal)]',
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

export const TasksSection: React.FC<Props> = ({ userId, goals = [], onStartFocus }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<TabId>('today');
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [draftPriority] = useState<TaskPriority>('normal');
  const [draftCategory, setDraftCategory] = useState<TaskCategory | undefined>();
  const [draftEnergy, setDraftEnergy] = useState<TaskEnergy | undefined>();
  const [draftMinutes, setDraftMinutes] = useState<number | undefined>();
  const [draftDue, setDraftDue] = useState<string | undefined>();
  const [timeFilter, setTimeFilter] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { awardXp } = useXp();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'quick'>('date');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stuckDismissed, setStuckDismissed] = useState<string | null>(null);

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
  const stuck = useMemo(() => {
    const t = mostStuckTask(tasks);
    return t && t.id !== stuckDismissed ? t : null;
  }, [tasks, stuckDismissed]);


  const visible = useMemo(() => {
    let base = tab === 'overdue' ? overdue : buckets[tab];
    if (tab !== 'completed' && timeFilter !== undefined) {
      base = rankTasks(base, { availableMinutes: timeFilter });
    }
    const found = searchTasks(base, search);

    // Sorting is applied last, so it never fights the search or time filter.
    const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 } as const;

    if (sortBy === 'priority') {
      return [...found].sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
    }

    if (sortBy === 'quick') {
      // Tasks without an estimate sort last: an unknown duration is not a
      // quick win, and guessing one would be worse.
      return [...found].sort(
        (a, b) => (a.estimatedMinutes ?? 9999) - (b.estimatedMinutes ?? 9999)
      );
    }

    return found;
  }, [buckets, overdue, tab, timeFilter, search, sortBy]);

  const detailTask = useMemo(
    () => tasks.find((t) => t.id === detailId) || null,
    [tasks, detailId]
  );

  const pinnedCount = tasks.filter((t) => t.pinned && !t.completed).length;

  /* ---------------- actions ---------------- */

  const handleAdd = async () => {
    if (!parsed?.title || busy) return;
    setBusy(true);

    // A date typed into the field is the more specific instruction, so it
    // takes precedence over the chip selection.
    const task = makeTask(parsed.title, parsed.priority || draftPriority, parsed.dueDate || draftDue);
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
    setDraftDue(undefined);
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
    if (completed) {
      soundFx.playSuccess();
      awardXp(XP.taskCompleted, task.title);
    } else {
      soundFx.playClick();
    }

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
        className={`group eb-lift relative overflow-hidden rounded-2xl border ${
          task.completed
            ? 'bg-[#0B0E13] border-[#20252E]'
            : highlight
              ? 'bg-[#141A28] border-[color-mix(in_oklab,var(--signal)_40%,transparent)] '
              : task.priority === 'critical' || task.priority === 'high'
                ? 'bg-[#17121A] border-[var(--rule)] hover:border-rose-500/40 '
                : task.category === 'fitness'
                  ? 'bg-[#181408] border-[var(--rule)] hover:border-amber-500/40 '
                  : task.category === 'personal'
                    ? 'bg-[#0C1714] border-[var(--rule)] hover:border-emerald-500/40 '
                    : task.category === 'work'
                      ? 'bg-[#0B1620] border-[var(--rule)] hover:border-sky-500/40 '
                      : 'bg-[#121722] border-[var(--rule)] hover:border-[color-mix(in_oklab,var(--signal)_40%,transparent)] '
        }`}
      >
        {!task.completed && (
          <span
            className={`absolute left-0 top-0 bottom-0 w-[3px] ${pri.bar} shadow-[0_0_10px_currentColor] opacity-90`}
          />
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
                  : 'border-[var(--rule-strong)] hover:border-emerald-500/60'
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
                    <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
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
                className="w-full bg-[var(--surface-sunk)] border border-[color-mix(in_oklab,var(--signal)_60%,transparent)] rounded-lg px-2 py-1 text-sm text-[var(--ink)] outline-none"
              />
            ) : (
              <button
                onClick={() => setDetailId(task.id)}
                className={`text-left text-sm leading-snug break-words w-full ${
                  task.completed ? 'text-[var(--ink-dim)] line-through' : 'text-[var(--ink)]'
                }`}
              >
                {task.pinned && !task.completed && (
                  <Star className="inline w-3 h-3 mb-0.5 mr-1 eb-warn fill-amber-400" />
                )}
                {task.title}
              </button>
            )}

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {!task.completed && (
                <button
                  onClick={() => cyclePriority(task)}
                  title="Change priority"
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${pri.chip}`}
                >
                  <PriIcon className="w-3.5 h-3.5 shrink-0" />
                  {pri.label}
                </button>
              )}
              {task.category && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_META[task.category].tint}`}
                >
                  {CATEGORY_META[task.category].label}
                </span>
              )}
              {task.estimatedMinutes ? (
                <span className="t-meta flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" />~{task.estimatedMinutes}m
                </span>
              ) : null}
              {task.energy && (
                <span className="t-meta hidden sm:flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 shrink-0" />
                  {ENERGY_META[task.energy].label}
                </span>
              )}
              {(task.subtasks?.length || 0) > 0 && (
                <span className="t-meta flex items-center gap-1">
                  <ListChecks className="w-3.5 h-3.5 shrink-0" />
                  {subtaskProgress(task).done}/{subtaskProgress(task).total}
                </span>
              )}
              {task.recurrence && (
                <span className="t-meta flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 shrink-0" />
                  {describeRecurrence(task.recurrence)}
                </span>
              )}
              {task.dueDate && (
                <span
                  className={`t-meta flex items-center gap-1 ${
                    isOverdue ? 'eb-warn' : ''
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {prettyDate(task.dueDate)}
                  {task.dueTime ? ` · ${task.dueTime}` : ''}
                </span>
              )}

              {(task.subtasks?.length || 0) > 0 && (
                <span className="t-meta flex items-center gap-1">
                  <ListChecks className="w-3 h-3 shrink-0" />
                  {task.subtasks!.filter((st) => st.done).length}/{task.subtasks!.length}
                </span>
              )}

              {task.recurrence && (
                <span className="t-meta flex items-center gap-1">
                  <Repeat className="w-3 h-3 shrink-0" />
                  {task.recurrence.freq}
                </span>
              )}

              {task.reminderMinutesBefore !== undefined && (
                <span className="t-meta flex items-center gap-1">
                  <Bell className="w-3 h-3 shrink-0" />
                </span>
              )}

              {/* Which goal this moves. Without it, finishing a task feels
                  like clearing a list rather than making progress. */}
              {(() => {
                const goal = task.goalId ? goals.find((g) => g.id === task.goalId) : null;
                if (!goal) return null;
                return (
                  <span
                    className="t-meta flex items-center gap-1 min-w-0"
                    style={{ color: 'var(--signal-ink)' }}
                  >
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[140px]">{goal.title}</span>
                  </span>
                );
              })()}
            </div>

            {!task.completed && (isOverdue || tab === 'today') && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {[
                  { label: 'Today', value: shiftDate(0) },
                  { label: 'Tomorrow', value: shiftDate(1) },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => {
                      // Only a push FORWARD counts as postponing. Pulling a
                      // task earlier is the opposite behaviour.
                      const pushed = !!task.dueDate && o.value > task.dueDate;
                      patch(
                        task,
                        {
                          dueDate: o.value,
                          ...(pushed
                            ? {
                                postponeCount: (task.postponeCount || 0) + 1,
                                lastPostponedAt: new Date().toISOString(),
                              }
                            : {}),
                        },
                        `Moved to ${o.label.toLowerCase()}.`
                      );
                    }}
                    className="t-meta px-2 py-1 rounded-full border border-[var(--rule)] text-[var(--ink-dim)] hover:text-[var(--ink-muted)] hover:border-[var(--rule-strong)] transition-colors"
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
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 eb-done hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                  >
                    <Timer className="w-3.5 h-3.5 shrink-0" />
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
                  className="w-10 h-10 shrink-0 rounded-lg hover:bg-[var(--surface-sunk)] text-[var(--ink-muted)] hover:eb-warn flex items-center justify-center transition-colors"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${task.pinned ? 'fill-amber-400 eb-warn' : ''}`}
                  />
                </button>
                <button
                  onClick={() => {
                    soundFx.playClick();
                    setEditingTask(task);
                    setComposerOpen(true);
                  }}
                  aria-label="Edit task"
                  className="w-10 h-10 shrink-0 rounded-lg hover:bg-[var(--surface-sunk)] text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                </button>
              </>
            )}
            <button
              onClick={() => handleDelete(task)}
              aria-label="Delete task"
              className="w-10 h-10 shrink-0 rounded-lg hover:bg-rose-500/15 text-[var(--ink-muted)] hover:eb-danger flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* One line rather than a card: the ring duplicated Home and pushed
          the list itself below the fold, which is what people complained
          about. */}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="t-title">Tasks</h1>
        <span className="t-meta shrink-0">
          {priorities.done}/{priorities.total} done today
        </span>
      </div>

      <div
        className="h-1.5 rounded-full overflow-hidden mt-3"
        style={{ background: 'var(--surface-sunk)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: pct >= 1 ? 'var(--done)' : 'var(--signal)' }}
          initial={false}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* The "next action" card lives on Home, which owns that role. Repeating
          it here duplicated the top of a list that is already priority-ranked. */}

      {stuck && tab === 'today' && (
        <StuckTaskCard
          task={stuck}
          onDismiss={() => setStuckDismissed(stuck.id)}
          onStartFocus={(task) => onStartFocus?.(task)}
          onSplit={(task) => setDetailId(task.id)}
        />
      )}

      {/* Needs attention */}
      {overdue.length > 0 && tab === 'today' && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 eb-warn" />
            <span className="t-meta eb-warn tracking-widest uppercase">
              Needs attention
            </span>
          </div>
          <p className="text-[11px] text-[var(--ink-muted)] mt-1">
            {overdue.length} task{overdue.length === 1 ? '' : 's'} passed their date. Move or
            finish.
          </p>
        </div>
      )}

      {/* Search. Flex row rather than an absolutely-positioned icon: the
          icon and the field are siblings, so text can never run under it. */}
      <div
        className="flex items-center gap-2.5 rounded-xl px-3.5 transition-colors"
        style={{
          background: 'var(--surface)',
          border: `1px solid ${searchFocused ? 'var(--signal)' : 'var(--rule)'}`,
          minHeight: 48,
        }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />

        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearch('');
              searchRef.current?.blur();
            }
          }}
          placeholder="Search tasks"
          className="flex-1 min-w-0 bg-transparent text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none border-0 p-0"
        />

        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--ink-dim)' }}
          >
            <X className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>

      {/* Sort. Only shown where it changes anything — sorting the Done tab
          by priority is meaningless. */}
      {tab !== 'completed' && visible.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { id: 'date' as const, label: 'By date' },
            { id: 'priority' as const, label: 'By priority' },
            { id: 'quick' as const, label: 'Quickest first' },
          ]).map((option) => (
            <button
              key={option.id}
              onClick={() => {
                soundFx.playClick();
                setSortBy(option.id);
              }}
              className="chip"
              data-active={sortBy === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabs + time filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: 'today' as TabId, label: 'Today', count: buckets.today.length },
          ...(overdue.length > 0
            ? [{ id: 'overdue' as TabId, label: 'Overdue', count: overdue.length }]
            : []),
          { id: 'upcoming' as TabId, label: 'Upcoming', count: buckets.upcoming.length },
          { id: 'completed' as TabId, label: 'Done', count: buckets.completed.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              soundFx.playClick();
              setTab(t.id);
            }}
            data-active={tab === t.id}
            className="chip shrink-0"
          >
            {t.label}
            <span className="opacity-55">{t.count}</span>
          </button>
        ))}

        {tab !== 'completed' && (
          <div className="flex items-center gap-1 ml-auto">
            {[15, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => setTimeFilter(timeFilter === m ? undefined : m)}
                title={`Show what fits in ${m} minutes`}
                className={`chip shrink-0 ${
                  timeFilter === m
                    ? 'eb-done bg-emerald-500/12 border-emerald-500/30'
                    : 'text-[var(--ink-dim)] border-[var(--rule)] hover:border-[var(--rule-strong)]'
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
        <div className="text-center py-12 px-6 border border-dashed border-[var(--rule)] rounded-2xl">
          <p className="t-section">
            {tab === 'today'
              ? 'Clear day.'
              : tab === 'upcoming'
                ? 'Nothing scheduled.'
                : 'Nothing finished yet.'}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)] mt-1.5 max-w-xs mx-auto leading-relaxed">
            {tab === 'today'
              ? 'Nothing is waiting on you. Add what matters and start.'
              : tab === 'upcoming'
                ? 'Give a task a date and it waits here until the day arrives.'
                : 'Completed work collects here so you can see what you got done.'}
          </p>
          {tab !== 'completed' && (
            <button
              onClick={() => inputRef.current?.focus()}
              className="btn-lg mt-5"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Add task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tab === 'today' && visible.some((t) => t.pinned) && (
            <p className="t-meta eb-warn/80 tracking-widest uppercase pt-1">
              Today's priorities
            </p>
          )}
          <AnimatePresence initial={false}>
            {visible.filter((t) => t.pinned).map((t) => renderCard(t, true))}
          </AnimatePresence>

          {tab === 'today' &&
            visible.some((t) => t.pinned) &&
            visible.some((t) => !t.pinned) && (
              <p className="eb-label pt-2">
                Everything else
              </p>
            )}
          <AnimatePresence initial={false}>
            {visible.filter((t) => !t.pinned).map((t) => renderCard(t))}
          </AnimatePresence>
        </div>
      )}

      {!userId && (
        <p className="t-meta text-center">
          Signed out — tasks stay on this device until you sign in.
        </p>
      )}

      <TaskDetailSheet
        task={detailTask}
        goals={goals}
        onClose={() => setDetailId(null)}
        onPatch={(changes) => detailTask && patch(detailTask, changes)}
        onDelete={() => detailTask && handleDelete(detailTask)}
        onStartFocus={onStartFocus}
      />

      <AddButton label="Add task" onClick={() => setComposerOpen(true)} />

      <ComposerSheet
        open={composerOpen}
        title={editingTask ? 'Edit task' : 'New task'}
        onClose={() => {
          setComposerOpen(false);
          setEditingTask(null);
        }}
      >
        <TaskComposer
          task={editingTask}
          goals={goals}
          onCancel={() => {
            setComposerOpen(false);
            setEditingTask(null);
          }}
          onSave={async (fields) => {
            if (editingTask) {
              const updated = { ...editingTask, ...fields, updatedAt: new Date().toISOString() };
              applyLocal((list) => list.map((t) => (t.id === updated.id ? updated : t)));
              await saveTask(userId, updated);
            } else {
              const task = makeTask(fields.title, fields.priority, fields.dueDate);
              Object.assign(task, {
                dueTime: fields.dueTime,
                estimatedMinutes: fields.estimatedMinutes,
                goalId: fields.goalId,
                notes: fields.notes,
              });
              applyLocal((list) => [task, ...list]);
              await saveTask(userId, task);
            }
            setComposerOpen(false);
            setEditingTask(null);
          }}
        />
      </ComposerSheet>

      {/* Toasts */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="pointer-events-auto eb-card-sunk px-3.5 py-2.5 shadow-none flex items-center gap-3"
            >
              <span className="text-[11px] text-[var(--ink)] flex-1 min-w-0">{t.message}</span>
              {t.undo && (
                <button
                  onClick={() => {
                    t.undo!();
                    setToasts((list) => list.filter((x) => x.id !== t.id));
                  }}
                  className="t-meta font-black text-[var(--signal-ink)] hover:text-[#C4B5FD] shrink-0"
                >
                  UNDO
                </button>
              )}
              <button
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
                className="w-9 h-9 rounded-lg hover:bg-[#20252E] text-[var(--ink-dim)] flex items-center justify-center shrink-0"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
