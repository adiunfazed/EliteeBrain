// Replaced at build time. Its only job is to make this file's bytes differ
// between deploys, which is how a browser detects a worker update at all.
const BUILD_ID = '__BUILD_ID__';

/**
 * EliteLife service worker.
 *
 * Handles notification display and click routing. Registering a service worker
 * is also what makes the app installable, which on iOS is a hard requirement
 * before notifications are permitted at all.
 */

/**
 * Deliberately does NOT call skipWaiting() here.
 *
 * Taking over immediately means there is never a "waiting" worker, so the app
 * has no way to know an update exists — and a user mid-task can have the page
 * swapped underneath them. Instead the new worker waits until the user taps
 * Relaunch, which posts SKIP_WAITING below.
 */
self.addEventListener('install', () => {
  // Intentionally empty: wait for the user.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Server-sent push. Inert until VAPID keys and a sending server exist, but
 * present so nothing needs re-plumbing when they do.
 */
self.addEventListener('push', (event) => {
  let payload = { title: 'EliteLife', body: 'Time to check in.', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/brand/elitelife-logo-192.png',
      badge: '/brand/elitelife-logo-96.png',
      tag: payload.tag || 'elitelife',
      data: { url: payload.url || '/' },
      // Replacing a same-tag notification avoids stacking duplicates.
      renotify: false,
    })
  );
});

/** Messages from the page — used for locally scheduled reminders. */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'SHOW_NOTIFICATION') return;

  self.registration.showNotification(data.title || 'EliteLife', {
    body: data.body || '',
    icon: '/brand/elitelife-logo-192.png',
    badge: '/brand/elitelife-logo-96.png',
    tag: data.tag || 'elitelife',
    data: { url: data.url || '/' },
    requireInteraction: false,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an existing tab rather than opening a duplicate.
      for (const client of list) {
        if ('focus' in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
