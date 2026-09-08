import type { ModuleId } from '../types';
import type { SkillGroup } from './skillGroups';

/**
 * What the user says they want to work on.
 *
 * Previously the onboarding collected a goal and then launched `digit-span`
 * regardless, so the answer had no effect. Each goal now maps to a genuine
 * first action and to the skill group surfaced first in training.
 */

export type GoalId = 'focus' | 'memory' | 'productivity' | 'consistency';

export interface GoalOption {
  id: GoalId;
  label: string;
  blurb: string;
  /** Where to send the user immediately after onboarding. */
  firstAction: { kind: 'module'; moduleId: ModuleId } | { kind: 'hub' };
  /** Skill group promoted to the top of the training section. */
  emphasise: SkillGroup;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'focus',
    label: 'Better focus',
    blurb: 'Hold attention longer and get pulled away less often.',
    firstAction: { kind: 'module', moduleId: 'stroop' as ModuleId },
    emphasise: 'focus',
  },
  {
    id: 'memory',
    label: 'Better memory',
    blurb: 'Hold more in mind and recall it when you need it.',
    firstAction: { kind: 'module', moduleId: 'digit-span' as ModuleId },
    emphasise: 'memory',
  },
  {
    id: 'productivity',
    label: 'More productive days',
    blurb: 'Decide what matters and actually finish it.',
    firstAction: { kind: 'hub' },
    emphasise: 'focus',
  },
  {
    id: 'consistency',
    label: 'Better consistency',
    blurb: 'Show up daily instead of in bursts.',
    firstAction: { kind: 'module', moduleId: 'stillness' as ModuleId },
    emphasise: 'reasoning',
  },
];

export function goalById(id?: string): GoalOption | undefined {
  return GOAL_OPTIONS.find((g) => g.id === id);
}

/** Skill group to show first, given the stored goal. */
export function emphasisedGroup(goalId?: string): SkillGroup | null {
  return goalById(goalId)?.emphasise ?? null;
}
