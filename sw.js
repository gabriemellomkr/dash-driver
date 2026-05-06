const CACHE = 'dashdriver-v3';
const ASSETS = ['/', '/corridas.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Supabase, APIs e /api/*: sempre network first
  if (
    e.request.url.includes('supabase') ||
    e.request.url.includes('nucleocriativo') ||
    e.request.url.includes('/api/') ||
    e.request.method !== 'GET'
  ) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

// ── Push Notifications ────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch {}

  const title   = data.title || 'DashDriver';
  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag   || 'dashdriver',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options).then(sub =>
      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      })
    )
  );
});
