/**
 * Image analysis for the Coach tools.
 *
 * Uses the Gemini key already configured — no new provider, no extra cost.
 * Each tool has its own instruction set rather than one generic "describe
 * this image" prompt, because the useful answer differs completely between
 * a plate of food and a standing posture.
 *
 * Images are analysed and discarded. Nothing is stored server-side: these are
 * photographs of people's bodies, meals and homes, and keeping them would
 * create a liability with no corresponding benefit.
 */

export type VisionTool = 'physique' | 'food' | 'posture' | 'outfit';

/** Largest image accepted, before base64 encoding. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const SHARED_RULES = `
You are EliteLife Coach. Be specific, practical and brief — six sentences at most.
Write plainly. No emoji, no exclamation marks, no motivational filler.
If the image is unclear or does not show what this tool expects, say so plainly
and ask for a better photo rather than guessing.
`;

const PROMPTS: Record<VisionTool, string> = {
  /**
   * Deliberately constrained. Commenting on someone's body carries real risk
   * of harm — particularly with a young audience — so this is framed around
   * training and health, never appearance, attractiveness or comparison.
   */
  physique: `${SHARED_RULES}
The user has shared a photo for fitness feedback.

Rules you must follow:
- Comment ONLY on visible posture, muscular development and training balance.
- Never comment on attractiveness, weight, body fat, or how they compare to
  anyone else.
- Never estimate body-fat percentage or weight. You cannot know these from a
  photo and a wrong number can do real harm.
- Never suggest restriction, cutting, or eating less.
- Frame everything as what to TRAIN next, not what is wrong with them.

Give: two things their training appears to be doing well, and two specific
exercises or movement patterns to add. Then one line noting that a photo shows
limited information.`,

  food: `${SHARED_RULES}
The user has shared a photo of food.

Identify what is on the plate. Give a rough estimate of calories and the
protein/carbohydrate/fat balance, and state clearly that these are estimates
from a photograph and may be well off.

Then give one practical suggestion to make this meal more balanced — something
to add rather than something to remove.

Never tell the user not to eat something, and never frame food as good or bad.`,

  posture: `${SHARED_RULES}
The user has shared a photo to check their posture.

Comment on what is visible: head position, shoulder alignment, spinal curve,
hip position. Name specifically what you can see, and say what you cannot
assess from this angle.

Give two stretches or strengthening exercises that address what you observed.
If the posture looks broadly fine, say so rather than inventing a problem.`,

  outfit: `${SHARED_RULES}
The user has shared a photo of an outfit for style feedback.

Say what works about it: fit, colour, proportion, or how the pieces sit
together. Then give two specific, actionable suggestions — a different
silhouette, a colour that would work better, a piece to swap.

Be constructive and direct. Never comment on the person's body, only on the
clothing and how it is worn.`,
};

export interface VisionResult {
  text: string;
}

/**
 * Analyse an image for one tool.
 *
 * Throws on failure so the caller decides what the user sees — a vision
 * failure should not be dressed up as advice.
 */
export async function analyseImage(
  ai: any,
  tool: VisionTool,
  base64: string,
  mimeType: string
): Promise<VisionResult> {
  const prompt = PROMPTS[tool];
  if (!prompt) throw new Error('Unknown tool');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    config: { temperature: 0.4 },
  });

  const text = response?.text?.trim();
  if (!text) throw new Error('No response from the model');

  return { text };
}

/** Accepted image types. Anything else is rejected before reaching the model. */
export function isAllowedMime(mime: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mime);
}
