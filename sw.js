/* SPEGANA — service worker
 * Tujuan: perubahan file di GitHub langsung tampil tanpa muat ulang paksa,
 * dan situs bisa dipasang ke layar utama. Selalu tanya server dulu (revalidasi),
 * memakai salinan tersimpan hanya saat tidak ada koneksi. */
const CACHE = 'speganamsmg-shell-v3';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API Apps Script, font, ikon: urusan browser
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
      })
  );
});
