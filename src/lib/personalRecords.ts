import type { WorkoutSession } from './bodyTraining';

/**
 * Personal records.
 *
 * One module, so the runner, the library, the history panel and the
 * celebration all answer "what is my best?" the same way. The previous
 * arrangement worked it out in three separate places from three slightly
 * different inputs, which is why a record could be celebrated and then not
 * appear, or appear and never be celebrated.
 *
 * A record is stored in two forms, deliberately:
 *
 *   1. Its own small document, written the instant the set ends. This is what
 *      makes a record survive — if the workout document fails to save, the
 *      record still exists.
 *   2. Implied by the sessions themselves. This is what makes a record
 *      correct — it is recomputed from what actually happened, so a stored
 *      value can never drift above the work that earned it.
 *
 * Reads take the higher of the two, so neither form can lose data the other
 * holds.
 */

/** users/{uid}/records/{exerciseId} */
export interface PersonalRecord {
  /** Doubles as the document id. */
  exerciseId: string;
  /** Reps for a rep exercise, seconds for a hold. */
  value: number;
  /** When it was set. */
  achievedAt: string;
  /** The session it came from, where one is known. */
  sessionId?: string;
}

export type RecordMap = Record<string, PersonalRecord>;

/** A finite positive integer, or null for anything else. */
function cleanValue(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * The best single set per exercise, implied by the sessions themselves.
 *
 * Per set rather than per session: a long easy session should never outrank a
 * genuinely harder one.
 *
 * Sessions saved before per-set results existed fall back to the planned
 * target, which is what those sessions were completed against — a set only
 * counted at all if it met its target, so the target is a true floor and
 * never an inflation.
 */
export function recordsFromSessions(sessions: WorkoutSession[]): RecordMap {
  const out: RecordMap = {};

  for (const s of sessions || []) {
    for (const item of s.items || []) {
      const id = item?.exerciseId;
      if (!id) continue;

      const achieved = s.results?.[id];
      const values =
        Array.isArray(achieved) && achieved.length > 0 ? achieved : [item.target];

      for (const raw of values) {
        const value = cleanValue(raw);
        if (value === null) continue;

        const held = out[id];
        if (!held || value > held.value) {
          out[id] = {
            exerciseId: id,
            value,
            achievedAt: s.finishedAt || s.startedAt || `${s.date}T00:00:00.000Z`,
            sessionId: s.id,
          };
        }
      }
    }
  }

  return out;
}

/**
 * Combine stored records with the ones the sessions imply.
 *
 * The larger value wins. A stored record that no session supports is still
 * kept: the set happened, and the only thing that failed was a write.
 */
export function mergeRecords(stored: RecordMap, derived: RecordMap): RecordMap {
  const out: RecordMap = {};

  for (const id of new Set([...Object.keys(stored || {}), ...Object.keys(derived || {})])) {
    const a = stored?.[id];
    const b = derived?.[id];

    const aValue = cleanValue(a?.value);
    const bValue = cleanValue(b?.value);

    if (aValue === null && bValue === null) continue;
    if (aValue === null) out[id] = { ...(b as PersonalRecord), value: bValue as number };
    else if (bValue === null) out[id] = { ...(a as PersonalRecord), value: aValue };
    else out[id] = aValue >= bValue ? { ...(a as PersonalRecord), value: aValue } : { ...(b as PersonalRecord), value: bValue };
  }

  return out;
}

/** Just the numbers, for the places that only need "what is my best?". */
export function recordValues(records: RecordMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, r] of Object.entries(records || {})) {
    const v = cleanValue(r?.value);
    if (v !== null) out[id] = v;
  }
  return out;
}

/**
 * Whether `value` beats the record held for `exerciseId`.
 *
 * Strictly greater: matching your best is not a new best. Equalling it
 * repeatedly is the easiest thing in training to do by accident, and
 * celebrating it would make the celebration worthless.
 */
export function beatsRecord(
  records: Record<string, number>,
  exerciseId: string,
  value: number
): boolean {
  const clean = cleanValue(value);
  if (clean === null) return false;
  return clean > (records[exerciseId] || 0);
}

/**
 * The target to offer when an exercise is opened.
 *
 * One past the record, because the target is also the ceiling for a set — so
 * defaulting to the record exactly would make a personal best unreachable
 * without editing the number every single time. Never below the floor, which
 * is what a first-timer gets.
 */
export function suggestedTarget(
  records: Record<string, number>,
  exerciseId: string,
  floor: number
): number {
  const best = records[exerciseId] || 0;
  return Math.max(best > 0 ? best + 1 : 0, floor);
}
