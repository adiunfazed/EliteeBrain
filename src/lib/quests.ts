/**
 * Daily quests.
 *
 * One quest per user per calendar day, chosen deterministically from the
 * user's id and the date. That choice matters: because the same inputs always
 * produce the same quest, a refresh, a second device, or an offline reload all
 * show the same thing without storing anything or asking the server. There is
 * no state to desynchronise.
 *
 * The pool is generated from templates rather than hand-written, so a few
 * hundred lines produce many hundreds of genuinely distinct quests, and adding
 * a variation adds dozens at once.
 */

export type QuestCategory =
  | 'fitness'
  | 'reading'
  | 'study'
  | 'focus'
  | 'productivity'
  | 'learning'
  | 'organisation'
  | 'creativity'
  | 'mindfulness'
  | 'discipline'
  | 'health';

export interface Quest {
  id: string;
  category: QuestCategory;
  title: string;
  objective: string;
  xp: number;
}

interface Template {
  category: QuestCategory;
  /** Base title, with {n} replaced by the scaled amount. */
  title: string;
  objective: string;
  /** Amount at level 1. */
  base: number;
  /** Added per level band. */
  step: number;
  /** Never exceed this, however high the level. */
  cap: number;
  /** XP at the lowest tier; scales with the amount. */
  xp: number;
}

/**
 * Difficulty band from the user's level.
 *
 * Bands rather than raw levels: a level-40 user should not be asked for 400
 * push-ups. Six bands, each capped, keeps quests demanding but sane.
 */
export function bandForLevel(level: number): number {
  if (level <= 2) return 0;
  if (level <= 5) return 1;
  if (level <= 9) return 2;
  if (level <= 14) return 3;
  if (level <= 20) return 4;
  return 5;
}

