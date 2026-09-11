import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sun,
  Check,
  Trash2,
  Moon,
  Clock,
  TrendingUp,
  MinusCircle,
  AlertTriangle,
  Pencil,
  Target,
  CalendarDays,
} from 'lucide-react';
import type {
  Habit,
  BlockKind,
  BlockState,
  RoutineBlock,
  RoutineLog,
  SleepLog,
  UserProfile,
} from '../types';
import {
  newRoutineBlock,
  patchRoutineBlock,
  removeRoutineBlock,
  removeSleepLog,
  saveRoutineBlock,
  saveSleepLog,
  setRoutineState,
  subscribeRoutineBlocks,
  subscribeRoutineLogs,
  subscribeSleepLogs,
} from '../lib/goalStore';
import {
  BLOCK_META,
  blockDuration,
  blocksForDate,
  formatSleepDuration,
  makeSleepLog,
  overloadWarning,
  routineAdherence,
  sleepStats,
} from '../lib/routine';
import { todayISO } from '../lib/tasks';
import { soundFx } from '../utils/audio';
import { blockDisplay, BLOCK_DISPLAY_STYLE } from '../lib/blockTiming';
import { ComposerSheet } from './ComposerSheet';
import { AddButton } from './AddButton';
import { RoutineComposer } from './RoutineComposer';

interface Props {
  userId: string | null;
  profile: UserProfile;
  /** Active goals a routine block can be attached to. */
  goals?: { id: string; title: string }[];
  /** Active habits a block can complete. */
  habits?: Habit[];
  /** Open directly on a given pane, e.g. from the Sleep card on Home. */
  initialPane?: 'routine' | 'week' | 'sleep';
}

type Pane = 'routine' | 'week' | 'sleep';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KINDS: BlockKind[] = ['study', 'work', 'exercise', 'sleep', 'meal', 'personal', 'custom'];

