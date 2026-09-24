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
 * Two bests are kept per exercise, not one:
 *
 *   1. The best bodyweight set, in reps (or seconds for a hold). This is what
 *      "24 push-ups" means.
 *   2. The best weighted set, ranked by estimated one-rep max.
 *
 * They are kept apart deliberately. Twenty bodyweight reps and 100 kg for one
 * are both records, and neither is an improvement on the other — collapsing
 * them into a single number would mean a light warm-up set could wipe out a
 * bodyweight best, or a heavy single could never be beaten by anything.
 *
 * A record is stored in two forms, also deliberately:
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
  /** Best bodyweight set: reps, or seconds for a hold. 0 if never done. */
  value: number;
  /** When the bodyweight best was set. */
  achievedAt: string;
  /** The session it came from, where one is known. */
  sessionId?: string;
  /**
   * The exercise's name and unit, stored with the record.
   *
   * A user-named exercise has no entry in the built-in list, so without this
   * a record would outlive the template that named it and become a slug. The
   * record carries its own label instead.
   */
  name?: string;
  metric?: 'reps' | 'hold';

  /** The best weighted set: the load, its reps, and what they imply. */
  weight?: number;
  weightReps?: number;
  /** Estimated one-rep max for that set. The ranking number for weights. */
  e1rm?: number;
  weightAt?: string;
}

export type RecordMap = Record<string, PersonalRecord>;

/** One set as it was actually performed. */
export interface PerformedSet {
  /** Kilograms. 0 means bodyweight, which is a real answer. */
  weight: number;
  /** Reps, or seconds for a hold. */
  reps: number;
}

