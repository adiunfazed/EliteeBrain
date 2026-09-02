import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Swords, Check } from 'lucide-react';
import { questForDay, Quest } from '../lib/quests';
import { todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  userId: string | null;
  level: number;
  completedToday: boolean;
  recentQuestIds?: string[];
  /**
   * Today's completed quest, if there is one.
   *
   * Read rather than recomputed: completing a quest adds its id to the recent
   * list, and the selector avoids recent ids — so recomputing after completion
   * returned a DIFFERENT quest while still showing it as done.
   */
  completedQuest?: { id: string; title: string; xp: number } | null;
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
  completedQuest,
  onComplete,
}) => {
  const today = todayISO();

  const quest = useMemo<Quest>(() => {
    // Once today's quest is completed, show the one that was actually
    // completed — never a freshly selected one.
    if (completedQuest) {
      return {
        id: completedQuest.id,
        title: completedQuest.title,
        xp: completedQuest.xp,
        objective: '',
        category: 'productivity',
      };
    }

    return questForDay(userId || 'guest', today, level, recentQuestIds);
  }, [userId, today, level, recentQuestIds, completedQuest]);

  const accept = () => {
    if (completedToday) return;
    soundFx.playSuccess();
    onComplete(quest);
  };

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5"
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
          <p className="t-section mt-0.5 break-words leading-tight">{quest.title}</p>
        </div>

        <span className="text-right shrink-0">
          <span className="block font-display font-extrabold text-lg tabular-nums leading-none">
            +{quest.xp}
          </span>
          <span className="block text-[11px] text-[var(--ink-dim)] mt-1">XP</span>
        </span>
      </div>

      <p className="t-sub mt-3 leading-snug">
        {completedToday ? 'Done today. A new quest arrives at midnight.' : quest.objective}
      </p>

      {/* The action lives with the quest — no second screen for one tap. */}
      {completedToday ? (
        <div
          className="mt-4 min-h-[46px] rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold"
          style={{
            background: 'color-mix(in oklab, var(--done) 14%, transparent)',
            color: 'var(--done)',
          }}
        >
          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
          Completed
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={accept}
          className="w-full mt-4 min-h-[46px] rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: 'var(--signal)' }}
        >
          <Check className="w-4 h-4 shrink-0" />
          Mark done
        </motion.button>
      )}
    </div>
  );
};
