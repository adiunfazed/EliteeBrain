import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Pause, Play, Plus, Trophy, X } from 'lucide-react';
import { RestRing } from './RestRing';
import { soundFx } from '../../utils/audio';

/** One row of the log: what was loaded, what was done, and whether it counts. */
export interface LoggedSet {
  /** Kilograms. 0 means bodyweight, which is a real answer, not a blank. */
  weight: number;
  /** Reps, or seconds for a hold. */
  reps: number;
  done: boolean;
}

interface Props {
  metric: 'reps' | 'hold';
  rows: LoggedSet[];
  /**
   * 'log' is the runner: each row has a tick and can be completed.
   * 'plan' is the builder: the same table, without the ticks.
   */
  mode: 'log' | 'plan';
  /** The row being worked on now. Highlighted, and the camera fills it. */
  activeIndex?: number;
  /** Rows whose numbers would beat a personal best, flagged before the tick. */
  prRows?: boolean[];
  /**
   * What each set was planned as.
   *
   * Shown as the cell's placeholder where the row starts empty — a hold
   * counting up from zero, or a set the camera is about to fill — so the
   * target is visible without pretending it has already been done.
   */
  goals?: number[];
  /** Seconds left of rest, shown under the row it follows. */
  rest?: { afterIndex: number; left: number; total: number } | null;
  /** Whether the hold timer is running, for a timed exercise. */
  timerRunning?: boolean;
  onChange: (index: number, patch: Partial<LoggedSet>) => void;
  onToggleDone?: (index: number) => void;
  onToggleTimer?: (index: number) => void;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onSkipRest?: () => void;
  /** Restart the rest at a chosen length, in seconds. */
  onSetRest?: (seconds: number) => void;
  /** Row cap, so a stray finger cannot create forty sets. */
  max?: number;
}

/**
 * A number in a table cell.
 *
 * Commits on every keystroke rather than on blur, because the next thing a
 * finger does after typing reps is hit the tick — and a value that only
 * commits on blur would be read a render too late, logging the old number.
 * The draft string is kept so a half-typed "6." or an emptied field is not
 * rewritten under the user, and it re-syncs from the outside whenever the
 * field is not focused, which is how the camera fills the reps cell.
 */
