import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Check, X, Sparkles } from 'lucide-react';
import { questForDay, Quest } from '../lib/quests';
import { todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  level: number;
  /** Quest ids already completed, keyed by date. */
  completedToday: boolean;
  recentQuestIds?: string[];
  onComplete: (quest: Quest) => void;
}

/**
 * Today's quest.
 *
 * The quest itself is derived from the user id and the date, so it never
 * changes on refresh and matches across devices without any stored state.
 * Only the completion flag needs persisting.
 */
export const DailyQuestCard: React.FC<Props> = ({
  userId,
  level,
  completedToday,
  recentQuestIds = [],
  onComplete,
}) => {
  const [open, setOpen] = useState(false);
  const today = todayISO();

  const quest = useMemo(
    () => questForDay(userId || 'guest', today, level, recentQuestIds),
    [userId, today, level, recentQuestIds]
  );

  const accept = () => {
    if (completedToday) return;
    soundFx.playSuccess();
    onComplete(quest);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => {
          soundFx.playClick();
          setOpen(true);
        }}
        className="w-full text-left rounded-2xl border p-4 sm:p-5 transition-transform active:scale-[0.99]"
        style={{
          background: completedToday
            ? 'color-mix(in oklab, var(--done) 10%, var(--surface))'
            : 'linear-gradient(135deg, color-mix(in oklab, var(--signal) 16%, var(--surface)), var(--surface))',
          borderColor: completedToday
            ? 'color-mix(in oklab, var(--done) 40%, var(--rule))'
            : 'color-mix(in oklab, var(--signal) 40%, var(--rule))',
          boxShadow: completedToday
            ? '0 1px 0 0 rgba(255,255,255,0.05) inset'
            : '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 12px 30px -18px color-mix(in oklab, var(--signal) 80%, transparent)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{
              background: completedToday
                ? 'color-mix(in oklab, var(--done) 20%, transparent)'
                : 'color-mix(in oklab, var(--signal) 22%, transparent)',
            }}
          >
            {completedToday ? (
              <Check className="w-5 h-5 shrink-0 eb-done stroke-[3]" />
            ) : (
              <Swords className="w-5 h-5 shrink-0 text-[var(--signal-ink)]" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-bold tracking-widest uppercase"
              style={{ color: completedToday ? 'var(--done)' : 'var(--signal-ink)' }}
            >
              Daily quest
            </p>
            <p className="t-section mt-0.5 break-words leading-tight">
              {quest.title}
            </p>
          </div>

          <span className="text-right shrink-0">
            <span className="block font-display font-extrabold text-lg tabular-nums leading-none">
              {quest.xp}
            </span>
            <span className="block text-[11px] text-[#7E8899] mt-1">XP</span>
          </span>
        </div>

        <p className="t-sub mt-2.5 leading-snug">
          {completedToday ? 'Done today. New quest at midnight.' : quest.objective}
        </p>
      </button>

      {/* Details */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md panel"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="text-[11px] font-bold tracking-widest uppercase"
                  style={{ color: 'var(--signal-ink)' }}
                >
                  Daily quest
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#7E8899] shrink-0"
                >
                  <X className="w-4 h-4 shrink-0" />
                </button>
              </div>

              <h2 className="t-title mt-3 break-words">{quest.title}</h2>
              <p className="t-body text-[#96A0B0] mt-3 leading-relaxed">{quest.objective}</p>

              <div className="flex items-center gap-2 mt-5">
                <Sparkles className="w-4 h-4 shrink-0 text-[var(--signal-ink)]" />
                <span className="t-sub">
                  Worth <span className="text-[var(--ink)] font-semibold">{quest.xp} XP</span> —
                  counts toward your level and rank.
                </span>
              </div>

              {completedToday ? (
                <p className="t-sub text-center mt-6 eb-done">
                  Completed today. A new quest arrives at midnight.
                </p>
              ) : (
                <>
                  <button onClick={accept} className="btn-lg w-full mt-6">
                    <Check className="w-4 h-4 shrink-0" />
                    Mark complete
                  </button>
                  <p className="t-sub text-center mt-3">
                    Only mark this done if you actually did it.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
