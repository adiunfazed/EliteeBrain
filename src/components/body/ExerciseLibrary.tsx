import React from 'react';
import * as Icons from 'lucide-react';
import { ChevronRight, Trophy } from 'lucide-react';
import { EXERCISES, Exercise } from '../../lib/bodyTraining';
import { RecordViews, recordLabel } from '../../lib/personalRecords';
import { soundFx } from '../../utils/audio';

/** A tint per exercise, so six rows are scannable rather than identical. */
const TINTS: Record<string, string> = {
  pushups: '#7A63E0',
  squats: '#00C2A8',
  lunges: '#FFB020',
  plank: '#5BA9F5',
  'glute-bridge': '#E86FA8',
  'calf-raises': '#8FD14F',
};

interface Props {
  onStart: (exercise: Exercise) => void;
  /** Both bests per exercise. Absent for anything never done. */
  records?: RecordViews;
}

/**
 * The exercise library.
 *
 * Compact rows rather than tiles: six exercises with instructions attached
 * would be a wall of cards, and the useful comparison between them is the
 * target, which reads better in a list.
 */
export const ExerciseLibrary: React.FC<Props> = ({ onStart, records = {} }) => (
  <div className="space-y-3">
    {/* No level picker. Sets and reps are typed in on the next screen, so a
        difficulty setting only ever changed a number the user was about to
        choose for themselves — two controls for one decision. */}
    <div className="space-y-1.5">
      {EXERCISES.map((ex) => {
        const Icon = (Icons as any)[ex.icon] || Icons.Dumbbell;
        const view = records[ex.id];
        const best = view?.reps || 0;
        const label = recordLabel(view, ex.metric);
        // What tapping through will offer: one past the bodyweight record
        // where there is one, the gentle starting figure where there is not.
        const target = Math.max(best > 0 ? best + 1 : 0, ex.targets.easy);

        return (
          <button
            key={ex.id}
            onClick={() => {
              soundFx.playClick();
              onStart(ex);
            }}
            className="w-full text-left rounded-xl eb-card p-3 flex items-center gap-3"
          >
            <span
              className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                background: `color-mix(in oklab, ${TINTS[ex.id] || 'var(--signal)'} 20%, var(--surface-sunk))`,
                border: `1px solid color-mix(in oklab, ${TINTS[ex.id] || 'var(--signal)'} 35%, transparent)`,
              }}
            >
              <Icon
                className="w-[18px] h-[18px] shrink-0"
                strokeWidth={2.2}
                style={{ color: TINTS[ex.id] || 'var(--signal-ink)' }}
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold leading-snug">{ex.name}</span>
              <span className="t-meta block mt-0.5 truncate">
                {best > 0 ? 'Next: ' : ''}
                {target} {ex.metric === 'hold' ? 'seconds' : 'reps'} · {ex.restSeconds}s rest
              </span>
            </span>

            {/* Only shown once there is a real record to show. The unit is
                left off deliberately — the line above already says "reps" or
                "seconds", and repeating it here cost enough width to truncate
                that line on a narrow phone. */}
            {label && (
              <span
                className="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg"
                style={{
                  background: 'color-mix(in oklab, var(--warn) 12%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--warn) 28%, var(--rule))',
                }}
                aria-label={`Personal best ${label}`}
              >
                <Trophy className="w-3 h-3 shrink-0 eb-warn" />
                <span
                  className="text-[12px] font-bold tabular-nums"
                  style={{ color: 'var(--warn)' }}
                >
                  {view && view.e1rm > 0 ? `${view.weight}kg` : best}
                </span>
              </span>
            )}

            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
          </button>
        );
      })}
    </div>

    <p className="t-meta leading-relaxed">
      Stop if you feel pain, dizziness or shortness of breath. These targets are a
      starting point, not a standard to meet.
    </p>
  </div>
);
