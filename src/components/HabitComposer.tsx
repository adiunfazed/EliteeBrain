import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Target } from 'lucide-react';
import { Habit, HabitCadence, HabitMetric } from '../types';
import { soundFx } from '../utils/audio';

interface Props {
  habit?: Habit | null;
  goals: { id: string; title: string }[];
  onSave: (fields: {
    title: string;
    cadence: HabitCadence;
    weekdays?: number[];
    timesPerWeek?: number;
    metric: HabitMetric;
    targetValue: number;
    goalId?: string;
    reminderTime?: string;
  }) => void;
  onCancel: () => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CADENCES: { id: HabitCadence; label: string; hint: string }[] = [
  { id: 'daily', label: 'Every day', hint: 'Due every single day' },
  { id: 'selected_days', label: 'Certain days', hint: 'Pick which days it is due' },
  { id: 'weekly', label: 'Times a week', hint: 'Any days, so long as you hit the count' },
];

const METRICS: { id: HabitMetric; label: string; hint: string }[] = [
  { id: 'yes_no', label: 'Done or not', hint: 'Simple tick' },
  { id: 'count', label: 'A number', hint: 'Pages, reps, glasses' },
  { id: 'duration', label: 'Minutes', hint: 'Time spent' },
];

/**
 * Habit composer.
 *
 * The old form put cadence, metric, target and weekday pickers on screen at
 * once, which made creating a habit feel harder than keeping one. Each choice
 * now reveals only what it actually needs — picking "Every day" never asks
 * which days.
 */
export const HabitComposer: React.FC<Props> = ({ habit, goals, onSave, onCancel }) => {
  const [title, setTitle] = useState(habit?.title || '');
  const [cadence, setCadence] = useState<HabitCadence>(habit?.cadence || 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays || [1, 3, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.timesPerWeek || 3);
  const [metric, setMetric] = useState<HabitMetric>(habit?.metric || 'yes_no');
  const [target, setTarget] = useState(habit?.targetValue || 1);
  const [goalId, setGoalId] = useState<string | undefined>(habit?.goalId);
  const [reminderTime, setReminderTime] = useState<string | undefined>(habit?.reminderTime);
  const [showMore, setShowMore] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    soundFx.playClick();
    onSave({
      title: title.trim(),
      cadence,
      weekdays: cadence === 'selected_days' ? weekdays : undefined,
      timesPerWeek: cadence === 'weekly' ? timesPerWeek : undefined,
      metric,
      // A yes/no habit always has a target of one; anything else would make
      // it impossible to complete.
      targetValue: metric === 'yes_no' ? 1 : Math.max(1, target),
      goalId,
      reminderTime,
    });
  };

  const toggleDay = (d: number) =>
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );

  return (
    <div className="pb-2">
      <input
        autoFocus={!habit}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && title.trim() && save()}
        placeholder="What will you repeat?"
        maxLength={120}
        className="w-full rounded-xl px-4 py-3.5 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none"
        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
      />

      <p className="eb-label mt-5 mb-2">How often</p>
      <div className="space-y-2">
        {CADENCES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCadence(c.id)}
            className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
            style={{
              background:
                cadence === c.id
                  ? 'color-mix(in oklab, var(--signal) 12%, transparent)'
                  : 'transparent',
              border: `1px solid ${cadence === c.id ? 'var(--signal)' : 'var(--rule)'}`,
            }}
          >
            <span
              className="w-4.5 h-4.5 rounded-full border-2 shrink-0 flex items-center justify-center"
              style={{
                width: 18,
                height: 18,
                borderColor: cadence === c.id ? 'var(--signal)' : 'var(--rule-strong)',
              }}
            >
              {cadence === c.id && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--signal)' }}
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-[15px] font-medium block">{c.label}</span>
              <span className="t-meta block mt-0.5">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Only shown when the cadence needs it. */}
      <AnimatePresence>
        {cadence === 'selected_days' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-1.5 pt-4">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className="dot-toggle"
                  data-active={weekdays.includes(i)}
                  aria-label={`Toggle day ${i}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {cadence === 'weekly' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap pt-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setTimesPerWeek(n)}
                  className="chip"
                  data-active={timesPerWeek === n}
                >
                  {n}× a week
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setShowMore((v) => !v)}
        className="btn-text mt-4 flex items-center gap-1.5"
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
            <div className="pt-3 space-y-4">
              <div>
                <p className="eb-label mb-2">How you track it</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMetric(m.id)}
                      className="chip"
                      data-active={metric === m.id}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {metric !== 'yes_no' && (
                <div>
                  <p className="eb-label mb-2">
                    Target per day {metric === 'duration' ? '(minutes)' : ''}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTarget((t) => Math.max(1, t - (metric === 'duration' ? 5 : 1)))}
                      className="icon-btn"
                      aria-label="Less"
                    >
                      −
                    </button>
                    <span className="t-figure text-xl w-14 text-center">{target}</span>
                    <button
                      onClick={() => setTarget((t) => t + (metric === 'duration' ? 5 : 1))}
                      className="icon-btn"
                      aria-label="More"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="eb-label mb-2">Remind me at</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'No reminder', value: undefined },
                    { label: '7:00', value: '07:00' },
                    { label: '12:00', value: '12:00' },
                    { label: '18:00', value: '18:00' },
                    { label: '21:00', value: '21:00' },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setReminderTime(option.value)}
                      className="chip"
                      data-active={reminderTime === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="t-meta mt-2">Only on days this habit is scheduled.</p>
              </div>

              {goals.length > 0 && (
                <div>
                  <p className="eb-label mb-2">Supports a goal</p>
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
          {habit ? 'Save changes' : 'Add habit'}
        </button>
      </div>
    </div>
  );
};
