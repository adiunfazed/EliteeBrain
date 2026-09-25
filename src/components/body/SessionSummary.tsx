import React from 'react';
import { Check, Trophy, Zap } from 'lucide-react';
import { TemplateItem } from '../../lib/workoutTemplates';

export interface SummaryLine {
  item: TemplateItem;
  /** Every set actually logged, in order, with the weight it was done at. */
  sets: { weight: number; reps: number }[];
  /** Sets that met their target. Only these count toward XP. */
  completedSets: number;
  /** True when one of this exercise's sets beat a record it started with. */
  record: boolean;
}

interface Props {
  title: string;
  lines: SummaryLine[];
  xp: number;
  prXp: number;
  onDone: () => void;
}

/**
 * What just happened, before it is filed away in history.
 *
 * Per exercise rather than one total: "42 reps" says nothing about a session,
 * while "Bench press 3 × 8, best 8" is the line someone actually wants to see
 * and compare against next week. Sets that fell short are shown as they
 * happened — an eight out of a planned ten is honest work, and hiding it
 * would make the history a record of intentions rather than training.
 */
export const SessionSummary: React.FC<Props> = ({ title, lines, xp, prXp, onDone }) => {
  const totalSets = lines.reduce((n, l) => n + l.sets.length, 0);
  const worked = lines.filter((l) => l.sets.length > 0).length;
  const volume = lines.reduce(
    (n, l) => n + l.sets.reduce((v, set) => v + set.weight * set.reps, 0),
    0
  );
  const records = lines.filter((l) => l.record).length;

  return (
    <div className="space-y-4">
      <div className="text-center pt-2">
        <span className="done-mark mx-auto">
          <Check className="w-8 h-8 shrink-0" />
        </span>

        <h2 className="t-title mt-3">{title} complete</h2>
        <p className="t-sub mt-1">
          {/* Only exercises with work done are counted: a skipped one is
              listed below, but it was not part of the session. */}
          {totalSets} {totalSets === 1 ? 'set' : 'sets'} across {worked}{' '}
          {worked === 1 ? 'exercise' : 'exercises'}
          {records > 0 && ` · ${records} personal ${records === 1 ? 'best' : 'bests'}`}
        </p>
      </div>

      <div className="panel-sm">
        <div className="panel-head">
          <span className="panel-title">This session</span>
        </div>

        {lines.map((line, index) => {
          const unit = line.item.metric === 'hold' ? 's' : '';
          const heaviest = line.sets.reduce((n, set) => Math.max(n, set.weight), 0);
          const bestSet = [...line.sets].sort(
            (a, b) => b.weight - a.weight || b.reps - a.reps
          )[0];

          return (
            <div key={`${line.item.exerciseId}:${index}`} className="panel-row">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold truncate">{line.item.name}</span>
                <span className="t-meta block mt-0.5 tabular-nums">
                  {line.sets.length > 0
                    ? line.sets
                        .map((set) =>
                          set.weight > 0
                            ? `${set.weight} kg × ${set.reps}${unit}`
                            : `${set.reps}${unit || ' reps'}`
                        )
                        .join(' · ')
                    : 'skipped'}
                </span>
              </span>

              {line.record && bestSet && (
                <span className="pr-chip shrink-0">
                  <Trophy className="w-3 h-3 shrink-0" />
                  {heaviest > 0 ? `${bestSet.weight} kg × ${bestSet.reps}` : `${bestSet.reps}${unit}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {volume > 0 && (
        <p className="t-sub text-center">
          {Math.round(volume).toLocaleString()} kg moved in total.
        </p>
      )}

      {(xp > 0 || prXp > 0) && (
        <div className="stat-strip grid-cols-2">
          <div>
            <span className="eb-label block">Workout XP</span>
            <span className="t-figure block mt-1.5 flex items-center gap-1" style={{ fontSize: 22 }}>
              <Zap className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />+{xp}
            </span>
          </div>
          <div>
            <span className="eb-label block">Record XP</span>
            <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
              +{prXp}
            </span>
          </div>
        </div>
      )}

      <button onClick={onDone} className="btn-lg w-full">
        Done
      </button>
    </div>
  );
};
