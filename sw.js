const CACHE_NAME = 'site-snap-cache-v1';
// These are the core files that make the app run.
const URLS_TO_CACHE = [
  '/',
  '/index.html', // Alias for '/'
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
  // Firebase SDKs are loaded from the network by design, so we don't cache them.
];

// Install event: Pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Activate the new SW immediately
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of open pages
  );
});

// Fetch event: Serve from cache, fall back to network (Stale-While-Revalidate)
self.addEventListener('fetch', event => {
  // We only want to cache GET requests for our app shell.
  // We explicitly DO NOT cache Firebase/Firestore API calls.
  if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Stale-While-Revalidate strategy
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If the network request is successful, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          // Network failed, but we might have a cache
          console.log('Network request failed:', err);
        });

        // Return the cached version immediately if available,
        // while the network request runs in the background to update the cache.
        return response || fetchPromise;
      });
    })
  );
});