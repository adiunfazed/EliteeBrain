import React, { useMemo } from 'react';
import { Trophy, Check } from 'lucide-react';
import { WorkoutSession, exerciseById, personalRecords } from '../../lib/bodyTraining';

interface Props {
  sessions: WorkoutSession[];
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;

  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Workout history.
 *
 * Inside Body Training rather than a new navigation destination: history is
 * something you glance at after finishing, not somewhere you go.
 */
export const WorkoutHistory: React.FC<Props> = ({ sessions }) => {
  const stats = useMemo(() => {
    // One definition of a personal best, shared with the runner and the PR
    // celebration, so the three can never disagree about what the record is.
    const best = personalRecords(sessions);
    let totalSets = 0;

    for (const s of sessions) {
      totalSets += Object.values(s.completed || {}).reduce((n, v) => n + v, 0);
    }

    return { best, totalSets, totalWorkouts: sessions.length };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="panel-sm">
        <div className="panel-head">
          <span className="panel-title">History</span>
        </div>
        <p className="t-sub py-1">No workouts yet. Your first one will appear here.</p>
      </div>
    );
  }

  // Every exercise with a record, in library order so the list does not
  // reshuffle each time one of them is beaten.
  const bestEntries = Object.entries(stats.best).filter(([id]) => exerciseById(id));

  return (
    <div className="space-y-3">
      <div className="stat-strip grid-cols-2">
        <div>
          <span className="eb-label block">Workouts</span>
          <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
            {stats.totalWorkouts}
          </span>
        </div>
        <div>
          <span className="eb-label block">Total sets</span>
          <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
            {stats.totalSets}
          </span>
        </div>
      </div>

      {bestEntries.length > 0 && (
        <div className="panel-sm">
          <div className="panel-head">
            <span className="panel-title">Personal bests</span>
            <Trophy className="w-3.5 h-3.5 shrink-0 eb-warn" />
          </div>

          {bestEntries.map(([id, value]) => {
            const ex = exerciseById(id);
            if (!ex) return null;

            return (
              <div key={id} className="panel-row">
                <span className="text-[14px] min-w-0 flex-1 truncate">{ex.name}</span>
                <span className="t-figure shrink-0" style={{ fontSize: 15 }}>
                  {value}
                  <span className="t-meta ml-1">
                    {ex.metric === 'hold' ? 's' : 'reps'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="panel-sm">
        <div className="panel-head">
          <span className="panel-title">Recent workouts</span>
        </div>

        {sessions.slice(0, 8).map((s) => {
          const names = (s.items || [])
            .map((i) => exerciseById(i.exerciseId)?.name)
            .filter(Boolean)
            .join(', ');

          const sets = Object.values(s.completed || {}).reduce((n, v) => n + v, 0);

          // "3 × 12 reps" says what was done; "3 sets" leaves out the part
          // that makes one session harder than another.
          const detail = (s.items || [])
            .map((i) => {
              const ex = exerciseById(i.exerciseId);
              if (!ex) return null;
              // What was actually done, where it was recorded. Older sessions
              // only have the target they were completed against.
              const done = s.results?.[i.exerciseId];
              const per =
                done && done.length > 0 ? Math.max(...done) : i.target;
              return `${i.sets} × ${per}${ex.metric === 'hold' ? 's' : ''}`;
            })
            .filter(Boolean)
            .join(' · ');
          const duration =
            s.finishedAt && s.startedAt
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) /
                      60000
                  )
                )
              : null;

          return (
            <div key={s.id} className="panel-row">
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--done)' }} />

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold truncate">{names || 'Workout'}</span>
                <span className="t-meta block mt-0.5 truncate">
                  {detail || `${sets} ${sets === 1 ? 'set' : 'sets'}`} ·{' '}
                  {prettyDate(s.date)}
                  {duration ? ` · ${duration} min` : ''}
                </span>
              </span>

              {s.xpAwarded > 0 && (
                <span className="t-meta shrink-0" style={{ color: 'var(--signal-ink)' }}>
                  +{s.xpAwarded}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
