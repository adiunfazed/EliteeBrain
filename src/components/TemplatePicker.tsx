import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Dumbbell, Target, Sunrise, Check, X, ArrowRight } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { TEMPLATES, Template } from '../lib/templates';
import { newGoal, newHabit, newRoutineBlock, saveGoal, saveHabit, saveRoutineBlock } from '../lib/goalStore';
import { makeTask, saveTask } from '../lib/tasks';

interface Props {
  userId: string | null;
  onDone: () => void;
  onSkip: () => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  Dumbbell,
  Target,
  Sunrise,
};

/**
 * Template picker.
 *
 * Creates ordinary goals, habits, routine blocks and tasks — nothing here is
 * special-cased anywhere else, so a template is only ever a head start that
 * the user can edit or delete like anything else they made themselves.
 */
export const TemplatePicker: React.FC<Props> = ({ userId, onDone, onSkip }) => {
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (template: Template) => {
    if (applying) return;
    setApplying(template.id);
    setError(null);
    soundFx.playClick();

    try {
      // Sequential rather than parallel: a burst of writes can trip Firestore
      // rate limits, and a half-applied template is worse than a slow one.
      if (template.goal) {
        const goal = newGoal(template.goal.title);
        goal.milestones = template.goal.milestones.map((title, i) => ({
          id: `ms_${Date.now()}_${i}`,
          title,
          done: false,
        }));
        await saveGoal(userId, goal);
      }

      for (const h of template.habits) {
        const habit = newHabit(h.title);
        habit.cadence = h.cadence;
        habit.metric = h.metric;
        habit.targetValue = h.targetValue;
        // Weekday-scheduled habits default to Mon/Wed/Fri rather than no days,
        // which would make them never due.
        if (h.cadence === 'selected_days') habit.weekdays = [1, 3, 5];
        await saveHabit(userId, habit);
      }

      for (const b of template.blocks) {
        await saveRoutineBlock(
          userId,
          newRoutineBlock(b.title, b.kind as any, b.startTime, b.endTime)
        );
      }

      for (const title of template.tasks) {
        await saveTask(userId, makeTask(title, 'normal'));
      }

      onDone();
    } catch (err) {
      console.error('Could not apply template:', err);
      setError('Something went wrong. Anything already created has been kept.');
      setApplying(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[92] bg-[var(--ground)] overflow-y-auto overscroll-contain">
      <div
        className="pointer-events-none absolute -top-28 -left-20 w-[26rem] h-72 rounded-full opacity-[0.15] blur-3xl"
        style={{ background: 'var(--signal)' }}
      />

      <div className="relative max-w-lg mx-auto px-5 py-10">
        <p className="t-eyebrow">Get started</p>
        <h1 className="t-display mt-3">What are you working on?</h1>
        <p className="t-sub mt-3 leading-relaxed">
          Pick one and we will set up a starting plan. You can change or delete any of it
          afterwards.
        </p>

        <div className="space-y-2.5 mt-8">
          {TEMPLATES.map((t) => {
            const Icon = ICONS[t.icon] || Target;
            const busy = applying === t.id;

            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => apply(t)}
                disabled={!!applying}
                className="w-full text-left rounded-2xl border p-4 flex items-center gap-4 transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--surface)',
                  borderColor: busy ? t.accent : 'var(--rule)',
                }}
              >
                <span
                  className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: `color-mix(in oklab, ${t.accent} 18%, transparent)` }}
                >
                  <Icon className="w-6 h-6 shrink-0" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="t-section block">{t.name}</span>
                  <span className="t-sub block mt-0.5 leading-snug">{t.who}</span>
                  <span className="t-sub block mt-1.5 text-[12px] text-[var(--ink-dim)]">
                    {t.habits.length} habits · {t.blocks.length} routine blocks
                    {t.goal ? ' · 1 goal' : ''}
                  </span>
                </span>

                {busy ? (
                  <Check className="w-5 h-5 shrink-0" style={{ color: t.accent }} />
                ) : (
                  <ArrowRight className="w-5 h-5 shrink-0 text-[var(--ink-dim)]" />
                )}
              </motion.button>
            );
          })}
        </div>

        {error && (
          <p className="t-sub eb-danger mt-4" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={onSkip}
          disabled={!!applying}
          className="w-full text-center text-[13px] text-[var(--ink-dim)] hover:text-[var(--ink)] py-4 mt-4 transition-colors"
        >
          I will set it up myself
        </button>
      </div>
    </div>
  );
};
