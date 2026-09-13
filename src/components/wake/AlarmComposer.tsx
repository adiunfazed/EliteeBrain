import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Check } from 'lucide-react';
import { ComposerSheet } from '../ComposerSheet';
import { Alarm, CHALLENGES, ChallengeType, validateAlarm } from '../../lib/wakeChallenge';
import { Difficulty, DIFFICULTY_LABEL } from '../../lib/bodyTraining';
import { soundFx } from '../../utils/audio';

interface Props {
  open: boolean;
  alarm?: Alarm | null;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SOUNDS = [
  { id: 'chime', label: 'Chime' },
  { id: 'rise', label: 'Rise' },
  { id: 'pulse', label: 'Pulse' },
];

/**
 * Creating and editing an alarm.
 *
 * Time and challenge are the two decisions that matter, so they are visible
 * immediately; repeat, sound and difficulty follow underneath.
 */
export const AlarmComposer: React.FC<Props> = ({ open, alarm, onClose, onSave }) => {
  const [time, setTime] = useState(alarm?.time || '07:00');
  const [label, setLabel] = useState(alarm?.label || '');
  const [weekdays, setWeekdays] = useState<number[]>(alarm?.weekdays || [1, 2, 3, 4, 5]);
  const [challenge, setChallenge] = useState<ChallengeType>(alarm?.challenge || 'squats');
  const [difficulty, setDifficulty] = useState<Difficulty>(alarm?.difficulty || 'easy');
  const [sound, setSound] = useState(alarm?.sound || 'chime');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const next: Alarm = {
      id: alarm?.id || `al_${Date.now()}`,
      time,
      label: label.trim() || 'Wake up',
      weekdays,
      enabled: alarm?.enabled ?? true,
      challenge,
      difficulty,
      sound,
      createdAt: alarm?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const problem = validateAlarm(next);
    if (problem) {
      setError(problem);
      return;
    }

    soundFx.playClick();
    onSave(next);
    onClose();
  };

  return (
    <ComposerSheet open={open} onClose={onClose} title={alarm ? 'Edit alarm' : 'New alarm'}>
      <p className="eb-label mb-2">Time</p>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full rounded-xl px-3 py-3 text-[20px] tabular-nums text-[var(--ink)] outline-none"
        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
      />

      <p className="eb-label mt-5 mb-2">Challenge</p>
      <div className="space-y-1.5">
        {CHALLENGES.map((c) => {
          const Icon = (Icons as any)[c.icon] || Icons.Dumbbell;
          const active = challenge === c.id;

          return (
            <button
              key={c.id}
              onClick={() => setChallenge(c.id)}
              className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklab, var(--signal) 14%, var(--surface))'
                  : 'var(--surface)',
                border: `1px solid ${
                  active ? 'color-mix(in oklab, var(--signal) 50%, var(--rule))' : 'var(--rule)'
                }`,
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? 'var(--signal-ink)' : 'var(--ink-dim)' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{c.name}</span>
                <span className="t-meta block mt-0.5 truncate">{c.blurb}</span>
              </span>
              <span className="t-meta shrink-0">
                {c.targets[difficulty]} {c.unit}
              </span>
              {active && (
                <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--signal-ink)' }} />
              )}
            </button>
          );
        })}
      </div>

      <p className="eb-label mt-5 mb-2">Difficulty</p>
      <div className="flex items-center gap-2">
        {(['easy', 'moderate', 'hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className="chip"
            data-active={difficulty === d}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      <p className="eb-label mt-5 mb-2">Repeat</p>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => {
          const on = weekdays.includes(i);
          return (
            <button
              key={i}
              onClick={() =>
                setWeekdays((prev) =>
                  prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()
                )
              }
              className="dot-toggle"
              data-active={on}
              aria-label={`Day ${i}`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <p className="t-meta mt-2">
        {weekdays.length === 0 ? 'Every day' : `${weekdays.length} days a week`}
      </p>

      <p className="eb-label mt-5 mb-2">Sound</p>
      <div className="flex items-center gap-2 flex-wrap">
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSound(s.id)}
            className="chip"
            data-active={sound === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="eb-label mt-5 mb-2">Name</p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Wake up"
        maxLength={40}
        className="w-full rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none"
        style={{ background: 'var(--surface-sunk)', border: '1px solid var(--rule)' }}
      />

      {error && <p className="t-meta eb-warn mt-3">{error}</p>}

      <div className="flex items-center gap-2.5 mt-6">
        <button onClick={onClose} className="btn-quiet flex-1">
          Cancel
        </button>
        <button onClick={submit} className="btn-lg flex-1">
          {alarm ? 'Save changes' : 'Create alarm'}
        </button>
      </div>
    </ComposerSheet>
  );
};
