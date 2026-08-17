import type { ModuleId } from '../types';

/**
 * Skill grouping for the training section.
 *
 * The existing `category` field gives seven labels across eight modules, so it
 * can't group anything — every module is its own category. These three groups
 * describe what a module actually asks of you, so the section reads as a
 * training centre rather than a flat list.
 *
 * Deliberately descriptive, not diagnostic: "trains recall under load" is a
 * claim about the exercise, not about the user's brain.
 */

export type SkillGroup = 'memory' | 'focus' | 'reasoning';

export const SKILL_GROUPS: Record<
  SkillGroup,
  { label: string; blurb: string; tint: string; accent: string }
> = {
  memory: {
    label: 'Memory',
    blurb: 'Hold information in mind and recall it accurately under load.',
    tint: 'text-rose-300',
    accent: 'bg-rose-500/15 border-rose-500/30',
  },
  focus: {
    label: 'Focus & Control',
    blurb: 'Sustain attention, resist distraction, and hold back the wrong response.',
    tint: 'text-emerald-300',
    accent: 'bg-emerald-500/15 border-emerald-500/30',
  },
  reasoning: {
    label: 'Reasoning & Speed',
    blurb: 'Spot patterns, switch between rules, and work through problems quickly.',
    tint: 'text-[#A78BFA]',
    accent: 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30',
  },
};

export const MODULE_SKILL_GROUP: Record<string, SkillGroup> = {
  'digit-span': 'memory',
  'n-back': 'memory',
  'visuospatial': 'memory',

  'stroop': 'focus',
  'stillness': 'focus',
  'reaction-inhibitor': 'focus',

  'pattern-matrix': 'reasoning',
  'cognitive-shift': 'reasoning',
};

export function skillGroupOf(id: ModuleId): SkillGroup {
  return MODULE_SKILL_GROUP[id] ?? 'reasoning';
}

export const SKILL_GROUP_ORDER: SkillGroup[] = ['focus', 'memory', 'reasoning'];
