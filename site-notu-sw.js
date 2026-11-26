/*!
 * site-notu-sw.js — TEK DOSYA, TUM SAYFALAR.
 *
 * Kurulum (bir kerelik):
 *   1) Bu dosyayi site kokune (sw.js'in yanina) yukle.
 *   2) sw.js'in EN USTUNE su satiri ekle:
 *        importScripts('site-notu-sw.js');
 *
 * Bundan sonra sitedeki HER HTML sayfasi (simdiki ve ileride eklenecek olanlar dahil)
 * tarayiciya giderken notu otomatik olarak icine alir. Sayfalara dokunmak gerekmez.
 * Metni degistirmek icin sadece asagidaki METIN'i duzenle.
 */
var METIN = '© 2026 Eko-Log | Bu web sitesi Ekonomi ve Diyalog Topluluğu öğrencilerinin ' +
            'bağımsız girişimidir; İnönü Üniversitesi’nin resmi yayın organı değildir.';

/* ---- Sayfada calisan kisim (SW bunu her sayfaya gomer) ---- */
function sayfaNotu(METIN) {
  'use strict';
  var css = document.createElement('style');
  css.textContent = '@media screen{body:has(.page.sim.on) footer{display:block!important}}';
  document.head.appendChild(css);

  function uygula() {
    var footer = document.querySelector('footer');
    if (!footer) {
      var cs = getComputedStyle(document.body);
      if (cs.overflowY === 'hidden') return;               // sabit yukseklikli uygulama ekrani (sohbet vb.)
      var sabit = cs.display === 'flex' || cs.display === 'inline-flex' || cs.display === 'grid';
      var st = document.createElement('style');
      st.textContent =
        'footer.site-notu-footer{background:#1a0b1f;color:#cdbfe0;padding:28px 0 calc(34px + env(safe-area-inset-bottom,0px));font:15px/1.6 "Instrument Sans",system-ui,sans-serif}' +
        'footer.site-notu-footer .wrap{max-width:1100px;margin:0 auto;padding:0 22px}' +
        (sabit ? 'footer.site-notu-footer{position:fixed;left:0;right:0;bottom:0;z-index:5;font-size:12px;line-height:1.45;padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px))}' +
                 'footer.site-notu-footer .wrap{padding:0 14px}' : '');
      document.head.appendChild(st);
      if (sabit) document.body.style.paddingBottom = 'calc(64px + env(safe-area-inset-bottom,0px))';
      footer = document.createElement('footer');
      footer.className = 'site-notu-footer';
      var w = document.createElement('div');
      w.className = 'wrap';
      footer.appendChild(w);
      document.body.appendChild(footer);
    }
    var wrap = footer.querySelector('.wrap') || footer;
    var satir = footer.querySelector('[data-site-notu]');
    if (!satir) {
      var adaylar = wrap.querySelectorAll('span');
      for (var i = 0; i < adaylar.length; i++) {
        if (adaylar[i].textContent.indexOf('\u00a9') !== -1) { satir = adaylar[i]; break; }
      }
      if (!satir) { satir = document.createElement('span'); wrap.insertBefore(satir, wrap.firstChild); }
      satir.setAttribute('data-site-notu', '1');
      satir.removeAttribute('data-k');
    }
    if (satir.textContent !== METIN) satir.textContent = METIN;
  }

  function basla() {
    uygula();
    if (!document.querySelector('footer')) return;
    try {
      new MutationObserver(function () {
        var s = document.querySelector('footer [data-site-notu]');
        if (!s || s.textContent !== METIN) uygula();
      }).observe(document.querySelector('footer'), { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
}

/* ---- Service worker kismi: her HTML sayfaya notu ekler ---- */
(function () {
  'use strict';
  function kacis(s) {   // ASCII disi karakterleri \uXXXX yap: sayfa charset'inden bagimsiz olsun
    return s.replace(/[\u0080-\uffff]/g, function (c) {
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  }
  var ETIKET = '<script id="site-notu-js">(' + sayfaNotu.toString().replace(/<\/script/gi, '<\\/script') +
               ')(' + kacis(JSON.stringify(METIN)) + ');</script>\n';

  // Son </body> konumu. (toLowerCase() kullanma: 'İ' gibi harfler uzunlugu degistirip konumu kaydirir.)
  function sonBody(m) {
    var re = /<\/body\s*>/gi, x, i = -1;
    while ((x = re.exec(m))) i = x.index;
    return i;
  }

  self.addEventListener('install', function () { self.skipWaiting(); });
  self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

  self.addEventListener('fetch', function (e) {
    var r = e.request;
    if (r.mode !== 'navigate' || r.method !== 'GET') return;
    e.stopImmediatePropagation();           // sw.js'teki diger fetch dinleyicileriyle cakismasin
    e.respondWith(isle(r));
  });

  async function isle(r) {
    var res;
    try { res = await fetch(r); }
    catch (err) {                           // cevrimdisi: onbellekteki sayfayi kullan
      res = await caches.match(r, { ignoreSearch: true });
      if (!res) throw err;
    }
    var tur = res.headers.get('content-type') || '';
    if (res.status !== 200 || tur.toLowerCase().indexOf('text/html') === -1) return res;

    var metin = await res.text();
    if (metin.indexOf('site-notu-js') === -1) {
      var i = sonBody(metin);
      metin = i === -1 ? metin + '\n' + ETIKET : metin.slice(0, i) + ETIKET + metin.slice(i);
    }
    var h = new Headers(res.headers);
    h.delete('content-length');             // govde degisti
    h.delete('content-encoding');           // fetch govdeyi zaten acti
    return new Response(metin, { status: res.status, statusText: res.statusText, headers: h });
  }
})();
