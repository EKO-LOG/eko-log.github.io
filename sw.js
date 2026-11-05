/* Eko-Log çevrimdışı mod
   - Sayfalar ve içerik verisi: önce ağ (kısa zaman aşımıyla), ağ yavaşsa/yoksa önbellek
   - Diğer dosyalar (görsel, font vb.): önbellekten hemen ver, arkadan tazele */
const V = 'eko-v3';
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

/* Ağ önce; ms içinde cevap gelmezse önbellekteki kopya verilir, ağ cevabı yine de önbelleği tazeler */
function networkFirst(r, key, ms, isPage) {
  return new Promise(resolve => {
    let done = false;
    const give = x => { if (!done) { done = true; resolve(x); } };
    const t = setTimeout(() => {
      caches.match(key).then(x => { if (x) give(x); });
    }, ms);
    fetch(r).then(x => {
      clearTimeout(t);
      if (x && x.ok) { const c = x.clone(); caches.open(V).then(h => h.put(key, c)); }
      give(x);
    }).catch(() => {
      clearTimeout(t);
      caches.match(key)
        .then(x => x || (isPage ? caches.match('index.html') : null))
        .then(x => give(x || Response.error()));
    });
  });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const isPage = r.mode === 'navigate' || (r.headers.get('accept') || '').includes('text/html');
  const isData = /\/(content|[^/]+)\.json$/.test(u.pathname);
  if (isPage || isData) {
    /* sorgu parametresi (?v=...) önbelleği şişirmesin diye anahtar sadece yol */
    e.respondWith(networkFirst(r, u.origin + u.pathname, isData ? 6000 : 4000, isPage));
  } else {
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
