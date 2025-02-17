const CACHE_NAME = 'world-end-v1';
const STATIC_ASSETS = [
    '/styles.css',
    '/app.js',
    '/logo.jpg',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Orbitron:wght@400;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Helper function to determine if a request is for static asset
function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => url.endsWith(asset));
}

// Helper function to determine if a request is for API
function isApiRequest(url) {
    return url.includes('/api/');
}

// Fetch event - different strategies for different requests
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Skip cross-origin requests except for whitelisted domains
    if (!url.startsWith(self.location.origin) && 
        !url.startsWith('https://fonts.googleapis.com') &&
        !url.startsWith('https://cdn.jsdelivr.net')) {
        return;
    }

    // For API requests: Network-first strategy with no caching
    if (isApiRequest(url)) {
        event.respondWith(
            fetch(event.request)
                .catch(error => {
                    console.error('API fetch failed:', error);
                    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // For static assets: Cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
                })
        );
        return;
    }

    // For HTML pages: Network-first strategy
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
}); 