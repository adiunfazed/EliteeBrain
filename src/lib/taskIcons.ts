/**
 * Icon choices for tasks.
 *
 * Stored as a key rather than a component, so the value survives a round trip
 * to Firestore and a rename of the icon library. An unknown key falls back to
 * the priority icon rather than rendering nothing.
 */

export const TASK_ICONS = [
  { id: 'study', label: 'Study', icon: 'BookOpen' },
  { id: 'work', label: 'Work', icon: 'Briefcase' },
  { id: 'fitness', label: 'Fitness', icon: 'Dumbbell' },
  { id: 'health', label: 'Health', icon: 'HeartPulse' },
  { id: 'money', label: 'Money', icon: 'Wallet' },
  { id: 'home', label: 'Home', icon: 'House' },
  { id: 'people', label: 'People', icon: 'Users' },
  { id: 'call', label: 'Call', icon: 'Phone' },
  { id: 'write', label: 'Write', icon: 'PenLine' },
  { id: 'code', label: 'Code', icon: 'Code' },
  { id: 'travel', label: 'Travel', icon: 'Plane' },
  { id: 'shop', label: 'Shopping', icon: 'ShoppingCart' },
] as const;

export type TaskIconId = (typeof TASK_ICONS)[number]['id'];

export function iconNameFor(id?: string): string | null {
  if (!id) return null;
  return TASK_ICONS.find((i) => i.id === id)?.icon ?? null;
}
