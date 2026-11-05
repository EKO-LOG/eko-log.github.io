/* Eko-Log çevrimdışı mod: sayfalar önce ağdan gelir, ağ yoksa önbellekten açılır */
const V = 'eko-v2';
const CORE = ['./', 'index.html', 'ansiklopedi.html', 'simulasyon-merkezi.html', 'manifest.webmanifest', 'favicon.png', 'ikon-192.png', 'ikon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const isPage = r.mode === 'navigate' || (r.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    /* sayfalar: önce ağ, olmazsa önbellek, o da yoksa ana sayfa */
    e.respondWith(
      fetch(r).then(x => {
        const c = x.clone();
        caches.open(V).then(h => h.put(r, c));
        return x;
      }).catch(() => caches.match(r).then(x => x || caches.match('index.html')))
    );
  } else {
    /* diğer dosyalar: önbellekten hemen ver, arkadan tazele */
    e.respondWith(
      caches.match(r).then(hit => {
        const net = fetch(r).then(x => {
          if (x && x.ok) { const c = x.clone(); caches.open(V).then(h => h.put(r, c)); }
          return x;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