/** A finite positive integer, or null for anything else. */
function cleanValue(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** A finite non-negative weight to the half kilo, or 0. */
function cleanWeight(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(500, Math.round(n * 2) / 2);
}

/**
 * Estimated one-rep max, by Epley: w × (1 + reps/30).
 *
 * A formula, not a measurement, and it is used for exactly one thing —
 * ranking two weighted sets against each other, so that 100 kg × 3 counts as
 * better than 100 kg × 1 and worse than 110 kg × 3. It is never presented to
 * the user as a lift they have done, because they have not done it.
 */
export function epley(weight: number, reps: number): number {
  const w = cleanWeight(weight);
  const r = cleanValue(reps) ?? 0;
  if (w <= 0 || r <= 0) return 0;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

/**
 * The best of two records, dimension by dimension.
 *
 * Merged rather than replaced, so a copy that only knows about the
 * bodyweight best cannot wipe out a weighted one, or the reverse.
 */
export function mergeRecord(a?: PersonalRecord, b?: PersonalRecord): PersonalRecord | undefined {
  if (!a) return b;
  if (!b) return a;

  const aValue = cleanValue(a.value) ?? 0;
  const bValue = cleanValue(b.value) ?? 0;
  const bodyweight = aValue >= bValue ? a : b;

  const aE1 = Number(a.e1rm) > 0 ? Number(a.e1rm) : 0;
  const bE1 = Number(b.e1rm) > 0 ? Number(b.e1rm) : 0;
  const weighted = aE1 >= bE1 ? a : b;

  const out: PersonalRecord = {
    exerciseId: a.exerciseId || b.exerciseId,
    value: Math.max(aValue, bValue),
    achievedAt: bodyweight.achievedAt || a.achievedAt || b.achievedAt || '',
    ...(bodyweight.sessionId ? { sessionId: bodyweight.sessionId } : {}),
    ...(a.name || b.name ? { name: a.name || b.name } : {}),
    ...(a.metric || b.metric ? { metric: a.metric || b.metric } : {}),
  };

  if (Math.max(aE1, bE1) > 0) {
    out.weight = cleanWeight(weighted.weight);
    out.weightReps = cleanValue(weighted.weightReps) ?? 0;
    out.e1rm = Math.max(aE1, bE1);
    if (weighted.weightAt) out.weightAt = weighted.weightAt;
  }

  return out;
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
 * never an inflation. Those sessions carry no weight, so they only ever
 * contribute to the bodyweight best.
 */
export function recordsFromSessions(sessions: WorkoutSession[]): RecordMap {
  const out: RecordMap = {};

  for (const s of sessions || []) {
    for (const item of s.items || []) {
      const id = item?.exerciseId;
      if (!id) continue;

      const at = s.finishedAt || s.startedAt || `${s.date}T00:00:00.000Z`;

      // The richest record of what happened, where it exists: weight and
      // reps, set by set. Older sessions have reps only, and older ones
      // still have nothing but the target they were completed against.
      const logged = s.sets?.[id];
      const repsOnly = s.results?.[id];

      const performed: PerformedSet[] =
        Array.isArray(logged) && logged.length > 0
          ? logged.map((row) => ({
              weight: cleanWeight(row?.weight),
              reps: cleanValue(row?.reps) ?? 0,
            }))
          : Array.isArray(repsOnly) && repsOnly.length > 0
            ? repsOnly.map((v) => ({ weight: 0, reps: cleanValue(v) ?? 0 }))
            : [{ weight: 0, reps: cleanValue(item.target) ?? 0 }];

      for (const set of performed) {
        if (set.reps <= 0) continue;

        const candidate: PersonalRecord = {
          exerciseId: id,
          value: set.weight > 0 ? 0 : set.reps,
          achievedAt: at,
          sessionId: s.id,
          ...(item.name ? { name: item.name } : {}),
          ...(item.metric ? { metric: item.metric } : {}),
          ...(set.weight > 0
            ? {
                weight: set.weight,
                weightReps: set.reps,
                e1rm: epley(set.weight, set.reps),
                weightAt: at,
              }
            : {}),
        };

        out[id] = mergeRecord(out[id], candidate) as PersonalRecord;
      }
    }
  }

  return out;
}

/**
 * Combine stored records with the ones the sessions imply.
 *
 * The larger value wins, dimension by dimension. A stored record that no
 * session supports is still kept: the set happened, and the only thing that
 * failed was a write.
 */
export function mergeRecords(stored: RecordMap, derived: RecordMap): RecordMap {
  const out: RecordMap = {};

  for (const id of new Set([...Object.keys(stored || {}), ...Object.keys(derived || {})])) {
    const merged = mergeRecord(stored?.[id], derived?.[id]);
    if (merged) out[id] = { ...merged, exerciseId: merged.exerciseId || id };
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Reading a record                                                    */
/* ------------------------------------------------------------------ */

/** A record in the form the interface asks questions of. */
export interface RecordView {
  /** Best bodyweight set, in reps or seconds. 0 when there is none. */
  reps: number;
  /** Best weighted set. All zero when nothing has been lifted. */
  weight: number;
  weightReps: number;
  e1rm: number;
}

export const EMPTY_VIEW: RecordView = { reps: 0, weight: 0, weightReps: 0, e1rm: 0 };

export function recordView(record?: PersonalRecord): RecordView {
  return {
    reps: cleanValue(record?.value) ?? 0,
    weight: cleanWeight(record?.weight),
    weightReps: cleanValue(record?.weightReps) ?? 0,
    e1rm: Number(record?.e1rm) > 0 ? Number(record?.e1rm) : 0,
  };
}

export type RecordViews = Record<string, RecordView>;

export function recordViews(records: RecordMap): RecordViews {
  const out: RecordViews = {};
  for (const [id, record] of Object.entries(records || {})) {
    const view = recordView(record);
    if (view.reps > 0 || view.e1rm > 0) out[id] = view;
  }
  return out;
}

/** Just the bodyweight numbers, for the places that only ask "how many?". */
export function recordValues(records: RecordMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, r] of Object.entries(records || {})) {
    const v = cleanValue(r?.value);
    if (v !== null) out[id] = v;
  }
  return out;
}

/**
 * "80 kg × 5" or "24 reps" — the best worth showing, in one short phrase.
 *
 * Where both exist the weighted set leads: someone who has started loading an
 * exercise is training the load, and the bodyweight figure is history.
 */
export function recordLabel(
  view: RecordView | undefined,
  metric: 'reps' | 'hold' = 'reps'
): string {
  if (!view) return '';
  if (view.e1rm > 0 && view.weight > 0) {
    const w = Number.isInteger(view.weight) ? view.weight : view.weight.toFixed(1);
    return `${w} kg × ${view.weightReps}${metric === 'hold' ? 's' : ''}`;
  }
  if (view.reps > 0) return metric === 'hold' ? `${view.reps}s` : `${view.reps} reps`;
  return '';
}

/* ------------------------------------------------------------------ */
/* Judging a set                                                       */
/* ------------------------------------------------------------------ */

export interface RecordBeat {
  /** Which best was beaten: the loaded one, or the bodyweight one. */
  kind: 'weight' | 'reps';
  /** What it was before, for "up from …". 0 when there was nothing. */
  previous: number;
  /**
   * The old best written out — "65 kg × 8", "24 reps" — or '' when this is
   * the first record for the exercise.
   *
   * Written here rather than reassembled by the caller, which only knows the
   * set that was just done and would otherwise pair the old weight with the
   * new reps, quietly describing a set nobody performed.
   */
  previousLabel: string;
  /** The record document this set produces, ready to store. */
  record: PersonalRecord;
}

/**
 * Whether a set beats what the exercise already holds.
 *
 * Strictly greater: matching your best is not a new best. Equalling it
 * repeatedly is the easiest thing in training to do by accident, and
 * celebrating it would make the celebration worthless.
 *
 * A weighted set is judged against the weighted best by estimated one-rep
 * max; a bodyweight set against the bodyweight best by reps. A set is never
 * judged against the other kind, so adding a dumbbell cannot erase a
 * bodyweight record and a deload cannot pretend to be one.
 */
export function judgeSet(
  records: RecordMap | undefined,
  exerciseId: string,
  set: PerformedSet,
  meta: { name?: string; metric?: 'reps' | 'hold'; at?: string; sessionId?: string } = {}
): RecordBeat | null {
  const reps = cleanValue(set?.reps);
  if (!exerciseId || reps === null) return null;

  const weight = cleanWeight(set?.weight);
  const held = recordView(records?.[exerciseId]);
  const at = meta.at || new Date().toISOString();

  const base: PersonalRecord = {
    exerciseId,
    value: 0,
    achievedAt: at,
    ...(meta.sessionId ? { sessionId: meta.sessionId } : {}),
    ...(meta.name ? { name: meta.name } : {}),
    ...(meta.metric ? { metric: meta.metric } : {}),
  };

  if (weight > 0) {
    const e1rm = epley(weight, reps);
    if (e1rm <= held.e1rm) return null;
    return {
      kind: 'weight',
      previous: held.weight,
      previousLabel:
        held.e1rm > 0
          ? recordLabel({ ...held, reps: 0 }, meta.metric === 'hold' ? 'hold' : 'reps')
          : '',
      record: { ...base, weight, weightReps: reps, e1rm, weightAt: at },
    };
  }

  if (reps <= held.reps) return null;
  return {
    kind: 'reps',
    previous: held.reps,
    previousLabel:
      held.reps > 0 ? recordLabel({ ...EMPTY_VIEW, reps: held.reps }, meta.metric || 'reps') : '',
    record: { ...base, value: reps },
  };
}

/**
 * Whether `value` beats the bodyweight record held for `exerciseId`.
 *
 * Kept for the places that deal only in reps — the quick-start screen and the
 * library chip — and defined by the same rule as everything else.
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
