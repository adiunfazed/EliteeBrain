import React from 'react';
import { motion } from 'motion/react';
import { Pencil, Play, Plus, Repeat } from 'lucide-react';
import { WorkoutTemplate, summariseTemplate } from '../../lib/workoutTemplates';
import { soundFx } from '../../utils/audio';

interface Props {
  templates: WorkoutTemplate[];
  onStart: (template: WorkoutTemplate) => void;
  onEdit: (template: WorkoutTemplate) => void;
  onCreate: () => void;
}

function lastUsedLabel(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Your own workouts, ready to run.
 *
 * The primary action on each card is Start, at full size, because that is
 * what a saved workout is for — editing it is the rare case and gets the
 * small button. The line under the name is the session's actual shape
 * ("3 × 10 · 4 × 8"), not a count of exercises: the shape is what tells you
 * whether this is the session you want today.
 */
export const WorkoutList: React.FC<Props> = ({ templates, onStart, onEdit, onCreate }) => {
  if (templates.length === 0) {
    return (
      <button onClick={onCreate} className="empty-build">
        <span className="empty-build-icon">
          <Plus className="w-5 h-5 shrink-0" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-bold">Create a custom workout</span>
          <span className="t-meta block mt-0.5">
            Your exercises, your sets and reps. Saved to your account.
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((template, index) => {
        const summary = summariseTemplate(template.items);
        // The exercises, not the arithmetic: "Bench press · Overhead press"
        // is how anyone recognises which workout this is. The numbers live
        // on the line below.
        const shape = (template.items || [])
          .slice(0, 3)
          .map((item) => item.name)
          .join(' · ');
        const used = lastUsedLabel(template.lastUsedAt);

        return (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.15) }}
            className="wk-card"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] font-bold leading-snug truncate">{template.name}</p>
              <p className="t-meta mt-1 truncate">
                {shape}
                {(template.items || []).length > 3
                  ? ` +${(template.items || []).length - 3} more`
                  : ''}
              </p>
              {/* Spacing rather than drawn dots: a wrapped line that starts
                  with a floating separator reads as a rendering fault. */}
              <p className="t-meta mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap">
                <span>{summary.sets} sets</span>
                {summary.volume > 0 && <span>{summary.volume.toLocaleString()} kg</span>}
                <span>~{summary.minutes} min</span>
                {used && (
                  <span className="inline-flex items-center gap-1">
                    <Repeat className="w-3 h-3 shrink-0" />
                    {used}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  soundFx.playClick();
                  onEdit(template);
                }}
                aria-label={`Edit ${template.name}`}
                className="icon-btn"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0" />
              </button>

              <button
                onClick={() => {
                  soundFx.playClick();
                  onStart(template);
                }}
                className="wk-start"
                aria-label={`Start ${template.name}`}
              >
                <Play className="w-4 h-4 shrink-0" />
                Start
              </button>
            </div>
          </motion.div>
        );
      })}

      <button onClick={onCreate} className="add-row">
        <Plus className="w-4 h-4 shrink-0" />
        New workout
      </button>
    </div>
  );
};
