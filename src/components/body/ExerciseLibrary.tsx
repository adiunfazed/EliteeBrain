import React from 'react';
import * as Icons from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { EXERCISES, Exercise, Difficulty, DIFFICULTY_LABEL } from '../../lib/bodyTraining';
import { soundFx } from '../../utils/audio';

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onStart: (exercise: Exercise) => void;
}

/**
 * The exercise library.
 *
 * Compact rows rather than tiles: six exercises with instructions attached
 * would be a wall of cards, and the useful comparison between them is the
 * target, which reads better in a list.
 */
export const ExerciseLibrary: React.FC<Props> = ({
  difficulty,
  onDifficultyChange,
  onStart,
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="t-meta shrink-0">Level</span>
      <div className="flex items-center gap-1">
        {(['easy', 'moderate', 'hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => {
              soundFx.playClick();
              onDifficultyChange(d);
            }}
            className="chip"
            data-active={difficulty === d}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

    </div>

    <div className="space-y-1.5">
      {EXERCISES.map((ex) => {
        const Icon = (Icons as any)[ex.icon] || Icons.Dumbbell;
        const target = ex.targets[difficulty];

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
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--signal) 16%, transparent)' }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug">{ex.name}</span>
              <span className="t-meta block mt-0.5 truncate">
                {target} {ex.metric === 'hold' ? 'seconds' : 'reps'} · {ex.restSeconds}s rest
              </span>
            </span>

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