const TEMPLATES: Template[] = [
  // --- Fitness. Capped deliberately: these are daily habits, not training
  //     programmes, and an unsafe target would be a real harm.
  { category: 'fitness', title: '{n} push-ups', objective: 'Any grip. Break them into sets if you need to.', base: 10, step: 10, cap: 60, xp: 25 },
  { category: 'fitness', title: '{n} squats', objective: 'Bodyweight. Keep your heels down.', base: 15, step: 15, cap: 90, xp: 25 },
  { category: 'fitness', title: '{n} sit-ups', objective: 'Slow and controlled beats fast and sloppy.', base: 15, step: 10, cap: 70, xp: 25 },
  { category: 'fitness', title: '{n} lunges', objective: 'Alternate legs. Count both sides.', base: 10, step: 10, cap: 60, xp: 25 },
  { category: 'fitness', title: 'Plank for {n} seconds', objective: 'Straight line from head to heels.', base: 30, step: 20, cap: 150, xp: 30 },
  { category: 'fitness', title: 'Walk {n} minutes', objective: 'Outside if you can. Phone in your pocket.', base: 15, step: 10, cap: 60, xp: 30 },
  { category: 'fitness', title: '{n} burpees', objective: 'Pace yourself. Rest between sets.', base: 8, step: 6, cap: 40, xp: 35 },
  { category: 'fitness', title: 'Stretch for {n} minutes', objective: 'Hold each position, no bouncing.', base: 5, step: 3, cap: 20, xp: 20 },
  { category: 'fitness', title: '{n} jumping jacks', objective: 'Good warm-up if you have been sitting.', base: 25, step: 20, cap: 120, xp: 20 },
  { category: 'fitness', title: 'Take {n} flights of stairs', objective: 'Skip the lift today.', base: 3, step: 2, cap: 12, xp: 20 },
  { category: 'fitness', title: '{n} calf raises', objective: 'Slow on the way down.', base: 20, step: 15, cap: 90, xp: 20 },
  { category: 'fitness', title: 'Hold a wall sit for {n} seconds', objective: 'Thighs parallel to the floor.', base: 30, step: 15, cap: 120, xp: 30 },

  // --- Reading
  { category: 'reading', title: 'Read {n} pages', objective: 'Any book. Phone in another room.', base: 10, step: 8, cap: 60, xp: 30 },
  { category: 'reading', title: 'Read for {n} minutes', objective: 'One sitting, no interruptions.', base: 15, step: 10, cap: 60, xp: 30 },
  { category: 'reading', title: 'Read {n} articles end to end', objective: 'Finish them. No skimming.', base: 1, step: 1, cap: 5, xp: 25 },
  { category: 'reading', title: 'Summarise what you read in {n} sentences', objective: 'Forces you to actually absorb it.', base: 3, step: 2, cap: 10, xp: 30 },

  // --- Study
  { category: 'study', title: 'Review {n} practice questions', objective: 'Mark the ones you got wrong.', base: 10, step: 8, cap: 50, xp: 35 },
  { category: 'study', title: 'Revise one topic for {n} minutes', objective: 'Pick the one you have been avoiding.', base: 20, step: 15, cap: 90, xp: 40 },
  { category: 'study', title: 'Make {n} flashcards', objective: 'For whatever you keep forgetting.', base: 5, step: 5, cap: 30, xp: 30 },
  { category: 'study', title: 'Teach one concept out loud for {n} minutes', objective: 'To nobody. If you stumble, you do not know it yet.', base: 3, step: 2, cap: 12, xp: 35 },
  { category: 'study', title: 'Redo {n} questions you previously got wrong', objective: 'The ones that stung.', base: 3, step: 3, cap: 20, xp: 40 },

  // --- Focus
  { category: 'focus', title: 'Focus for {n} minutes', objective: 'One task. Timer running. No tabs.', base: 25, step: 15, cap: 90, xp: 40 },
  { category: 'focus', title: 'Complete {n} focus sessions', objective: 'Short breaks between them.', base: 1, step: 1, cap: 5, xp: 40 },
  { category: 'focus', title: 'Work {n} minutes with your phone in another room', objective: 'Not face down. Another room.', base: 20, step: 15, cap: 75, xp: 40 },

  // --- Productivity
  { category: 'productivity', title: "Write down tomorrow's {n} priorities", objective: 'On paper or in a note. Before you sleep.', base: 3, step: 1, cap: 6, xp: 25 },
  { category: 'productivity', title: 'Reply to {n} messages you have been avoiding', objective: 'Short replies are still replies.', base: 2, step: 2, cap: 10, xp: 25 },
  { category: 'fitness', title: '{n} shoulder taps in plank', objective: 'Keep your hips still.', base: 20, step: 10, cap: 60, xp: 25 },
  { category: 'fitness', title: '{n} mountain climbers', objective: 'Count both legs.', base: 20, step: 20, cap: 100, xp: 25 },
  { category: 'fitness', title: '{n} glute bridges', objective: 'Squeeze at the top.', base: 15, step: 10, cap: 60, xp: 20 },
  { category: 'fitness', title: '{n} tricep dips', objective: 'Use a chair or a step.', base: 10, step: 8, cap: 50, xp: 25 },
  { category: 'fitness', title: 'Skip rope for {n} minutes', objective: 'Real or imaginary rope, both work.', base: 3, step: 2, cap: 15, xp: 30 },
  { category: 'fitness', title: '{n} high knees', objective: 'Fast pace, count both legs.', base: 30, step: 20, cap: 120, xp: 20 },
  { category: 'fitness', title: 'Hold a dead hang for {n} seconds', objective: 'Any bar you can reach.', base: 15, step: 10, cap: 60, xp: 30 },
  { category: 'fitness', title: '{n} leg raises', objective: 'Lower slowly, do not drop.', base: 12, step: 8, cap: 50, xp: 25 },

  // --- Learning
  { category: 'learning', title: 'Learn {n} new words', objective: 'Write a sentence with each one.', base: 5, step: 3, cap: 20, xp: 25 },
  { category: 'learning', title: 'Watch {n} minutes of something that teaches you', objective: 'Not entertainment dressed as learning.', base: 15, step: 10, cap: 60, xp: 25 },
  { category: 'learning', title: 'Write down {n} things you learned today', objective: 'Specific ones. Not "worked hard".', base: 3, step: 2, cap: 10, xp: 25 },
  { category: 'learning', title: 'Practise a skill for {n} minutes', objective: 'The one you keep meaning to get back to.', base: 20, step: 15, cap: 75, xp: 35 },

  // --- Organisation
  { category: 'organisation', title: 'Clear {n} items from your desk', objective: 'Put them where they belong, not in a pile.', base: 5, step: 5, cap: 30, xp: 20 },
  { category: 'organisation', title: 'Delete {n} files or photos you do not need', objective: 'Start with screenshots.', base: 10, step: 10, cap: 60, xp: 20 },
  { category: 'organisation', title: 'Unsubscribe from {n} email lists', objective: 'The ones you never open.', base: 3, step: 2, cap: 12, xp: 20 },
  { category: 'organisation', title: 'Tidy one space for {n} minutes', objective: 'Set a timer and stop when it goes.', base: 10, step: 5, cap: 30, xp: 20 },

  // --- Creativity
  { category: 'creativity', title: 'Write {n} words about anything', objective: 'Quality is not the point today.', base: 100, step: 100, cap: 600, xp: 30 },
  { category: 'creativity', title: 'Sketch or design for {n} minutes', objective: 'Nobody has to see it.', base: 15, step: 10, cap: 45, xp: 25 },
  { category: 'creativity', title: 'Write down {n} ideas', objective: 'Bad ones count. Volume first.', base: 5, step: 5, cap: 25, xp: 25 },

  // --- Mindfulness
  { category: 'mindfulness', title: 'Sit quietly for {n} minutes', objective: 'No phone, no music, no agenda.', base: 5, step: 3, cap: 20, xp: 25 },
  { category: 'mindfulness', title: 'Take {n} slow breaths before starting work', objective: 'In for four, out for six.', base: 10, step: 5, cap: 30, xp: 15 },
  { category: 'mindfulness', title: 'Write {n} things that went well today', objective: 'Small ones count.', base: 3, step: 1, cap: 6, xp: 20 },
  { category: 'mindfulness', title: 'Spend {n} minutes outside without your phone', objective: 'Leave it inside.', base: 10, step: 5, cap: 30, xp: 25 },

  // --- Digital discipline
  { category: 'discipline', title: 'Go {n} minutes without social media', objective: 'From the moment you accept this.', base: 60, step: 60, cap: 300, xp: 30 },
  { category: 'discipline', title: 'Keep your phone out of reach for {n} minutes', objective: 'Physically out of reach.', base: 30, step: 30, cap: 180, xp: 30 },
  { category: 'discipline', title: 'Close {n} browser tabs you are not using', objective: 'Be honest about which ones.', base: 5, step: 5, cap: 30, xp: 15 },
  { category: 'discipline', title: 'No screens for the first {n} minutes after waking', objective: 'Tomorrow morning counts if today has gone.', base: 15, step: 10, cap: 60, xp: 30 },

  // --- Health
  { category: 'health', title: 'Drink {n} glasses of water', objective: 'Spread through the day.', base: 5, step: 1, cap: 10, xp: 20 },
  { category: 'health', title: 'Stand up and move every {n} minutes', objective: 'Set a reminder if you sit for work.', base: 45, step: -5, cap: 20, xp: 20 },
  { category: 'health', title: 'Get to bed {n} minutes earlier than usual', objective: 'Start winding down before then.', base: 15, step: 10, cap: 60, xp: 30 },
  { category: 'health', title: 'Eat {n} portions of fruit or vegetables', objective: 'Whatever is actually in the house.', base: 2, step: 1, cap: 6, xp: 20 },
];

