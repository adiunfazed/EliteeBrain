/**
 * Bundled vocabulary.
 *
 * Shipped with the app rather than fetched, so it works offline and costs
 * nothing to run. Each entry carries everything the learning loop needs, which
 * means no lookup ever fails halfway through a session.
 *
 * `tier` drives difficulty: 1 is everyday-but-precise, 3 is genuinely advanced.
 */

export interface VocabWord {
  word: string;
  /** Simplified respelling — no IPA, which most learners cannot read. */
  say: string;
  part: string;
  definition: string;
  example: string;
  synonyms: string[];
  tier: 1 | 2 | 3;
}

export const VOCABULARY: VocabWord[] = [
  // ---- Tier 1 ----
  { word: 'candid', say: 'KAN-did', part: 'adjective', definition: 'Honest and direct, even when it is uncomfortable.', example: 'She was candid about how far behind the project had fallen.', synonyms: ['frank', 'blunt', 'forthright'], tier: 1 },
  { word: 'diligent', say: 'DIL-i-jent', part: 'adjective', definition: 'Working carefully and persistently.', example: 'Diligent revision beat last-minute cramming.', synonyms: ['industrious', 'assiduous', 'painstaking'], tier: 1 },
  { word: 'concise', say: 'kun-SYSE', part: 'adjective', definition: 'Saying much in few words.', example: 'His answer was concise and left nothing out.', synonyms: ['succinct', 'terse', 'brief'], tier: 1 },
  { word: 'resilient', say: 'ri-ZIL-yent', part: 'adjective', definition: 'Able to recover quickly from difficulty.', example: 'A resilient student treats one bad exam as data, not a verdict.', synonyms: ['tough', 'hardy', 'adaptable'], tier: 1 },
  { word: 'meticulous', say: 'muh-TIK-yuh-lus', part: 'adjective', definition: 'Showing great attention to detail.', example: 'Her notes were meticulous, down to the page numbers.', synonyms: ['thorough', 'scrupulous', 'exacting'], tier: 1 },
  { word: 'ambiguous', say: 'am-BIG-yoo-us', part: 'adjective', definition: 'Open to more than one interpretation.', example: 'The instructions were ambiguous, so half the class got it wrong.', synonyms: ['unclear', 'equivocal', 'vague'], tier: 1 },
  { word: 'pragmatic', say: 'prag-MAT-ik', part: 'adjective', definition: 'Dealing with things practically rather than ideally.', example: 'He took a pragmatic view and shipped the simpler version.', synonyms: ['practical', 'realistic', 'sensible'], tier: 1 },
  { word: 'trivial', say: 'TRIV-ee-ul', part: 'adjective', definition: 'Of little value or importance.', example: 'Do not spend your best hours on trivial tasks.', synonyms: ['minor', 'negligible', 'petty'], tier: 1 },
  { word: 'coherent', say: 'koh-HEER-unt', part: 'adjective', definition: 'Logical and consistent; easy to follow.', example: 'Her argument was coherent from first line to last.', synonyms: ['logical', 'lucid', 'orderly'], tier: 1 },
  { word: 'obsolete', say: 'OB-suh-leet', part: 'adjective', definition: 'No longer in use or useful.', example: 'The method became obsolete once faster tools appeared.', synonyms: ['outdated', 'antiquated', 'defunct'], tier: 1 },
  { word: 'inevitable', say: 'in-EV-i-tuh-bul', part: 'adjective', definition: 'Certain to happen and impossible to avoid.', example: 'Some setbacks are inevitable; the response is not.', synonyms: ['unavoidable', 'certain', 'inescapable'], tier: 1 },
  { word: 'articulate', say: 'ar-TIK-yuh-lut', part: 'adjective', definition: 'Able to express ideas clearly and fluently.', example: 'She was articulate under pressure.', synonyms: ['eloquent', 'fluent', 'expressive'], tier: 1 },
  { word: 'scrutinise', say: 'SKROO-tuh-nyze', part: 'verb', definition: 'To examine closely and critically.', example: 'Scrutinise your mistakes before repeating them.', synonyms: ['inspect', 'examine', 'study'], tier: 1 },
  { word: 'advocate', say: 'AD-vuh-kayt', part: 'verb', definition: 'To publicly support or recommend.', example: 'He advocates shorter, more frequent study sessions.', synonyms: ['champion', 'endorse', 'support'], tier: 1 },
  { word: 'mitigate', say: 'MIT-i-gayt', part: 'verb', definition: 'To make something less severe.', example: 'Planning ahead mitigates the damage of a bad week.', synonyms: ['lessen', 'alleviate', 'reduce'], tier: 1 },
  { word: 'consolidate', say: 'kun-SOL-i-dayt', part: 'verb', definition: 'To combine into a single, stronger whole.', example: 'Consolidate your notes before the exam, not during it.', synonyms: ['merge', 'unify', 'strengthen'], tier: 1 },
  { word: 'discern', say: 'di-SURN', part: 'verb', definition: 'To recognise or distinguish, especially with difficulty.', example: 'It is hard to discern effort from talent at a glance.', synonyms: ['perceive', 'detect', 'distinguish'], tier: 1 },
  { word: 'aptitude', say: 'AP-ti-tood', part: 'noun', definition: 'A natural ability to do something well.', example: 'She showed an early aptitude for numbers.', synonyms: ['talent', 'flair', 'facility'], tier: 1 },
  { word: 'candour', say: 'KAN-der', part: 'noun', definition: 'The quality of being open and honest.', example: 'His candour made the feedback useful.', synonyms: ['frankness', 'honesty', 'openness'], tier: 1 },
  { word: 'discipline', say: 'DIS-uh-plin', part: 'noun', definition: 'Training yourself to do what is required, reliably.', example: 'Discipline is what carries you when motivation does not.', synonyms: ['self-control', 'restraint', 'regimen'], tier: 1 },

  // ---- Tier 2 ----
  { word: 'tenacious', say: 'tuh-NAY-shus', part: 'adjective', definition: 'Holding firmly to a purpose; not easily discouraged.', example: 'Tenacious students outlast talented ones.', synonyms: ['persistent', 'dogged', 'determined'], tier: 2 },
  { word: 'astute', say: 'uh-STOOT', part: 'adjective', definition: 'Shrewd; quick to see what matters.', example: 'An astute reader spots the assumption behind the claim.', synonyms: ['shrewd', 'perceptive', 'canny'], tier: 2 },
  { word: 'prudent', say: 'PROO-dunt', part: 'adjective', definition: 'Careful and sensible about the future.', example: 'It was prudent to start a month early.', synonyms: ['judicious', 'cautious', 'wise'], tier: 2 },
  { word: 'redundant', say: 'ri-DUN-dunt', part: 'adjective', definition: 'Not needed, because it repeats something already present.', example: 'The second paragraph was redundant.', synonyms: ['superfluous', 'unnecessary', 'repetitive'], tier: 2 },
  { word: 'nuanced', say: 'NOO-anst', part: 'adjective', definition: 'Showing subtle differences in meaning.', example: 'A nuanced answer beats a confident wrong one.', synonyms: ['subtle', 'refined', 'shaded'], tier: 2 },
  { word: 'candidly', say: 'KAN-did-lee', part: 'adverb', definition: 'In an honest and direct way.', example: 'Candidly, the first draft was not good enough.', synonyms: ['frankly', 'openly', 'honestly'], tier: 2 },
  { word: 'arduous', say: 'AR-joo-us', part: 'adjective', definition: 'Requiring great effort; difficult and tiring.', example: 'The final month was arduous but decisive.', synonyms: ['strenuous', 'gruelling', 'laborious'], tier: 2 },
  { word: 'succinct', say: 'suk-SINGKT', part: 'adjective', definition: 'Expressed clearly in very few words.', example: 'Keep the summary succinct.', synonyms: ['concise', 'pithy', 'compact'], tier: 2 },
  { word: 'diligence', say: 'DIL-i-juns', part: 'noun', definition: 'Careful and persistent effort.', example: 'Diligence compounds in a way talent does not.', synonyms: ['industry', 'perseverance', 'application'], tier: 2 },
  { word: 'inference', say: 'IN-fer-uns', part: 'noun', definition: 'A conclusion reached from evidence rather than direct statement.', example: 'That is an inference, not a fact.', synonyms: ['deduction', 'conclusion', 'reasoning'], tier: 2 },
  { word: 'paradigm', say: 'PA-ruh-dyme', part: 'noun', definition: 'A typical pattern or model of how something works.', example: 'The new method broke the old paradigm.', synonyms: ['model', 'framework', 'pattern'], tier: 2 },
  { word: 'catalyst', say: 'KAT-uh-list', part: 'noun', definition: 'Something that causes change or speeds it up.', example: 'One bad result became the catalyst for a better routine.', synonyms: ['spur', 'trigger', 'stimulus'], tier: 2 },
  { word: 'discrepancy', say: 'dis-KREP-un-see', part: 'noun', definition: 'A difference between things that should match.', example: 'There was a discrepancy between his plan and his week.', synonyms: ['inconsistency', 'mismatch', 'disparity'], tier: 2 },
  { word: 'proficiency', say: 'pruh-FISH-un-see', part: 'noun', definition: 'A high degree of skill or competence.', example: 'Proficiency comes from repetition, not intention.', synonyms: ['skill', 'expertise', 'mastery'], tier: 2 },
  { word: 'alleviate', say: 'uh-LEE-vee-ayt', part: 'verb', definition: 'To make suffering or a problem less severe.', example: 'A clear plan alleviates most of the anxiety.', synonyms: ['ease', 'relieve', 'soften'], tier: 2 },
  { word: 'delineate', say: 'di-LIN-ee-ayt', part: 'verb', definition: 'To describe or mark out precisely.', example: 'Delineate the steps before you start.', synonyms: ['outline', 'define', 'specify'], tier: 2 },
  { word: 'substantiate', say: 'sub-STAN-shee-ayt', part: 'verb', definition: 'To support a claim with evidence.', example: 'Substantiate the argument or drop it.', synonyms: ['prove', 'verify', 'corroborate'], tier: 2 },
  { word: 'undermine', say: 'un-der-MYNE', part: 'verb', definition: 'To weaken something gradually.', example: 'Skipping sleep undermines everything else you do.', synonyms: ['weaken', 'erode', 'sabotage'], tier: 2 },
  { word: 'reconcile', say: 'REK-un-syle', part: 'verb', definition: 'To make two conflicting things compatible.', example: 'He had to reconcile ambition with a finite week.', synonyms: ['harmonise', 'settle', 'square'], tier: 2 },
  { word: 'attribute', say: 'uh-TRIB-yoot', part: 'verb', definition: 'To regard something as caused by a particular thing.', example: 'She attributes the improvement to consistency.', synonyms: ['ascribe', 'credit', 'assign'], tier: 2 },

  // ---- Tier 3 ----
  { word: 'ubiquitous', say: 'yoo-BIK-wi-tus', part: 'adjective', definition: 'Present everywhere at once.', example: 'Distraction is ubiquitous; attention is not.', synonyms: ['omnipresent', 'pervasive', 'universal'], tier: 3 },
  { word: 'perfunctory', say: 'per-FUNK-tuh-ree', part: 'adjective', definition: 'Done with minimum effort, as a formality.', example: 'A perfunctory review catches nothing.', synonyms: ['cursory', 'superficial', 'token'], tier: 3 },
  { word: 'intransigent', say: 'in-TRAN-si-junt', part: 'adjective', definition: 'Refusing to change one\u2019s views or position.', example: 'He was intransigent even when the data changed.', synonyms: ['unyielding', 'obstinate', 'inflexible'], tier: 3 },
  { word: 'ephemeral', say: 'i-FEM-er-ul', part: 'adjective', definition: 'Lasting for a very short time.', example: 'Motivation is ephemeral; systems are not.', synonyms: ['fleeting', 'transient', 'short-lived'], tier: 3 },
  { word: 'innocuous', say: 'i-NOK-yoo-us', part: 'adjective', definition: 'Harmless; unlikely to cause offence.', example: 'The remark seemed innocuous but stung later.', synonyms: ['harmless', 'inoffensive', 'benign'], tier: 3 },
  { word: 'esoteric', say: 'es-uh-TER-ik', part: 'adjective', definition: 'Understood by only a small, specialised group.', example: 'The paper was too esoteric for a general reader.', synonyms: ['abstruse', 'arcane', 'obscure'], tier: 3 },
  { word: 'tacit', say: 'TAS-it', part: 'adjective', definition: 'Understood without being stated.', example: 'There was a tacit agreement to stop at nine.', synonyms: ['implicit', 'unspoken', 'implied'], tier: 3 },
  { word: 'salient', say: 'SAY-lee-unt', part: 'adjective', definition: 'Most noticeable or important.', example: 'Lead with the salient point.', synonyms: ['prominent', 'key', 'conspicuous'], tier: 3 },
  { word: 'inexorable', say: 'in-EK-ser-uh-bul', part: 'adjective', definition: 'Impossible to stop or prevent.', example: 'The deadline moved with inexorable certainty.', synonyms: ['relentless', 'unstoppable', 'implacable'], tier: 3 },
  { word: 'circumspect', say: 'SUR-kum-spekt', part: 'adjective', definition: 'Careful to consider all consequences before acting.', example: 'Be circumspect about promises you make at midnight.', synonyms: ['cautious', 'wary', 'guarded'], tier: 3 },
  { word: 'proclivity', say: 'proh-KLIV-i-tee', part: 'noun', definition: 'A natural tendency toward something.', example: 'He has a proclivity for starting rather than finishing.', synonyms: ['inclination', 'propensity', 'penchant'], tier: 3 },
  { word: 'equanimity', say: 'ek-wuh-NIM-i-tee', part: 'noun', definition: 'Calmness and composure under strain.', example: 'She took the result with equanimity.', synonyms: ['composure', 'poise', 'serenity'], tier: 3 },
  { word: 'impetus', say: 'IM-pi-tus', part: 'noun', definition: 'The force that makes something happen or move faster.', example: 'The deadline gave the work fresh impetus.', synonyms: ['momentum', 'drive', 'stimulus'], tier: 3 },
  { word: 'antithesis', say: 'an-TITH-uh-sis', part: 'noun', definition: 'The direct opposite of something.', example: 'Cramming is the antithesis of spaced practice.', synonyms: ['opposite', 'converse', 'reverse'], tier: 3 },
  { word: 'veracity', say: 'vuh-RAS-i-tee', part: 'noun', definition: 'Conformity to truth; accuracy.', example: 'Check the veracity of the claim before repeating it.', synonyms: ['truthfulness', 'accuracy', 'honesty'], tier: 3 },
  { word: 'obfuscate', say: 'OB-fus-kayt', part: 'verb', definition: 'To make something deliberately unclear.', example: 'Jargon often obfuscates rather than explains.', synonyms: ['obscure', 'confuse', 'cloud'], tier: 3 },
  { word: 'extrapolate', say: 'ik-STRAP-uh-layt', part: 'verb', definition: 'To extend known information to estimate the unknown.', example: 'Do not extrapolate a trend from two days.', synonyms: ['infer', 'project', 'deduce'], tier: 3 },
  { word: 'precipitate', say: 'pri-SIP-i-tayt', part: 'verb', definition: 'To cause something to happen suddenly or too soon.', example: 'One missed week precipitated the collapse of the plan.', synonyms: ['trigger', 'hasten', 'provoke'], tier: 3 },
  { word: 'repudiate', say: 'ri-PYOO-dee-ayt', part: 'verb', definition: 'To reject or deny the validity of something.', example: 'He repudiated the earlier claim entirely.', synonyms: ['reject', 'disown', 'renounce'], tier: 3 },
  { word: 'assimilate', say: 'uh-SIM-i-layt', part: 'verb', definition: 'To take in and fully understand information.', example: 'You cannot assimilate six chapters in one night.', synonyms: ['absorb', 'digest', 'internalise'], tier: 3 },
];

/** Words available at a given difficulty, cumulative so earlier ones recur. */
export function wordsForTier(maxTier: 1 | 2 | 3): VocabWord[] {
  return VOCABULARY.filter((w) => w.tier <= maxTier);
}
