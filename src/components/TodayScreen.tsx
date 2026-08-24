import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, ChevronRight, Play, Moon, Clock } from 'lucide-react';
import type { Habit, HabitLog, RoutineBlock, RoutineLog, SleepLog, Task } from '../types';
import { setHabitValue, setRoutineState } from '../lib/goalStore';
import { addDays, patchTask, todayISO } from '../lib/tasks';
import { DailyQuestCard } from './DailyQuestCard';
import { praiseFor } from '../lib/praise';
import { reviewToday, suggestNextActions } from '../lib/nextAction';
import { blocksForDate, minutesOf } from '../lib/routine';
import { isScheduledOn, valueOn } from '../lib/habits';
import { soundFx } from '../utils/audio';
import { useXp } from './XpToast';
import { XP } from '../lib/xp';

interface Props {
  userId: string | null;
  displayName?: string;
  tasks: Task[];
  /** Level drives quest difficulty. */
  level: number;
  questDoneToday: boolean;
  recentQuestIds?: string[];
  /** Today's completed quest, read back rather than recomputed. */
  completedQuest?: { id: string; title: string; xp: number } | null;
  onCompleteQuest: (quest: { id: string; title: string; xp: number }) => void;
  habits: Habit[];
  habitLogs: HabitLog[];
  routineBlocks: RoutineBlock[];
  routineLogs: RoutineLog[];
  sleepLogs: SleepLog[];
  goals: { id: string; title: string }[];
  onGo: (pane: 'tasks' | 'habits' | 'goals' | 'routine') => void;
  onStartFocus?: (task: Task) => void;
}

/**
 * Today.
 *
 * The whole screen answers one question: what should I do right now, and am I
 * doing it? Everything analytical lives elsewhere — a first screen full of
 * statistics tells you how you did, which is not the same as telling you what
 * to do.
 *
 * Built from sections and rows rather than cards. A card per item turned the
 * page into a stack of boxes with no hierarchy.
 */