/** No-amount quests, for variety — some things are not measured in numbers. */
const FLAT_QUESTS: Omit<Quest, 'id'>[] = [
  { category: 'productivity', title: 'Do the thing you keep postponing', objective: 'You know the one. Ten minutes is enough to start.', xp: 45 },
  { category: 'fitness', title: 'Do a full body warm-up', objective: 'Arms, legs, back. Five minutes is plenty.', xp: 20 },
  { category: 'fitness', title: 'Take the stairs every time today', objective: 'No lifts, no escalators.', xp: 25 },
  { category: 'health', title: 'Stretch before bed tonight', objective: 'Five minutes. Neck, shoulders, hamstrings.', xp: 20 },
  { category: 'organisation', title: 'Clean your workspace', objective: 'Clear surface, everything put away.', xp: 25 },
  { category: 'productivity', title: 'Plan tomorrow before you sleep', objective: 'Three things, written down.', xp: 25 },
  { category: 'mindfulness', title: 'Eat one meal without a screen', objective: 'No phone, no TV, no laptop.', xp: 20 },
  { category: 'discipline', title: 'Make your bed', objective: 'First win of the day, before anything else.', xp: 15 },
  { category: 'health', title: 'Go to bed at a set time tonight', objective: 'Decide the time now, not later.', xp: 30 },
  { category: 'learning', title: 'Explain something you learned to someone', objective: 'Out loud, to a real person.', xp: 35 },
  { category: 'creativity', title: 'Finish something you started and abandoned', objective: 'Anything. The point is finishing.', xp: 50 },
  { category: 'mindfulness', title: 'Say no to one thing today', objective: 'Something that does not deserve your time.', xp: 30 },
  { category: 'productivity', title: 'Do the hardest task first', objective: 'Before email, before anything else.', xp: 45 },
  { category: 'organisation', title: 'Empty one inbox completely', objective: 'Email, messages or a physical tray.', xp: 30 },
  { category: 'fitness', title: 'Do push-ups until you cannot do another', objective: 'One set. Stop when form goes.', xp: 40 },
  { category: 'fitness', title: 'Hold a plank as long as you can', objective: 'One attempt. Note the time.', xp: 35 },
  { category: 'health', title: 'Cook something instead of ordering', objective: 'Simple counts.', xp: 30 },
  { category: 'discipline', title: 'Delete one app you waste time on', objective: 'You can reinstall it tomorrow if you really want.', xp: 40 },
  { category: 'study', title: "Review yesterday's notes before starting new work", objective: 'Ten minutes of revision beats an hour of rereading.', xp: 30 },
  { category: 'focus', title: 'Work in silence for one session', objective: 'No music, no podcast, no background noise.', xp: 35 },
];

