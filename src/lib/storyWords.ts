/**
 * Word bank for timed story building.
 *
 * Words are chosen for how well they bend a narrative, not for vocabulary
 * difficulty. "Mirror" is an easy word that forces an interesting turn;
 * "perspicacious" is a hard word that mostly stalls a story. Difficulty here
 * means how hard the word is to WEAVE IN, which is the actual skill.
 */

export type StoryDifficulty = 'easy' | 'medium' | 'hard';

export interface StoryWordBank {
  easy: string[];
  medium: string[];
  hard: string[];
}

/**
 * Easy: concrete nouns a story can simply contain. A mountain, a key, a dog —
 * they slot in without reshaping anything.
 */
const EASY = [
  'mountain', 'mirror', 'airport', 'letter', 'garden', 'bicycle', 'candle', 'harbour',
  'suitcase', 'railway', 'lantern', 'bakery', 'umbrella', 'staircase', 'violin', 'orchard',
  'compass', 'notebook', 'balcony', 'tunnel', 'sandcastle', 'telescope', 'library', 'raincoat',
  'marketplace', 'lighthouse', 'passport', 'wristwatch', 'greenhouse', 'ferry', 'attic', 'bridge',
  'campfire', 'postcard', 'windmill', 'seashell', 'chessboard', 'kettle', 'hammock', 'doorbell',
  'fountain', 'scarf', 'pebble', 'canoe', 'birdcage', 'thermos', 'sketchbook', 'courtyard',
  'roundabout', 'toolbox', 'piano', 'satchel', 'clocktower', 'meadow', 'ladder', 'anchor',
  'blanket', 'whistle', 'basket', 'corridor',
];

/**
 * Medium: abstractions and states. They cannot simply sit in a scene — the
 * story has to accommodate them.
 */
const MEDIUM = [
  'suspicion', 'reunion', 'silence', 'promise', 'departure', 'rumour', 'apology', 'inheritance',
  'confession', 'rivalry', 'nostalgia', 'betrayal', 'coincidence', 'obsession', 'forgiveness',
  'exile', 'ambition', 'regret', 'superstition', 'reputation', 'bargain', 'disguise', 'ritual',
  'debt', 'secrecy', 'loyalty', 'escape', 'ambush', 'verdict', 'quarantine', 'migration',
  'inheritance', 'sacrifice', 'illusion', 'hierarchy', 'negotiation', 'exposure', 'restraint',
  'defiance', 'ceasefire', 'testimony', 'allegiance', 'reckoning', 'pilgrimage', 'quarrel',
  'threshold', 'omen', 'blackmail', 'sanctuary', 'insomnia', 'amnesty', 'vendetta', 'stalemate',
  'anonymity', 'contagion', 'trespass', 'inquest', 'penance', 'mutiny', 'requiem',
];

/**
 * Hard: constraints and reversals. These force the narrative to change
 * direction rather than absorb a detail, which is where the difficulty lives.
 */
const HARD = [
  'paradox', 'ultimatum', 'metamorphosis', 'contradiction', 'irony', 'catalyst', 'entropy',
  'juxtaposition', 'ambivalence', 'dissonance', 'catharsis', 'hubris', 'serendipity', 'nemesis',
  'epiphany', 'schism', 'anachronism', 'symbiosis', 'ephemera', 'labyrinth', 'palimpsest',
  'threshold', 'liminal', 'recursion', 'obsolescence', 'equilibrium', 'divergence', 'inversion',
  'precedent', 'abstraction', 'convergence', 'attrition', 'reciprocity', 'displacement',
  'perpetuity', 'incongruity', 'transience', 'duality', 'oblivion', 'inertia', 'fracture',
  'residue', 'aftermath', 'vestige', 'severance', 'cipher', 'artifice', 'reverie', 'tribunal',
  'apparition', 'covenant', 'refraction', 'sediment', 'undertow', 'axiom',
];

export const STORY_WORDS: StoryWordBank = {
  // Harder tiers include easier words so a long session still varies in pace —
  // an unbroken run of abstractions is exhausting rather than challenging.
  easy: EASY,
  medium: [...MEDIUM, ...EASY.slice(0, 20)],
  hard: [...HARD, ...MEDIUM.slice(0, 20)],
};

/**
 * A shuffled run of words with no immediate repeats.
 *
 * Generated up front rather than drawn one at a time: a session must never
 * stall waiting for the next word, and pre-shuffling guarantees no word
 * appears twice until the pool is exhausted.
 */
export function buildWordRun(difficulty: StoryDifficulty, count: number): string[] {
  const pool = [...new Set(STORY_WORDS[difficulty])];
  const out: string[] = [];

  while (out.length < count) {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    for (const w of shuffled) {
      if (out.length >= count) break;
      // Guard the seam between shuffles, where the same word could land twice.
      if (out.length > 0 && out[out.length - 1] === w) continue;
      out.push(w);
    }
  }

  return out;
}

/** How many words a session will show, given its length and interval. */
export function wordCountFor(durationMinutes: number, intervalSeconds: number): number {
  return Math.max(1, Math.floor((durationMinutes * 60) / intervalSeconds));
}
