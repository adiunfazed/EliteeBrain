import { BlockState } from '../types';

/**
 * How a routine block should read right now.
 *
 * Completion and timing are separate facts. Striking a block through because
 * its time passed says "you did this", which is a lie when you slept through
 * it — and it contradicts the adherence figure the app already records.
 *
 * So: strike-through always means completed. Timing shows as a third state.
 */
export type BlockDisplay = 'upcoming' | 'now' | 'missed' | 'done' | 'skipped';

function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function blockDisplay(
  state: BlockState,
  startTime?: string,
  endTime?: string,
  now: Date = new Date()
): BlockDisplay {
  // What the user recorded always wins over what the clock says.
  if (state === 'done' || state === 'partial') return 'done';
  if (state === 'skipped') return 'skipped';

  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  if (start === null) return 'upcoming';

  const current = now.getHours() * 60 + now.getMinutes();

  // An overnight block (sleep) ends before it starts on the clock.
  const overnight = end !== null && end < start;
  const withinNow = overnight
    ? current >= start || current < end
    : current >= start && (end === null || current < end);

  if (withinNow) return 'now';

  // Passed without being marked. Shown as missed rather than done, so the
  // display agrees with the adherence record.
  const past = overnight ? false : end !== null ? current >= end : current > start;
  return past ? 'missed' : 'upcoming';
}

/** Style for each state, so every screen renders them identically. */
export const BLOCK_DISPLAY_STYLE: Record<
  BlockDisplay,
  { strike: boolean; opacity: number; label: string | null; color: string | null }
> = {
  upcoming: { strike: false, opacity: 1, label: null, color: null },
  now: { strike: false, opacity: 1, label: 'Now', color: 'var(--signal)' },
  missed: { strike: false, opacity: 0.55, label: 'Missed', color: 'var(--warn)' },
  done: { strike: true, opacity: 0.6, label: null, color: 'var(--done)' },
  skipped: { strike: false, opacity: 0.45, label: 'Skipped', color: 'var(--ink-dim)' },
};
