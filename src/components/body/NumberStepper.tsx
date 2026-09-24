import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface Props {
  label: string;
  value: number;
  /** Shown after the number: "s", "reps", or nothing. */
  unit?: string;
  min: number;
  max: number;
  step?: number;
  /** A quieter, tighter variant for use inside a list row. */
  compact?: boolean;
  onChange: (value: number) => void;
}

/**
 * A stepper whose number is itself an input.
 *
 * The buttons stay for a quick nudge, but going from 10 to 30 should not cost
 * twenty taps — tapping the number opens the numeric keypad and the exact
 * figure can be typed. The field commits on blur or Enter, so a half-typed "3"
 * on the way to "30" is never clamped up to the minimum under the user's
 * finger.
 *
 * One component, used by the quick-start screen and the workout builder alike,
 * so a set count behaves identically wherever it is edited.
 */
export const NumberStepper: React.FC<Props> = ({
  label,
  value,
  unit = '',
  min,
  max,
  step = 1,
  compact = false,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // While the field is closed it simply mirrors the value, so the buttons and
  // the typed number can never disagree.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const open = () => {
    setDraft(String(value));
    setEditing(true);
    // Selected on open: the common case is replacing the number, not
    // appending to it.
    window.setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    setEditing(false);

    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10);
    // Anything that is not a sensible number leaves the value alone rather
    // than silently becoming zero.
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = Math.max(min, Math.min(max, parsed));
    setDraft(String(next));
    if (next !== value) {
      soundFx.playClick();
      onChange(next);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className={compact ? 'eb-label min-w-0 flex-1' : 't-sub min-w-0 flex-1'}>{label}</span>

      <div className="flex items-center gap-1.5 shrink-0" data-compact={compact ? 'true' : 'false'}>
        <button
          onClick={() => {
            soundFx.playClick();
            onChange(Math.max(min, value - step));
          }}
          disabled={value <= min}
          aria-label={`Less ${label}`}
          className={compact ? 'step-btn step-btn-sm' : 'step-btn'}
        >
          <Minus className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            // Numeric keypad on mobile, without the spinner arrows a number
            // input drags in on desktop.
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                inputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setDraft(String(value));
                setEditing(false);
              }
            }}
            aria-label={`${label}, type a number`}
            autoFocus
            className={compact ? 'step-field step-field-sm' : 'step-field'}
          />
        ) : (
          <button
            onClick={open}
            aria-label={`${label}: ${value}${unit}. Tap to type a number.`}
            className={compact ? 'step-value step-value-sm' : 'step-value'}
          >
            <span className="t-figure tabular-nums" style={{ fontSize: compact ? 15 : 18 }}>
              {value}
            </span>
            {unit && <span className="t-meta ml-0.5">{unit}</span>}
          </button>
        )}

        <button
          onClick={() => {
            soundFx.playClick();
            onChange(Math.min(max, value + step));
          }}
          disabled={value >= max}
          aria-label={`More ${label}`}
          className={compact ? 'step-btn step-btn-sm' : 'step-btn'}
        >
          <Plus className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
        </button>
      </div>
    </div>
  );
};
