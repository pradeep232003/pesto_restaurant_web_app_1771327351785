/* JKHive Service Worker — Web Push for Cooking & Cooling alarms.
 *
 * Receives `push` events with a JSON payload {title, body, tag, url} from the
 * backend (see /app/backend/routes/cooking_cooling.py → run_cooling_alarm_sweep)
 * and shows a system notification. Tapping the notification focuses an open
 * JKHive tab or opens the cooling page.
 */
const SW_VERSION = 'jkhive-cooling-1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    try { data = { title: 'JKHive', body: event.data ? event.data.text() : '' }; } catch (__) { data = {}; }
  }
  const title = data.title || 'JKHive';
  const body  = data.body  || '';
  const tag   = data.tag   || 'jkhive';
  const url   = data.url   || '/jkhive/cooking-cooling';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    data: { url },
    requireInteraction: true,
    vibrate: [180, 100, 180],
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/jkhive/cooking-cooling';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of allClients) {
      if (c.url.includes('/jkhive')) {
        await c.focus();
        try { c.postMessage({ type: 'jkhive-nav', url: target }); } catch (_) {}
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
