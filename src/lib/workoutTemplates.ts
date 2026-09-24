import { EXERCISES, Exercise, exerciseById } from './bodyTraining';

/**
 * Custom workouts.
 *
 * A template is a named list of exercises, each with its own sets, target and
 * rest. Every number is independent: three sets of eight on one exercise and
 * five sets of twelve on the next is the normal case in a gym, and a single
 * shared "difficulty" could never express it.
 *
 * Exercises come from two places. The built-in ones are the six the camera and
 * the rep engine understand. Anything else the user types is a custom
 * exercise, counted by hand — the camera is never pointed at a movement it was
 * not built to judge, because a wrong rep count is worse than no rep count.
 *
 * Custom exercise ids are derived from the name rather than generated at
 * random, so "Bench press" added to three different templates is one exercise
 * with one personal best, not three. The consequence is deliberate: renaming
 * an exercise starts a new record rather than moving the old one, since the
 * app has no way to know whether a rename means "same lift, better name" or
 * "different lift entirely".
 */

export const CUSTOM_PREFIX = 'custom_';

/** Limits. Generous enough for real training, tight enough to stay sane. */
export const TEMPLATE_LIMITS = {
  nameMax: 40,
  items: 24,
  sets: { min: 1, max: 12 },
  reps: { min: 1, max: 200 },
  hold: { min: 5, max: 900 },
  rest: { min: 0, max: 600 },
  /** Kilograms. 500 is past every world record; the cap is for typos. */
  weight: { min: 0, max: 500, step: 2.5 },
  templates: 40,
} as const;

export type ExerciseMetric = 'reps' | 'hold';

/**
 * One planned set: a weight and a number of reps.
 *
 * Per set rather than per exercise, because that is how people actually
 * train — 60×10, 60×10, 70×8 is one exercise with three different sets, and
 * a single "reps" figure for the whole exercise cannot say it. Weight is in
 * kilograms, and zero means bodyweight, which is a real answer rather than
 * missing data.
 *
 * For a hold, `reps` is seconds.
 */
export interface PlannedSet {
  weight: number;
  reps: number;
}

/** One exercise inside a template, with its own numbers. */
export interface TemplateItem {
  /** A built-in exercise id, or `custom_<slug>`. */
  exerciseId: string;
  /** Carried on the item so a custom exercise reads correctly everywhere. */
  name: string;
  metric: ExerciseMetric;
  /** The sets to do, in order. Never empty. */
  plan: PlannedSet[];
  restSeconds: number;
  /**
   * Mirrors of the plan, kept in sync on every write.
   *
   * Older builds of the app — and the workout history, which has always
   * stored a session as sets-and-target — read these. They are derived,
   * never authoritative: `sets` is the number of planned sets and `target`
   * the heaviest demand in reps, so an old client still shows something
   * true rather than something invented.
   */
  sets: number;
  target: number;
}

/** users/{uid}/workoutTemplates/{id} */
export interface WorkoutTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
  createdAt: string;
  updatedAt: string;
  /** Set when a session built from this template finishes. */
  lastUsedAt?: string;
  /** Finished sessions started from this template. */
  uses?: number;
}

/* ------------------------------------------------------------------ */
/* Ids                                                                 */
/* ------------------------------------------------------------------ */

/** A small stable hash, for names that survive slugging as nothing at all. */
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * The id for a user-named exercise.
 *
 * Case and spacing are ignored, so "Bench Press" and "bench press" are the
 * same exercise and share one personal best. A name made entirely of
 * characters that cannot appear in an id (emoji, punctuation, another script)
 * falls back to a hash of the name itself rather than colliding with every
 * other such name.
 */
export function customExerciseId(name: string): string {
  const slug = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

  return `${CUSTOM_PREFIX}${slug || `x${hash(String(name || '').trim().toLowerCase())}`}`;
}

export function isCustomExercise(exerciseId: string): boolean {
  return typeof exerciseId === 'string' && exerciseId.startsWith(CUSTOM_PREFIX);
}

