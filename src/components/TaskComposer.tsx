import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Target, Plus, ChevronDown, X, Check, Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { TASK_ICONS } from '../lib/taskIcons';
import { Task, TaskPriority, Subtask, Recurrence } from '../types';
import { DatePicker } from './DatePicker';
import { soundFx } from '../utils/audio';

interface Props {
  /** Existing task when editing; absent when creating. */
  task?: Task | null;
  goals: { id: string; title: string }[];
  onSave: (fields: {
    title: string;
    priority: TaskPriority;
    dueDate?: string;
    dueTime?: string;
    estimatedMinutes?: number;
    goalId?: string;
    notes?: string;
    subtasks?: Subtask[];
    recurrence?: Recurrence;
    reminderMinutesBefore?: number;
    iconId?: string;
  }) => void;
  onCancel: () => void;
}

const PRIORITIES: { id: TaskPriority; label: string; color: string }[] = [
  { id: 'low', label: 'Low', color: '#7E8899' },
  { id: 'normal', label: 'Normal', color: '#7C5CFF' },
  { id: 'high', label: 'High', color: '#FFB020' },
  { id: 'critical', label: 'Critical', color: '#FF5A6E' },
];

const DURATIONS = [15, 30, 45, 60, 90];

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Task composer.
 *
 * Progressive disclosure: the title and a date are all most tasks need, and
 * showing eight fields at once makes adding a task feel like filling a form.
 * Everything else sits behind "More options".
 *
 * Used for editing as well as creating, so a mis-set date is no longer
 * permanent — which was the specific complaint.
 */
