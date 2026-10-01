/* The Mantle Library — service worker (offline-first).
   ⚠ Bump CACHE_VERSION after ANY change to any file before deploying — users
   will otherwise see stale files. */
const CACHE_VERSION = 'mantle-v50';

// App shell: everything needed to render the library fully offline.
// Audio is intentionally NOT precached (large files); it is cached on first
// play at runtime so a fresh install stays fast and small.
const PRECACHE_URLS = [
  './',
  'index.html',
  'privacy.html',
  'css/styles.css',
  'js/app.js',
  'js/normalize.js',
  'js/settings.js',
  'content/works.json',
  'fonts/DigitalKhattIndoPak.otf',
  'fonts/DigitalKhattV2.ttf',
  'manifest.webmanifest',
  'icons/favicon.ico',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/bg-tile-dark.jpg',
  'icons/bg-tile-light.jpg',
  'audio/art/art_Tawshih_Fatana_Shrub_al-Hana_Ahmad_al-Ajami_1905.jpg',
  'audio/art/art_Tawshih_Ya_Ghazalan_Ahmad_al-Ajami_1905.jpg',
  'audio/art/art_Qasida_Ala_Fi_Sabil_Allah_Pt1_Said_al-Safti_1905.jpg',
  'audio/art/art_Qasida_Ala_Fi_Sabil_Allah_Pt2_Said_al-Safti_1905.jpg',
  'audio/art/art_Qasidat_Allahu_Akbar_Ahmad_al-Mir_1907-1911.jpg',
  'audio/art/art_Hayyamatni_Tayyamatni_Ahmad_al-Mir_1907-1911.jpg',
  'audio/art/art_Surat_Yusuf_Pt1_Wadudah_al-Minyalawi_1915.jpg',
  'audio/art/art_Surat_Yusuf_Pt2_Wadudah_al-Minyalawi_1915.jpg',
  'audio/art/art_Quran_Suras_1_112_114_110_Benhamouda_1921_Sorbonne.jpg',
  'audio/art/art_Biaini_Alexis_Ben_Kori_1914_Sorbonne.jpg',
  'audio/art/art_Taravikh_Tatar_Trio_Kazan_1901_Berliner_24023.jpg',
  'audio/art/art_Surat_Al-Fatiha_Alexis_Ben_Kori_1914_Sorbonne.jpg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (name) {
          if (name !== CACHE_VERSION) return caches.delete(name);
          return undefined;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Only handle same-origin requests; this app makes no external requests.
  if (url.origin !== self.location.origin) return;

  // Audio: cache-on-first-play (runtime caching). Serve from cache when
  // present; otherwise fetch from network and store a copy for offline use.
  if (url.pathname.indexOf('/audio/') !== -1) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(event.request).then(function (cached) {
          if (cached) return cached;
          return fetch(event.request).then(function (response) {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // App shell: cache-first, with network fallback that populates the cache.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        // Offline and not cached: fall back to the app shell for navigations.
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
        throw new Error('Offline and resource not cached: ' + url.pathname);
      });
    })
  );
});
