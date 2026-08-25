/* Custom service worker hooks merged by next-pwa (production builds). */

// Never intercept cross-origin fetches (Railway API). Workbox must not break CORS preflight.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') return;
  try {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
      return;
    }
  } catch {
    return;
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }

  const title = data.title || 'Atomic Repair';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/techboard' },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/techboard';
  const absolute = target.startsWith('http') ? target : `${self.location.origin}${target}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(target) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(absolute);
      return undefined;
    }),
  );
});
