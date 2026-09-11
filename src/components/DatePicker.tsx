import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  /** Currently selected date, ISO yyyy-mm-dd. */
  value?: string;
  onChange: (iso: string | undefined) => void;
  onClose?: () => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}

/**
 * Calendar date picker.
 *
 * Replaces the Today/Tomorrow/Next week chips, which gave no sense of what
 * date was actually being set and made an accidental choice invisible until
 * the task disappeared from today's list.
 *
 * Shortcuts stay, because most tasks really are for today or tomorrow — but
 * the calendar is right there, so any other date is one tap rather than
 * impossible.
 */
export const DatePicker: React.FC<Props> = ({ value, onChange, onClose }) => {
  const today = iso(new Date());
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();

  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (string | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      iso(new Date(month.getFullYear(), month.getMonth(), i + 1))
    ),
  ];

  const shortcuts = [
    { label: 'Today', value: shift(0) },
    { label: 'Tomorrow', value: shift(1) },
    { label: 'Next week', value: shift(7) },
  ];

  return (
    <div>
      {/* Shortcuts. Selected state is explicit, so it is always clear which
          one is active rather than having to infer it. */}
      <div className="flex items-center gap-2 flex-wrap">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            onClick={() => onChange(s.value)}
            className="chip"
            data-active={value === s.value}
          >
            {s.label}
          </button>
        ))}

        {value && (
          <button onClick={() => onChange(undefined)} className="chip" title="Remove the date">
            <X className="w-3.5 h-3.5 shrink-0" />
            Clear
          </button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-3 mt-5">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="icon-btn"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>

        <p className="t-section">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </p>

        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
          className="icon-btn"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-4">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="t-meta text-center py-1">
            {d}
          </span>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <span key={`pad-${i}`} />;

          const selected = cell === value;
          const isToday = cell === today;
          const past = cell < today;

          return (
            <button
              key={cell}
              onClick={() => onChange(cell)}
              className="relative aspect-square rounded-xl text-[14px] font-medium transition-colors flex items-center justify-center"
              style={{
                minHeight: 38,
                background: selected ? 'var(--signal)' : 'transparent',
                color: selected
                  ? '#fff'
                  : past
                    ? 'var(--ink-dim)'
                    : 'var(--ink)',
                border: isToday && !selected ? '1px solid var(--signal)' : '1px solid transparent',
                // Past dates stay selectable — people log things late — but
                // read as secondary so today is easy to find.
                opacity: past && !selected ? 0.5 : 1,
              }}
            >
              {Number(cell.slice(-2))}
            </button>
          );
        })}
      </div>

      {onClose && (
        <button onClick={onClose} className="btn-lg w-full mt-5">
          Done
        </button>
      )}
    </div>
  );
};
