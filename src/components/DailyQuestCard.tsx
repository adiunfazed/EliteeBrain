import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Swords, Check } from 'lucide-react';
import { questForDay, Quest } from '../lib/quests';
import { todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';

interface Props {
  /** False until the profile has loaded. Nothing is generated before then. */
  ready?: boolean;
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
  completedQuest?: { id: string; title: string; objective?: string; xp: number } | null;
  /** The quest generated for today, read back rather than recomputed. */
  storedQuest?: { date: string; id: string; title: string; objective?: string; xp: number } | null;
  onStoreQuest?: (q: { date: string; id: string; title: string; objective: string; xp: number }) => void;
  onComplete: (quest: Quest) => void;
}

/**
 * Today's quest.
 *
 * The day's quest is generated once and then persisted. Deriving it on every
 * render meant any change to level or history silently rescaled it mid-day.
 */
export const DailyQuestCard: React.FC<Props> = ({
  userId,
  level,
  completedToday,
  ready = true,
  recentQuestIds = [],
  completedQuest,
  storedQuest,
  onStoreQuest,
  onComplete,
}) => {
  const today = todayISO();

  /**
   * Today's quest, generated once and then read back.
   *
   * Previously the quest was derived from level and recent history on every
   * render, so any change to those inputs silently rescaled it — "10 tricep
   * dips" became "34 tricep dips" mid-day. Persisting the generated quest
   * means there is nothing left to recompute.
   */
  const quest = useMemo<Quest>(() => {
    // Already completed: show exactly what was completed.
    if (completedQuest) {
      return {
        id: completedQuest.id,
        title: completedQuest.title,
        xp: completedQuest.xp,
        objective: completedQuest.objective || '',
        category: 'productivity',
      };
    }

    // Already generated today: reuse it verbatim.
    if (storedQuest && storedQuest.date === today) {
      return {
        id: storedQuest.id,
        title: storedQuest.title,
        xp: storedQuest.xp,
        objective: storedQuest.objective || '',
        category: 'productivity',
      };
    }

    // Placeholder while the profile loads. Rendering a real quest here and
    // swapping it a moment later is exactly the flicker being reported.
    if (!ready) {
      return { id: 'pending', title: '', objective: '', xp: 0, category: 'productivity' };
    }

    return questForDay(userId || 'guest', today, level, recentQuestIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedQuest, storedQuest, today, userId, ready]);

  // Persist the moment it is generated, so a reload or a level-up cannot
  // produce a different one.
  useEffect(() => {
    // Never persist a quest generated from an unloaded profile — that is what
    // wrote a throwaway quest and then replaced it moments later.
    if (!ready) return;
    if (completedQuest) return;
    if (storedQuest?.date === today) return;
    onStoreQuest?.({
      date: today,
      id: quest.id,
      title: quest.title,
      objective: quest.objective,
      xp: quest.xp,
    });
  }, [quest, storedQuest, today, completedQuest, onStoreQuest, ready]);

  const accept = () => {
    if (completedToday) return;
    soundFx.playSuccess();
    onComplete(quest);
  };

  if (!ready || quest.id === 'pending') {
    return (
      <div
        className="rounded-2xl border p-4 sm:p-5 animate-pulse"
        style={{ background: 'var(--surface)', borderColor: 'var(--rule)', minHeight: 132 }}
      />
    );
  }

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