/** "  Bench   press " → "Bench press". Never longer than the limit. */
export function cleanName(name: string, max = TEMPLATE_LIMITS.nameMax): string {
  return String(name || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * A weight, rounded to the nearest half kilo.
 *
 * Half a kilo is the smallest plate change worth recording, and rounding on
 * the way in means the stored number is never 62.50000000000001 after a few
 * taps of a stepper.
 */
export function clampWeight(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(TEMPLATE_LIMITS.weight.max, Math.round(n * 2) / 2);
}

/** The allowed range for a target, which differs for holds and reps. */
export function targetRange(metric: ExerciseMetric): { min: number; max: number; step: number } {
  return metric === 'hold'
    ? { ...TEMPLATE_LIMITS.hold, step: 5 }
    : { ...TEMPLATE_LIMITS.reps, step: 1 };
}

/* ------------------------------------------------------------------ */
/* Building items                                                      */
/* ------------------------------------------------------------------ */

/** A template row for one of the built-in exercises. */
export function itemFromExercise(exercise: Exercise, over: Partial<TemplateItem> = {}): TemplateItem {
  return normaliseItem({
    exerciseId: exercise.id,
    name: exercise.name,
    metric: exercise.metric,
    sets: 3,
    target: exercise.targets.easy,
    restSeconds: exercise.restSeconds,
    ...over,
  });
}

/** A template row for an exercise the user typed in. */
export function itemFromCustom(
  name: string,
  metric: ExerciseMetric = 'reps',
  over: Partial<TemplateItem> = {}
): TemplateItem {
  const clean = cleanName(name);
  return normaliseItem({
    exerciseId: customExerciseId(clean),
    name: clean,
    metric,
    sets: 3,
    target: metric === 'hold' ? 30 : 10,
    restSeconds: 60,
    ...over,
  });
}

/** One planned set, forced into range. */
export function normaliseSet(set: Partial<PlannedSet>, metric: ExerciseMetric): PlannedSet {
  const range = targetRange(metric);
  return {
    weight: clampWeight(set?.weight),
    reps: clampInt(set?.reps, range.min, range.max, metric === 'hold' ? 30 : 10),
  };
}

/**
 * Force one row into range.
 *
 * Applied on the way in and on the way out, so a template edited on an older
 * build, hand-edited in the database, or half-written by a failed save can
 * never produce a set count of 4000 or a negative rest.
 */
export function normaliseItem(item: Partial<TemplateItem>): TemplateItem {
  const metric: ExerciseMetric = item?.metric === 'hold' ? 'hold' : 'reps';
  const range = targetRange(metric);
  const preset = exerciseById(String(item?.exerciseId || ''));
  const name = cleanName(item?.name || preset?.name || '') || 'Exercise';

  const sets = clampInt(item?.sets, TEMPLATE_LIMITS.sets.min, TEMPLATE_LIMITS.sets.max, 3);
  const target = clampInt(item?.target, range.min, range.max, metric === 'hold' ? 30 : 10);

  // A workout written by an older build has no per-set plan, only a set count
  // and one target. It is expanded into identical sets rather than rejected,
  // so nobody's saved workout stops opening.
  const rows = Array.isArray(item?.plan) && item.plan.length > 0
    ? item.plan
    : Array.from({ length: sets }, () => ({ weight: 0, reps: target }));

  const plan = rows
    .filter((r) => r && typeof r === 'object')
    .slice(0, TEMPLATE_LIMITS.sets.max)
    .map((r) => normaliseSet(r, metric));

  const safePlan = plan.length > 0 ? plan : [normaliseSet({ reps: target }, metric)];

  return {
    exerciseId: String(item?.exerciseId || customExerciseId(name)),
    name,
    metric,
    plan: safePlan,
    restSeconds: clampInt(
      item?.restSeconds,
      TEMPLATE_LIMITS.rest.min,
      TEMPLATE_LIMITS.rest.max,
      60
    ),
    // Derived, so the two can never disagree about how many sets there are.
    sets: safePlan.length,
    target: safePlan.reduce((n, r) => Math.max(n, r.reps), 0) || target,
  };
}

/** A template as it should be stored: cleaned, clamped and never empty. */
export function normaliseTemplate(template: Partial<WorkoutTemplate>): WorkoutTemplate {
  const now = new Date().toISOString();
  const items = (Array.isArray(template?.items) ? template.items : [])
    .filter((i) => i && typeof i === 'object')
    .slice(0, TEMPLATE_LIMITS.items)
    .map(normaliseItem);

  return {
    id: String(template?.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    name: cleanName(template?.name || '') || 'Untitled workout',
    items,
    createdAt: template?.createdAt || now,
    updatedAt: now,
    ...(template?.lastUsedAt ? { lastUsedAt: template.lastUsedAt } : {}),
    ...(Number.isFinite(Number(template?.uses)) && Number(template?.uses) > 0
      ? { uses: Math.min(100000, Math.floor(Number(template?.uses))) }
      : {}),
  };
}

/** What stops a template being saved, in words the user can act on. */
export function templateProblem(template: Partial<WorkoutTemplate>): string | null {
  if (!cleanName(template?.name || '')) return 'Give the workout a name.';
  if (!Array.isArray(template?.items) || template.items.length === 0) {
    return 'Add at least one exercise.';
  }
  if (template.items.length > TEMPLATE_LIMITS.items) {
    return `That is more than ${TEMPLATE_LIMITS.items} exercises.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Reading a template                                                  */
/* ------------------------------------------------------------------ */

export interface TemplateSummary {
  exercises: number;
  sets: number;
  /** Total reps planned. Holds are excluded — seconds are not reps. */
  reps: number;
  /** Total seconds planned in holds. */
  holdSeconds: number;
  /** Kilograms moved: the sum of weight × reps across every weighted set. */
  volume: number;
  /** Rough minutes, from work and rest. Honest about being an estimate. */
  minutes: number;
}

/**
 * What a template adds up to.
 *
 * The minute figure assumes about three seconds a rep and counts the rest
 * between sets, but not the rest after the final set of the workout — nobody
 * stands in the gym resting after they have finished.
 */
export function summariseTemplate(items: TemplateItem[]): TemplateSummary {
  let sets = 0;
  let reps = 0;
  let holdSeconds = 0;
  let volume = 0;
  let workSeconds = 0;
  let restSeconds = 0;

  const rows = items || [];
  rows.forEach((item, index) => {
    const row = normaliseItem(item);
    sets += row.plan.length;

    for (const set of row.plan) {
      if (row.metric === 'hold') {
        holdSeconds += set.reps;
        workSeconds += set.reps;
      } else {
        reps += set.reps;
        workSeconds += set.reps * 3;
        volume += set.weight * set.reps;
      }
    }

    const lastRow = index === rows.length - 1;
    const restCount = lastRow ? Math.max(0, row.plan.length - 1) : row.plan.length;
    restSeconds += restCount * row.restSeconds;
  });

  return {
    exercises: rows.length,
    sets,
    reps,
    holdSeconds,
    volume: Math.round(volume),
    minutes: Math.max(1, Math.round((workSeconds + restSeconds) / 60)),
  };
}

/** "62.5 kg" — a half plate shows its half, a whole number does not. */
export function kg(weight: number): string {
  const n = clampWeight(weight);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
}

/**
 * The shape of one exercise in a line.
 *
 * Identical sets collapse to "3 × 10 · 60 kg", which is how it would be
 * written on paper. A pyramid keeps its own numbers — "10 · 8 · 6" — because
 * flattening it to an average would describe a session nobody did.
 */
export function itemLine(item: TemplateItem): string {
  const row = normaliseItem(item);
  const unit = row.metric === 'hold' ? 's' : '';
  const reps = row.plan.map((s) => s.reps);
  const weights = row.plan.map((s) => s.weight);

  const sameReps = reps.every((r) => r === reps[0]);
  const sameWeight = weights.every((w) => w === weights[0]);

  const repPart = sameReps
    ? `${row.plan.length} × ${reps[0]}${unit}`
    : reps.map((r) => `${r}${unit}`).join(' · ');

  if (weights.every((w) => w === 0)) return repPart;

  const lo = Math.min(...weights);
  const hi = Math.max(...weights);
  const weightPart = sameWeight ? kg(hi) : `${lo}–${kg(hi)}`;

  return `${repPart} · ${weightPart}`;
}

/* ------------------------------------------------------------------ */
/* Exercises the user has invented                                     */
/* ------------------------------------------------------------------ */

export interface KnownExercise {
  id: string;
  name: string;
  metric: ExerciseMetric;
  custom: boolean;
  /** Where the built-in ones carry guidance, it is kept. */
  cue?: string;
  restSeconds: number;
  /** The camera can only judge the movements the rep engine knows. */
  tracked: boolean;
}

const TRACKED = new Set(['pushups', 'squats', 'lunges', 'glute-bridge', 'calf-raises']);

/**
 * The gym catalogue.
 *
 * Common lifts, so building a push day does not mean typing "Bench press"
 * from scratch every time. They are ordinary custom exercises — the ids come
 * from the same name-derived rule — so a lift picked from this list and the
 * same lift typed by hand are one exercise with one personal best, and
 * nothing here is treated as camera-countable.
 *
 * Deliberately not exhaustive. It covers what most people actually put in a
 * session; anything missing is one typed name away.
 */
const CATALOGUE: { name: string; metric?: ExerciseMetric; rest?: number }[] = [
  // Chest
  { name: 'Bench press', rest: 120 },
  { name: 'Incline bench press', rest: 120 },
  { name: 'Dumbbell press', rest: 90 },
  { name: 'Dumbbell fly', rest: 60 },
  { name: 'Cable crossover', rest: 60 },
  { name: 'Chest dip', rest: 90 },
  // Back
  { name: 'Deadlift', rest: 180 },
  { name: 'Barbell row', rest: 120 },
  { name: 'Dumbbell row', rest: 90 },
  { name: 'Lat pulldown', rest: 90 },
  { name: 'Seated cable row', rest: 90 },
  { name: 'Pull-up', rest: 120 },
  { name: 'Chin-up', rest: 120 },
  { name: 'Face pull', rest: 60 },
  { name: 'Shrug', rest: 60 },
  // Legs
  { name: 'Back squat', rest: 180 },
  { name: 'Front squat', rest: 150 },
  { name: 'Romanian deadlift', rest: 120 },
  { name: 'Leg press', rest: 120 },
  { name: 'Leg extension', rest: 60 },
  { name: 'Leg curl', rest: 60 },
  { name: 'Hip thrust', rest: 90 },
  { name: 'Bulgarian split squat', rest: 90 },
  { name: 'Standing calf raise', rest: 45 },
  // Shoulders and arms
  { name: 'Overhead press', rest: 120 },
  { name: 'Arnold press', rest: 90 },
  { name: 'Lateral raise', rest: 45 },
  { name: 'Rear delt fly', rest: 45 },
  { name: 'Barbell curl', rest: 60 },
  { name: 'Dumbbell curl', rest: 60 },
  { name: 'Hammer curl', rest: 60 },
  { name: 'Preacher curl', rest: 60 },
  { name: 'Triceps pushdown', rest: 60 },
  { name: 'Skull crusher', rest: 60 },
  { name: 'Close-grip bench press', rest: 90 },
  { name: 'Triceps dip', rest: 90 },
  // Core and carries
  { name: 'Hanging leg raise', rest: 60 },
  { name: 'Cable crunch', rest: 45 },
  { name: 'Russian twist', rest: 45 },
  { name: 'Ab wheel rollout', rest: 60 },
  { name: 'Side plank', metric: 'hold', rest: 45 },
  { name: 'Farmer carry', metric: 'hold', rest: 90 },
  { name: 'Dead hang', metric: 'hold', rest: 60 },
  // Conditioning
  { name: 'Burpee', rest: 60 },
  { name: 'Mountain climber', rest: 45 },
  { name: 'Jump rope', metric: 'hold', rest: 60 },
  { name: 'Kettlebell swing', rest: 60 },
  { name: 'Box jump', rest: 90 },
  { name: 'Battle ropes', metric: 'hold', rest: 60 },
];

/**
 * Common lifts, ready to add.
 *
 * Built once per call from the same id rule as a typed name, so picking
 * "Bench press" here and typing it by hand are indistinguishable afterwards.
 */
export function catalogueExercises(): KnownExercise[] {
  return CATALOGUE.map((row) => ({
    id: customExerciseId(row.name),
    name: row.name,
    metric: row.metric || 'reps',
    custom: true,
    restSeconds: row.rest ?? 60,
    tracked: false,
  }));
}

export function presetExercises(): KnownExercise[] {
  return EXERCISES.map((e) => ({
    id: e.id,
    name: e.name,
    metric: e.metric,
    custom: false,
    cue: e.cue,
    restSeconds: e.restSeconds,
    tracked: TRACKED.has(e.id),
  }));
}

/**
 * Every custom exercise the account has ever put in a template.
 *
 * So that adding "Bench press" to a second workout is picking it from a list
 * rather than typing it again and risking a second, slightly different id.
 * Sorted by name, because this list is scanned rather than ranked.
 */
export function customExercisesFrom(templates: WorkoutTemplate[]): KnownExercise[] {
  const seen = new Map<string, KnownExercise>();

  for (const template of templates || []) {
    for (const raw of template?.items || []) {
      const item = normaliseItem(raw);
      if (!isCustomExercise(item.exerciseId) || seen.has(item.exerciseId)) continue;
      seen.set(item.exerciseId, {
        id: item.exerciseId,
        name: item.name,
        metric: item.metric,
        custom: true,
        restSeconds: item.restSeconds,
        tracked: false,
      });
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The display name for an exercise id, wherever it came from.
 *
 * Templates are consulted first because they hold the name the user typed;
 * sessions second, because a template can be deleted while its history
 * remains. A slug is only prettified as a last resort, and never invented —
 * an id with no name anywhere still reads as the words the user typed, since
 * that is what the slug was made from.
 */
export function exerciseNameFor(
  exerciseId: string,
  sources: { templates?: WorkoutTemplate[]; names?: Record<string, string> } = {}
): string {
  const preset = exerciseById(exerciseId);
  if (preset) return preset.name;

  const fromNames = sources.names?.[exerciseId];
  if (fromNames) return fromNames;

  for (const template of sources.templates || []) {
    for (const item of template?.items || []) {
      if (item?.exerciseId === exerciseId && item?.name) return item.name;
    }
  }

  if (!isCustomExercise(exerciseId)) return exerciseId || 'Exercise';

  const slug = exerciseId.slice(CUSTOM_PREFIX.length).replace(/[-_]+/g, ' ').trim();
  if (!slug) return 'Exercise';
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** The metric an id implies, so history can label a number correctly. */
export function metricFor(
  exerciseId: string,
  sources: { templates?: WorkoutTemplate[]; metrics?: Record<string, ExerciseMetric> } = {}
): ExerciseMetric {
  const preset = exerciseById(exerciseId);
  if (preset) return preset.metric;

  const known = sources.metrics?.[exerciseId];
  if (known === 'hold' || known === 'reps') return known;

  for (const template of sources.templates || []) {
    for (const item of template?.items || []) {
      if (item?.exerciseId === exerciseId && item?.metric === 'hold') return 'hold';
      if (item?.exerciseId === exerciseId && item?.metric === 'reps') return 'reps';
    }
  }

  return 'reps';
}

/** A starting template for someone who has never built one. */
export function starterTemplate(): WorkoutTemplate {
  const picks = ['pushups', 'squats', 'glute-bridge', 'plank'];
  return normaliseTemplate({
    name: 'Full body starter',
    items: picks
      .map((id) => exerciseById(id))
      .filter(Boolean)
      .map((e) => itemFromExercise(e as Exercise)),
  });
}