const Cell: React.FC<{
  value: number;
  suffix?: string;
  decimals?: boolean;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  tone?: 'plain' | 'live';
  onCommit: (value: number) => void;
}> = ({
  value,
  suffix,
  decimals = false,
  label,
  placeholder = '0',
  disabled,
  tone = 'plain',
  onCommit,
}) => {
  const [draft, setDraft] = useState(String(value ?? 0));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value ? String(value) : '');
  }, [value]);

  const parse = (text: string): number | null => {
    const cleaned = decimals
      ? text.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
      : text.replace(/[^\d]/g, '');
    if (!cleaned || cleaned === '.') return 0;
    const n = decimals ? Number.parseFloat(cleaned) : Number.parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <span className="log-cell" data-tone={tone} data-disabled={disabled ? 'true' : 'false'}>
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={draft}
        disabled={disabled}
        aria-label={label}
        placeholder={placeholder}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(value ? String(value) : '');
        }}
        onChange={(e) => {
          const text = e.target.value.slice(0, 6);
          setDraft(text);
          const parsed = parse(text);
          if (parsed !== null) onCommit(parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="log-input"
      />
      {suffix && <span className="log-suffix">{suffix}</span>}
    </span>
  );
};

/**
 * The set log.
 *
 * One table used in two places: the builder plans the sets, the runner
 * performs them. Same columns, same order, same cells — so what you typed
 * when planning is literally the row you tick off in the gym, and there is
 * nothing to learn twice.
 *
 * Every row is independent. Pyramid sets, a drop set, a heavy single after
 * three back-off sets: all of it is just rows, because a single "reps" figure
 * for a whole exercise cannot describe any of them.
 */
export const SetLogger: React.FC<Props> = ({
  metric,
  rows,
  mode,
  activeIndex = -1,
  prRows = [],
  goals = [],
  rest = null,
  timerRunning = false,
  onChange,
  onToggleDone,
  onToggleTimer,
  onAdd,
  onRemove,
  onSkipRest,
  onSetRest,
  max = 12,
}) => {
  const isHold = metric === 'hold';

  return (
    <div className="log">
      <div className="log-head">
        <span>Set</span>
        <span>Weight</span>
        <span>{isHold ? 'Secs' : 'Reps'}</span>
        <span className="sr-only">Done</span>
      </div>

      <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const active = mode === 'log' && index === activeIndex && !row.done;
          const isPr = !!prRows[index] && !row.done;

          return (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
            >
              <div
                className="log-row"
                data-done={row.done ? 'true' : 'false'}
                data-active={active ? 'true' : 'false'}
              >
                <span className="log-index">
                  {index + 1}
                  {isPr && <Trophy className="w-3 h-3 shrink-0 log-pr" />}
                </span>

                <Cell
                  value={row.weight}
                  suffix="kg"
                  decimals
                  label={`Set ${index + 1} weight in kilograms`}
                  disabled={row.done}
                  onCommit={(weight) => onChange(index, { weight })}
                />

                <Cell
                  value={row.reps}
                  placeholder={goals[index] ? String(goals[index]) : '0'}
                  label={`Set ${index + 1} ${isHold ? 'seconds' : 'reps'}`}
                  disabled={row.done}
                  tone={active && (isHold ? timerRunning : true) ? 'live' : 'plain'}
                  onCommit={(reps) => onChange(index, { reps })}
                />

                {mode === 'log' ? (
                  <span className="log-actions">
                    {/* A hold is timed rather than counted, so the active row
                        offers a stopwatch. The number stays editable either
                        way: a phone put down mid-plank should not force a
                        wrong figure. */}
                    {isHold && active && onToggleTimer && (
                      <button
                        onClick={() => {
                          soundFx.playClick();
                          onToggleTimer(index);
                        }}
                        aria-label={timerRunning ? 'Pause the hold' : 'Start the hold'}
                        className="log-timer"
                      >
                        {timerRunning ? (
                          <Pause className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Play className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        soundFx.playClick();
                        onToggleDone?.(index);
                      }}
                      aria-label={
                        row.done ? `Undo set ${index + 1}` : `Log set ${index + 1} as done`
                      }
                      aria-pressed={row.done}
                      className="log-check"
                      data-done={row.done ? 'true' : 'false'}
                      disabled={!row.done && row.reps <= 0}
                    >
                      <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                    </button>
                  </span>
                ) : (
                  <span className="log-actions">
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        onRemove?.(index);
                      }}
                      aria-label={`Remove set ${index + 1}`}
                      className="log-remove"
                      disabled={rows.length <= 1}
                    >
                      <X className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </span>
                )}
              </div>

              {/* Rest sits under the set it follows, counting down, without
                  taking over the screen — the next set's numbers stay visible
                  and editable while it runs. */}
              {rest && rest.afterIndex === index && rest.left > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rest-panel"
                >
                  <div className="rest-panel-ring">
                    <RestRing left={rest.left} total={rest.total} size={92} />
                    <span className="eb-label mt-1.5">Rest</span>
                  </div>

                  <div className="rest-panel-side">
                    {/* The three lengths people actually use, one tap each.
                        Tapping one restarts the rest at that length rather
                        than adding to it, so a mis-tap is corrected by
                        tapping the right one. */}
                    <div className="rest-presets" role="group" aria-label="Rest length">
                      {[60, 90, 120].map((seconds) => (
                        <button
                          key={seconds}
                          onClick={() => {
                            soundFx.playClick();
                            onSetRest?.(seconds);
                          }}
                          data-active={rest.total === seconds ? 'true' : 'false'}
                          className="rest-preset"
                        >
                          {seconds}s
                        </button>
                      ))}
                    </div>

                    <button onClick={onSkipRest} className="rest-skip">
                      Skip rest
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {onAdd && rows.length < max && (
        <button onClick={onAdd} className="log-add">
          <Plus className="w-3.5 h-3.5 shrink-0" />
          Add set
        </button>
      )}
    </div>
  );
};