export const TodayScreen: React.FC<Props> = ({
  userId,
  displayName,
  tasks,
  level,
  questDoneToday,
  recentQuestIds,
  completedQuest,
  onCompleteQuest,
  habits,
  habitLogs,
  routineBlocks,
  routineLogs,
  sleepLogs,
  goals,
  onGo,
  onStartFocus,
}) => {
  const today = todayISO();
  const { awardXp } = useXp();

  const [localHabits, setLocalHabits] = useState(habitLogs);
  const [localRoutine, setLocalRoutine] = useState(routineLogs);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setLocalHabits(habitLogs), [habitLogs]);
  useEffect(() => setLocalRoutine(routineLogs), [routineLogs]);

  // Keeps "right now" honest as the day moves.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const greeting = nowMin < 12 * 60 ? 'Good morning' : nowMin < 17 * 60 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName ? displayName.split(' ')[0] : '';

  const suggestInput = useMemo(
    () => ({ tasks, habits, habitLogs: localHabits, routineBlocks, routineLogs: localRoutine, now }),
    [tasks, habits, localHabits, routineBlocks, localRoutine, now]
  );

  const suggestions = useMemo(
    () => suggestNextActions(suggestInput, 3).filter((s) => !dismissed.includes(s.id)),
    [suggestInput, dismissed]
  );

  const review = useMemo(() => reviewToday(suggestInput, today), [suggestInput, today]);

  const day = useMemo(
    () => blocksForDate(routineBlocks, localRoutine, today),
    [routineBlocks, localRoutine, today]
  );
  const openHabits = useMemo(() => {
    // Anything already listed under "Your day" is not repeated here.
    const shown = new Set(day.map((d) => d.block.title.trim().toLowerCase()));
    const seen = new Set<string>();

    return habits.filter((h) => {
      if (h.status !== 'active') return false;
      if (!isScheduledOn(h, today)) return false;
      if (valueOn(localHabits, h.id, today) >= Math.max(1, h.targetValue || 1)) return false;

      const key = h.title.trim().toLowerCase();
      if (shown.has(key)) return false;
      // Guard against duplicate habits created with the same name.
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [habits, localHabits, today, day]);

  /** Missed items that can actually be rescheduled. */
  const missedTasks = useMemo(
    () => review.missed.filter((m) => m.kind === 'task'),
    [review.missed]
  );

  const [movedCount, setMovedCount] = useState<number | null>(null);

  const moveTasksToTomorrow = async () => {
    const iso = addDays(today, 1);
    let moved = 0;

    for (const m of missedTasks) {
      const t = tasks.find((x) => x.id === m.id);
      if (!t) continue;
      try {
        await patchTask(userId, t.id, {
          dueDate: iso,
          // Counting the postponement keeps the pattern visible — a task
          // pushed repeatedly should surface in the next-action reasoning.
          postponeCount: (t.postponeCount || 0) + 1,
          lastPostponedAt: new Date().toISOString(),
        });
        moved++;
      } catch (e) {
        console.error('Could not move task:', e);
      }
    }

    soundFx.playSuccess();
    setMovedCount(moved);
  };

  const sleptLastNight = sleepLogs.some((s) => s.date === today);

  /** Tasks due today, plus anything overdue — the work that needs doing now. */
  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (t.completed) return false;
          // No due date means "do it whenever" — that still belongs on Today.
          // Only work explicitly scheduled for a LATER day is held back.
          if (!t.dueDate) return true;
          return t.dueDate <= today;
        })
        .sort((a, b) => {
          // Overdue first, then undated, then today's.
          const rank = (t: Task) => (!t.dueDate ? 1 : t.dueDate < today ? 0 : 2);
          const diff = rank(a) - rank(b);
          if (diff !== 0) return diff;
          return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        })
        .slice(0, 12),
    [tasks, today]
  );

  const doneTasks = useMemo(
    () => tasks.filter((t) => t.completed && (t.completedAt || '').startsWith(today)),
    [tasks, today]
  );
  // Evening, and everything scheduled has been resolved one way or another.
  const dayIsOver = nowMin >= 20 * 60 && review.total > 0;

  const goalTitle = (id?: string) => goals.find((g) => g.id === id)?.title;

  /* ---------------- actions ---------------- */

  const completeTask = async (task: Task) => {
    soundFx.playSuccess();
    // The message names what was actually achieved rather than praising
    // everything identically.
    awardXp(
      XP.taskCompleted,
      praiseFor(
        {
          kind: 'task',
          minutes: task.estimatedMinutes,
          priority: task.priority,
          postponed: task.postponeCount,
          title: task.title,
        },
        task.id
      )
    );
    try {
      await patchTask(userId, task.id, { completed: true, completedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Could not complete task:', e);
    }
  };

  const completeHabit = async (habit: Habit) => {
    soundFx.playSuccess();
    awardXp(XP.habitMet, habit.title);
    const target = Math.max(1, habit.targetValue || 1);
    setLocalHabits((prev) => [
      { id: `${today}__${habit.id}`, habitId: habit.id, date: today, value: target, updatedAt: '' },
      ...prev.filter((l) => !(l.habitId === habit.id && l.date === today)),
    ]);
    try {
      await setHabitValue(userId, habit.id, today, target);
    } catch (e) {
      console.error('Could not update habit:', e);
    }
  };

  const completeBlock = async (block: RoutineBlock) => {
    soundFx.playSuccess();
    awardXp(XP.routineBlockDone, block.title);
    setLocalRoutine((prev) => [
      { id: `${today}__${block.id}`, blockId: block.id, date: today, state: 'done', updatedAt: '' },
      ...prev.filter((l) => !(l.blockId === block.id && l.date === today)),
    ]);
    try {
      await setRoutineState(userId, block.id, today, 'done');
    } catch (e) {
      console.error('Could not update block:', e);
    }
  };

  const act = (kind: string, id: string) => {
    if (kind === 'task') {
      const t = tasks.find((x) => x.id === id);
      if (t) completeTask(t);
    } else if (kind === 'habit') {
      const h = habits.find((x) => x.id === id);
      if (h) completeHabit(h);
    } else {
      const b = routineBlocks.find((x) => x.id === id);
      if (b) completeBlock(b);
    }
  };

  const startFocus = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t && onStartFocus) onStartFocus(t);
    else onGo('tasks');
  };

  const nothingPlanned = review.total === 0 && suggestions.length === 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* ---------------- Header ---------------- */}
      <header className="enter relative pt-2 pb-1">
        {/* Colour bleeding from behind the text rather than a container around
            it — the header should read as part of the page, not a control. */}
        <div
          className="pointer-events-none absolute -top-16 -left-10 w-72 h-56 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: 'var(--signal)' }}
        />
        <div
          className="pointer-events-none absolute -top-10 right-0 w-56 h-44 rounded-full opacity-[0.10] blur-3xl"
          style={{ background: '#00C2A8' }}
        />

        <p className="t-meta relative">
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="t-display mt-2 relative">
          {greeting}
          {firstName && <span className="text-[var(--signal-ink)]">, {firstName}</span>}
        </h1>

        {review.total > 0 && (
          <div className="mt-4 relative">
            <p className="t-sub">
              <span className="text-[var(--ink)] font-semibold">
                {review.done} of {review.total}
              </span>{' '}
              done today
              {review.total - review.done > 0 && ` · ${review.total - review.done} left`}
            </p>

            <div className="h-1.5 rounded-full bg-[var(--surface-sunk)] overflow-hidden mt-3">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    review.done >= review.total
                      ? 'var(--done)'
                      : 'linear-gradient(90deg, var(--signal), color-mix(in oklab, var(--signal) 60%, #fff))',
                }}
                initial={false}
                animate={{ width: `${(review.done / Math.max(1, review.total)) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        )}
      </header>

      {/* ---------------- Daily quest ---------------- */}
      <section className="sec enter enter-1">
        <DailyQuestCard
          userId={userId}
          level={level}
          completedToday={questDoneToday}
          recentQuestIds={recentQuestIds}
          completedQuest={completedQuest}
          onComplete={onCompleteQuest}
        />
      </section>

      {/* ---------------- Do this next ---------------- */}
      {suggestions.length > 0 && !dayIsOver && (
        <section className="sec enter enter-1">
          <div className="sec-head">
            <span className="sec-label">Do this next</span>
          </div>

          <AnimatePresence initial={false}>
            {suggestions.map((s, i) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className={i === 0 ? 'surface-accent p-5' : 'row'}
              >
                {i === 0 ? (
                  /* The top suggestion gets real estate — it is the answer to
                     "what should I do right now". */
                  <div>
                    <h2 className="t-title">{s.title}</h2>

                    <p className="t-sub mt-2">
                      {s.reason}
                      {s.minutes ? ` · about ${s.minutes} min` : ''}
                      {goalTitle(s.goalId) ? ` · ${goalTitle(s.goalId)}` : ''}
                    </p>

                    <div className="flex items-center gap-3 mt-5 flex-wrap">
                      {s.kind === 'task' && (
                        <button onClick={() => startFocus(s.id)} className="btn-lg">
                          <Play className="w-4 h-4 shrink-0" />
                          Start
                        </button>
                      )}
                      <button onClick={() => act(s.kind, s.id)} className={s.kind === 'task' ? 'btn-quiet' : 'btn-lg'}>
                        <Check className="w-4 h-4 shrink-0" />
                        Mark done
                      </button>
                      <button
                        onClick={() => setDismissed((p) => [...p, s.id])}
                        className="btn-quiet border-transparent text-[var(--ink-muted)]"
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => act(s.kind, s.id)}
                      aria-label={`Complete ${s.title}`}
                      className="shrink-0 w-6 h-6 rounded-full border border-[var(--rule)] hover:border-[var(--signal)] transition-colors"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="t-body font-medium truncate">{s.title}</p>
                      <p className="t-meta mt-0.5 truncate">{s.reason}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* ---------------- End of day ---------------- */}
      {dayIsOver && (
        <section className="sec enter enter-1">
          <div className="panel">
            <span className="sec-label">Today complete</span>
            <h2 className="t-title mt-3">
              {review.done} of {review.total} finished
            </h2>

            {review.missed.length > 0 ? (
              <>
                {/* Name what slipped, grouped by kind. Only tasks can be
                    rescheduled — a habit or routine block belongs to its day,
                    so offering to "move" one would do nothing, which is why
                    the button previously looked broken. */}
                <div className="surface-lift px-4 mt-4">
                  {review.missed.map((m) => (
                    <div key={`${m.kind}-${m.id}`} className="row">
                      <span
                        className="shrink-0 w-2 h-2 rounded-full"
                        style={{
                          background:
                            m.kind === 'task'
                              ? 'var(--warn)'
                              : m.kind === 'habit'
                                ? 'var(--signal)'
                                : '#7C9CFF',
                        }}
                      />
                      <p className="t-body flex-1 min-w-0 truncate">{m.title}</p>
                      <span className="t-meta shrink-0 capitalize">{m.kind}</span>
                    </div>
                  ))}
                </div>

                {movedCount === null ? (
                  missedTasks.length > 0 && (
                    <button onClick={moveTasksToTomorrow} className="btn-lg w-full mt-4">
                      <ArrowRight className="w-4 h-4 shrink-0" />
                      Move {missedTasks.length} {missedTasks.length === 1 ? 'task' : 'tasks'} to
                      tomorrow
                    </button>
                  )
                ) : (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="t-sub mt-4 eb-done"
                  >
                    Moved {movedCount} to tomorrow. Start fresh in the morning.
                  </motion.p>
                )}

                {missedTasks.length === 0 && (
                  <p className="t-sub mt-4">
                    Habits and routine blocks belong to today — they reset tomorrow on their own.
                  </p>
                )}
              </>
            ) : (
              <p className="t-sub mt-3">Everything you planned today is done.</p>
            )}
          </div>
        </section>
      )}

      {/* ---------------- Routine ---------------- */}
      {day.length > 0 && (
        <section className="sec enter enter-2">
          <div className="sec-head">
            <span className="sec-label">Your day</span>
            <button onClick={() => onGo('routine')} className="t-meta hover:text-[var(--ink)]">
              Edit
            </button>
          </div>

          <div className="surface-lift px-4">
          {day.map(({ block, state }) => {
            const live = minutesOf(block.startTime) <= nowMin && minutesOf(block.endTime) > nowMin;
            return (
              <div key={block.id} className="row">
                <button
                  onClick={() => completeBlock(block)}
                  aria-label={`Complete ${block.title}`}
                  className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                    state === 'done'
                      ? 'bg-[var(--done)] border-[var(--done)]'
                      : 'border-[var(--rule)] hover:border-[var(--signal)]'
                  }`}
                >
                  {state === 'done' && <Check className="w-3.5 h-3.5 shrink-0 text-[#04231F] stroke-[3]" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`t-body truncate ${
                      state === 'done' ? 'text-[var(--ink-muted)] line-through' : ''
                    }`}
                  >
                    {block.title}
                  </p>
                  <p className="t-meta mt-0.5">
                    {block.startTime}–{block.endTime}
                    {live && state !== 'done' && (
                      <span className="text-[var(--done)]"> · now</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}

      {/* ---------------- Tasks ---------------- */}
      {(todayTasks.length > 0 || doneTasks.length > 0) && (
        <section className="sec enter enter-2">
          <div className="sec-head">
            <span className="sec-label">To do today</span>
            <button onClick={() => onGo('tasks')} className="t-meta hover:text-[var(--ink)]">
              All tasks
            </button>
          </div>

          <div className="surface-lift px-4">
            {todayTasks.map((t) => {
              const overdue = !!t.dueDate && t.dueDate < today;
              return (
                <div key={t.id} className="row">
                  <button
                    onClick={() => completeTask(t)}
                    aria-label={`Complete ${t.title}`}
                    className="shrink-0 w-6 h-6 rounded-full border border-[var(--rule)] hover:border-[var(--signal)] transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="t-body truncate">{t.title}</p>
                    {(overdue || t.estimatedMinutes) && (
                      <p className="t-meta mt-0.5">
                        {overdue && <span className="eb-warn">Overdue</span>}
                        {overdue && t.estimatedMinutes ? ' · ' : ''}
                        {t.estimatedMinutes ? `${t.estimatedMinutes} min` : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {doneTasks.map((t) => (
              <div key={t.id} className="row opacity-50">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--done)] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 shrink-0 text-[#04231F] stroke-[3]" />
                </span>
                <p className="t-body flex-1 min-w-0 truncate line-through">{t.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Habits ---------------- */}
      {openHabits.length > 0 && (
        <section className="sec enter enter-3">
          <div className="sec-head">
            <span className="sec-label">To repeat</span>
          </div>

          <div className="surface-lift px-4">
          {openHabits.map((h) => (
            <div key={h.id} className="row">
              <button
                onClick={() => completeHabit(h)}
                aria-label={`Complete ${h.title}`}
                className="shrink-0 w-6 h-6 rounded-full border border-[var(--rule)] hover:border-[var(--signal)] transition-colors"
              />
              <p className="t-body flex-1 min-w-0 truncate">{h.title}</p>
            </div>
          ))}
          </div>
        </section>
      )}

      {/* ---------------- Sleep ---------------- */}
      <section className="sec enter enter-3">
        <button onClick={() => onGo('routine')} className="surface-lift row row-tap w-full text-left px-4">
          <Moon className="w-4 h-4 text-[#7C9CFF] shrink-0" />
          <span className="t-body flex-1">Sleep</span>
          <span className="t-meta">{sleptLastNight ? 'Logged' : 'Not logged'}</span>
          <ChevronRight className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
        </button>
      </section>

      {/* ---------------- Empty ---------------- */}
      {nothingPlanned && (
        <section className="sec enter enter-1">
          <div className="panel text-center">
            <Clock className="w-6 h-6 shrink-0 text-[var(--ink-muted)] mx-auto" />
            <h2 className="t-section mt-4">Nothing planned yet</h2>
            <p className="t-sub mt-2 max-w-sm mx-auto">
              Add one thing you want to finish today. It'll show up here with a Start button.
            </p>
            <button onClick={() => onGo('tasks')} className="btn-lg mt-6">
              Add a task
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
