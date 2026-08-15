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

const KINDS: BlockKind[] = ['study', 'work', 'exercise', 'sleep', 'meal', 'personal', 'custom'];

export const LifeSection: React.FC<Props> = ({ userId, goals = [], initialPane }) => {
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [pane, setPane] = useState<Pane>(initialPane || 'routine');

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<BlockKind>('study');
  const [blockGoalId, setBlockGoalId] = useState<string | undefined>();
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
    setBlocks((prev) => [block, ...prev]);
    setTitle('');
    setBlockGoalId(undefined);
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
            className={`eb-press eb-shine text-[11px] font-mono font-bold px-3.5 py-2 rounded-xl border capitalize ${
              pane === p
                ? 'text-[#A78BFA] bg-[#8B5CF6]/15 border-[#8B5CF6]/40'
                : 'text-[#98A2B3] bg-[#0E1116] border-[#2A313C] hover:border-[#3A424F]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {pane === 'routine' && (
        <>
          {/* Today's adherence */}
          {adherence.total > 0 && (
            <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
                  Today's routine
                </span>
                <span className="text-sm font-black font-mono text-[#F4F6F8] tabular-nums">
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
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#98A2B3] leading-relaxed">{overload}</p>
            </div>
          )}

          {/* Composer */}
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlock()}
                placeholder="Add a time block — e.g. Morning study"
                maxLength={80}
                className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] focus:border-[#8B5CF6]/60 rounded-xl px-3 py-2.5 text-sm text-[#F4F6F8] placeholder:text-[#5A6472] outline-none"
              />
              <button
                onClick={addBlock}
                disabled={!title.trim()}
                aria-label="Add block"
                className="eb-btn-primary eb-shine shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3]">
                <Clock className="w-3 h-3" />
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
                <span className="text-[#5A6472]">→</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
              </label>
            </div>

            {goals.length > 0 && (
              <div>
                <p className="text-[9px] font-mono font-bold text-[#5A6472] tracking-widest uppercase mb-1.5">
                  Counts toward a goal
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setBlockGoalId(undefined)}
                    className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                      !blockGoalId
                        ? 'text-[#A78BFA] bg-[#8B5CF6]/15 border-[#8B5CF6]/35'
                        : 'text-[#5A6472] border-[#2A313C]'
                    }`}
                  >
                    Nothing
                  </button>
                  {goals.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setBlockGoalId(blockGoalId === g.id ? undefined : g.id)}
                      className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border max-w-full truncate ${
                        blockGoalId === g.id
                          ? 'text-[#A78BFA] bg-[#8B5CF6]/15 border-[#8B5CF6]/35'
                          : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
                      }`}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`eb-press text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                    kind === k
                      ? BLOCK_META[k].tint
                      : 'text-[#5A6472] border-[#2A313C] hover:border-[#3A424F]'
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
              <p className="text-base font-black text-[#F4F6F8] font-mono">No routine yet.</p>
              <p className="text-[11px] text-[#98A2B3] mt-1.5 max-w-xs mx-auto leading-relaxed">
                Block out when things happen and the day plans itself.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {day.map(({ block, state }) => (
                <motion.div
                  key={block.id}
                  layout
                  className={`group eb-shine eb-lift relative overflow-hidden rounded-2xl border p-3.5 flex items-start gap-3 ${stateStyle[state]}`}
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
                      {state === 'done' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      {state === 'partial' && <MinusCircle className="w-3.5 h-3.5" />}
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
                          state === 'skipped' ? 'text-[#5A6472] line-through' : 'text-[#F4F6F8]'
                        }`}
                      >
                        {block.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-mono text-[#98A2B3]">
                        {block.startTime} – {block.endTime}
                      </span>
                      <span className="text-[10px] font-mono text-[#5A6472]">
                        {blockDuration(block)} min
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${BLOCK_META[block.kind].tint}`}
                      >
                        {BLOCK_META[block.kind].label}
                      </span>
                      {block.goalId && (
                        <span className="text-[9px] font-mono text-[#A78BFA] flex items-center gap-1">
                          <Target className="w-2.5 h-2.5" />
                          {goals.find((g) => g.id === block.goalId)?.title || 'Goal'}
                        </span>
                      )}
                      {state === 'skipped' && (
                        <span className="text-[9px] font-mono text-[#5A6472]">Skipped</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(block.id);
                        setEditText(block.title);
                      }}
                      aria-label="Rename block"
                      className="w-10 h-10 rounded-lg hover:bg-[#171B22] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBlock(block)}
                      aria-label="Delete block"
                      className="w-10 h-10 rounded-lg hover:bg-rose-500/15 text-[#98A2B3] hover:text-rose-300 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
              <p className="text-[10px] font-mono text-[#5A6472] text-center pt-1">
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
                    <p className="text-[9px] font-mono font-bold text-[#98A2B3] uppercase text-center">
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
                        <p className="text-[9px] font-mono text-[#3A424F] text-center py-1">—</p>
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
                            <p className="text-[9px] font-bold text-[#F4F6F8] leading-tight truncate">
                              {block.title}
                            </p>
                          </div>
                        ))
                      )}
                      {dayBlocks.length > 5 && (
                        <p className="text-[8px] font-mono text-[#5A6472] text-center">
                          +{dayBlocks.length - 5}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] font-mono text-[#5A6472] text-center">
            Mark blocks done from the Routine tab.
          </p>
        </div>
      )}

      {pane === 'sleep' && (
        <div className="space-y-4">
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
            <div className="flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-indigo-300" />
              <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase">
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
                  className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#98A2B3]">
                Wake
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="bg-[#171B22] border border-[#2A313C] rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
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
                  className="ml-2 text-[#5A6472] hover:text-rose-300"
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
                    className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-3 text-center min-w-0"
                  >
                    <p className="text-lg font-black font-mono text-[#F4F6F8] tabular-nums leading-none">
                      {s.value}
                    </p>
                    <p className="text-[9px] font-mono text-[#5A6472] mt-1 truncate">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Duration history */}
              <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
                <span className="text-[10px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
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
                        className="flex-1 min-w-[3px] bg-indigo-500/70 hover:bg-indigo-400 rounded-t transition-colors"
                        style={{ height: `${Math.min(100, (l.minutes / 600) * 100)}%` }}
                      />
                    ))}
                </div>
              </div>

              <p className="text-[10px] font-mono text-[#5A6472] leading-relaxed text-center max-w-md mx-auto">
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
