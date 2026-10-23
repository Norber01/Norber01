// Caches the app so it keeps working without internet.
const CACHE = 'poultry-tracker-v12';
const FILES = [
  './', 'index.html', 'style.css?v=12', 'app.js?v=12', 'firebase-config.js?v=12', 'manifest.json', 'icon.svg', 'shop.html', 'shop.js?v=12',
  'vendor/firebase-app-compat.js?v=10.12.2', 'vendor/firebase-auth-compat.js?v=10.12.2', 'vendor/firebase-firestore-compat.js?v=10.12.2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates show up, falling back to the cache when offline.
self.addEventListener('fetch', e => {
  // Only this app's own files; Firebase's live connection must go straight to the network.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // no-cache: always ask the server for the newest files instead of the browser's copy.
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
