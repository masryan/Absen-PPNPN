// Service worker SIMPEG PPNPN Portal 439
// Tujuan utama: memenuhi syarat "installable PWA" di browser.
// Strategi: network-first untuk HTML (supaya data selalu terbaru),
// cache-first untuk aset statis (ikon, manifest) supaya app tetap
// bisa dibuka walau sinyal internet sedang lemah.

const CACHE_NAME = 'simpeg-ppnpn-439-v1';
const APP_SHELL = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {
        // Jangan gagal total kalau salah satu aset tidak ketemu saat install
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  // Hanya tangani GET; biarkan request lain (POST ke Supabase, dsb) lewat apa adanya
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan campuri request ke API/backend eksternal (Supabase, worldtimeapi, dsb)
  // -> selalu network, tidak dicache, supaya data absensi selalu real-time.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Untuk file HTML utama: coba network dulu (data/status terbaru),
  // kalau offline baru fallback ke cache.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('./absensi_kpp439_FINAL_3tim.html');
          });
        })
    );
    return;
  }

  // Aset statis lain (ikon, manifest, font lokal): cache-first
  event.respondWith(
    caches.match(req).then(function (cached) {
      return (
        cached ||
        fetch(req).then(function (res) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, resClone); });
          return res;
        })
      );
    })
  );
});
