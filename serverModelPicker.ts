/**
 * Model discovery.
 *
 * Hard-coding model names is why the Coach broke: Google retired every name
 * the code knew, and the app had no way to find the replacements. Asking the
 * API which models actually exist means a retirement resolves itself on the
 * next cache refresh instead of needing a code change.
 *
 * The pinned list stays as a fallback for when discovery itself fails, so
 * this is strictly more robust than the previous behaviour rather than a
 * different single point of failure.
 */

/** Tried first when discovery is unavailable. Order matters: cheapest first. */
const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

/** How long a discovered list is trusted. Retirements are not sudden. */
const CACHE_MS = 6 * 60 * 60 * 1000;

let cached: { models: string[]; at: number } | null = null;

/**
 * Rank candidates so the cheapest capable model is tried first.
 *
 * Lite variants cost the least and have the most generous free-tier limits,
 * which matters more here than raw capability — these are short prompts over
 * a single image.
 */
function score(name: string): number {
  let s = 0;

  // Prefer flash over pro: far higher free-tier limits, ample for this work.
  if (name.includes('flash')) s -= 100;
  if (name.includes('lite')) s -= 50;
  if (name.includes('pro')) s += 100;

  // Avoid anything explicitly experimental or preview: they are retired with
  // the least notice.
  if (/exp|preview|thinking/.test(name)) s += 200;

  // Newer generation first, so a retirement moves forward rather than back.
  const gen = /gemini-(\d+)\.?(\d+)?/.exec(name);
  if (gen) s -= Number(gen[1]) * 10 + Number(gen[2] || 0);

  return s;
}

/**
 * Models this key can actually use for image analysis, best first.
 *
 * Never throws: discovery failing must not break the feature, since the
 * pinned list is usually still correct.
 */
export async function usableVisionModels(ai: any): Promise<string[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.models;

  try {
    const page = await ai.models.list();

    const names: string[] = [];
    // The SDK returns an async pager; collecting one page is enough.
    for await (const model of page) {
      const raw = String(model?.name || '');
      if (!raw) continue;

      // Names arrive as "models/gemini-x"; the generate call wants the bare id.
      const id = raw.replace(/^models\//, '');

      // Only models that can actually generate content.
      const actions: string[] = model?.supportedActions || model?.supportedGenerationMethods || [];
      if (actions.length > 0 && !actions.some((a: string) => a.includes('generateContent'))) {
        continue;
      }

      // Embedding, imaging and TTS models cannot answer a vision prompt.
      if (/embed|aqa|imagen|veo|tts|native-audio/.test(id)) continue;
      if (!id.startsWith('gemini')) continue;

      names.push(id);
      if (names.length > 60) break;
    }

    if (names.length === 0) throw new Error('No usable models returned');

    const ordered = names.sort((a, b) => score(a) - score(b)).slice(0, 6);
    cached = { models: ordered, at: Date.now() };

    console.info('Vision models discovered:', ordered.join(', '));
    return ordered;
  } catch (err: any) {
    // Discovery is an optimisation, not a requirement.
    console.warn('Model discovery failed, using pinned list:', err?.message || err);
    return FALLBACK_MODELS;
  }
}

/** Drop the cache so the next call rediscovers — used after a 404. */
export function forgetDiscoveredModels(): void {
  cached = null;
}
