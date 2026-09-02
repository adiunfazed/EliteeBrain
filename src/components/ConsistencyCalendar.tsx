import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MomentumInput } from '../lib/momentum';
import { momentumForDate } from '../lib/momentum';
import { todayISO } from '../lib/tasks';

interface Props {
  input: MomentumInput;
}

/**
 * Month calendar shaded by how much of each day was completed.
 *
 * Shading comes from the same score the rest of the app uses, so a day here
 * can never disagree with a day elsewhere. Days with nothing recorded are left
 * unshaded rather than shaded as failures — no data is not the same as a bad
 * day, and colouring it red would be a lie that discourages people.
 */
export const ConsistencyCalendar: React.FC<Props> = ({ input }) => {
  const today = todayISO();
  const [offset, setOffset] = useState(0);

  const { label, cells } = useMemo(() => {
    const base = new Date(`${today}T00:00:00`);
    base.setMonth(base.getMonth() + offset, 1);

    const year = base.getFullYear();
    const month = base.getMonth();
    const monthLabel = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday-first grid.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;

    const out: ({ date: string; day: number; score: number | null; isToday: boolean } | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // Future days have nothing to score.
      const score = iso > today ? null : momentumForDate(input, iso).score;
      out.push({ date: iso, day: d, score, isToday: iso === today });
    }

    return { label: monthLabel, cells: out };
  }, [input, today, offset]);

  // Four steps rather than a continuous gradient — easier to read at a glance.
  const shade = (score: number | null) => {
    if (score === null) return { background: 'var(--surface-sunk)', color: 'var(--ink-muted)' };
    if (score >= 80) return { background: 'var(--signal)', color: '#fff' };
    if (score >= 50) return { background: 'color-mix(in oklab, var(--signal) 62%, transparent)', color: '#fff' };
    if (score >= 20) return { background: 'color-mix(in oklab, var(--signal) 34%, transparent)', color: 'var(--ink)' };
    return { background: 'color-mix(in oklab, var(--signal) 14%, transparent)', color: 'var(--ink-muted)' };
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="t-section">{label}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous month"
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label="Next month"
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mt-4">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="t-meta text-center text-[10px]">
            {d}
          </span>
        ))}

        {cells.map((c, i) =>
          c === null ? (
            <span key={`pad-${i}`} />
          ) : (
            <span
              key={c.date}
              title={c.score === null ? c.date : `${c.date}: ${c.score}% of the day done`}
              style={shade(c.score)}
              className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-mono tabular-nums ${
                c.isToday ? 'ring-2 ring-[var(--signal)]' : ''
              }`}
            >
              {c.day}
            </span>
          )
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="t-meta text-[10px]">Less</span>
        {[0, 25, 55, 85].map((v) => (
          <span key={v} style={shade(v)} className="w-3.5 h-3.5 shrink-0 rounded" />
        ))}
        <span className="t-meta text-[10px]">More</span>
      </div>
    </div>
  );
};
