import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Repeat, Target } from 'lucide-react';
import { RoutineBlock, BlockKind, Habit } from '../types';
import { soundFx } from '../utils/audio';

interface Props {
  block?: RoutineBlock | null;
  habits: Habit[];
  goals: { id: string; title: string }[];
  onSave: (fields: {
    title: string;
    kind: BlockKind;
    startTime: string;
    endTime: string;
    weekdays?: number[];
    habitId?: string;
    goalId?: string;
    reminderMinutesBefore?: number;
  }) => void;
  onCancel: () => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KINDS: { id: BlockKind; label: string; color: string }[] = [
  { id: 'study', label: 'Study', color: '#7A63E0' },
  { id: 'work', label: 'Work', color: '#5B8DEF' },
  { id: 'exercise', label: 'Exercise', color: '#00C2A8' },
  { id: 'meal', label: 'Meal', color: '#FFB020' },
  { id: 'sleep', label: 'Sleep', color: '#7FD4E8' },
  { id: 'personal', label: 'Personal', color: '#E8A0C8' },
];

/** Adds minutes to a HH:MM string, wrapping past midnight. */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + mins + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function durationOf(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return mins;
}

/**
 * Routine block composer.
 *
 * Duration is chosen rather than an end time, because people think "an hour
 * of study", not "09:00 to 10:00" — and picking two times independently makes
 * it easy to create a block that ends before it starts.
 */
export const RoutineComposer: React.FC<Props> = ({
  block,
  habits,
  goals,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(block?.title || '');
  const [kind, setKind] = useState<BlockKind>(block?.kind || 'work');
  const [startTime, setStartTime] = useState(block?.startTime || '09:00');
  const [minutes, setMinutes] = useState(() =>
    block ? durationOf(block.startTime, block.endTime) : 60
  );
  const [weekdays, setWeekdays] = useState<number[]>(block?.weekdays || []);
  const [habitId, setHabitId] = useState<string | undefined>(block?.habitId);
  const [goalId, setGoalId] = useState<string | undefined>(block?.goalId);
  const [reminderMinutes, setReminderMinutes] = useState<number | undefined>(
    block?.reminderMinutesBefore
  );
  const [showMore, setShowMore] = useState(false);

  const endTime = addMinutes(startTime, minutes);

  const save = () => {
    if (!title.trim()) return;
    soundFx.playClick();
    onSave({
      title: title.trim(),
      kind,
      startTime,
      endTime,
      // Empty means every day, which is what the data model expects.
      weekdays: weekdays.length > 0 && weekdays.length < 7 ? weekdays : undefined,
      habitId,
      goalId,
      reminderMinutesBefore: reminderMinutes,
    });
  };

  const toggleDay = (d: number) =>
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );

  return (
    <div className="pb-2">
      <input
        autoFocus={!block}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && title.trim() && save()}
        placeholder="What is this block for?"
        maxLength={120}
        className="w-full rounded-xl px-4 py-3.5 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
      />

      <div className="flex items-center gap-3 mt-4">
        <div className="min-w-0 flex-1">
          <p className="eb-label mb-2">Starts</p>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl px-3 py-3 text-[15px] text-[var(--ink)] outline-none"
            style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="eb-label mb-2">Ends</p>
          {/* Derived, not entered: picking both independently makes it easy to
              create a block that ends before it begins. */}
          <input
            type="time"
            value={endTime}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              // Setting the end directly recomputes the duration, so the two
              // controls always agree rather than fighting each other.
              const mins = durationOf(startTime, next);
              setMinutes(mins > 0 ? mins : 1440 + mins);
            }}
            className="w-full rounded-xl px-3 py-3 text-[15px] text-[var(--ink)] outline-none"
            style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
          />
        </div>
      </div>

      <p className="eb-label mt-4 mb-2">How long</p>
      <div className="flex items-center gap-2 flex-wrap">
        {[15, 30, 45, 60, 90, 120, 180, 240, 480].map((m) => (
          <button
            key={m}
            onClick={() => setMinutes(m)}
            className="chip"
            data-active={minutes === m}
          >
            {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`}
          </button>
        ))}
      </div>
      <p className="t-meta mt-2">
        {minutes >= 60
          ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
          : `${minutes} minutes`}
        {' · or set the end time above'}
      </p>

      <p className="eb-label mt-5 mb-2">Type</p>
      <div className="flex items-center gap-2 flex-wrap">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className="chip"
            data-active={kind === k.id}
            style={
              kind === k.id
                ? {
                    color: k.color,
                    borderColor: `color-mix(in oklab, ${k.color} 55%, var(--rule))`,
                    background: `color-mix(in oklab, ${k.color} 14%, transparent)`,
                  }
                : undefined
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="eb-label mt-5 mb-2">Which days</p>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => (
          <button
            key={i}
            onClick={() => toggleDay(i)}
            className="dot-toggle"
            data-active={weekdays.length === 0 || weekdays.includes(i)}
            aria-label={`Toggle day ${i}`}
          >
            {d}
          </button>
        ))}
      </div>
      {weekdays.length === 0 && <p className="t-meta mt-2">Every day</p>}

      <button
        onClick={() => setShowMore((v) => !v)}
        className="btn-text mt-4 flex items-center gap-1.5"
      >
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ transform: showMore ? 'rotate(180deg)' : undefined }}
        />
        {showMore ? 'Fewer options' : 'Link to a habit or goal'}
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
            <div className="pt-3 space-y-4">
              <div>
                <p className="eb-label mb-2">Remind me before</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'No reminder', value: undefined },
                    { label: 'At the time', value: 0 },
                    { label: '10 min', value: 10 },
                    { label: '30 min', value: 30 },
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
              </div>

              {habits.length > 0 && (
                <div>
                  <p className="eb-label mb-2">Completes a habit</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {habits.slice(0, 6).map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setHabitId(habitId === h.id ? undefined : h.id)}
                        className="chip max-w-full"
                        data-active={habitId === h.id}
                      >
                        <Repeat className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{h.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {goals.length > 0 && (
                <div>
                  <p className="eb-label mb-2">Works toward</p>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2.5 mt-6">
        <button onClick={onCancel} className="btn-quiet flex-1">
          Cancel
        </button>
        <button onClick={save} disabled={!title.trim()} className="btn-lg flex-1">
          {block ? 'Save changes' : 'Add block'}
        </button>
      </div>
    </div>
  );
};
