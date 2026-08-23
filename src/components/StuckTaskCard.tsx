import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LifeBuoy, Timer, X, ArrowRight } from 'lucide-react';
import type { Task } from '../types';
import { STUCK_OPTIONS, StuckReason, daysOverdue, suggestionFor } from '../lib/adaptive';
import { soundFx } from '../utils/audio';

interface Props {
  task: Task;
  onStartFocus?: (task: Task, minutes: number) => void;
  onSplit?: (task: Task) => void;
  onDismiss: () => void;
}

/**
 * Shown when one task has been pushed repeatedly or is well overdue.
 *
 * It asks what's actually wrong rather than telling the user to try harder,
 * then offers one concrete small step. Deliberately surfaces a single task —
 * a list of everything you're avoiding is discouraging, and the goal is to
 * restart one thing.
 */
export const StuckTaskCard: React.FC<Props> = ({ task, onStartFocus, onSplit, onDismiss }) => {
  const [reason, setReason] = useState<StuckReason | null>(null);
  const overdue = daysOverdue(task);
  const suggestion = reason ? suggestionFor(task, reason) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#8B5CF6]/30 bg-[#141020] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-mono font-bold text-[#A78BFA] tracking-widest uppercase flex items-center gap-1.5">
          <LifeBuoy className="w-3 h-3 shrink-0" />
          Stuck on this
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 w-8 h-8 -m-1 rounded-lg hover:bg-[#171B22] text-[#7E8899] flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      <p className="text-sm font-bold text-[#F4F6F8] mt-2 break-words">{task.title}</p>
      <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
        {(task.postponeCount || 0) > 0 && `Moved ${task.postponeCount} times`}
        {(task.postponeCount || 0) > 0 && overdue > 0 && ' · '}
        {overdue > 0 && `${overdue} day${overdue === 1 ? '' : 's'} past its date`}
      </p>

      {!suggestion ? (
        <>
          <p className="text-[11px] text-[#98A2B3] mt-3">What's actually in the way?</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {STUCK_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  soundFx.playClick();
                  setReason(o.id);
                }}
                className="eb-press text-[11px] font-semibold px-2.5 py-2 rounded-full border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] hover:border-[#3A424F]"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
            <p className="text-xs font-black font-mono text-[#A78BFA]">{suggestion.headline}</p>
            <p className="text-[11px] text-[#F4F6F8] mt-1 leading-relaxed">
              {suggestion.firstStep}
            </p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {suggestion.minutes > 0 && onStartFocus && (
                <button
                  onClick={() => onStartFocus(task, suggestion.minutes)}
                  className="eb-lift eb-shine eb-glow-brand px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:brightness-110 text-white text-xs font-mono font-black flex items-center gap-1.5"
                >
                  <Timer className="w-3.5 h-3.5 shrink-0" />
                  Start {suggestion.minutes} min
                </button>
              )}
              {suggestion.offerSplit && onSplit && (
                <button
                  onClick={() => onSplit(task)}
                  className="eb-press px-4 py-2.5 rounded-xl bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  Break it up
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
              <button
                onClick={() => setReason(null)}
                className="eb-press px-3 py-2.5 text-[10px] font-mono font-bold text-[#7E8899] hover:text-[#98A2B3]"
              >
                Back
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
};
