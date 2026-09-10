import React, { useMemo, useState } from 'react';
import { Habit, HabitLog } from '../types';

interface Props {
  habit: Habit;
  logs: HabitLog[];
  /** Days to show in the grid. 84 is twelve weeks, which fits a phone width. */
  days?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Completion history.
 *
 * A grid of the last twelve weeks, one square per day. Streak numbers say how
 * you are doing now; this says what the pattern actually looks like — whether
 * you miss Mondays, or fell off three weeks ago and never restarted.
 */
export const HabitHistory: React.FC<Props> = ({ habit, logs, days = 84 }) => {
  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      if (log.habitId !== habit.id) continue;
      map.set(log.date, log.value || 0);
    }
    return map;
  }, [logs, habit.id]);

  const [view, setView] = useState<'grid' | 'month'>('grid');
  const target = Math.max(1, habit.targetValue || 1);

  /** Whether the habit was due on a given date. */
  const scheduled = (d: Date): boolean => {
    if (habit.cadence === 'daily') return true;
    if (habit.cadence === 'selected_days') return (habit.weekdays || []).includes(d.getDay());
    return true; // weekly: any day counts
  };

  const cells = useMemo(() => {
    const out: { iso: string; value: number; due: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start far enough back that the grid begins on a Sunday, so columns line
    // up as weeks rather than drifting.
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    start.setDate(start.getDate() - start.getDay());

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const iso = isoOf(d);
      out.push({ iso, value: byDate.get(iso) || 0, due: scheduled(d) });
    }
    return out;
  }, [byDate, days, habit.cadence, habit.weekdays]);

  const doneCount = cells.filter((c) => c.value >= target).length;
  const dueCount = cells.filter((c) => c.due).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {(['grid', 'month'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="chip"
            data-active={view === v}
          >
            {v === 'grid' ? '12 weeks' : 'This month'}
          </button>
        ))}
      </div>

      {view === 'month' ? (
        <MonthView habit={habit} byDate={byDate} target={target} scheduled={scheduled} />
      ) : (
      <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eb-label">Last 12 weeks</p>
        <p className="t-meta shrink-0">
          {doneCount} of {dueCount} days
        </p>
      </div>

      {/* Columns are weeks, rows are weekdays — the same shape as a calendar,
          so a missed Monday is visible as a gap in one row. */}
      <div
        className="mt-3 grid grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: 'repeat(7, 1fr)' }}
      >
        {cells.map((cell) => {
          const met = cell.value >= target;
          const partial = cell.value > 0 && !met;

          return (
            <span
              key={cell.iso}
              title={`${cell.iso}${met ? ' — done' : partial ? ' — partial' : cell.due ? ' — missed' : ''}`}
              className="rounded-[3px]"
              style={{
                aspectRatio: '1 / 1',
                background: met
                  ? 'var(--done)'
                  : partial
                    ? 'color-mix(in oklab, var(--warn) 70%, transparent)'
                    : cell.due
                      ? 'var(--surface-sunk)'
                      : 'transparent',
                border: cell.due && !met && !partial ? '1px solid var(--rule)' : 'none',
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3">
        {[
          { color: 'var(--done)', label: 'Done' },
          { color: 'color-mix(in oklab, var(--warn) 70%, transparent)', label: 'Partial' },
          { color: 'var(--surface-sunk)', label: 'Missed' },
        ].map((k) => (
          <span key={k.label} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-[3px] shrink-0"
              style={{ background: k.color, border: '1px solid var(--rule)' }}
            />
            <span className="t-meta">{k.label}</span>
          </span>
        ))}
      </div>
      </div>
      )}
    </div>
  );
};

/**
 * Month view.
 *
 * Same data as the grid, laid out as a calendar with dates visible — for
 * answering "did I do it on the 14th" rather than "what does the pattern
 * look like".
 */
const MonthView: React.FC<{
  habit: Habit;
  byDate: Map<string, number>;
  target: number;
  scheduled: (d: Date) => boolean;
}> = ({ byDate, target, scheduled }) => {
  const [offset, setOffset] = React.useState(0);

  const base = new Date();
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoOf(new Date());

  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(new Date(year, month, i + 1))),
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOffset((o) => o - 1)} className="icon-btn" aria-label="Previous month">
          ‹
        </button>
        <p className="t-section">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          className="icon-btn"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-4">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="t-meta text-center py-1">
            {d}
          </span>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <span key={`pad-${i}`} />;

          const value = byDate.get(cell) || 0;
          const met = value >= target;
          const partial = value > 0 && !met;
          const due = scheduled(new Date(`${cell}T00:00:00`));
          const future = cell > todayIso;

          return (
            <span
              key={cell}
              className="aspect-square rounded-lg flex items-center justify-center text-[13px] font-medium"
              style={{
                background: met
                  ? 'var(--done)'
                  : partial
                    ? 'color-mix(in oklab, var(--warn) 60%, transparent)'
                    : 'transparent',
                border:
                  due && !met && !partial && !future
                    ? '1px solid var(--rule)'
                    : '1px solid transparent',
                color: met || partial ? '#fff' : future ? 'var(--ink-dim)' : 'var(--ink)',
                opacity: future ? 0.4 : 1,
              }}
            >
              {Number(cell.slice(-2))}
            </span>
          );
        })}
      </div>
    </div>
  );
};
