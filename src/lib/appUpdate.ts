/**
 * App updates.
 *
 * A new deploy installs a new service worker, which then waits rather than
 * taking over. The app watches for that waiting worker and offers a relaunch.
 *
 * The relaunch clears CACHE STORAGE ONLY. localStorage and IndexedDB are left
 * untouched, because that is where Firebase keeps the session and where the
 * profile is cached — wiping them would sign the user out and discard local
 * data, which is the opposite of what an update should do.
 */

type UpdateCallback = (available: boolean) => void;

let waitingWorker: ServiceWorker | null = null;

/**
 * Watch for a new version.
 *
 * Checks on load, on focus, and hourly — a user who leaves the app open for
 * days would otherwise never see an update.
 */
export function watchForUpdates(onChange: UpdateCallback): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  let cancelled = false;
  let registration: ServiceWorkerRegistration | null = null;

  const announce = (worker: ServiceWorker | null) => {
    if (cancelled || !worker) return;
    waitingWorker = worker;
    onChange(true);
  };

  navigator.serviceWorker.ready
    .then((reg) => {
      if (cancelled) return;
      registration = reg;

      // Already waiting when the page loaded.
      if (reg.waiting) announce(reg.waiting);

      // Ask the server explicitly. Without this the browser may not re-check
      // for hours, so a user who deployed minutes ago sees nothing.
      reg.update().catch(() => {});

      // A new worker arrives while the page is open.
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;

        const check = () => {
          // 'installed' with an existing controller means an UPDATE, not a
          // first install — without that check, every new user would be told
          // an update is available the moment they arrive.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            announce(installing);
          }
        };

        // Check immediately in case installation completed before this
        // listener was attached, then on every subsequent state change.
        check();
        installing.addEventListener('statechange', check);
      });
    })
    .catch(() => {
      /* no service worker support; updates simply arrive on next load */
    });

  const check = () => registration?.update().catch(() => {});
  const onFocus = () => check();

  window.addEventListener('focus', onFocus);
  const interval = window.setInterval(check, 60 * 60 * 1000);

  return () => {
    cancelled = true;
    window.removeEventListener('focus', onFocus);
    window.clearInterval(interval);
  };
}

/**
 * Apply the update.
 *
 * Order matters: caches are cleared first, then the waiting worker is
 * activated, then the page reloads once the new worker takes control. Reloading
 * before the swap would just load the old version again.
 */
export async function applyUpdate(): Promise<void> {
  try {
    // Cache Storage only. Session and profile live in localStorage and
    // IndexedDB and must survive.
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (err) {
    console.warn('Could not clear caches:', err);
  }

  const worker = waitingWorker;

  if (worker) {
    // Reload once the new worker is in control.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    worker.postMessage({ type: 'SKIP_WAITING' });

    // Fallback: if the swap does not happen promptly, reload anyway rather
    // than leaving the user staring at a button that appears to do nothing.
    window.setTimeout(() => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    }, 2500);
    return;
  }

  window.location.reload();
}
