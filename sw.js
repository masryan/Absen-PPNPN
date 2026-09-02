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

// ============================================================
// PUSH NOTIFICATION — pengingat absen masuk/pulang
// Ini bagian yang membuat notifikasi tetap bisa muncul walau
// aplikasi/tab SEDANG TERTUTUP. Payload dikirim oleh Edge Function
// "absen-reminder" di Supabase, berbentuk JSON: { title, body, tag, url }
// ============================================================
self.addEventListener('push', function (event) {
  var data = { title: 'Pengingat Absen', body: 'Jangan lupa absen ya!', tag: 'absen-reminder', url: './' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    // Payload bukan JSON valid — pakai default di atas.
  }

  var options = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: data.tag,          // notif dengan tag sama akan saling menggantikan, bukan menumpuk
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Klik notifikasi → fokus ke tab yang sudah terbuka, atau buka tab baru.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Kalau browser mencabut/memperbarui subscription secara otomatis
// (mis. mendekati kadaluarsa), coba subscribe ulang diam-diam.
// Backend akan otomatis membuang subscription lama saat pengiriman push
// gagal (lihat Edge Function absen-reminder), jadi ini hanya jaga-jaga.
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(
      event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true }
    ).catch(function () { /* biarkan; pegawai bisa aktifkan ulang lewat banner */ })
  );
});
