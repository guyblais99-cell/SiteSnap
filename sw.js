const CACHE_NAME = 'site-snap-v1';

// All the files your app needs to work offline
const URLS_TO_CACHE = [
  '.',
  'index.html',
  'manifest.json',
  // CDNs & Fonts
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  // Firebase SDKs
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js',
  // Your app icons
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/icon-maskable-512x512.png'
];

// Install event: cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        
        // Use fetch + put to handle opaque (no-cors) responses from CDNs
        const cachePromises = URLS_TO_CACHE.map(url => {
            return fetch(new Request(url, { mode: 'no-cors' }))
                .then(response => cache.put(url, response))
                .catch(err => console.warn(`Failed to cache ${url}:`, err));
        });
        return Promise.all(cachePromises);
      })
  );
});

// Activate event: clean up old caches
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
    })
  );
});

// Fetch event: Apply Stale-While-Revalidate strategy
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 1. Network Only: Always fetch live data from Firestore
  if (requestUrl.hostname.includes('firestore.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Stale-While-Revalidate for all other requests
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // Fetch from network to update cache
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Check for valid response to cache
          if (networkResponse && (networkResponse.ok || networkResponse.status === 0)) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          // Network failed, just return cached response if it exists
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache and network fails, the fetch will fail
        });

        // Return cached response immediately if available,
        // otherwise wait for the network fetch to complete.
        return cachedResponse || fetchPromise;
      });
    })
  );
});