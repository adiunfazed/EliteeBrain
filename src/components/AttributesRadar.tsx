import React, { useMemo } from 'react';
import type { MomentumInput } from '../lib/momentum';
import { todayISO } from '../lib/tasks';
import { isScheduledOn, valueOn } from '../lib/habits';
import { blocksForDate } from '../lib/routine';

interface Props {
  input: MomentumInput;
  days?: number;
}

/**
 * Attributes radar.
 *
 * Six axes scored from real activity over the window. Each is a ratio of what
 * was completed against what was scheduled, so an untracked axis sits at zero
 * rather than being invented — the shape describes the user's record, it is
 * not a personality assessment.
 */

const AXES = [
  { key: 'strength', label: 'STRENGTH' },
  { key: 'nutrition', label: 'NUTRITION' },
  { key: 'discipline', label: 'DISCIPLINE' },
  { key: 'streak', label: 'STREAK' },
  { key: 'volume', label: 'VOLUME' },
  { key: 'focus', label: 'FOCUS' },
] as const;

function shift(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const AttributesRadar: React.FC<Props> = ({ input, days = 30 }) => {
  const today = todayISO();

  const scores = useMemo(() => {
    const dates = Array.from({ length: days }, (_, i) => shift(today, -i));

    let exDone = 0, exTotal = 0;
    let mealDone = 0, mealTotal = 0;
    let blocksDone = 0, blocksTotal = 0;

    for (const d of dates) {
      for (const { block, state } of blocksForDate(input.routineBlocks, input.routineLogs, d)) {
        blocksTotal++;
        if (state === 'done') blocksDone++;
        if (block.kind === 'exercise') {
          exTotal++;
          if (state === 'done') exDone++;
        }
        if (block.kind === 'meal') {
          mealTotal++;
          if (state === 'done') mealDone++;
        }
      }
    }

    let habitDone = 0, habitTotal = 0;
    for (const d of dates) {
      for (const h of input.habits.filter((x) => x.status === 'active' && isScheduledOn(x, d))) {
        habitTotal++;
        if (valueOn(input.habitLogs, h.id, d) >= Math.max(1, h.targetValue || 1)) habitDone++;
      }
    }

    const activeDays = dates.filter(
      (d) =>
        input.tasks.some((t) => t.completed && (t.completedAt || '').startsWith(d)) ||
        input.routineLogs.some((l) => l.date === d && l.state === 'done') ||
        input.habitLogs.some((l) => l.date === d && (l.value || 0) > 0) ||
        input.focusSessions.some((s) => s.startedAt.startsWith(d))
    ).length;

    const tasksDone = input.tasks.filter(
      (t) => t.completed && dates.some((d) => (t.completedAt || '').startsWith(d))
    ).length;

    const focusMin =
      input.focusSessions
        .filter((s) => dates.some((d) => s.startedAt.startsWith(d)))
        .reduce((sum, s) => sum + (s.focusedSeconds || 0), 0) / 60;

    const ratio = (done: number, total: number) => (total > 0 ? Math.min(1, done / total) : 0);

    return {
      strength: ratio(exDone, exTotal),
      // Habits stand in for nutrition when no meal blocks exist, since that is
      // where most people record eating.
      nutrition: mealTotal > 0 ? ratio(mealDone, mealTotal) : ratio(habitDone, habitTotal),
      discipline: ratio(blocksDone, blocksTotal),
      streak: Math.min(1, activeDays / days),
      volume: Math.min(1, tasksDone / (days * 3)),
      focus: Math.min(1, focusMin / (days * 45)),
    } as Record<string, number>;
  }, [input, today, days]);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 82;

  const point = (i: number, value: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    const dist = r * Math.max(0.04, value);
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
  };

  const shape = AXES.map((a, i) => point(i, scores[a.key] || 0).join(',')).join(' ');
  const hasAny = AXES.some((a) => (scores[a.key] || 0) > 0.02);

  return (
    <div className="panel">
      <h3 className="t-section">Attributes</h3>
      <p className="t-sub">Last {days} days of recorded activity</p>

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto mt-2">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={AXES.map((_, i) => point(i, f).join(',')).join(' ')}
            fill="none"
            stroke="var(--rule)"
            strokeWidth="1"
          />
        ))}

        {AXES.map((_, i) => {
          const [x, y] = point(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--rule)" strokeWidth="1" />;
        })}

        {hasAny && (
          <polygon
            points={shape}
            fill="var(--signal)"
            fillOpacity="0.3"
            stroke="var(--signal)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {AXES.map((a, i) => {
          const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
          return (
            <text
              key={a.key}
              x={cx + Math.cos(angle) * (r + 24)}
              y={cy + Math.sin(angle) * (r + 24)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9"
              letterSpacing="1"
              fill="var(--ink-muted)"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {a.label}
            </text>
          );
        })}
      </svg>

      {!hasAny && (
        <p className="t-sub text-center">
          Complete routine blocks, habits or focus sessions and your shape appears here.
        </p>
      )}
    </div>
  );
};