export const TaskComposer: React.FC<Props> = ({ task, goals, onSave, onCancel }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'normal');
  const [dueDate, setDueDate] = useState<string | undefined>(task?.dueDate);
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [minutes, setMinutes] = useState<number | undefined>(task?.estimatedMinutes);
  const [goalId, setGoalId] = useState<string | undefined>(task?.goalId);
  const [notes, setNotes] = useState(task?.notes || '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task?.recurrence);
  const [reminderMinutes, setReminderMinutes] = useState<number | undefined>(
    task?.reminderMinutesBefore
  );

  const [showCalendar, setShowCalendar] = useState(false);
  const [iconId, setIconId] = useState<string | undefined>(task?.iconId);
  const [customMinutes, setCustomMinutes] = useState(
    () => !!task?.estimatedMinutes && !DURATIONS.includes(task.estimatedMinutes)
  );
  const [showMore, setShowMore] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    soundFx.playClick();
    onSave({
      title: title.trim(),
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      estimatedMinutes: minutes,
      goalId,
      notes: notes.trim() || undefined,
      // Blank steps are noise; drop them rather than saving empty rows.
      subtasks: subtasks.filter((st) => st.title.trim()),
      recurrence: dueDate ? recurrence : undefined,
      reminderMinutesBefore: dueTime ? reminderMinutes : undefined,
      iconId,
    });
  };

  return (
    <div className="pb-2">
      {/* Title. The one field that always matters, so it gets the most room
          and the focus. */}
      <input
        autoFocus={!task}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) save();
        }}
        placeholder="What needs doing?"
        maxLength={200}
        className="w-full rounded-xl px-4 py-3.5 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
      />

      {/* Icon. Optional, and directly under the title because choosing one is
          part of naming the task rather than a setting. */}
      <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setIconId(undefined)}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={{
            background: !iconId ? 'color-mix(in oklab, var(--signal) 16%, transparent)' : 'transparent',
            border: `1px solid ${!iconId ? 'var(--signal)' : 'var(--rule)'}`,
            color: !iconId ? 'var(--signal-ink)' : 'var(--ink-dim)',
          }}
          aria-label="No icon"
        >
          <Circle className="w-4 h-4 shrink-0" />
        </button>

        {TASK_ICONS.map((entry) => {
          const Icon = (Icons as any)[entry.icon];
          if (!Icon) return null;
          const active = iconId === entry.id;

          return (
            <button
              key={entry.id}
              onClick={() => setIconId(active ? undefined : entry.id)}
              title={entry.label}
              aria-label={entry.label}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklab, var(--signal) 16%, transparent)'
                  : 'transparent',
                border: `1px solid ${active ? 'var(--signal)' : 'var(--rule)'}`,
                color: active ? 'var(--signal-ink)' : 'var(--ink-dim)',
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Date — the second thing anyone sets, so it stays visible. */}
      <button
        onClick={() => setShowCalendar((v) => !v)}
        className="w-full mt-2.5 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          background: 'var(--surface-sunk)',
          border: `1px solid ${showCalendar ? 'var(--signal)' : 'var(--rule)'}`,
        }}
      >
        <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
        <span className="text-[15px] flex-1 min-w-0 text-left">
          {dueDate ? prettyDate(dueDate) : 'No date'}
          {dueTime && <span className="t-meta ml-2">{dueTime}</span>}
        </span>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{
            color: 'var(--ink-dim)',
            transform: showCalendar ? 'rotate(180deg)' : undefined,
          }}
        />
      </button>

      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-4 mt-2"
              style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
            >
              <DatePicker value={dueDate} onChange={setDueDate} />

              {dueDate && (
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--rule)]">
                  <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
                  <span className="text-[14px] flex-1 min-w-0">Time</span>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="rounded-lg px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Priority. Four options fit on one row, so hiding them would cost more
          taps than it saves. */}
      <div className="flex items-center gap-2 mt-2.5">
        {PRIORITIES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPriority(p.id)}
            className="flex-1 min-w-0 min-h-[42px] rounded-xl text-[13px] font-semibold transition-colors"
            style={{
              background:
                priority === p.id
                  ? `color-mix(in oklab, ${p.color} 18%, transparent)`
                  : 'transparent',
              border: `1px solid ${priority === p.id ? p.color : 'var(--rule)'}`,
              color: priority === p.id ? p.color : 'var(--ink-dim)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowMore((v) => !v)}
        className="btn-text mt-3 flex items-center gap-1.5"
      >
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ transform: showMore ? 'rotate(180deg)' : undefined }}
        />
        {showMore ? 'Fewer options' : 'More options'}
      </button>

      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-3">
              <div>
                <p className="eb-label mb-2">How long will it take?</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {DURATIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMinutes(minutes === m ? undefined : m);
                        setCustomMinutes(false);
                      }}
                      className="chip"
                      data-active={minutes === m && !customMinutes}
                    >
                      {m}m
                    </button>
                  ))}

                  <button
                    onClick={() => setCustomMinutes((v) => !v)}
                    className="chip"
                    data-active={customMinutes}
                  >
                    Custom
                  </button>
                </div>

                {customMinutes && (
                  <div className="flex items-center gap-3 mt-3">
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={minutes ?? ''}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setMinutes(Number.isFinite(n) && n > 0 ? Math.min(600, n) : undefined);
                      }}
                      placeholder="Minutes"
                      className="w-28 rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none"
                      style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                    />
                    <span className="t-meta">
                      {minutes
                        ? minutes >= 60
                          ? `${Math.floor(minutes / 60)}h ${minutes % 60 || ''}${minutes % 60 ? 'm' : ''}`
                          : `${minutes} minutes`
                        : 'Enter minutes'}
                    </span>
                  </div>
                )}
              </div>

              {goals.length > 0 && (
                <div>
                  <p className="eb-label mb-2">Part of a goal</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {goals.slice(0, 6).map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGoalId(goalId === g.id ? undefined : g.id)}
                        className="chip max-w-full"
                        data-active={goalId === g.id}
                      >
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{g.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks. A task with steps is a checklist, and splitting it
                  is what stops it being postponed indefinitely. */}
              <div>
                <p className="eb-label mb-2">Subtasks</p>
                <div className="space-y-1.5">
                  {subtasks.map((st, i) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setSubtasks((prev) =>
                            prev.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x))
                          )
                        }
                        aria-label={st.done ? 'Mark not done' : 'Mark done'}
                        className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
                        style={{
                          background: st.done ? 'var(--done)' : 'transparent',
                          border: `1px solid ${st.done ? 'var(--done)' : 'var(--rule)'}`,
                        }}
                      >
                        {st.done && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                      </button>

                      <input
                        value={st.title}
                        onChange={(e) =>
                          setSubtasks((prev) =>
                            prev.map((x) =>
                              x.id === st.id ? { ...x, title: e.target.value } : x
                            )
                          )
                        }
                        placeholder={`Subtask ${i + 1}`}
                        className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
                        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                      />

                      <button
                        onClick={() => setSubtasks((prev) => prev.filter((x) => x.id !== st.id))}
                        aria-label="Remove subtask"
                        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                        style={{ color: 'var(--ink-dim)' }}
                      >
                        <X className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() =>
                    setSubtasks((prev) => [
                      ...prev,
                      { id: `st_${Date.now()}_${prev.length}`, title: '', done: false },
                    ])
                  }
                  className="btn-text mt-2 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  Add a subtask
                </button>
              </div>

              {/* Repeat */}
              <div>
                <p className="eb-label mb-2">Repeat</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Never', value: undefined },
                    { label: 'Daily', value: { freq: 'daily' as const, interval: 1 } },
                    { label: 'Weekly', value: { freq: 'weekly' as const, interval: 1 } },
                    { label: 'Monthly', value: { freq: 'monthly' as const, interval: 1 } },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setRecurrence(option.value)}
                      className="chip"
                      data-active={
                        option.value
                          ? recurrence?.freq === option.value.freq
                          : !recurrence
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {recurrence && !dueDate && (
                  <p className="t-meta mt-2 eb-warn">
                    A repeating task needs a date to repeat from.
                  </p>
                )}
              </div>

              {/* Reminder. Only offered with a time, since a notification
                  needs a moment to fire at. */}
              <div>
                <p className="eb-label mb-2">Remind me</p>
                {dueTime ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: 'No reminder', value: undefined },
                      { label: 'At the time', value: 0 },
                      { label: '10 min before', value: 10 },
                      { label: '30 min before', value: 30 },
                      { label: '1 hour before', value: 60 },
                    ].map((option) => (
                      <button
                        key={option.label}
                        onClick={() => setReminderMinutes(option.value)}
                        className="chip"
                        data-active={reminderMinutes === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="t-meta">Set a time on the date above to add a reminder.</p>
                )}
              </div>

              <div>
                <p className="eb-label mb-2">Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything worth remembering"
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-xl px-4 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none resize-none"
                  style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2.5 mt-6">
        <button onClick={onCancel} className="btn-quiet flex-1">
          Cancel
        </button>
        <button onClick={save} disabled={!title.trim()} className="btn-lg flex-1">
          {task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </div>
  );
};
