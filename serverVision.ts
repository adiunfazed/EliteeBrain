/**
 * Image analysis for the Coach tools.
 *
 * Uses the Gemini key already configured. Each tool has its own instruction
 * set, because the useful answer differs completely between a plate of food
 * and a person standing side-on.
 *
 * Images are analysed and discarded. Nothing is written to disk: these are
 * photographs of people's bodies, meals and homes.
 */

export type VisionTool = 'food' | 'physique' | 'outfit';

/** Largest image accepted, before base64 encoding. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const SHARED = `
You are EliteLife Coach. Write plainly and specifically. No emoji, no
exclamation marks, no motivational filler, no hedging language.
Be direct. The user asked for an honest assessment, so give one.
`;

const PROMPTS: Record<VisionTool, string> = {
  /**
   * Food. Indian dishes are the common case for this audience and are the
   * hardest for a generic model — "curry" is not an answer. The prompt names
   * that explicitly and asks for per-component breakdown.
   */
  food: `${SHARED}
Identify everything visible in this photo of food. Be specific: name the actual
dish, not a category. If it is Indian food, name it properly — rajma, chole,
paneer butter masala, poha, upma, biryani, dosa, thali components individually.
Do the same for any cuisine. If it is fruit or dry fruit, name the variety.

Then give this exact structure:

WHAT THIS IS
One line naming the dish or items.

ROUGH NUMBERS
Calories: <number> kcal
Protein: <number> g
Carbs: <number> g
Fat: <number> g
Fibre: <number> g

For a mixed plate, estimate the total across everything visible, and note the
portion size you assumed.

WHAT IT IS GOOD FOR
Two lines on what this meal actually provides.

WHAT IT IS MISSING
One or two lines naming what to ADD to balance it. Never say to remove or eat
less of something, and never call food good or bad.

End with one line: these are estimates from a photograph and can be off by a
fair margin, especially for oil and portion size.`,

  /**
   * Physique and posture, merged.
   *
   * The user asked for brutal honesty, and that is reasonable for training
   * feedback. Two hard limits remain: no body-fat or weight estimates, which
   * cannot be known from a photo and which cause real harm when wrong, and
   * nothing framed around appearance or attractiveness. Direct about TRAINING
   * is useful; direct about someone's body is not.
   */
  physique: `${SHARED}
This is a photo shared for training and posture feedback. Assess it honestly.
Do not soften your assessment to be kind — the user explicitly asked for a
straight answer.

Give this exact structure:

RATING
<score>/10 — one line explaining the score.
Score on visible muscular development, symmetry and posture only.

POSTURE
Name what you can actually see: head position, shoulder level, spinal curve,
hip tilt, knee alignment. Say plainly what is off. If posture is good, say so.
Note what the angle does not let you assess.

WHAT YOUR TRAINING IS DOING WELL
Two specific things.

WHAT IS LAGGING
Two specific muscle groups or movement patterns that are visibly behind, and
the exercises that fix each.

DO THIS NEXT
Three concrete things for the next month.

Rules you must not break:
- Never estimate body-fat percentage or weight. You cannot know these from a
  photo, and a wrong number does real damage.
- Never comment on attractiveness or compare them to anyone else.
- Never suggest eating less, restricting, or cutting.
- Frame everything as what to TRAIN, not what is wrong with them as a person.`,

  outfit: `${SHARED}
This is a photo shared for style feedback. Be honest and direct — the user
asked for a real opinion, not encouragement.

Give this exact structure:

RATING
<score>/10 — one line explaining the score.

WHAT WORKS
Two specific things: fit, colour, proportion, texture, or how the pieces sit
together.

WHAT DOES NOT
Two specific things, named plainly. If the fit is wrong, say where. If the
colours clash, say which.

FIX IT
Two concrete swaps or changes that would raise the score.

If the outfit genuinely works, say so and explain why rather than inventing
faults. Comment only on the clothing and how it is worn — never on the
person's body.`,
};

export interface VisionResult {
  text: string;
}

/**
 * Analyse an image.
 *
 * Throws with a specific message on failure. Previously any problem produced
 * the same generic error, which made a safety block indistinguishable from a
 * network fault and left users with no idea what to do.
 */
/**
 * Models to try, in order.
 *
 * A single hard-coded name fails completely if that model is unavailable on
 * the account's tier or gets renamed — which is indistinguishable from a
 * broken feature. Falling through keeps the tool working.
 */
const VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

export async function analyseImage(
  ai: any,
  tool: VisionTool,
  base64: string,
  mimeType: string
): Promise<VisionResult> {
  const prompt = PROMPTS[tool];
  if (!prompt) throw new Error('Unknown tool');

  let lastError: any = null;

  for (const model of VISION_MODELS) {
    try {
      const result = await callModel(ai, model, prompt, base64, mimeType);
      if (result) return result;
    } catch (err: any) {
      lastError = err;
      const status = Number(err?.status || err?.code || 0);

      // A safety block or a bad image will fail the same way on every model,
      // so stop rather than retrying three times.
      if (status === 400 || status === 429) break;

      console.warn(`Vision model ${model} failed:`, err?.message || err);
    }
  }

  // Carry the real reason forward. Reporting "something went wrong" for an
  // expired key, a missing model and a safety block alike is what made this
  // impossible to diagnose.
  const detail = String(lastError?.message || 'no response');
  throw new Error(`Analysis failed: ${detail.slice(0, 200)}`);
}

async function callModel(
  ai: any,
  model: string,
  prompt: string,
  base64: string,
  mimeType: string
): Promise<VisionResult | null> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }],
      },
    ],
    config: {
      temperature: 0.4,
      // Photos of people routinely trip the default thresholds — a posture
      // photo in gym clothing is not adult content. Loosened to BLOCK_ONLY_HIGH
      // so legitimate fitness and outfit photos are not silently refused,
      // while genuinely harmful content still is.
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    },
  });

  const text = typeof response?.text === 'string' ? response.text.trim() : '';
  if (text) return { text };

  // No text means the response was blocked or empty. Report which, so the
  // user gets an actionable message instead of "something went wrong".
  const blockReason =
    response?.promptFeedback?.blockReason ||
    response?.candidates?.[0]?.finishReason ||
    null;

  if (blockReason === 'SAFETY' || blockReason === 'PROHIBITED_CONTENT') {
    throw new Error(
      'That photo could not be analysed. Try one that clearly shows what you want assessed.'
    );
  }

  if (blockReason === 'MAX_TOKENS') {
    throw new Error('The response was cut short. Try again.');
  }

  console.warn('Vision returned no text. Reason:', blockReason);
  return null;
}

export function isAllowedMime(mime: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mime);
}
