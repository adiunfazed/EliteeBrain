import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { Check, Play, Volume2, Music, Upload, X } from 'lucide-react';
import {
  CustomSound,
  listCustomSounds,
  saveCustomSound,
  deleteCustomSound,
  startAlarmSound,
} from '../../lib/alarmSounds';
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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewRef = useRef<{ stop: () => void } | null>(null);

  const stopPreview = () => {
    previewRef.current?.stop();
    previewRef.current = null;
    setPreviewing(null);
  };

  /** Play five seconds, then stop on its own. */
  const preview = (id: string) => {
    previewRef.current?.stop();
    previewRef.current = soundFx.startAlarm(id);
    setPreviewing(id);

    window.setTimeout(() => {
      previewRef.current?.stop();
      previewRef.current = null;
      setPreviewing(null);
    }, 5000);
  };

  // A preview left running after the sheet closes would be alarming in the
  // literal sense.
  useEffect(() => () => previewRef.current?.stop(), []);

  /** Sounds the user has added on this device. */
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [uploading, setUploading] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);

  useEffect(() => {
    void listCustomSounds().then(setCustomSounds);
  }, []);

  const addCustom = async (file: File) => {
    setUploading(true);
    setSoundError(null);

    try {
      const meta = await saveCustomSound(file);
      setCustomSounds((prev) => [...prev, meta]);
      setSound(meta.id);
      void previewCustom(meta.id);
    } catch (err: any) {
      setSoundError(err?.message || 'Could not add that file.');
    } finally {
      setUploading(false);
    }
  };

  const removeCustom = async (id: string) => {
    await deleteCustomSound(id);
    setCustomSounds((prev) => prev.filter((c) => c.id !== id));
    // Falling back keeps the alarm audible rather than pointing at nothing.
    if (sound === id) setSound('chime');
  };

  const previewCustom = async (id: string) => {
    previewRef.current?.stop();
    const handle = await startAlarmSound(id, () => soundFx.startAlarm('chime'));
    previewRef.current = handle;
    setPreviewing(id);
    window.setTimeout(() => stopPreview(), 5000);
  };

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
        {SOUNDS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => {
              setSound(entry.id);
              if (previewing === entry.id) {
                stopPreview();
              } else {
                preview(entry.id);
              }
            }}
            className="chip flex items-center gap-1.5"
            data-active={sound === entry.id}
          >
            {previewing === entry.id ? (
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Play className="w-3 h-3 shrink-0" />
            )}
            {entry.label}
          </button>
        ))}
      </div>

      {/* Custom sounds, stored on this device. */}
      {customSounds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {customSounds.map((c) => (
            <span key={c.id} className="flex items-center">
              <button
                onClick={() => {
                  setSound(c.id);
                  if (previewing === c.id) stopPreview();
                  else void previewCustom(c.id);
                }}
                className="chip flex items-center gap-1.5"
                data-active={sound === c.id}
              >
                {previewing === c.id ? (
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Music className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate max-w-[110px]">{c.name}</span>
              </button>

              <button
                onClick={() => void removeCustom(c.id)}
                aria-label={`Delete ${c.name}`}
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{ color: 'var(--ink-dim)' }}
              >
                <X className="w-3.5 h-3.5 shrink-0" />
              </button>
            </span>
          ))}
        </div>
      )}

      <label className="btn-text mt-2 inline-flex items-center gap-1.5 cursor-pointer">
        <Upload className="w-3.5 h-3.5 shrink-0" />
        {uploading ? 'Adding…' : 'Add your own sound'}
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so the same file can be chosen again after a failure.
            e.target.value = '';
            if (file) void addCustom(file);
          }}
        />
      </label>

      {soundError && <p className="t-meta eb-warn mt-2">{soundError}</p>}

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
