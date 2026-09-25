import { useEffect, useRef } from 'react';

/**
 * The hardware back button.
 *
 * The app is one page. Everything on screen — a section, a pane, a sheet, the
 * workout runner — is React state, so the browser's history has exactly one
 * entry and Android's back button leaves the app rather than going back a
 * step. Installed to the home screen that reads as the app crashing.
 *
 * The fix is to give every layer its own history entry. When a layer opens it
 * pushes one and registers how to close itself; when back is pressed the
 * topmost layer closes and the app stays open. When a layer is closed by its
 * own button instead, its history entry is taken back off so the two never
 * drift apart.
 *
 * Nothing here is React-specific beyond the hook at the bottom, and nothing
 * touches the URL: the entries carry a marker in `history.state` only, so a
 * shared link still opens the app at the top.
 */

interface Layer {
  id: number;
  close: () => void;
}

const stack: Layer[] = [];
let nextId = 1;

/**
 * True while we are unwinding history ourselves.
 *
 * Closing a layer with its own X calls `history.back()` to drop the entry it
 * pushed, which fires `popstate` — and without this flag that would be read
 * as the user pressing back and would close a second layer.
 */
let unwinding = 0;

/** What to do when back is pressed with nothing open. Set by the app shell. */
let rootHandler: (() => boolean) | null = null;

function onPopState(): void {
  if (unwinding > 0) {
    unwinding--;
    return;
  }

  const layer = stack.pop();
  if (layer) {
    layer.close();
    return;
  }

  // Nothing is open. The shell decides: step back to Home, or let the press
  // through and leave the app.
  const handled = rootHandler?.();
  if (handled) {
    // Another entry is pushed so there is something to consume next time,
    // otherwise the following press would exit immediately.
    pushEntry();
  }
}

function pushEntry(): void {
  try {
    window.history.pushState({ ebLayer: nextId }, '');
  } catch {
    /* history is unavailable (rare, sandboxed); back simply behaves as before */
  }
}

let installed = false;

/**
 * Start listening, whoever asks first.
 *
 * A layer can open before the shell has mounted — a sheet restored on load,
 * a modal opened from a notification — and a layer that pushed a history
 * entry with nobody listening would swallow the press silently.
 */
function ensureInstalled(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', onPopState);
}

/** Called once by the app shell. */
export function installBackHandler(handler: () => boolean): () => void {
  rootHandler = handler;
  ensureInstalled();

  // One spare entry so the first back press at the root has something to
  // consume rather than leaving the app.
  pushEntry();

  return () => {
    rootHandler = null;
  };
}

/** Open a layer: one history entry, and how to close it. */
export function pushLayer(close: () => void): number {
  ensureInstalled();
  const id = nextId++;
  stack.push({ id, close });
  pushEntry();
  return id;
}

/**
 * Close a layer from the app's own controls.
 *
 * The entry it pushed is removed so history stays in step. Only the topmost
 * layer can unwind cleanly; a layer closed out of order is dropped from the
 * stack and its entry is left to be consumed harmlessly by a later press.
 */
export function popLayer(id: number): void {
  const index = stack.findIndex((l) => l.id === id);
  if (index === -1) return;

  const isTop = index === stack.length - 1;
  stack.splice(index, 1);

  if (isTop) {
    unwinding++;
    try {
      window.history.back();
    } catch {
      unwinding--;
    }
  }
}

/** How many layers are open. Exposed for tests. */
export function layerCount(): number {
  return stack.length;
}

/** Test seam: forget everything between cases. */
export function resetBackStack(): void {
  stack.length = 0;
  unwinding = 0;
  rootHandler = null;
}

/**
 * Register a layer for as long as `open` is true.
 *
 * `close` is held in a ref, so a component can pass an inline arrow without
 * the layer being torn down and re-pushed on every render — which would
 * stack up history entries and take several presses to escape.
 */
export function useBackGuard(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;

    const id = pushLayer(() => closeRef.current());
    return () => popLayer(id);
  }, [open]);
}
