import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Plus,
  Trash2,
  Flag,
  Calendar,
  ListTodo,
  Pencil,
  X,
} from 'lucide-react';
import type { Task, TaskPriority } from '../types';
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
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
}

type TabId = 'today' | 'upcoming' | 'completed';

const PRIORITY_STYLE: Record<TaskPriority, { dot: string; label: string; chip: string }> = {
  high: {
    dot: 'bg-rose-400',
    label: 'High',
    chip: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
  },
  normal: {
    dot: 'bg-[#5C6CF2]',
    label: 'Normal',
    chip: 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/30',
  },
  low: {
    dot: 'bg-slate-500',
    label: 'Low',
    chip: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
  },
};

export const TasksSection: React.FC<Props> = ({ userId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<TabId>('today');
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>('normal');
  const [draftDue, setDraftDue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeTasks(userId, setTasks), [userId]);

  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);
  const visible = buckets[tab];

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    soundFx.playClick();
    try {
      await saveTask(userId, makeTask(title, draftPriority, draftDue || undefined));
      setDraft('');
      setDraftDue('');
      setDraftPriority('normal');
    } catch (err) {
      console.error('Could not save task:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (task: Task) => {
    if (!task.completed) soundFx.playSuccess();
    else soundFx.playClick();
    try {
      await toggleTask(userId, task);
    } catch (err) {
      console.error('Could not update task:', err);
    }
  };

  const commitEdit = async (task: Task) => {
    const title = editingText.trim();
    setEditingId(null);
    if (!title || title === task.title) return;
    try {
      await patchTask(userId, task.id, { title });
    } catch (err) {
      console.error('Could not rename task:', err);
    }
  };

  const cyclePriority = async (task: Task) => {
    const order: TaskPriority[] = ['high', 'normal', 'low'];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    soundFx.playClick();
    try {
      await patchTask(userId, task.id, { priority: next });
    } catch (err) {
      console.error('Could not change priority:', err);
    }
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'today', label: 'Today', count: buckets.today.length },
    { id: 'upcoming', label: 'Upcoming', count: buckets.upcoming.length },
    { id: 'completed', label: 'Done', count: buckets.completed.length },
  ];

  const emptyCopy: Record<TabId, { title: string; body: string }> = {
    today: {
      title: 'Nothing planned yet',
      body: 'Add the two or three things that actually matter today. A short list you finish beats a long one you don’t.',
    },
    upcoming: {
      title: 'No scheduled work',
      body: 'Give a task a date and it will wait here until the day arrives.',
    },
    completed: {
      title: 'Nothing finished yet',
      body: 'Completed tasks collect here so you can see what you actually got done.',
    },
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="What needs doing?"
            maxLength={140}
            className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none transition-colors"
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleAdd}
            disabled={!draft.trim() || busy}
            aria-label="Add task"
            className="shrink-0 w-11 h-11 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {(['high', 'normal', 'low'] as TaskPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                soundFx.playClick();
                setDraftPriority(p);
              }}
              className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all ${
                draftPriority === p
                  ? PRIORITY_STYLE[p].chip
                  : 'text-[#5A6472] bg-transparent border-[#2A313C] hover:border-[#3A424F]'
              }`}
            >
              {PRIORITY_STYLE[p].label}
            </button>
          ))}

          <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3] ml-auto">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <input
              type="date"
              value={draftDue}
              min={todayISO()}
              onChange={(e) => setDraftDue(e.target.value)}
              className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1 text-[10px] text-[#F4F6F8] outline-none focus:border-[#5C6CF2]/60"
            />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              soundFx.playClick();
              setTab(t.id);
            }}
            className={`shrink-0 text-[11px] font-mono font-bold px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
              tab === t.id
                ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/40'
                : 'text-[#98A2B3] bg-[#0E1116] border-[#2A313C] hover:border-[#3A424F]'
            }`}
          >
            <span>{t.label}</span>
            <span className="text-[9px] opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-[#2A313C] rounded-2xl">
          <ListTodo className="w-8 h-8 text-[#5A6472] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#F4F6F8] font-mono">{emptyCopy[tab].title}</p>
          <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
            {emptyCopy[tab].body}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18 }}
                className="group bg-[#0E1116] border border-[#2A313C] hover:border-[#3A424F] rounded-2xl p-3 flex items-start gap-3 transition-colors"
              >
                <button
                  onClick={() => handleToggle(task)}
                  aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
                  className="shrink-0 w-10 h-10 -m-2 flex items-center justify-center"
                >
                  <span
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                        : 'border-[#3A424F] hover:border-emerald-500/60'
                    }`}
                  >
                    {task.completed && <Check className="w-4 h-4 stroke-[3]" />}
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
                    <p
                      className={`text-sm leading-snug break-words ${
                        task.completed ? 'text-[#5A6472] line-through' : 'text-[#F4F6F8]'
                      }`}
                    >
                      {task.title}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {!task.completed && (
                      <button
                        onClick={() => cyclePriority(task)}
                        title="Change priority"
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${PRIORITY_STYLE[task.priority].chip}`}
                      >
                        <Flag className="w-2.5 h-2.5" />
                        {PRIORITY_STYLE[task.priority].label}
                      </button>
                    )}
                    {task.dueDate && (
                      <span className="text-[9px] font-mono text-[#98A2B3] flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {!task.completed && (
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
                  )}
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      removeTask(userId, task.id).catch((e) =>
                        console.error('Could not delete task:', e)
                      );
                    }}
                    aria-label="Delete task"
                    className="w-10 h-10 rounded-lg hover:bg-rose-500/15 text-[#98A2B3] hover:text-rose-300 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!userId && (
        <p className="text-[10px] text-[#98A2B3] font-mono text-center flex items-center justify-center gap-1.5">
          <X className="w-3 h-3" />
          Signed out — tasks stay on this device only.
        </p>
      )}
    </div>
  );
};