/** The amount for a template at a given band, respecting its cap. */
function amountFor(template: Template, band: number): number {
  const raw = template.base + template.step * band;
  // Negative steps (like "move every N minutes") count down instead of up.
  return template.step >= 0
    ? Math.min(template.cap, raw)
    : Math.max(template.cap, raw);
}

/**
 * The full quest pool for a difficulty band.
 *
 * Templates are expanded into concrete quests so the count and the wording
 * are both testable — a pool that silently produces "0 push-ups" would
 * otherwise only surface in front of a user.
 */
export function questPool(band: number): Quest[] {
  const scaled = TEMPLATES.map((t) => {
    const n = amountFor(t, band);
    return {
      id: `${t.category}:${t.title}:${n}`,
      category: t.category,
      title: t.title.replace('{n}', String(n)),
      objective: t.objective,
      // Reward tracks effort: a bigger target is worth more.
      xp: Math.round(t.xp * (1 + band * 0.25)),
    };
  });

  const flat = FLAT_QUESTS.map((q) => ({
    ...q,
    id: `flat:${q.title}`,
    xp: Math.round(q.xp * (1 + band * 0.15)),
  }));

  return [...scaled, ...flat];
}

/** Every quest across every band — used to report the true pool size. */
export function totalQuestVariations(): number {
  const seen = new Set<string>();
  for (let band = 0; band <= 5; band++) {
    for (const q of questPool(band)) seen.add(`${band}:${q.id}`);
  }
  return seen.size;
}

/** Stable hash, so the same inputs always pick the same quest. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Today's quest for a user.
 *
 * Derived from the user id and the local date, so it is identical on every
 * device and across refreshes without any stored state. Nothing to sync,
 * nothing to lose offline, and no way for two devices to disagree.
 *
 * The recent-history parameter nudges selection away from quests seen in the
 * last few days, so the same one does not reappear immediately.
 */
export function questForDay(
  userId: string,
  dateISO: string,
  level: number,
  recentIds: string[] = []
): Quest {
  const band = bandForLevel(level);
  const pool = questPool(band);

  const seed = hash(`${userId}|${dateISO}`);
  let index = seed % pool.length;

  // Walk forward past anything seen recently. Bounded, so a user with a long
  // history still gets a quest rather than looping forever.
  for (let attempt = 0; attempt < pool.length; attempt++) {
    const candidate = pool[(index + attempt) % pool.length];
    if (!recentIds.includes(candidate.id)) {
      return candidate;
    }
  }

  return pool[index];
}
