import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pause, Play, Square, Timer, Check, X } from 'lucide-react';
import type { FocusSession, Task } from '../types';
import {
  ActiveFocus,
  FOCUS_PRESETS,
  elapsedSeconds,
  formatClock,
  formatDuration,
  isFinished,
  loadActiveFocus,
  pauseFocus,
  remainingSeconds,
  resumeFocus,
  saveActiveFocus,
  saveFocusSession,
  startFocus,
  subscribeFocusSessions,
  focusSecondsToday,
} from '../lib/focus';
import { bucketTasks, newTaskId, patchTask, subscribeTasks } from '../lib/tasks';
import { soundFx } from '../utils/audio';
import { setHabitValue, subscribeHabitLogs } from '../lib/goalStore';
import { valueOn } from '../lib/habits';
import { todayISO } from '../lib/tasks';

interface Props {
  userId: string | null;
  /** Habit handed over from the Goals screen, if any. */
  incomingHabit?: { title: string; minutes: number; habitId: string } | null;
  onConsumeHabit?: () => void;
  /** Task handed over from the task list, if any. */
  incomingTask?: Task | null;
  onConsumeIncoming?: () => void;
}

export const FocusSection: React.FC<Props> = ({ userId, incomingTask, onConsumeIncoming, incomingHabit, onConsumeHabit }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [active, setActive] = useState<ActiveFocus | null>(() => loadActiveFocus());
  const [minutes, setMinutes] = useState(25);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [freeLabel, setFreeLabel] = useState('');
  const [justFinished, setJustFinished] = useState<FocusSession | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => subscribeTasks(userId, setTasks), [userId]);
  useEffect(() => subscribeHabitLogs(userId, setHabitLogs), [userId]);
  useEffect(() => subscribeFocusSessions(userId, setSessions), [userId]);

  // A habit handed over starts immediately with the remaining minutes.
  useEffect(() => {
    if (!incomingHabit) return;
    setFreeLabel(incomingHabit.title);
    setSelectedTaskId('');
    setMinutes(Math.max(5, incomingHabit.minutes));
    persist(
      startFocus(incomingHabit.title, Math.max(5, incomingHabit.minutes), undefined, Date.now(), incomingHabit.habitId)
    );
    onConsumeHabit?.();
  }, [incomingHabit]);

  // A task arriving from the list preselects itself and its estimated duration,
  // so the user only has to press Start.
  useEffect(() => {
    if (!incomingTask) return;
    setSelectedTaskId(incomingTask.id);
    setFreeLabel(incomingTask.title);
    if (incomingTask.estimatedMinutes) {
      const nearest = FOCUS_PRESETS.reduce((best, p) =>
        Math.abs(p - incomingTask.estimatedMinutes!) < Math.abs(best - incomingTask.estimatedMinutes!)
          ? p
          : best
      );
      setMinutes(nearest);
    }
    onConsumeIncoming?.();
  }, [incomingTask, onConsumeIncoming]);

  // Re-render once a second so the clock updates. The value itself is always
  // derived from timestamps, so a missed tick never loses time.
  useEffect(() => {
    if (!active || active.pausedAt !== null) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const todayTasks = useMemo(() => bucketTasks(tasks).today, [tasks]);
  const secondsToday = useMemo(() => focusSecondsToday(sessions), [sessions]);

  const persist = (next: ActiveFocus | null) => {
    setActive(next);
    saveActiveFocus(next);
  };

  const finish = useCallback(
    async (completed: boolean) => {
      if (!active) return;
      const focusedSeconds = elapsedSeconds(active);
      const session: FocusSession = {
        id: newTaskId(),
        taskId: active.taskId,
        taskTitle: active.taskTitle,
        plannedMinutes: active.plannedMinutes,
        focusedSeconds,
        startedAt: new Date(active.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        completed,
      };

      persist(null);

      // Anything under a minute is a misfire, not a session worth recording.
      if (focusedSeconds < 60) return;

      setJustFinished(session);
      if (completed) soundFx.playSuccess();

      try {
        await saveFocusSession(userId, session);
        if (active.taskId) {
          const task = tasks.find((t) => t.id === active.taskId);
          await patchTask(userId, active.taskId, {
            focusSeconds: (task?.focusSeconds || 0) + focusedSeconds,
          });
        }

        // Credit the linked habit. The log id is date+habitId, so writing an
        // absolute total overwrites rather than accumulating a duplicate row.
        if (active.habitId) {
          const today = todayISO();
          const already = valueOn(habitLogs, active.habitId, today);
          await setHabitValue(
            userId,
            active.habitId,
            today,
            already + Math.round(focusedSeconds / 60)
          );
        }
      } catch (err) {
        console.error('Could not save focus session:', err);
      }
    },
    [active, tasks, userId]
  );

  // Auto-finish the moment the planned time elapses.
  useEffect(() => {
    if (active && active.pausedAt === null && isFinished(active)) {
      finish(true);
    }
  });

  const begin = () => {
    const task = todayTasks.find((t) => t.id === selectedTaskId);
    const title = task ? task.title : freeLabel.trim() || 'Focused work';
    soundFx.playClick();
    persist(startFocus(title, minutes, task?.id));
    setJustFinished(null);
  };

  /* ---------- Running session: distraction-free ---------- */
  if (active) {
    const remaining = remainingSeconds(active);
    const paused = active.pausedAt !== null;
    const progress = 1 - remaining / (active.plannedMinutes * 60);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-6 sm:p-10 text-center"
      >
        <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
          {paused ? 'Paused' : 'Focusing on'}
        </p>
        <p className="text-sm sm:text-base font-bold text-[#F4F6F8] mt-2 break-words max-w-md mx-auto">
          {active.taskTitle}
        </p>

        {/* Progress ring — the clock reads as a dial rather than a number. */}
        <div className="relative mx-auto mt-6 w-56 h-56 sm:w-64 sm:h-64">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#171B22" strokeWidth="6" />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={paused ? '#5A6472' : '#10B981'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 54}
              animate={{
                strokeDashoffset: 2 * Math.PI * 54 * (1 - Math.min(1, progress)),
              }}
              transition={{ ease: 'linear', duration: 0.9 }}
            />
          </svg>

          {/* Soft pulse while running, so the screen feels alive when idle. */}
          {!paused && (
            <motion.span
              className="absolute inset-6 rounded-full bg-emerald-500/10 blur-2xl"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.02, 0.96] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-mono font-black tabular-nums tracking-tight transition-colors text-4xl sm:text-5xl ${
                paused ? 'text-[#5A6472]' : 'text-[#F4F6F8]'
              }`}
            >
              {formatClock(remaining)}
            </span>
            <span className="text-[10px] font-mono text-[#5A6472] mt-1">
              of {active.plannedMinutes} min
            </span>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2.5 flex-wrap">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              soundFx.playClick();
              persist(paused ? resumeFocus(active) : pauseFocus(active));
            }}
            className="px-5 py-3 rounded-xl bg-[#171B22] hover:bg-[#20252E] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono font-bold flex items-center gap-2 transition-colors"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'Resume' : 'Pause'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => finish(false)}
            className="eb-lift eb-glow-emerald eb-shine px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-black flex items-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Finish now
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              soundFx.playClick();
              persist(null);
            }}
            className="px-4 py-3 rounded-xl bg-transparent hover:bg-rose-500/10 border border-[#2A313C] hover:border-rose-500/40 text-[#98A2B3] hover:text-rose-300 text-xs font-mono font-bold flex items-center gap-2 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Cancel
          </motion.button>
        </div>

        <p className="text-[10px] text-[#5A6472] font-mono mt-5">
          Cancelling discards this session. Finishing keeps the time you did.
        </p>
      </motion.div>
    );
  }

  /* ---------- Setup ---------- */
  return (
    <div className="space-y-4">
      <AnimatePresence>
        {justFinished && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3"
          >
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[3]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-300 font-mono">Session complete</p>
              <p className="text-[11px] text-[#98A2B3] mt-0.5 break-words">
                {formatDuration(justFinished.focusedSeconds)} on {justFinished.taskTitle}
              </p>
            </div>
            <button
              onClick={() => setJustFinished(null)}
              aria-label="Dismiss"
              className="shrink-0 w-10 h-10 rounded-lg hover:bg-emerald-500/15 text-[#98A2B3] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4 space-y-4">
        <div>
          <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase mb-2">
            What are you working on?
          </p>

          {todayTasks.length > 0 ? (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {todayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedTaskId(selectedTaskId === t.id ? '' : t.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2.5 ${
                    selectedTaskId === t.id
                      ? 'bg-[#5C6CF2]/15 border-[#5C6CF2]/50 text-[#F4F6F8]'
                      : 'bg-[#171B22] border-[#2A313C] text-[#98A2B3] hover:border-[#3A424F]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      selectedTaskId === t.id ? 'bg-[#5C6CF2]' : 'bg-[#3A424F]'
                    }`}
                  />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <input
              value={freeLabel}
              onChange={(e) => setFreeLabel(e.target.value)}
              placeholder="Name this session"
              maxLength={100}
              className="w-full bg-[#171B22] border border-[#2A313C] focus:border-[#5C6CF2]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none transition-colors"
            />
          )}
        </div>

        <div>
          <p className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase mb-2">
            For how long?
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {FOCUS_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  soundFx.playClick();
                  setMinutes(m);
                }}
                className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                  minutes === m
                    ? 'text-[#818CF8] bg-[#5C6CF2]/15 border-[#5C6CF2]/40'
                    : 'text-[#98A2B3] bg-[#171B22] border-[#2A313C] hover:border-[#3A424F]'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={begin}
          disabled={todayTasks.length === 0 && !freeLabel.trim()}
          className="eb-lift eb-glow-indigo eb-shine w-full py-3.5 rounded-xl bg-[#5C6CF2] hover:bg-[#4F5BE0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-mono font-black flex items-center justify-center gap-2"
        >
          <Timer className="w-4 h-4" />
          Start focus
        </motion.button>
      </div>

      {secondsToday > 0 && (
        <p className="text-[11px] text-[#98A2B3] font-mono text-center">
          {formatDuration(secondsToday)} focused today
        </p>
      )}
    </div>
  );
};
