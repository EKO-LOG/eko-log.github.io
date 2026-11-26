importScripts('site-notu-sw.js'); /* her sayfaya "resmi site degildir" notunu ekler */
/* Eko-Log service worker. Sürümü değiştirirsen eski önbellek silinir. */
const V='eko-v2',STATIC=V+'-static',PAGES=V+'-pages';
const PRE=['./','index.html','ansiklopedi.html','simulasyon-merkezi.html','eko-plus/','offline.html','manifest.webmanifest','favicon.png','icon-192.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(PAGES).then(c=>Promise.allSettled(PRE.map(u=>c.add(new Request(u,{cache:'reload'}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('eko-')&&!n.startsWith(V)).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
const fresh=(req,cache,ms)=>new Promise((ok,no)=>{
  const t=setTimeout(()=>no(new Error('timeout')),ms);
  fetch(req).then(r=>{clearTimeout(t);if(r&&r.ok){const c=r.clone();caches.open(cache).then(x=>x.put(req,c))}ok(r)},e=>{clearTimeout(t);no(e)});
});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.pathname.endsWith('/admin.html')||u.searchParams.has('admin'))return;           /* yönetim paneli hiç önbelleğe alınmaz */
  const font=/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(u.origin!==location.origin&&!font)return;                                            /* veritabanı ve API istekleri doğrudan ağa gider */
  if(font||/\.(png|jpe?g|webp|svg|ico|woff2?|css|js)$/i.test(u.pathname)){               /* statik: önce önbellek, arkada yenile */
    e.respondWith(caches.match(req).then(c=>{const n=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))caches.open(STATIC).then(x=>x.put(req,r.clone()));return r}).catch(()=>c);return c||n}));return;
  }
  /* sayfalar ve content.json: önce ağ (4 sn), olmazsa önbellek, o da yoksa çevrimdışı sayfası */
  e.respondWith(fresh(req,PAGES,4000).catch(()=>caches.match(req,{ignoreSearch:true}).then(c=>c||(req.mode==='navigate'?caches.match('offline.html'):Response.error()))).then(r=>self.siteNotuEkle(req,r)));
});
