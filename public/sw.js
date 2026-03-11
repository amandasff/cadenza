// Cadenza Service Worker — handles push notifications

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Cadenza', {
      body: data.body ?? 'Time to practice!',
      icon: '/icon',
      badge: '/apple-icon',
      tag: 'practice-reminder',
      renotify: true,
      data: { url: data.url ?? '/student' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/student';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
