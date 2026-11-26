/*!
 * site-notu.js — Tüm sayfalarda footer'daki telif satırını ortak "resmî site değildir" metniyle değiştirir.
 * Kullanım: her HTML sayfasında </body> öncesine ekle:
 *   <script src="site-notu.js" defer></script>
 * Metni değiştirmek için sadece METIN'i düzenle.
 */
(function () {
  'use strict';

  var METIN = '© 2026 Eko-Log | Bu web sitesi Ekonomi ve Diyalog Topluluğu öğrencilerinin ' +
              'bağımsız girişimidir; İnönü Üniversitesi’nin resmi yayın organı değildir.';

  function uygula() {
    var footer = document.querySelector('footer');

    // Footer'ı olmayan sayfalarda aynı görünümde bir footer oluştur
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
      // Mevcut "© ... İnönü Üniversitesi Ekonomi ve Diyalog Topluluğu" satırını bul
      var adaylar = wrap.querySelectorAll('span');
      for (var i = 0; i < adaylar.length; i++) {
        if (adaylar[i].textContent.indexOf('©') !== -1) { satir = adaylar[i]; break; }
      }
      if (!satir) {
        satir = document.createElement('span');
        wrap.insertBefore(satir, wrap.firstChild);
      }
      satir.setAttribute('data-site-notu', '1');
      satir.removeAttribute('data-k'); // çeviri/güncelleme sistemi geri yazmasın
    }

    if (satir.textContent !== METIN) satir.textContent = METIN;
    return satir;
  }

  function basla() {
    var satir = uygula();
    // Başka bir betik footer'ı yeniden yazarsa metni geri koy
    try {
      new MutationObserver(function () {
        var s = document.querySelector('footer [data-site-notu]');
        if (!s || s.textContent !== METIN) uygula();
      }).observe(document.querySelector('footer') || document.body,
                 { childList: true, subtree: true, characterData: true });
    } catch (e) {}
    return satir;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
})();
