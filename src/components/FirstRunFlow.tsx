import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Target, Flag, ListChecks } from 'lucide-react';
import { newGoal, saveGoal } from '../lib/goalStore';
import { makeTask, newTaskId, saveTask, todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  onDone: () => void;
}

/**
 * First run.
 *
 * A new account previously landed on screens reading "0 goals, 0 tasks, 0 XP",
 * which explains the product as an empty spreadsheet. Three questions instead
 * walk the person through the core loop once — goal, milestone, first action —
 * so they finish setup already inside the system rather than staring at it.
 *
 * Everything created here is real user data written to the normal collections.
 * Nothing is a sample or placeholder.
 */
export const FirstRunFlow: React.FC<Props> = ({ userId, onDone }) => {
  const [step, setStep] = useState(0);
  const [goalTitle, setGoalTitle] = useState('');
  const [milestone, setMilestone] = useState('');
  const [firstTask, setFirstTask] = useState('');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const goal = newGoal(goalTitle.trim() || 'My first goal');
      goal.metric = 'completion';

      if (milestone.trim()) {
        goal.milestones = [{ id: newTaskId(), title: milestone.trim(), done: false }];
      }
      await saveGoal(userId, goal);

      if (firstTask.trim()) {
        const task = makeTask(firstTask.trim(), 'high', todayISO());
        task.goalId = goal.id;
        await saveTask(userId, task);
      }

      soundFx.playSuccess();
    } catch (err) {
      // Setup failing shouldn't trap the user on this screen.
      console.error('Could not create starter items:', err);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  const steps = [
    {
      icon: Target,
      label: 'Where are you going?',
      hint: 'One thing you actually want to be true in a few months.',
      placeholder: 'e.g. Score 95% in Class 12',
      value: goalTitle,
      set: setGoalTitle,
      cta: 'Next',
    },
    {
      icon: Flag,
      label: 'What would prove progress?',
      hint: 'A milestone you could tick off along the way.',
      placeholder: 'e.g. Finish the Physics syllabus',
      value: milestone,
      set: setMilestone,
      cta: 'Next',
    },
    {
      icon: ListChecks,
      label: 'What will you do today?',
      hint: 'One small action. It goes straight onto today.',
      placeholder: 'e.g. Revise one chapter for 30 minutes',
      value: firstTask,
      set: setFirstTask,
      cta: 'Start',
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const canContinue = current.value.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress across the three questions */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-[var(--signal)]' : 'bg-[var(--surface-sunk)]'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="w-12 h-12 shrink-0 rounded-2xl eb-card-sunk flex items-center justify-center">
              <Icon className="w-5 h-5 shrink-0 text-[var(--signal-ink)]" />
            </span>

            <h2 className="eb-heading text-2xl mt-4">{current.label}</h2>
            <p className="text-xs text-[#8A93A5] mt-1.5 leading-relaxed">{current.hint}</p>

            <input
              autoFocus
              value={current.value}
              onChange={(e) => current.set(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !canContinue) return;
                step < 2 ? setStep(step + 1) : finish();
              }}
              placeholder={current.placeholder}
              maxLength={90}
              className="w-full mt-5 bg-[var(--surface-sunk)] border border-[var(--rule)] focus:border-[var(--signal)] rounded-xl px-4 py-3.5 text-sm text-[#F2F4F7] placeholder:text-[#5A6472] outline-none"
            />

            <button
              onClick={() => (step < 2 ? setStep(step + 1) : finish())}
              disabled={!canContinue || saving}
              className="eb-btn-primary w-full mt-4 py-3.5 text-sm font-mono flex items-center justify-center gap-2"
            >
              {saving ? 'Setting up…' : current.cta}
              {step < 2 ? <ArrowRight className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            </button>

            <div className="flex items-center justify-between gap-3 mt-3">
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="text-[11px] font-mono text-[#8A93A5] hover:text-[#F2F4F7]"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <button
                onClick={onDone}
                className="text-[11px] font-mono text-[#5A6472] hover:text-[#8A93A5]"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
