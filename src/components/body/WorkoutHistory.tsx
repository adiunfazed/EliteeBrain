import React, { useMemo } from 'react';
import { Trophy, Check, Dumbbell } from 'lucide-react';
import { WorkoutSession } from '../../lib/bodyTraining';
import { WorkoutTemplate, exerciseNameFor, metricFor } from '../../lib/workoutTemplates';
import { RecordViews, recordLabel } from '../../lib/personalRecords';

interface Props {
  sessions: WorkoutSession[];
  /** Consulted for the names of user-named exercises. */
  templates?: WorkoutTemplate[];
  /** The merged personal bests, so history and the library agree exactly. */
  records?: RecordViews;
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
 *
 * Names come from the session itself first, then from the workout it was run
 * from — so a bench press stays a bench press in the history even after the
 * workout that named it has been deleted.
 */
export const WorkoutHistory: React.FC<Props> = ({ sessions, templates = [], records }) => {
  /** Every name the sessions themselves carry, which outlive any template. */
  const namesFromSessions = useMemo(() => {
    const names: Record<string, string> = {};
    const metrics: Record<string, 'reps' | 'hold'> = {};
    for (const s of sessions) {
      for (const item of s.items || []) {
        if (item?.exerciseId && item.name && !names[item.exerciseId]) {
          names[item.exerciseId] = item.name;
        }
        if (item?.exerciseId && item.metric && !metrics[item.exerciseId]) {
          metrics[item.exerciseId] = item.metric;
        }
      }
    }
    return { names, metrics };
  }, [sessions]);

  const nameOf = (id: string) =>
    exerciseNameFor(id, { templates, names: namesFromSessions.names });
  const metricOf = (id: string) =>
    metricFor(id, { templates, metrics: namesFromSessions.metrics });

  const stats = useMemo(() => {
    let totalSets = 0;
    let volume = 0;

    for (const s of sessions) {
      totalSets += Object.values(s.completed || {}).reduce((n, v) => n + v, 0);
      // Kilograms actually moved, from the set log where there is one. Older
      // sessions carry no weights, so they contribute nothing rather than a
      // guess.
      for (const rows of Object.values(s.sets || {})) {
        for (const row of rows || []) {
          volume += (Number(row?.weight) || 0) * (Number(row?.reps) || 0);
        }
      }
    }

    return { totalSets, volume: Math.round(volume), totalWorkouts: sessions.length };
  }, [sessions]);

  if (sessions.length === 0) {
    // No second "History" heading here: the section above this one already
    // says it, and two headings for one empty sentence reads as a mistake.
    return (
      <div className="panel-sm">
        <p className="t-sub">No workouts yet. Your first one will appear here.</p>
      </div>
    );
  }

  // Best first: the list is read for the biggest numbers, and a fixed order
  // means it does not reshuffle every time one of them is beaten.
  const bestEntries = Object.entries(records || {})
    .filter(([, view]) => view.reps > 0 || view.e1rm > 0)
    .sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])));

  return (
    <div className="space-y-3">
      <div className={`stat-strip ${stats.volume > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
        {stats.volume > 0 && (
          <div>
            <span className="eb-label block">Volume</span>
            <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
              {stats.volume.toLocaleString()}
              <span className="t-meta ml-1">kg</span>
            </span>
          </div>
        )}
      </div>

      {bestEntries.length > 0 && (
        <div className="panel-sm">
          <div className="panel-head">
            <span className="panel-title">Personal bests</span>
            <Trophy className="w-3.5 h-3.5 shrink-0 eb-warn" />
          </div>

          {bestEntries.map(([id, view]) => (
            <div key={id} className="panel-row">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] truncate">{nameOf(id)}</span>
                {/* Both bests where both exist: someone who has loaded an
                    exercise still cares what they did with bodyweight. */}
                {view.e1rm > 0 && view.reps > 0 && (
                  <span className="t-meta block mt-0.5 tabular-nums">
                    {view.reps} {metricOf(id) === 'hold' ? 'seconds' : 'reps'} bodyweight
                  </span>
                )}
              </span>
              <span className="t-figure shrink-0 tabular-nums" style={{ fontSize: 15 }}>
                {recordLabel(view, metricOf(id))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel-sm">
        <div className="panel-head">
          <span className="panel-title">Recent workouts</span>
        </div>

        {sessions.slice(0, 8).map((s) => {
          const title =
            s.templateName ||
            (s.items || [])
              .map((i) => nameOf(i.exerciseId))
              .filter(Boolean)
              .join(', ') ||
            'Workout';

          const sets = Object.values(s.completed || {}).reduce((n, v) => n + v, 0);

          // "3 × 12 · 4 × 8" says what was done; "3 sets" leaves out the part
          // that makes one session harder than another.
          const detail = (s.items || [])
            .map((i) => {
              // What was actually done, where it was recorded. Older sessions
              // only have the target they were completed against, and older
              // ones still have no weights at all.
              const logged = s.sets?.[i.exerciseId];
              const done = s.results?.[i.exerciseId];
              const per =
                Array.isArray(logged) && logged.length > 0
                  ? Math.max(...logged.map((row) => row?.reps || 0))
                  : done && done.length > 0
                    ? Math.max(...done)
                    : i.target;
              const count =
                Array.isArray(logged) && logged.length > 0 ? logged.length : i.sets;
              const load = i.weight && i.weight > 0 ? ` @ ${i.weight} kg` : '';
              return `${count} × ${per}${metricOf(i.exerciseId) === 'hold' ? 's' : ''}${load}`;
            })
            .filter(Boolean)
            .slice(0, 4)
            .join(' · ');

          const duration =
            s.finishedAt && s.startedAt
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 60000
                  )
                )
              : null;

          return (
            <div key={s.id} className="panel-row">
              {s.templateName ? (
                <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--signal-ink)' }} />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--done)' }} />
              )}

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold truncate">{title}</span>
                <span className="t-meta block mt-0.5 truncate tabular-nums">
                  {detail || `${sets} ${sets === 1 ? 'set' : 'sets'}`} · {prettyDate(s.date)}
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
