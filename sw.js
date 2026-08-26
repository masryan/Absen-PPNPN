// Service Worker minimal untuk SIMPEG PPNPN
// Tujuan utama: memenuhi syarat "installable" PWA di Chrome/Edge Android
// (menampilkan tombol/prompt "Install App"). Tidak melakukan caching agresif
// agar data absensi & evaluasi tugas selalu diambil langsung dari server/Supabase.

const CACHE_NAME = 'simpeg-ppnpn-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Passthrough sederhana: selalu ambil dari jaringan.
// Fetch handler wajib ada agar browser menganggap halaman ini installable.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
