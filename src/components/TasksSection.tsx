import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { GripVertical, CalendarClock, ChevronRight, ArrowUpDown, Bell, Target,
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
import { SwipeableRow } from './SwipeableRow';
import { byManualOrder, positionFor, needsRebalance, rebalance } from '../lib/ordering';
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
  /** Opens a goal found by search. */
  onOpenGoal?: (goalId: string) => void;
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

export const TasksSection: React.FC<Props> = ({ userId, goals = [], onStartFocus, onOpenGoal }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<TabId>('today');
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [draftPriority] = useState<TaskPriority>('normal');
  const [draftCategory, setDraftCategory] = useState<TaskCategory | undefined>();
  const [draftEnergy, setDraftEnergy] = useState<TaskEnergy | undefined>();
  const [draftMinutes, setDraftMinutes] = useState<number | undefined>();
  const [draftDue, setDraftDue] = useState<string | undefined>();
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
  const [openSubtasks, setOpenSubtasks] = useState<Record<string, boolean>>({});
  /** Ids picked for a bulk action. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /**
   * A single drag controller, shared by every row.
   *
   * useDragControls is a hook and cannot be called per item. Only one row
   * drags at a time, so one controller is sufficient — the handle that
   * starts it determines which row moves.
   */
  const dragControls = useDragControls();
  /** Live order during a drag, before it is committed. */
  const [dragOrder, setDragOrder] = useState<Task[] | null>(null);
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

  /** Goals whose title matches the current search. */
  const matchingGoals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return goals.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 4);
  }, [goals, search]);
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
    let found = searchTasks(base, search);

    // Also match tasks by the goal they belong to, so searching a goal name
    // finds the work attached to it.
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchingGoalIds = new Set(
        goals.filter((g) => g.title.toLowerCase().includes(q)).map((g) => g.id)
      );
      if (matchingGoalIds.size > 0) {
        const byGoal = base.filter((t) => t.goalId && matchingGoalIds.has(t.goalId));
        const seen = new Set(found.map((t) => t.id));
        found = [...found, ...byGoal.filter((t) => !seen.has(t.id))];
      }
    }

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

    // Manual order applies only to the default sort. Under an explicit sort
    // the user has asked for a specific ordering, and honouring drags too
    // would leave the two fighting each other.
    return byManualOrder(found, () => 0);
  }, [buckets, overdue, tab, search, sortBy, goals]);

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

  /**
   * Persist a drag.
   *
   * Writes only the moved task: its neighbours keep their positions, so a
   * reorder costs one write rather than one per row.
   */
  const commitReorder = async (moved: Task) => {
    const next = dragOrder;
    setDragOrder(null);
    if (!next) return;

    const index = next.findIndex((t) => t.id === moved.id);
    if (index < 0) return;

    const order = positionFor(
      next.filter((t) => t.id !== moved.id),
      index
    );

    applyLocal((list) =>
      list.map((t) => (t.id === moved.id ? { ...t, manualOrder: order } : t))
    );

    try {
      await patchTask(userId, moved.id, { manualOrder: order });

      // Gaps halve with each midpoint drop and eventually collide, which
      // would silently break ordering. Renumbering is many writes, so it runs
      // only when the gaps have actually collapsed.
      const current = byManualOrder(
        next.map((t) => (t.id === moved.id ? { ...t, manualOrder: order } : t)),
        () => 0
      );

      if (needsRebalance(current)) {
        const spaced = rebalance(current);
        applyLocal((list) =>
          list.map((t) => {
            const hit = spaced.find((s) => s.item.id === t.id);
            return hit ? { ...t, manualOrder: hit.manualOrder } : t;
          })
        );
        await Promise.all(
          spaced.map((s) => patchTask(userId, s.item.id, { manualOrder: s.manualOrder }))
        );
      }
    } catch (err) {
      console.error('Could not save the new order:', err);
    }
  };

  const renderCard = (task: Task, highlight = false) => {
    const pri = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.normal;
    const PriIcon = pri.icon;
    const isOverdue = !!task.dueDate && task.dueDate < todayISO() && !task.completed;

    return (
      <SwipeableRow
        key={task.id}
        disabled={task.completed || selected.size > 0}
        rightAction="complete"
        leftAction="reschedule"
        onSwipeRight={() => handleToggle(task)}
        onSwipeLeft={() => {
          const value = shiftDate(1);
          const pushed = !!task.dueDate && value > task.dueDate;
          patch(
            task,
            {
              dueDate: value,
              ...(pushed
                ? {
                    postponeCount: (task.postponeCount || 0) + 1,
                    lastPostponedAt: new Date().toISOString(),
                  }
                : {}),
            },
            'Moved to tomorrow.'
          );
        }}
      >
      <motion.div
        layout
        style={
          selected.has(task.id)
            ? {
                outline: '2px solid var(--signal)',
                outlineOffset: -2,
                borderRadius: 16,
              }
            : undefined
        }
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.18 }}
        className="group relative overflow-hidden rounded-2xl eb-card transition-colors"
      >
        {!task.completed && (
          <span
            className={`absolute left-0 top-0 bottom-0 w-[3px] ${pri.bar}`}
          />
        )}
        <div className="p-4 pl-5 flex items-start gap-3.5">
          <button
            onClick={() => handleToggle(task)}
            aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
            className="shrink-0 w-10 h-10 -m-2 flex items-center justify-center"
          >
            <span
              className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-all ${
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
                onClick={() => {
                  if (selected.size > 0) {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                      return next;
                    });
                    return;
                  }
                  setDetailId(task.id);
                }}
                onContextMenu={(e) => {
                  // Long-press on mobile surfaces as a context menu event.
                  e.preventDefault();
                  soundFx.playClick();
                  setSelected((prev) => new Set(prev).add(task.id));
                }}
                className={`text-left text-[15px] leading-snug break-words w-full line-clamp-2 ${
                  task.completed ? 'text-[var(--ink-dim)] line-through' : 'text-[var(--ink)]'
                }`}
              >
                {task.pinned && !task.completed && (
                  <Star className="inline w-3 h-3 mb-0.5 mr-1 eb-warn fill-amber-400" />
                )}
                {task.title}
              </button>
            )}

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {task.dueDate && (
                <span className={`t-meta flex items-center gap-1 ${isOverdue ? 'eb-warn' : ''}`}>
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {prettyDate(task.dueDate)}
                  {task.dueTime ? ` · ${task.dueTime}` : ''}
                </span>
              )}

              {task.estimatedMinutes ? (
                <span className="t-meta flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {task.estimatedMinutes}m
                </span>
              ) : null}

              {task.recurrence && <Repeat className="w-3.5 h-3.5 shrink-0 text-[var(--ink-dim)]" />}

              {(() => {
                const goal = task.goalId ? goals.find((g) => g.id === task.goalId) : null;
                if (!goal) return null;
                return (
                  <span
                    className="t-meta flex items-center gap-1 min-w-0"
                    style={{ color: 'var(--signal-ink)' }}
                  >
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[120px]">{goal.title}</span>
                  </span>
                );
              })()}
            </div>

            {/* Notes and steps, shown inline. Previously they existed but
                nothing on the card indicated what they said. */}
            {task.notes && !task.completed && (
              <p className="t-sub mt-2 leading-snug line-clamp-2">{task.notes}</p>
            )}

            {(task.subtasks?.length || 0) > 0 && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Undefined means open, so the first tap must close it.
                    setOpenSubtasks((prev) => ({
                      ...prev,
                      [task.id]: prev[task.id] === false,
                    }));
                  }}
                  className="flex items-center gap-1.5 t-meta"
                >
                  <ChevronRight
                    className="w-3.5 h-3.5 shrink-0 transition-transform"
                    style={{
                      transform: openSubtasks[task.id] !== false ? 'rotate(90deg)' : undefined,
                    }}
                  />
                  {subtaskProgress(task).done}/{subtaskProgress(task).total} subtasks
                </button>

                {openSubtasks[task.id] !== false && (
                  <div
                    className="mt-2 space-y-1.5 pl-2"
                    style={{ borderLeft: '1px solid var(--rule)' }}
                  >
                    {task.subtasks!.map((st) => (
                  <button
                    key={st.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = (task.subtasks || []).map((x) =>
                        x.id === st.id ? { ...x, done: !x.done } : x
                      );
                      applyLocal((list) =>
                        list.map((t) => (t.id === task.id ? { ...t, subtasks: next } : t))
                      );
                      void patch(task, { subtasks: next });
                    }}
                        className="flex items-center gap-2.5 text-left w-full py-1 pl-2"
                      >
                        <span
                          className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                          style={{
                            background: st.done ? 'var(--done)' : 'transparent',
                            border: `1px solid ${st.done ? 'var(--done)' : 'var(--rule)'}`,
                          }}
                        >
                          {st.done && <Check className="w-3 h-3 shrink-0 text-white" />}
                        </span>
                        <span
                          className="text-[13px] min-w-0 flex-1"
                          style={{
                            textDecoration: st.done ? 'line-through' : undefined,
                            color: st.done ? 'var(--ink-dim)' : 'var(--ink)',
                          }}
                        >
                          {st.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!task.completed && (
              <div className="mt-3 space-y-2">
                {onStartFocus && (
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      onStartFocus(task);
                    }}
                    className="w-full min-h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold overflow-hidden transition-colors"
                    style={{
                      background: 'color-mix(in oklab, var(--done) 14%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--done) 40%, var(--rule))',
                      color: 'var(--done)',
                    }}
                  >
                    <Timer className="w-4 h-4 shrink-0" />
                    <span className="truncate">Start focus</span>
                    {task.estimatedMinutes ? (
                      <span
                        className="shrink-0 tabular-nums px-1.5 py-0.5 rounded-md text-[12px]"
                        style={{
                          background: 'color-mix(in oklab, var(--done) 18%, transparent)',
                        }}
                      >
                        {task.estimatedMinutes}m
                      </span>
                    ) : null}
                  </button>
                )}

                {(isOverdue || tab === 'today') && (
                  <button
                    onClick={() => {
                      const value = shiftDate(1);
                      const pushed = !!task.dueDate && value > task.dueDate;
                      patch(
                        task,
                        {
                          dueDate: value,
                          ...(pushed
                            ? {
                                postponeCount: (task.postponeCount || 0) + 1,
                                lastPostponedAt: new Date().toISOString(),
                              }
                            : {}),
                        },
                        'Moved to tomorrow.'
                      );
                    }}
                    className="btn-text flex items-center gap-1.5"
                  >
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    Move to tomorrow
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
      </SwipeableRow>
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
          placeholder="Search tasks and goals"
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

      {/* Goals matching the search. Tasks are the main result, but a goal
          with that name is often what was actually being looked for. */}
      {search.trim().length > 1 && matchingGoals.length > 0 && (
        <div className="space-y-2">
          <p className="eb-label">Goals</p>
          {matchingGoals.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                soundFx.playClick();
                onOpenGoal?.(g.id);
              }}
              className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
            >
              <Target className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
              <span className="text-[14px] min-w-0 flex-1 truncate">{g.title}</span>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions. Appears only once something is selected, so it costs
          nothing when unused. */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-3 flex items-center gap-2.5 flex-wrap"
          style={{
            background: 'color-mix(in oklab, var(--signal) 14%, var(--surface))',
            border: '1px solid color-mix(in oklab, var(--signal) 40%, var(--rule))',
          }}
        >
          <span className="text-[14px] font-semibold min-w-0 flex-1">
            {selected.size} selected
          </span>

          <button
            onClick={async () => {
              soundFx.playSuccess();
              const picked = tasks.filter((t) => selected.has(t.id) && !t.completed);
              setSelected(new Set());
              for (const t of picked) await handleToggle(t);
            }}
            className="chip shrink-0"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            Complete
          </button>

          <button
            onClick={async () => {
              const value = shiftDate(1);
              const picked = tasks.filter((t) => selected.has(t.id));
              setSelected(new Set());
              for (const t of picked) await patch(t, { dueDate: value });
              pushToast(`Moved ${picked.length} to tomorrow.`);
            }}
            className="chip shrink-0"
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            Tomorrow
          </button>

          <button onClick={() => setSelected(new Set())} className="chip shrink-0">
            Cancel
          </button>
        </motion.div>
      )}

      {/* Sort. A single cycling control rather than three chips competing
          with the tabs above them. */}
      {tab !== 'completed' && visible.length > 1 && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => {
              soundFx.playClick();
              const order = ['date', 'priority', 'quick'] as const;
              setSortBy(order[(order.indexOf(sortBy) + 1) % order.length]);
            }}
            className="btn-text flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
            {sortBy === 'date' ? 'By date' : sortBy === 'priority' ? 'By priority' : 'Quickest first'}
          </button>
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
          {/* Drag to reorder, but only under the default sort and when not
              selecting — otherwise two interactions compete for the gesture. */}
          {sortBy === 'date' && selected.size === 0 ? (
            <Reorder.Group
              axis="y"
              values={visible.filter((t) => !t.pinned)}
              onReorder={(next) => setDragOrder(next)}
              className="space-y-2"
            >
              {(dragOrder ?? visible.filter((t) => !t.pinned)).map((t) => (
                <Reorder.Item
                  key={t.id}
                  value={t}
                  // Dragged only from the handle, so scrolling, swiping and
                  // long-press-to-select all keep working on the card itself.
                  dragListener={false}
                  dragControls={dragControls}
                  onDragEnd={() => commitReorder(t)}
                  whileDrag={{ scale: 1.015, zIndex: 30 }}
                  className="relative"
                >
                  {/* Grip. Small and quiet, but a definite target. */}
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      soundFx.playClick();
                      dragControls.start(e);
                    }}
                    aria-label="Drag to reorder"
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-12 flex items-center justify-center touch-none"
                    style={{ color: 'var(--ink-dim)' }}
                  >
                    <GripVertical className="w-4 h-4 shrink-0" />
                  </button>

                  <div className="pr-7">{renderCard(t)}</div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <AnimatePresence initial={false}>
              {visible.filter((t) => !t.pinned).map((t) => renderCard(t))}
            </AnimatePresence>
          )}
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
                // These were being dropped: the composer collected them and
                // the save ignored them, so subtasks never survived a reopen.
                subtasks: fields.subtasks,
                recurrence: fields.recurrence,
                reminderMinutesBefore: fields.reminderMinutesBefore,
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
