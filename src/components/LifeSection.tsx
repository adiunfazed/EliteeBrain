import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
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

interface Props {
  userId: string | null;
  profile: UserProfile;
  /** Active goals a routine block can be attached to. */
  goals?: { id: string; title: string }[];
  /** Open directly on a given pane, e.g. from the Sleep card on Home. */
  initialPane?: 'routine' | 'week' | 'sleep';
}

type Pane = 'routine' | 'week' | 'sleep';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KINDS: BlockKind[] = ['study', 'work', 'exercise', 'sleep', 'meal', 'personal', 'custom'];

export const LifeSection: React.FC<Props> = ({ userId, goals = [], initialPane }) => {
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [pane, setPane] = useState<Pane>(initialPane || 'routine');

  // useState only reads its initial value on first mount, so a later request
  // to open Sleep was ignored whenever this component was already mounted —
  // which is exactly the case when tapping Sleep from Home.
  useEffect(() => {
    if (initialPane) setPane(initialPane);
  }, [initialPane]);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BlockKind>('study');
  const [blockGoalId, setBlockGoalId] = useState<string | undefined>();
  /** Empty means every day. */
  const [blockDays, setBlockDays] = useState<number[]>([]);
  const [editingDaysFor, setEditingDaysFor] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingTimeFor, setEditingTimeFor] = useState<string | null>(null);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
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

  const addBlock = async () => {
    const t = title.trim();
    if (!t) return;
    const block = newRoutineBlock(t, kind, start, end);
    if (blockGoalId) block.goalId = blockGoalId;
    if (blockDays.length > 0) block.weekdays = [...blockDays].sort((a, b) => a - b);
    setBlocks((prev) => [block, ...prev]);
    setTitle('');
    setBlockGoalId(undefined);
    setBlockDays([]);
    soundFx.playClick();
    try {
      await saveRoutineBlock(userId, block);
    } catch (e) {
      console.error('Could not save block:', e);
      setBlocks((prev) => prev.filter((b) => b.id !== block.id));
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
    pending: 'border-[#2A313C] bg-[#0E1116]',
    done: 'border-emerald-500/30 bg-emerald-500/[0.07]',
    partial: 'border-amber-500/30 bg-amber-500/[0.07]',
    skipped: 'border-[#20252E] bg-[#0B0E13] opacity-60',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {(['routine', 'week', 'sleep'] as Pane[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              soundFx.playClick();
              setPane(p);
            }}
            data-active={pane === p}
            className="eb-tab eb-shine text-[11px] font-mono px-3.5 py-2.5 capitalize shrink-0" 
          >
            {p}
          </button>
        ))}
      </div>

      {pane === 'routine' && (
        <>
          {/* Today's adherence */}
          {adherence.total > 0 && (
            <div className="eb-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="eb-label">
                  Today's routine
                </span>
                <span className="eb-heading text-sm tabular-nums">
                  {adherence.done} / {adherence.total}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full bg-[#171B22] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#8B5CF6] rounded-full"
                  initial={false}
                  animate={{ width: `${adherence.ratio * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {overload && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-3.5 h-3.5 eb-warn shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#98A2B3] leading-relaxed">{overload}</p>
            </div>
          )}

          {/* Composer */}
          <div className="eb-card p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlock()}
                placeholder="Add a time block — e.g. Morning study"
                maxLength={80}
                className="flex-1 min-w-0 eb-card-sunk focus:border-[#8B5CF6]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#7E8899] outline-none"
              />
              <button
                onClick={addBlock}
                disabled={!title.trim()}
                aria-label="Add block"
                className="eb-btn-primary eb-shine shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
              >
                <Plus className="w-5 h-5 shrink-0" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3]">
                <Clock className="w-3 h-3 shrink-0" />
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="eb-card-sunk rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
                <span className="text-[#7E8899]">→</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="eb-card-sunk rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
              </label>
            </div>

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="eb-press text-[10px] font-mono font-bold text-[#8A93A5] hover:text-[#F2F4F7] flex items-center gap-1.5"
            >
              {showAdvanced ? '− Fewer options' : '+ Days, type and goal'}
            </button>

            <div className={showAdvanced ? '' : 'hidden'}>
              <p className="eb-label mb-1.5">
                Repeats on
                <span className="ml-1.5 normal-case tracking-normal text-[#7E8899]">
                  {blockDays.length === 0 ? 'every day' : `${blockDays.length} day${blockDays.length === 1 ? '' : 's'}`}
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                {DAY_LABELS.map((label, i) => {
                  const on = blockDays.length === 0 || blockDays.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setBlockDays((prev) => {
                          // An empty list means every day, so the first tap
                          // starts from all-selected rather than none.
                          const base = prev.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : prev;
                          const next = base.includes(i)
                            ? base.filter((d) => d !== i)
                            : [...base, i].sort((a, b) => a - b);
                          return next.length === 7 ? [] : next;
                        })
                      }
                      aria-label={`Toggle day ${i}`}
                      className={`eb-press flex-1 h-10 rounded-xl text-[11px] font-mono font-bold border ${
                        on ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {goals.length > 0 && showAdvanced && (
              <div>
                <p className="eb-label mb-1.5">
                  Counts toward a goal
                </p>
                <div className="eb-tabs w-fit max-w-full overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setBlockGoalId(undefined)}
                    className={`eb-press text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${
                      !blockGoalId
                        ? 'eb-chip-active'
                        : 'text-[#7E8899] border-[#2A313C]'
                    }`}
                  >
                    Nothing
                  </button>
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setBlockGoalId(blockGoalId === g.id ? undefined : g.id)}
                      className={`eb-press text-[11px] font-semibold px-2.5 py-1.5 rounded-full border max-w-full truncate ${
                        blockGoalId === g.id
                          ? 'eb-chip-active'
                          : 'text-[#7E8899] border-[#2A313C] hover:border-[#3A424F]'
                      }`}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`items-center gap-1.5 flex-wrap ${showAdvanced ? 'flex' : 'hidden'}`}>
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`eb-press text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${
                    kind === k
                      ? BLOCK_META[k].tint
                      : 'text-[#7E8899] border-[#2A313C] hover:border-[#3A424F]'
                  }`}
                >
                  {BLOCK_META[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {day.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-[#2A313C] rounded-2xl">
              <p className="eb-heading text-base">Build your day</p>
              <p className="text-[13px] text-[#8A93A5] mt-1.5 max-w-xs mx-auto leading-relaxed">
                Add the blocks you actually repeat — study, gym, sleep. Tick them off as you go,
                and link one to a goal so the goal moves when you do the work.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {day.map(({ block, state }) => (
                <motion.div
                  key={block.id}
                  layout
                  className={`group eb-shine eb-lift relative overflow-hidden rounded-2xl border p-3.5 flex items-start gap-3 ${
                  editingDaysFor === block.id || editingTimeFor === block.id ? 'pb-14' : ''
                } ${stateStyle[state]}`}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${BLOCK_META[block.kind].bar}`} />

                  <button
                    onClick={() => cycleState(block, state)}
                    aria-label="Cycle block state"
                    className="shrink-0 w-10 h-10 -m-1 flex items-center justify-center"
                  >
                    <span
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                        state === 'done'
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                          : state === 'partial'
                            ? 'bg-amber-500 border-amber-500 text-slate-950'
                            : 'border-[#3A424F]'
                      }`}
                    >
                      {state === 'done' && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                      {state === 'partial' && <MinusCircle className="w-3.5 h-3.5 shrink-0" />}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    {editingId === block.id ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => commitRename(block)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(block);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-[#171B22] border border-[#8B5CF6]/60 rounded-lg px-2 py-1 text-sm text-[#F4F6F8] outline-none"
                      />
                    ) : (
                      <p
                        className={`text-sm font-bold break-words ${
                          state === 'skipped' ? 'text-[#7E8899] line-through' : 'text-[#F4F6F8]'
                        }`}
                      >
                        {block.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {editingTimeFor === block.id ? (
                        <span
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="time"
                            defaultValue={block.startTime}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== block.startTime) {
                                patchRoutineBlock(userId, block.id, { startTime: e.target.value });
                                setBlocks((prev) =>
                                  prev.map((b) =>
                                    b.id === block.id ? { ...b, startTime: e.target.value } : b
                                  )
                                );
                              }
                            }}
                            className="bg-[#0E1116] border border-[#262C38] rounded-lg px-1.5 py-1 text-[10px] text-[#F2F4F7] outline-none"
                          />
                          <span className="text-[#7E8899] text-[10px]">→</span>
                          <input
                            type="time"
                            defaultValue={block.endTime}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== block.endTime) {
                                patchRoutineBlock(userId, block.id, { endTime: e.target.value });
                                setBlocks((prev) =>
                                  prev.map((b) =>
                                    b.id === block.id ? { ...b, endTime: e.target.value } : b
                                  )
                                );
                              }
                            }}
                            className="bg-[#0E1116] border border-[#262C38] rounded-lg px-1.5 py-1 text-[10px] text-[#F2F4F7] outline-none"
                          />
                          <button
                            onClick={() => setEditingTimeFor(null)}
                            className="eb-press text-[10px] font-mono font-bold text-[var(--signal-ink)] px-1.5"
                          >
                            Done
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setEditingTimeFor(block.id)}
                          className="eb-press text-[10px] font-mono text-[#98A2B3] hover:text-[#F2F4F7]"
                        >
                          {block.startTime} – {block.endTime}
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-[#7E8899]">
                        {blockDuration(block)} min
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${BLOCK_META[block.kind].tint}`}
                      >
                        {BLOCK_META[block.kind].label}
                      </span>
                      <button
                        onClick={() =>
                          setEditingTimeFor(editingTimeFor === block.id ? null : block.id)
                        }
                        className="eb-press text-[11px] font-mono text-[#8A93A5] hover:text-[#F2F4F7] flex items-center gap-1 relative"
                      >
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        {block.startTime}–{block.endTime}
                      </button>
                      <button
                        onClick={() =>
                          setEditingDaysFor(editingDaysFor === block.id ? null : block.id)
                        }
                        className="eb-press text-[11px] font-mono text-[#8A93A5] hover:text-[#F2F4F7] flex items-center gap-1 relative"
                      >
                        <CalendarDays className="w-2.5 h-2.5 shrink-0" />
                        {!block.weekdays || block.weekdays.length === 0
                          ? 'Every day'
                          : block.weekdays.map((d) => DAY_LABELS[d]).join(' ')}
                      </button>
                      {block.goalId && (
                        <span className="text-[11px] font-mono text-[#A78BFA] flex items-center gap-1">
                          <Target className="w-2.5 h-2.5 shrink-0" />
                          {goals.find((g) => g.id === block.goalId)?.title || 'Goal'}
                        </span>
                      )}
                      {state === 'skipped' && (
                        <span className="text-[11px] font-mono text-[#7E8899]">Skipped</span>
                      )}
                    </div>
                  </div>

                  {editingTimeFor === block.id && (
                    <div className="absolute left-3 right-3 bottom-2 z-10 flex items-center gap-2 flex-wrap">
                      <input
                        type="time"
                        defaultValue={block.startTime}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== block.startTime) {
                            patchRoutineBlock(userId, block.id, { startTime: e.target.value });
                            setBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id ? { ...b, startTime: e.target.value } : b
                              )
                            );
                          }
                        }}
                        className="bg-[#0B0D12] border border-[#262C38] rounded-lg px-2 py-1.5 text-[11px] text-[#F2F4F7] outline-none"
                      />
                      <span className="text-[#7E8899] text-[11px]">→</span>
                      <input
                        type="time"
                        defaultValue={block.endTime}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== block.endTime) {
                            patchRoutineBlock(userId, block.id, { endTime: e.target.value });
                            setBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id ? { ...b, endTime: e.target.value } : b
                              )
                            );
                          }
                        }}
                        className="bg-[#0B0D12] border border-[#262C38] rounded-lg px-2 py-1.5 text-[11px] text-[#F2F4F7] outline-none"
                      />

                      <select
                        defaultValue={block.kind}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const kind = e.target.value as BlockKind;
                          patchRoutineBlock(userId, block.id, { kind });
                          setBlocks((prev) =>
                            prev.map((b) => (b.id === block.id ? { ...b, kind } : b))
                          );
                        }}
                        className="bg-[#0B0D12] border border-[#262C38] rounded-lg px-2 py-1.5 text-[11px] text-[#F2F4F7] outline-none"
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {BLOCK_META[k].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingTimeFor === block.id && (
                    <div
                      className="absolute left-3 right-3 bottom-2 flex items-center gap-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="time"
                        defaultValue={block.startTime}
                        onBlur={(e) =>
                          e.target.value !== block.startTime &&
                          updateBlockTime(block, { startTime: e.target.value })
                        }
                        className="flex-1 min-w-0 bg-[#0B0D12] border border-[#262C38] rounded-lg px-2 py-1.5 text-[11px] text-[#F2F4F7] outline-none"
                      />
                      <span className="text-[#7E8899] text-xs">→</span>
                      <input
                        type="time"
                        defaultValue={block.endTime}
                        onBlur={(e) =>
                          e.target.value !== block.endTime &&
                          updateBlockTime(block, { endTime: e.target.value })
                        }
                        className="flex-1 min-w-0 bg-[#0B0D12] border border-[#262C38] rounded-lg px-2 py-1.5 text-[11px] text-[#F2F4F7] outline-none"
                      />
                    </div>
                  )}

                  {editingDaysFor === block.id && (
                    <div className="absolute left-3 right-3 bottom-2 flex items-center gap-1 z-10">
                      {DAY_LABELS.map((label, i) => {
                        const active =
                          !block.weekdays || block.weekdays.length === 0
                            ? true
                            : block.weekdays.includes(i);
                        return (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBlockDay(block, i);
                            }}
                            className={`eb-press flex-1 h-8 rounded-lg text-[10px] font-mono font-bold border ${
                              active ? 'eb-chip-active' : 'text-[#7E8899] border-[#262C38] bg-[#0B0D12]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-0.5 shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(block.id);
                        setEditText(block.title);
                      }}
                      aria-label="Rename block"
                      className="w-10 h-10 shrink-0 rounded-lg hover:bg-[#171B22] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" />
                    </button>
                    <button
                      onClick={() => deleteBlock(block)}
                      aria-label="Delete block"
                      className="w-10 h-10 shrink-0 rounded-lg hover:bg-rose-500/15 text-[#98A2B3] hover:eb-danger flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                </motion.div>
              ))}
              <p className="text-[10px] font-mono text-[#7E8899] text-center pt-1">
                Tap the box to cycle: pending → done → partial → skipped.
              </p>
            </div>
          )}
        </>
      )}

      {pane === 'week' && (
        <div className="space-y-3">
          <p className="text-[10px] font-mono text-[#98A2B3]">
            The week at a glance. Green means done, amber partial.
          </p>

          <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
            <div className="grid grid-cols-7 gap-1.5 min-w-[520px]">
              {weekDates.map((iso) => {
                const dayBlocks = blocksForDate(blocks, logs, iso);
                const d = new Date(`${iso}T00:00:00`);
                const isToday = iso === today;
                return (
                  <div
                    key={iso}
                    className={`rounded-xl border p-2 min-w-0 ${
                      isToday ? 'border-[#8B5CF6]/45 bg-[#8B5CF6]/[0.07]' : 'border-[#2A313C] bg-[#0E1116]'
                    }`}
                  >
                    <p className="text-[11px] font-mono font-bold text-[#98A2B3] uppercase text-center">
                      {d.toLocaleDateString(undefined, { weekday: 'short' })}
                    </p>
                    <p
                      className={`text-[11px] font-mono font-black text-center tabular-nums ${
                        isToday ? 'text-[#A78BFA]' : 'text-[#F4F6F8]'
                      }`}
                    >
                      {d.getDate()}
                    </p>

                    <div className="mt-2 space-y-1">
                      {dayBlocks.length === 0 ? (
                        <p className="text-[11px] font-mono text-[#3A424F] text-center py-1">—</p>
                      ) : (
                        dayBlocks.slice(0, 5).map(({ block, state }) => (
                          <div
                            key={block.id}
                            title={`${block.title} · ${block.startTime}–${block.endTime}`}
                            className={`rounded-md px-1 py-1 border ${
                              state === 'done'
                                ? 'bg-emerald-500/15 border-emerald-500/30'
                                : state === 'partial'
                                  ? 'bg-amber-500/15 border-amber-500/30'
                                  : state === 'skipped'
                                    ? 'bg-[#0B0E13] border-[#20252E] opacity-50'
                                    : 'bg-[#171B22] border-[#2A313C]'
                            }`}
                          >
                            <p className="text-[8px] font-mono text-[#98A2B3] leading-tight truncate">
                              {block.startTime}
                            </p>
                            <p className="text-[11px] font-bold text-[#F4F6F8] leading-tight truncate">
                              {block.title}
                            </p>
                          </div>
                        ))
                      )}
                      {dayBlocks.length > 5 && (
                        <p className="text-[8px] font-mono text-[#7E8899] text-center">
                          +{dayBlocks.length - 5}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] font-mono text-[#7E8899] text-center">
            Mark blocks done from the Routine tab.
          </p>
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
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3]">
                Bed
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className="eb-card-sunk rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3]">
                Wake
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="eb-card-sunk rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
              </label>
              <button
                onClick={logSleep}
                className="eb-press eb-shine ml-auto text-[11px] font-mono font-black px-4 py-2.5 rounded-xl bg-indigo-500 hover:brightness-110 text-white"
              >
                {tonight ? 'Update' : 'Log sleep'}
              </button>
            </div>

            {tonight && (
              <p className="text-[11px] font-mono text-indigo-300 mt-2.5">
                {formatSleepDuration(tonight.minutes)} · {tonight.bedtime} → {tonight.wakeTime}
                <button
                  onClick={() => {
                    setSleep((prev) => prev.filter((s) => s.id !== today));
                    removeSleepLog(userId, today).catch((e) => console.error(e));
                  }}
                  className="ml-2 text-[#7E8899] hover:eb-danger"
                >
                  remove
                </button>
              </p>
            )}
          </div>

          {stats.nights > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Nights', value: `${stats.nights}` },
                  { label: 'Average', value: formatSleepDuration(stats.averageMinutes) },
                  { label: 'Consistency', value: `${stats.consistency}%` },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="eb-card p-3 text-center min-w-0"
                  >
                    <p className="text-lg font-black font-mono text-[#F4F6F8] tabular-nums leading-none">
                      {s.value}
                    </p>
                    <p className="text-[11px] font-mono text-[#7E8899] mt-1 truncate">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Duration history */}
              <div className="eb-card p-4">
                <span className="eb-label flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 shrink-0" />
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

              <p className="text-[10px] text-[#7E8899] leading-relaxed text-center max-w-md mx-auto">
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
