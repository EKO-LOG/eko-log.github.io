/*!
 * site-notu.js — Tek dosya, iki iş:
 *
 * 1) TARAYICIDA: Her sayfanın footer'ındaki telif satırını "resmi site degildir" metniyle degistirir.
 * 2) TERMINALDE:  node site-notu.js [klasor]
 *    Klasordeki (alt klasorler dahil) tum .html dosyalarina bu betigin etiketini ekler.
 *    Tekrar calistirmak guvenlidir (ekliyse dokunmaz). Betik site kokunde durmalidir.
 *
 * Metni degistirmek icin sadece METIN'i duzenle.
 */
(function () {
  'use strict';

  var METIN = '\u00a9 2026 Eko-Log | Bu web sitesi Ekonomi ve Diyalog Toplulu\u011fu \u00f6\u011frencilerinin ' +
              'ba\u011f\u0131ms\u0131z giri\u015fimidir; \u0130n\u00f6n\u00fc \u00dcniversitesi\u2019nin resmi yay\u0131n organ\u0131 de\u011fildir.';

  /* ---------- TERMINAL: tum HTML dosyalarina ekle ---------- */
  if (typeof window === 'undefined' && typeof require === 'function') {
    var fs = require('fs'), path = require('path');
    var kok = path.resolve(process.argv[2] || path.dirname(__filename));
    var betik = path.resolve(__filename);
    var eklenen = 0, atlanan = 0;

    (function gez(klasor) {
      fs.readdirSync(klasor, { withFileTypes: true }).forEach(function (d) {
        var yol = path.join(klasor, d.name);
        if (d.isDirectory()) {
          if (d.name !== '.git' && d.name !== 'node_modules') gez(yol);
          return;
        }
        if (!/\.html?$/i.test(d.name)) return;
        var ic = fs.readFileSync(yol, 'utf8');
        if (ic.indexOf('site-notu') !== -1) { atlanan++; return; }
        var rel = path.relative(path.dirname(yol), betik).split(path.sep).join('/');
        var etiket = '<script src="' + rel + '" defer></script>\n';
        var i = ic.toLowerCase().lastIndexOf('</body>');
        fs.writeFileSync(yol, i === -1 ? ic + '\n' + etiket : ic.slice(0, i) + etiket + ic.slice(i));
        eklenen++;
        console.log('eklendi: ' + path.relative(kok, yol));
      });
    })(kok);

    console.log('\nBitti: ' + eklenen + ' dosyaya eklendi, ' + atlanan + ' dosya zaten ekliydi.');
    return;
  }

  /* ---------- TARAYICI: footer metni ---------- */
  // Sitenin CSS'i footer'i simulasyon sayfalarinda gizliyor; ekranda goster (yazdirmada gizli kalsin)
  var css = document.createElement('style');
  css.textContent = '@media screen{body:has(.page.sim.on) footer{display:block!important}}';
  document.head.appendChild(css);

  function uygula() {
    var footer = document.querySelector('footer');

    // Footer'i olmayan sayfalarda ayni gorunumde bir footer olustur
    if (!footer) {
      var st = document.createElement('style');
      st.textContent =
        'footer.site-notu-footer{background:#1a0b1f;color:#cdbfe0;padding:28px 0 calc(34px + env(safe-area-inset-bottom,0px));font:15px/1.6 "Instrument Sans",system-ui,sans-serif}' +
        'footer.site-notu-footer .wrap{max-width:1100px;margin:0 auto;padding:0 22px}';
      document.head.appendChild(st);
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
      if (!satir) {
        satir = document.createElement('span');
        wrap.insertBefore(satir, wrap.firstChild);
      }
      satir.setAttribute('data-site-notu', '1');
      satir.removeAttribute('data-k'); // ceviri/guncelleme sistemi geri yazmasin
    }

    if (satir.textContent !== METIN) satir.textContent = METIN;
  }

  function basla() {
    uygula();
    try {
      new MutationObserver(function () {
        var s = document.querySelector('footer [data-site-notu]');
        if (!s || s.textContent !== METIN) uygula();
      }).observe(document.querySelector('footer') || document.body,
                 { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
})();