export const LifeSection: React.FC<Props> = ({ userId, goals = [], habits = [], initialPane }) => {
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [pane, setPane] = useState<Pane>(initialPane || 'routine');
  const [blockComposerOpen, setBlockComposerOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);

  // useState only reads its initial value on first mount, so a later request
  // to open Sleep was ignored whenever this component was already mounted —
  // which is exactly the case when tapping Sleep from Home.
  useEffect(() => {
    if (initialPane) setPane(initialPane);
  }, [initialPane]);

  const [editingDaysFor, setEditingDaysFor] = useState<string | null>(null);
  const [editingTimeFor, setEditingTimeFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');

  useEffect(() => subscribeRoutineBlocks(userId, setBlocks), [userId]);
  useEffect(() => subscribeRoutineLogs(userId, setLogs), [userId]);
  useEffect(() => subscribeSleepLogs(userId, setSleep), [userId]);

  const today = todayISO();
  const day = useMemo(() => blocksForDate(blocks, logs, today), [blocks, logs, today]);
  const adherence = useMemo(() => routineAdherence(blocks, logs, today), [blocks, logs, today]);
  const overload = useMemo(() => overloadWarning(blocks, today), [blocks, today]);
  const stats = useMemo(() => sleepStats(sleep, today), [sleep, today]);
  const tonight = useMemo(() => sleep.find((s) => s.date === today), [sleep, today]);

  // The current week, Monday first.
  const weekDates = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    });
  }, [today]);
  /** Set a block to a specific state. */
  const setBlockState = async (block: RoutineBlock, next: BlockState) => {
    if (next === 'done') soundFx.playSuccess();
    else soundFx.playClick();

    setLogs((prev) => [
      { id: `${today}__${block.id}`, blockId: block.id, date: today, state: next, updatedAt: '' },
      ...prev.filter((l) => !(l.blockId === block.id && l.date === today)),
    ]);
    try {
      await setRoutineState(userId, block.id, today, next);
    } catch (e) {
      console.error('Could not update block:', e);
    }
  };

  const cycleState = async (block: RoutineBlock, current: BlockState) => {
    const order: BlockState[] = ['pending', 'done', 'partial', 'skipped'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    if (next === 'done') soundFx.playSuccess();
    else soundFx.playClick();

    setLogs((prev) => [
      { id: `${today}__${block.id}`, blockId: block.id, date: today, state: next, updatedAt: '' },
      ...prev.filter((l) => !(l.blockId === block.id && l.date === today)),
    ]);
    try {
      await setRoutineState(userId, block.id, today, next);
    } catch (e) {
      console.error('Could not update block:', e);
    }
  };

  const commitRename = async (block: RoutineBlock) => {
    const t = editText.trim();
    setEditingId(null);
    if (!t || t === block.title) return;
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, title: t } : b)));
    try {
      await patchRoutineBlock(userId, block.id, { title: t });
    } catch (e) {
      console.error('Could not rename block:', e);
    }
  };

  /** Change a block's start or end time without losing its history. */
  const updateBlockTime = async (block: RoutineBlock, changes: Partial<RoutineBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, ...changes } : b)));
    try {
      await patchRoutineBlock(userId, block.id, changes);
    } catch (e) {
      console.error('Could not update time:', e);
    }
  };

  const toggleBlockDay = async (block: RoutineBlock, day: number) => {
    const current = block.weekdays && block.weekdays.length > 0 ? block.weekdays : [0, 1, 2, 3, 4, 5, 6];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);

    // Removing every day would hide the block entirely with no way back, so
    // an empty selection means "every day" rather than "never".
    const weekdays = next.length === 0 || next.length === 7 ? undefined : next;

    soundFx.playClick();
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, weekdays } : b)));
    try {
      await patchRoutineBlock(userId, block.id, { weekdays: weekdays ?? [] });
    } catch (e) {
      console.error('Could not update days:', e);
    }
  };

  const deleteBlock = async (block: RoutineBlock) => {
    if (!window.confirm(`Remove "${block.title}" from your routine?`)) return;
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    try {
      await removeRoutineBlock(userId, block.id);
    } catch (e) {
      console.error('Could not delete block:', e);
    }
  };

  const logSleep = async () => {
    const entry = makeSleepLog(today, bedtime, wakeTime);
    setSleep((prev) => [entry, ...prev.filter((s) => s.id !== entry.id)]);
    soundFx.playSuccess();
    try {
      await saveSleepLog(userId, entry);
    } catch (e) {
      console.error('Could not save sleep:', e);
    }
  };

  const stateStyle: Record<BlockState, string> = {
    pending: 'border-[var(--rule)] bg-[var(--ground)]',
    done: 'border-emerald-500/30 bg-emerald-500/[0.07]',
    partial: 'border-amber-500/30 bg-amber-500/[0.07]',
    skipped: 'border-[#20252E] bg-[var(--surface)] opacity-60',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--surface-sunk)] border border-[var(--rule)]">
        {([
          { id: 'routine' as Pane, label: 'Day', icon: Sun },
          { id: 'week' as Pane, label: 'Week', icon: CalendarDays },
          { id: 'sleep' as Pane, label: 'Sleep', icon: Moon },
        ]).map(({ id, label, icon: Icon }) => {
          const active = pane === id;
          return (
            <button
              key={id}
              onClick={() => {
                soundFx.playClick();
                setPane(id);
              }}
              aria-current={active ? 'page' : undefined}
              className="relative min-h-[38px] rounded-lg flex items-center justify-center gap-1.5 px-2 transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="life-tab-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                    boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}

              <Icon
                className="relative w-[15px] h-[15px] shrink-0"
                strokeWidth={active ? 2.4 : 1.9}
                style={{ color: active ? 'var(--signal-ink)' : 'var(--ink-dim)' }}
              />
              <span
                className="relative text-[12.5px] leading-none whitespace-nowrap"
                style={{
                  color: active ? 'var(--ink)' : 'var(--ink-dim)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {pane === 'routine' && (
        <>
          {/* Today's adherence */}
          {adherence.total > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h1 className="t-title">Routine</h1>
                <span className="t-meta shrink-0">
                  {adherence.done}/{adherence.total} done today
                </span>
              </div>
              <div
                className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: 'var(--surface-sunk)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: adherence.ratio >= 1 ? 'var(--done)' : 'var(--signal)',
                  }}
                  initial={false}
                  animate={{ width: `${adherence.ratio * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {overload && (
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                background: 'color-mix(in oklab, var(--warn) 9%, transparent)',
                border: '1px solid color-mix(in oklab, var(--warn) 30%, var(--rule))',
              }}
            >
              <AlertTriangle className="w-4 h-4 eb-warn shrink-0 mt-0.5" />
              <p className="t-sub flex-1 min-w-0 leading-relaxed">{overload}</p>
            </div>
          )}

          <AddButton label="Add block" onClick={() => setBlockComposerOpen(true)} />

          <ComposerSheet
            open={blockComposerOpen}
            title={editingBlock ? 'Edit block' : 'New routine block'}
            onClose={() => {
              setBlockComposerOpen(false);
              setEditingBlock(null);
            }}
          >
            <RoutineComposer
              block={editingBlock}
              habits={habits}
              goals={goals.map((g) => ({ id: g.id, title: g.title }))}
              onCancel={() => {
                setBlockComposerOpen(false);
                setEditingBlock(null);
              }}
              onSave={async (fields) => {
                if (editingBlock) {
                  const updated = {
                    ...editingBlock,
                    ...fields,
                    updatedAt: new Date().toISOString(),
                  };
                  setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                  await saveRoutineBlock(userId, updated);
                } else {
                  const created = newRoutineBlock(
                    fields.title,
                    fields.kind,
                    fields.startTime,
                    fields.endTime
                  );
                  Object.assign(created, {
                    weekdays: fields.weekdays,
                    habitId: fields.habitId,
                    goalId: fields.goalId,
                  });
                  setBlocks((prev) => [...prev, created]);
                  await saveRoutineBlock(userId, created);
                }
                setBlockComposerOpen(false);
                setEditingBlock(null);
              }}
            />
          </ComposerSheet>

          {/* Timeline */}
          {day.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-[var(--rule)] rounded-xl">
              <p className="t-section text-base">Build your day</p>
              <p className="text-[13px] text-[var(--ink-muted)] mt-1.5 max-w-xs mx-auto leading-relaxed">
                Add the blocks you actually repeat — study, gym, sleep. Tick them off as you go,
                and link one to a goal so the goal moves when you do the work.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {day.map(({ block, state }) => {
                const meta = BLOCK_META[block.kind] || BLOCK_META.custom;
                const days = block.weekdays && block.weekdays.length > 0 ? block.weekdays : null;

                // Shared with Home, so a block reads the same on both screens.
                const display = blockDisplay(state, block.startTime, block.endTime);
                const dStyle = BLOCK_DISPLAY_STYLE[display];

                return (
                  <div
                    key={block.id}
                    className="rounded-xl eb-card p-4"
                    style={{
                      opacity: dStyle.opacity,
                      borderColor:
                        display === 'now'
                          ? 'color-mix(in oklab, var(--signal) 45%, var(--rule))'
                          : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Time, fixed width so every name starts at the same x. */}
                      <span
                        className="w-[52px] shrink-0 text-center rounded-xl py-1.5"
                        style={{ background: 'var(--surface-sunk)' }}
                      >
                        <span className="t-figure block text-[13px] tabular-nums">
                          {block.startTime}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[15px] font-semibold leading-snug line-clamp-2"
                          style={{
                            // Strike-through means completed, never merely
                            // elapsed — otherwise a missed block looks done.
                            textDecoration: dStyle.strike ? 'line-through' : undefined,
                            color: dStyle.strike ? 'var(--ink-dim)' : 'var(--ink)',
                          }}
                        >
                          {block.title}
                        </p>
                        <p className="t-meta mt-0.5 truncate flex items-center gap-1.5">
                          <span>
                            {meta.label} · {blockDuration(block)} min
                          </span>
                          {dStyle.label && (
                            <span
                              className="px-1.5 py-0.5 rounded shrink-0"
                              style={{
                                color: dStyle.color || 'var(--ink-dim)',
                                background: `color-mix(in oklab, ${dStyle.color} 14%, transparent)`,
                              }}
                            >
                              {dStyle.label}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Same completion control as tasks and habits. */}
                      <button
                        onClick={() => setBlockState(block, state === 'done' ? 'pending' : 'done')}
                        aria-label={state === 'done' ? 'Mark not done' : 'Mark done'}
                        className="shrink-0 w-10 h-10 flex items-center justify-center"
                      >
                        <span
                          className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-all ${
                            state === 'done'
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950 glow-done'
                              : 'border-[var(--rule-strong)]'
                          }`}
                        >
                          {state === 'done' && (
                            <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                          )}
                        </span>
                      </button>
                    </div>

                    {/* Which days it runs. Only shown when it is not every day,
                        since "every day" is already in the line above. */}
                    {days && (
                      <div className="grid grid-cols-7 gap-1.5 mt-3.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => {
                          const on = days.includes(i);
                          const isToday = new Date(`${today}T00:00:00`).getDay() === i;

                          return (
                            <div key={i} className="flex flex-col items-center gap-1 min-w-0">
                              <span className="t-meta leading-none">{label}</span>
                              <span
                                className={`w-full rounded-full ${isToday && on ? 'glow-today' : ''}`}
                                style={{
                                  aspectRatio: '1 / 1',
                                  maxWidth: 28,
                                  background: on
                                    ? 'color-mix(in oklab, var(--signal) 60%, transparent)'
                                    : 'transparent',
                                  border: on ? 'none' : '1px solid var(--rule)',
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <span className="t-meta min-w-0 truncate">
                        {block.startTime}–{block.endTime}
                      </span>

                      <span className="flex-1" />

                      <button
                        onClick={() => {
                          soundFx.playClick();
                          setEditingBlock(block);
                          setBlockComposerOpen(true);
                        }}
                        aria-label="Edit block"
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: 'var(--ink-dim)' }}
                      >
                        <Pencil className="w-4 h-4 shrink-0" />
                      </button>

                      <button
                        onClick={() => deleteBlock(block)}
                        aria-label="Delete block"
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: 'var(--ink-dim)' }}
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="t-meta text-center pt-1">
                Tap the box to cycle: pending → done → partial → skipped.
              </p>
            </div>
          )}
        </>
      )}

      {pane === 'week' && (
        <div className="space-y-2.5">
          {weekDates.map((iso) => {
            const dayBlocks = blocksForDate(blocks, logs, iso);
            const d = new Date(`${iso}T00:00:00`);
            const isToday = iso === today;
            const done = dayBlocks.filter((b) => b.state === 'done').length;

            return (
              <div
                key={iso}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${
                    isToday ? 'color-mix(in oklab, var(--signal) 45%, var(--rule))' : 'var(--rule)'
                  }`,
                }}
              >
                {/* Day header. The date and completion sit on one line so the
                    blocks below get the full width. */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    background: isToday
                      ? 'color-mix(in oklab, var(--signal) 12%, transparent)'
                      : 'var(--surface-sunk)',
                  }}
                >
                  <span
                    className="t-figure text-[17px] w-7 text-center shrink-0"
                    style={{ color: isToday ? 'var(--signal-ink)' : 'var(--ink)' }}
                  >
                    {d.getDate()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-[14px] font-semibold block leading-tight">
                      {d.toLocaleDateString(undefined, { weekday: 'long' })}
                      {isToday && (
                        <span className="t-meta ml-2" style={{ color: 'var(--signal-ink)' }}>
                          Today
                        </span>
                      )}
                    </span>
                  </span>

                  {dayBlocks.length > 0 && (
                    <span className="t-meta shrink-0">
                      {done}/{dayBlocks.length}
                    </span>
                  )}
                </div>

                {dayBlocks.length === 0 ? (
                  <p className="t-sub px-4 py-3">Nothing scheduled.</p>
                ) : (
                  <div>
                    {dayBlocks.map(({ block, state }, i) => (
                      <div
                        key={block.id}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
                          opacity: state === 'skipped' ? 0.45 : 1,
                        }}
                      >
                        {/* Status as a dot rather than a filled block: colour
                            on a 4px mark is enough, and it leaves the title
                            room to be read. */}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              state === 'done'
                                ? 'var(--done)'
                                : state === 'partial'
                                  ? 'var(--warn)'
                                  : 'var(--rule-strong)',
                          }}
                        />

                        <span className="t-meta w-11 shrink-0 tabular-nums">
                          {block.startTime}
                        </span>

                        <span
                          className="text-[14px] min-w-0 flex-1 truncate"
                          style={{
                            textDecoration: state === 'done' ? 'line-through' : undefined,
                            color: state === 'done' ? 'var(--ink-dim)' : 'var(--ink)',
                          }}
                        >
                          {block.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <p className="t-sub text-center pt-1">Mark blocks done from the Day tab.</p>
        </div>
      )}

      {pane === 'sleep' && (
        <div className="space-y-4">
          <div className="eb-card p-4">
            <div className="flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
              <span className="eb-label">
                Last night
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <label className="flex items-center gap-1.5 t-meta">
                Bed
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none w-full"
                  style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                />
              </label>
              <label className="flex items-center gap-1.5 t-meta">
                Wake
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none w-full"
                  style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
                />
              </label>
              <button onClick={logSleep} className="btn-lg ml-auto shrink-0">
                {tonight ? 'Update' : 'Log sleep'}
              </button>
            </div>

            {tonight && (
              <p className="t-meta text-indigo-300 mt-2.5">
                {formatSleepDuration(tonight.minutes)} · {tonight.bedtime} → {tonight.wakeTime}
                <button
                  onClick={() => {
                    setSleep((prev) => prev.filter((s) => s.id !== today));
                    removeSleepLog(userId, today).catch((e) => console.error(e));
                  }}
                  className="ml-2 text-[var(--ink-dim)] hover:eb-danger"
                >
                  remove
                </button>
              </p>
            )}
          </div>

          {stats.nights > 0 && (
            <>
              <div
                className="grid grid-cols-3 rounded-xl overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--rule)',
                  gap: 1,
                  boxShadow: '0 0 0 1px var(--rule) inset',
                }}
              >
                {[
                  { label: 'Nights', value: `${stats.nights}` },
                  { label: 'Average', value: formatSleepDuration(stats.averageMinutes) },
                  { label: 'Consistency', value: `${stats.consistency}%` },
                ].map((s) => (
                  <div key={s.label} className="p-3 text-center min-w-0">
                    <p className="t-figure text-lg">{s.value}</p>
                    <p className="t-meta mt-1.5 truncate">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Duration history */}
              <div className="eb-card p-4">
                <span className="eb-label flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  Sleep history
                </span>
                <div className="flex items-end gap-1 mt-3 h-20">
                  {sleep
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(-30)
                    .map((l) => (
                      <div
                        key={l.id}
                        title={`${l.date}: ${formatSleepDuration(l.minutes)}`}
                        className="flex-1 min-w-0 min-w-[3px] bg-indigo-500/70 hover:bg-indigo-400 rounded-t transition-colors"
                        style={{ height: `${Math.min(100, (l.minutes / 600) * 100)}%` }}
                      />
                    ))}
                </div>
              </div>

              <p className="text-[12px] text-[var(--ink-dim)] leading-relaxed text-center max-w-md mx-auto">
                Consistency measures how steady your bedtime is across recorded nights. It
                describes your own logged times — it is not a health or medical measure.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
