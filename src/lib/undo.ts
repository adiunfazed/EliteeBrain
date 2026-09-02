/**
 * Undo for destructive actions.
 *
 * Deletions are immediate and permanent everywhere in the app, so one mis-tap
 * loses real work. Rather than adding a confirmation dialogue to every delete
 * — which slows down the common case to guard against the rare one — the
 * action happens instantly and stays reversible for a few seconds.
 */

export interface UndoAction {
  id: string;
  /** What was undone, e.g. "Task deleted". */
  label: string;
  /** Restores the deleted item. Must be safe to call once. */
  restore: () => Promise<void> | void;
}

type Listener = (action: UndoAction | null) => void;

let current: UndoAction | null = null;
let timer: number | null = null;
const listeners = new Set<Listener>();

/** How long a deletion stays reversible. */
const WINDOW_MS = 6000;

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeUndo(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/**
 * Offer an undo.
 *
 * A second deletion replaces the first rather than queueing — showing two
 * undo prompts at once is confusing, and the most recent action is the one
 * someone is likely to regret.
 */
export function offerUndo(label: string, restore: UndoAction['restore']): void {
  if (timer !== null) window.clearTimeout(timer);

  current = { id: `undo_${Date.now()}`, label, restore };
  emit();

  timer = window.setTimeout(() => {
    current = null;
    timer = null;
    emit();
  }, WINDOW_MS);
}

/** Run the pending restore. Clears first, so it cannot fire twice. */
export async function runUndo(): Promise<void> {
  const action = current;
  if (!action) return;

  if (timer !== null) window.clearTimeout(timer);
  current = null;
  timer = null;
  emit();

  try {
    await action.restore();
  } catch (err) {
    console.error('Undo failed:', err);
  }
}

export function dismissUndo(): void {
  if (timer !== null) window.clearTimeout(timer);
  current = null;
  timer = null;
  emit();
}
