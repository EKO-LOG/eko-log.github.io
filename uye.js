/* Eko-Log · ortak üyelik betiği (uye.js)
   Tüm sayfalar bunu tek satırla çağırır; giriş / üye ol / profil / üye menüsü burada yaşar.
   Eski sistemle AYNI anahtarları kullanır (localStorage: eko_uye, eko_uye_ok) ve aynı Firebase'e yazar,
   bu yüzden Laboratuvar, Mevzuat, Veri Analizi gibi sayfaların kendi kapıları da çalışmaya devam eder. */
(function () {
  'use strict';
  if (window.__ekoUye) return;
  /* sayfa başka bir sayfanın içine gömülüyse (iframe) üst sayfadaki düğmeler yeter */
  try { if (window.parent !== window && window.parent.__ekoUye) return; } catch (e) {}
  window.__ekoUye = 1;
  var D = document;
  var SRC = (D.currentScript && D.currentScript.src) || '';
  var ROOT = SRC.split('?')[0].replace(/[^\/]*$/, '');
  var DBU = String(window.EKO_DB || 'https://eko-log-b902a-default-rtdb.europe-west1.firebasedatabase.app').replace(/\/+$/, '');
  var KEY = String(window.EKO_KEY || 'AIzaSyDNwfakrjOuMx0YlonGfOBvk1_hAWiUyk0');

  /* ---------- üye alanı bağlantıları ---------- */
  var FEATURES = [
    ['🧪', 'Laboratuvar', ROOT + 'eko-plus/iibf-laboratuvar.html'],
    ['📜', 'Mevzuat', ROOT + 'mevzuat/'],
    ['📊', 'Veri Analizi', ROOT + 'eko-plus/veri-analizi.html'],
    ['💬', 'Soru-Cevap', ROOT + 'eko-plus/#/forum'],
    ['🧰', 'Diğer üye araçları', ROOT + 'eko-plus/#/ekstra']
  ];
  var LOPT = [['isletme', 'İşletme & Finans', ['isletme']], ['iktisat', 'İktisat', ['iktisat']], ['ekonometri', 'Ekonometri', ['ekonometri']], ['maliye', 'Maliye & Vergi', ['maliye']], ['kamu', 'Kamu Yönetimi', ['kamu']], ['uluslararasi', 'Uluslararası İlişkiler', ['uluslararasi']], ['ceko', 'Çalışma Ekonomisi ve Endüstri İlişkileri', ['ceko']], ['siyaset-kamu', 'Siyaset Bilimi ve Kamu Yönetimi', ['kamu']], ['siyaset-ub', 'Siyaset Bilimi ve Uluslararası İlişkiler', ['uluslararasi']]];
  var lpick = function (k) { return LOPT.filter(function (x) { return x[0] === k; })[0] || ['', '', []]; };
  var lbyname = function (n) { return LOPT.filter(function (x) { return x[1] === n; })[0]; };
  var EMAIL_RE = /^[^@\s]+@([a-z0-9-]+\.)*inonu\.edu\.tr$/i;
  var hk = function (e) { return String(e || '').trim().toLowerCase().replace(/\./g, ','); };

  /* ---------- oturum ---------- */
  var S = null;
  try { S = JSON.parse(localStorage.getItem('eko_uye') || 'null'); } catch (e) {}
  var loadedMember = isOk();
  var ST = { role: S ? (isOk() ? 'member' : 'pending') : 'guest', rec: null, ver: false, admin: false, hoca: false };

  function isOk() { try { return !!(S && S.uid && localStorage.getItem('eko_uye_ok') === S.uid); } catch (e) { return false; } }
  function keep() {
    try {
      if (S) localStorage.setItem('eko_uye', JSON.stringify(S));
      else { localStorage.removeItem('eko_uye'); localStorage.removeItem('eko_uye_ok'); }
    } catch (e) {}
  }
  var MS = { EMAIL_EXISTS: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.', WEAK_PASSWORD: 'Parola en az 6 karakter olmalı.', INVALID_LOGIN_CREDENTIALS: 'E-posta ya da parola hatalı.', INVALID_PASSWORD: 'E-posta ya da parola hatalı.', EMAIL_NOT_FOUND: 'E-posta ya da parola hatalı.', INVALID_EMAIL: 'E-posta adresi geçersiz.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.', OPERATION_NOT_ALLOWED: 'Üyelik girişi henüz açık değil. Yönetici Firebase’de E-posta/Parola girişini açmalı.', USER_DISABLED: 'Bu hesap devre dışı bırakıldı.', CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Güvenlik için çıkış yapıp yeniden giriş yaptıktan sonra tekrar dene.', INVALID_ID_TOKEN: 'Oturum süresi doldu, yeniden giriş yap.' };
  function msg(c) { c = String(c || ''); for (var k in MS) if (c.indexOf(k) > -1) return MS[k]; return 'İşlem yapılamadı (' + c + ').'; }
  var NET = 'Sunucuya ulaşılamadı. İnternetini kontrol et.';
  function idt(p, b) {
    return fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + p + '?key=' + encodeURIComponent(KEY), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .catch(function () { throw new Error(NET); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(msg(j.error && j.error.message)); return j; }); });
  }
  function tok() {
    if (!S) return Promise.reject(new Error('auth'));
    if (Date.now() < S.exp) return Promise.resolve(S.t);
    return fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(KEY), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.r) })
      .catch(function () { throw new Error(NET); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { S = null; keep(); throw new Error('auth'); }
          S.t = j.id_token; S.r = j.refresh_token; S.exp = Date.now() + (Number(j.expires_in || 3600) - 90) * 1e3; keep();
          return S.t;
        });
      });
  }
  function db(p, m, b, q) {
    return tok().then(function (t) {
      return fetch(DBU + '/' + p + '.json?' + (q ? q + '&' : '') + 'auth=' + encodeURIComponent(t), { method: m || 'GET', cache: 'no-store', headers: b !== undefined ? { 'Content-Type': 'application/json' } : {}, body: b !== undefined ? JSON.stringify(b) : undefined })
        .catch(function () { throw new Error('Veritabanına ulaşılamadı. İnternetini kontrol et.'); })
        .then(function (r) {
          if (r.status === 401 || r.status === 403) throw new Error('perm');
          if (!r.ok) throw new Error('Veritabanı beklenmedik bir yanıt verdi (' + r.status + ').');
          return r.json();
        });
    });
  }
  function setS(j, email, name) { S = { t: j.idToken, r: j.refreshToken, exp: Date.now() + (Number(j.expiresIn || 3600) - 90) * 1e3, uid: j.localId, e: email, n: name || '' }; keep(); }

  /* üyelik durumunu sunucudan çöz: yönetici / hoca / onaylı üye / bekleyen */
  function check() {
    if (!S) { ST = { role: 'guest', rec: null, ver: false, admin: false, hoca: false }; return Promise.resolve(ST); }
    var st = { role: 'pending', rec: null, ver: false, admin: false, hoca: false };
    return tok().then(function () {
      return db('uyeler', 'GET', undefined, 'shallow=true').then(function () { st.admin = true; }, function (e) { if (e.message !== 'perm') throw e; });
    }).then(function () {
      if (st.admin) return;
      return db('hoca/' + hk(S.e)).then(function (h) { if (h) { st.hoca = true; st.rec = h; } }, function (e) { if (e.message !== 'perm') throw e; });
    }).then(function () {
      if (st.admin || st.hoca) { st.role = 'member'; return; }
      return idt('lookup', { idToken: S.t }).then(function (lk) {
        st.ver = !!(lk.users && lk.users[0] && lk.users[0].emailVerified);
        return db('uyeler/' + S.uid);
      }).then(function (rec) {
        if (!rec) { rec = { n: S.n || S.e.split('@')[0], e: S.e, b: '', c: '', s: 'bekliyor', d: Date.now() }; return db('uyeler/' + S.uid, 'PUT', rec).then(function () { return rec; }); }
        return rec;
      }).then(function (rec) {
        st.rec = rec;
        st.role = (rec.s === 'onay' && st.ver) ? 'member' : (rec.s === 'red' ? 'rejected' : 'pending');
      });
    }).then(function () {
      if (st.admin || st.hoca) st.ver = true;
      try { if (st.role === 'member') localStorage.setItem('eko_uye_ok', S.uid); else localStorage.removeItem('eko_uye_ok'); } catch (e) {}
      if (st.rec && st.rec.n) { S.n = st.rec.n; keep(); }
      ST = st; return st;
    }).catch(function (e) {
      if (e.message === 'auth' || /INVALID_ID_TOKEN|TOKEN_EXPIRED/.test(e.message)) { S = null; keep(); ST = { role: 'guest', rec: null, ver: false, admin: false, hoca: false }; return ST; }
      ST.error = e.message === 'perm' ? 'Üyelik kaydı okunamadı. Yönetici veritabanı kurallarını yayınlamış olmalı.' : e.message;
      return ST;
    });
  }

  /* ---------- stil ---------- */
  var css = [
    '.uye-box{display:flex;align-items:center;gap:6px;margin-left:auto;flex:none;position:relative}',
    'nav~.uye-box{margin-left:6px}',
    '.uye-b{font:600 14px/1 "Instrument Sans",system-ui,sans-serif;border:1px solid var(--line,#e5d8dc);background:var(--surf,#fff);color:var(--ink,#1d1526);border-radius:999px;padding:10px 15px;cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:6px}',
    '.uye-b:hover{border-color:var(--red,#c4202e)}',
    '.uye-b.pri{background:linear-gradient(135deg,var(--g1,#c4202e),var(--g2,#ff7a45));color:#fff;border-color:transparent}',
    '.uye-av{width:36px;height:36px;border-radius:50%;padding:0;justify-content:center;background:linear-gradient(135deg,var(--g1,#c4202e),var(--g2,#ff7a45));color:#fff;border-color:transparent;font-weight:800}',
    '.uye-dot{position:absolute;right:-1px;top:-1px;width:11px;height:11px;border-radius:50%;background:#f59e0b;border:2px solid var(--surf,#fff)}',
    '.uye-menu{position:absolute;right:0;top:calc(100% + 10px);min-width:230px;background:var(--surf,#fff);color:var(--ink,#1d1526);border:1px solid var(--line,#e5d8dc);border-radius:18px;box-shadow:0 20px 50px -14px rgba(30,10,40,.4);padding:8px;z-index:60}',
    '.uye-menu[hidden]{display:none}',
    '.uye-menu a,.uye-menu button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:10px 12px;border-radius:12px;border:0;background:none;color:inherit;font:600 15px "Instrument Sans",system-ui,sans-serif;text-decoration:none;cursor:pointer}',
    '.uye-menu a:hover,.uye-menu button:hover{background:var(--soft,#f5ecef)}',
    '.uye-menu hr{border:0;border-top:1px solid var(--line,#e5d8dc);margin:6px 4px}',
    '.uye-menu .who{padding:8px 12px 6px;font-size:13px;color:var(--mut,#6a5f76);line-height:1.35;word-break:break-word}',
    '.uye-menu .who b{display:block;color:var(--ink,#1d1526);font-size:15px}',
    '@media (max-width:560px){.uye-b{padding:9px 11px;font-size:13px}.uye-lab{display:none}}',
    '.uye-ov{position:fixed;inset:0;z-index:100000;background:rgba(18,8,26,.55);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(20px,env(safe-area-inset-top,0px)) 14px 30px}',
    '.uye-modal{width:100%;max-width:480px;margin:auto;background:var(--surf,#fff);color:var(--ink,#1d1526);border:1px solid var(--line,#e5d8dc);border-radius:26px;box-shadow:0 30px 80px -20px rgba(20,0,30,.6);padding:24px 22px;font:16px/1.5 "Instrument Sans",system-ui,sans-serif}',
    '.uye-modal h2{font:800 24px/1.1 "Bricolage Grotesque",sans-serif;margin:0 0 6px}',
    '.uye-modal h3{font:700 16px/1.2 "Bricolage Grotesque",sans-serif;margin:20px 0 8px}',
    '.uye-modal p.n{margin:0 0 12px;color:var(--mut,#6a5f76);font-size:14.5px}',
    '.uye-x{float:right;border:0;background:var(--soft,#f5ecef);color:inherit;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;line-height:1}',
    '.uye-tabs{display:flex;gap:6px;margin:14px 0}',
    '.uye-tabs button{flex:1}',
    '.uye-tabs .on{background:var(--ink,#1d1526);color:var(--surf,#fff);border-color:transparent}',
    '.uye-f{display:block;margin:10px 0 0;font-weight:600;font-size:14px}',
    '.uye-f input,.uye-f select{display:block;width:100%;margin-top:5px;padding:12px 14px;border:1px solid var(--line,#e5d8dc);border-radius:14px;background:var(--bg,#fbf6f7);color:var(--ink,#1d1526);font:400 16px "Instrument Sans",system-ui,sans-serif}',
    '.uye-f input[readonly]{opacity:.7}',
    '.uye-f input:focus,.uye-f select:focus{outline:3px solid var(--g2,#ff7a45);outline-offset:1px}',
    '.uye-go{margin-top:16px;width:100%;justify-content:center;padding:13px 16px;font-size:16px}',
    '.uye-go:disabled{opacity:.6;cursor:wait}',
    '.uye-m{margin:12px 0 0;padding:10px 12px;border-radius:12px;font-size:14px;background:var(--soft,#f5ecef)}',
    '.uye-m.ok{background:#e6f6ec;color:#14532d}.uye-m.er{background:#fde8ea;color:#8a1020}',
    '.uye-m[hidden]{display:none}',
    '.uye-st{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px;font-size:14.5px}',
    '.uye-st li{display:flex;gap:10px;align-items:flex-start}.uye-st b{width:22px;flex:none;text-align:center}',
    '.uye-pf{display:flex;gap:14px;align-items:center;margin:14px 0 4px}',
    '.uye-pf .uye-av{width:56px;height:56px;font-size:22px}',
    '.uye-pf b{display:block;font-size:18px}.uye-pf span{color:var(--mut,#6a5f76);font-size:14px;word-break:break-all}',
    '.uye-chip{display:inline-block;margin-top:4px;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:700;background:var(--soft,#f5ecef)}',
    '.uye-link{background:none;border:0;color:var(--red,#c4202e);font:600 14px inherit;cursor:pointer;padding:6px 0;text-decoration:underline}',
    '.uye-cta{margin:18px auto;max-width:460px;text-align:center;padding:26px 20px;border:1px solid var(--line,#e5d8dc);border-radius:24px;background:var(--surf,#fff);color:var(--ink,#1d1526)}',
    '.uye-cta h3{font:800 22px "Bricolage Grotesque",sans-serif;margin:0 0 6px}.uye-cta p{margin:0 0 14px;color:var(--mut,#6a5f76)}',
    '.uye-cta .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}'
  ].join('\n');
  var st = D.createElement('style'); st.id = 'uye-css'; st.textContent = css; (D.head || D.documentElement).appendChild(st);

  /* ---------- küçük yardımcılar ---------- */
  function h(tag, a) {
    var e = D.createElement(tag), k = [].slice.call(arguments, 2);
    for (var x in (a || {})) {
      var v = a[x];
      if (x === 'text') e.textContent = v;
      else if (x.slice(0, 2) === 'on') e.addEventListener(x.slice(2), v);
      else if (v === true) e.setAttribute(x, '');
      else if (v !== false && v != null) e.setAttribute(x, v);
    }
    k.forEach(function (c) { [].concat(c).forEach(function (n) { if (n != null && n !== false) e.append(n); }); });
    return e;
  }
  var initials = function () { var n = (S && (S.n || S.e)) || '?'; var p = n.trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toLocaleUpperCase('tr'); };
  var roleLabel = function () { return ST.admin ? 'Yönetici' : ST.hoca ? 'Hoca' : 'Üye'; };

  /* ---------- üst menü: Giriş yap / Üye ol  ·  Laboratuvar + üye menüsü ---------- */
  var box = null, menu = null;
  function mountBox() {
    var bar = D.querySelector('header .bar') || D.querySelector('header');
    if (!bar) return;
    if (!box) { box = h('div', { class: 'uye-box' }); }
    if (box.parentNode !== bar) bar.appendChild(box);
    renderBox();
  }
  function renderBox() {
    if (!box) return;
    box.replaceChildren();
    if (!S) {
      box.append(
        h('button', { class: 'uye-b', type: 'button', onclick: function () { openAuth('in'); } }, 'Giriş yap'),
        h('button', { class: 'uye-b pri', type: 'button', onclick: function () { openAuth('up'); } }, 'Üye ol')
      );
      return;
    }
    var mem = ST.role === 'member';
    if (mem) box.append(h('a', { class: 'uye-b pri uye-lab', href: FEATURES[0][2] }, '🧪 Laboratuvar'));
    var av = h('button', { class: 'uye-b uye-av', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Üye menüsü', title: S.n || S.e, text: initials() });
    if (!mem) av.append(h('span', { class: 'uye-dot', title: 'Üyelik onayı bekleniyor' }));
    menu = h('div', { class: 'uye-menu', role: 'menu', hidden: true },
      h('div', { class: 'who' }, h('b', { text: S.n || S.e }), S.e),
      mem ? [h('hr')].concat(FEATURES.map(function (f) { return h('a', { href: f[2], role: 'menuitem' }, f[0] + ' ' + f[1]); })) : h('div', { class: 'who', text: 'Üyeliğin onaylanınca Laboratuvar ve diğer özellikler burada açılır.' }),
      h('hr'),
      h('button', { type: 'button', role: 'menuitem', onclick: function () { closeMenu(); openProfile(); } }, '👤 Profilim'),
      h('button', { type: 'button', role: 'menuitem', onclick: function () { logout(); } }, '↩ Çıkış yap')
    );
    av.addEventListener('click', function (e) { e.stopPropagation(); var open = menu.hidden; menu.hidden = !open; av.setAttribute('aria-expanded', String(open)); });
    box.append(av, menu);
  }
  function closeMenu() { if (menu) { menu.hidden = true; var b = box && box.querySelector('.uye-av'); if (b) b.setAttribute('aria-expanded', 'false'); } }
  D.addEventListener('click', function (e) { if (menu && !menu.hidden && !(box && box.contains(e.target))) closeMenu(); });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeModal(); } });

  /* ---------- pencere ---------- */
  var ov = null, lastFocus = null;
  function closeModal() { if (ov) { ov.remove(); ov = null; D.documentElement.style.overflow = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} } }
  function modal(title, nodes) {
    if (!ov) {
      lastFocus = D.activeElement;
      ov = h('div', { class: 'uye-ov', onmousedown: function (e) { if (e.target === ov) closeModal(); } });
      D.body.appendChild(ov); D.documentElement.style.overflow = 'hidden';
    }
    var m = h('div', { class: 'uye-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'uye-t' },
      h('button', { class: 'uye-x', type: 'button', 'aria-label': 'Kapat', onclick: closeModal, text: '×' }),
      h('h2', { id: 'uye-t', text: title }), nodes);
    ov.replaceChildren(m);
    var f = m.querySelector('input,select,button.uye-go'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
    return m;
  }
  function note(o, t, kind) { o.textContent = t; o.hidden = !t; o.className = 'uye-m' + (kind ? ' ' + kind : ''); }
  function fld(id, label, type, o) { return h('label', { class: 'uye-f', for: id }, label, h('input', Object.assign({ id: id, type: type, autocomplete: 'off' }, o || {}))); }
  function reloadSoon() { setTimeout(function () { location.reload(); }, 350); }

  /* giriş / üye ol / parola sıfırla */
  function openAuth(tab) {
    tab = tab || 'in';
    var sg = tab === 'up', fg = tab === 'fg';
    var out = h('p', { class: 'uye-m', role: 'alert', hidden: true });
    var btn = h('button', { class: 'uye-b pri uye-go', type: 'submit', text: fg ? 'Sıfırlama bağlantısı gönder' : sg ? 'Üye ol' : 'Giriş yap' });
    var sel = h('select', { id: 'u-b', required: true }, h('option', { value: '', text: 'Bölümünü seç' }), LOPT.map(function (x) { return h('option', { value: x[0], text: x[1] }); }));
    var f = h('form', { novalidate: true },
      sg ? fld('u-n', 'Ad soyad', 'text', { autocomplete: 'name', maxlength: '80' }) : null,
      sg ? h('label', { class: 'uye-f', for: 'u-b' }, 'Bölüm', sel) : null,
      sg ? fld('u-c', 'Sınıf', 'text', { maxlength: '40', placeholder: 'Örn. 2. sınıf' }) : null,
      fld('u-e', 'Üniversite e-postası', 'email', { autocomplete: 'username', inputmode: 'email', placeholder: 'ad.soyad@ogr.inonu.edu.tr' }),
      fg ? null : fld('u-p', 'Parola', 'password', { autocomplete: sg ? 'new-password' : 'current-password', minlength: '6' }),
      h('p', { class: 'n', style: 'margin-top:10px', text: sg ? 'Yalnızca inonu.edu.tr uzantılı e-postalar kabul edilir. Başvurun yönetici onayından geçince Laboratuvar ve diğer özellikler açılır; e-postanı da doğrulaman gerekir.' : fg ? 'Parolanı sıfırlamak için kayıtlı e-postanı yaz.' : 'Üyeliğin henüz onaylanmadıysa giriş yapınca durumunu Profilim’de görürsün.' }),
      btn, out,
      sg || fg ? null : h('button', { class: 'uye-link', type: 'button', onclick: function () { openAuth('fg'); } }, 'Parolamı unuttum')
    );
    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); note(out, '');
      var v = function (id) { var x = f.querySelector('#' + id); return x ? x.value.trim() : ''; };
      var em = v('u-e').toLowerCase(), pw = fg ? '' : f.querySelector('#u-p').value;
      if (sg && !EMAIL_RE.test(em)) return note(out, 'Üniversite e-postanı yaz (…@inonu.edu.tr ya da …@ogr.inonu.edu.tr).', 'er');
      if (!/^\S+@\S+\.\S+$/.test(em)) return note(out, 'E-posta adresi geçersiz.', 'er');
      if (!fg && pw.length < 6) return note(out, 'Parola en az 6 karakter olmalı.', 'er');
      if (sg && v('u-n').length < 3) return note(out, 'Ad soyadını yaz.', 'er');
      if (sg && !v('u-b')) return note(out, 'Bölümünü seç.', 'er');
      btn.disabled = true;
      var p;
      if (fg) {
        p = idt('sendOobCode', { requestType: 'PASSWORD_RESET', email: em }).then(function () { note(out, 'Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen ve gereksiz kutunu kontrol et.', 'ok'); });
      } else if (sg) {
        var lp = lpick(v('u-b'));
        p = idt('signUp', { email: em, password: pw, returnSecureToken: true }).then(function (j) {
          setS(j, em, v('u-n'));
          return idt('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: j.idToken }).catch(function () {}).then(function () {
            return db('uyeler/' + S.uid, 'PUT', { n: v('u-n'), e: em, b: lp[1], l: lp[2][0] || '', ll: lp[2].reduce(function (o, k) { o[k] = true; return o; }, {}), c: v('u-c'), s: 'bekliyor', d: Date.now() }).catch(function () {});
          });
        }).then(afterAuth);
      } else {
        p = idt('signInWithPassword', { email: em, password: pw, returnSecureToken: true }).then(function (j) { setS(j, em, ''); }).then(afterAuth);
      }
      p.catch(function (e) { note(out, e.message === 'auth' ? 'Oturum açılamadı.' : e.message, 'er'); }).then(function () { btn.disabled = false; });
    });
    var tb = function (k, t) { return h('button', { class: 'uye-b' + (tab === k ? ' on' : ''), type: 'button', 'aria-pressed': String(tab === k), onclick: function () { openAuth(k); }, text: t }); };
    modal(fg ? 'Parolamı unuttum' : sg ? 'Üye ol' : 'Giriş yap', [h('p', { class: 'n', text: 'İİBF Laboratuvarı, Mevzuat, Veri Analizi ve diğer üye özellikleri onaylı üyelere açıktır.' }), fg ? null : h('div', { class: 'uye-tabs' }, tb('in', 'Giriş yap'), tb('up', 'Üye ol')), f]);
  }
  function afterAuth() {
    return check().then(function (s) {
      renderBox();
      if (s.role === 'member') { closeModal(); reloadSoon(); }
      else openProfile(S ? 'Giriş yapıldı. Üyeliğin henüz aktif değil; aşağıda durumunu görebilirsin.' : '');
    });
  }
  function logout() { S = null; ST = { role: 'guest', rec: null, ver: false, admin: false, hoca: false }; keep(); try { sessionStorage.removeItem('eko_tk'); } catch (e) {} closeMenu(); closeModal(); renderBox(); reloadSoon(); }

  /* ---------- Profilim ---------- */
  function openProfile(first) {
    if (!S) return openAuth('in');
    var m = modal('Profilim', [h('p', { class: 'n', text: 'Bilgilerin yükleniyor…' })]);
    check().then(function (s) {
      renderBox();
      if (!S) return openAuth('in');
      drawProfile(s, first);
    });
  }
  function drawProfile(s, first) {
    var rec = s.rec || {}, editable = !s.admin && !s.hoca;
    var out = h('p', { class: 'uye-m', role: 'status', hidden: true });
    if (first) note(out, first, 'ok'); else if (s.error) note(out, s.error, 'er');
    var statusLine = s.role === 'member' ? ['✓', 'Üyeliğin aktif: Laboratuvar ve diğer özellikler açık'] : s.role === 'rejected' ? ['✕', 'Başvurun onaylanmadı. Sorular için topluluğa yazabilirsin.'] : ['…', 'Yönetici onayı bekleniyor'];
    var li = function (a, b) { return h('li', null, h('b', { text: a }), h('span', { text: b })); };
    var resend = s.ver ? null : h('button', { class: 'uye-link', type: 'button', text: 'Doğrulama e-postasını tekrar gönder', onclick: function () {
      tok().then(function (t) { return idt('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: t }); }).then(function () { note(out, 'Doğrulama e-postası gönderildi. Gelen ve gereksiz kutunu kontrol et.', 'ok'); }).catch(function (e) { note(out, e.message === 'auth' ? 'Oturum süresi doldu, yeniden giriş yap.' : e.message, 'er'); });
    } });

    var kids = [];
    kids.push(h('div', { class: 'uye-pf' }, h('span', { class: 'uye-b uye-av', text: initials() }), h('div', null, h('b', { text: rec.n || S.n || S.e }), h('span', { text: S.e }), h('br'), h('span', { class: 'uye-chip', text: roleLabel() }))));
    kids.push(h('ul', { class: 'uye-st' }, li(s.ver ? '✓' : '…', s.ver ? 'E-posta doğrulandı' : 'E-posta doğrulaması bekleniyor: gelen kutundaki bağlantıya bas'), li(statusLine[0], statusLine[1])), resend);
    kids.push(h('button', { class: 'uye-link', type: 'button', text: 'Durumu yenile', onclick: function () { if (S) S.exp = 0; var was = ST.role; check().then(function (n) { renderBox(); if (n.role === 'member' && was !== 'member') { closeModal(); reloadSoon(); } else drawProfile(n); }); } }));

    if (editable) {
      var cur = lbyname(rec.b);
      var sel = h('select', { id: 'p-b' }, h('option', { value: '', text: 'Bölümünü seç' }), LOPT.map(function (x) { return h('option', { value: x[0], text: x[1], selected: !!cur && cur[0] === x[0] }); }));
      var btn = h('button', { class: 'uye-b pri uye-go', type: 'submit', text: 'Bilgilerimi kaydet' });
      var form = h('form', { novalidate: true },
        fld('p-n', 'Ad soyad', 'text', { value: rec.n || S.n || '', maxlength: '80', autocomplete: 'name' }),
        h('label', { class: 'uye-f', for: 'p-b' }, 'Bölüm', sel),
        fld('p-c', 'Sınıf', 'text', { value: rec.c || '', maxlength: '40', placeholder: 'Örn. 2. sınıf' }),
        fld('p-e', 'E-posta (değiştirilemez)', 'email', { value: S.e, readonly: true }),
        btn);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var n = form.querySelector('#p-n').value.trim(), bk = form.querySelector('#p-b').value, c = form.querySelector('#p-c').value.trim();
        if (n.length < 3) return note(out, 'Ad soyadını yaz.', 'er');
        var upd = { n: n, c: c };
        if (bk) { var lp = lpick(bk); upd.b = lp[1]; upd.l = lp[2][0] || ''; upd.ll = lp[2].reduce(function (o, k) { o[k] = true; return o; }, {}); }
        btn.disabled = true;
        db('uyeler/' + S.uid, 'PATCH', upd).then(function () {
          S.n = n; keep(); ST.rec = Object.assign({}, rec, upd); renderBox(); note(out, 'Bilgilerin güncellendi.', 'ok');
        }).catch(function (e) {
          note(out, e.message === 'perm' ? 'Bilgiler kaydedilemedi: veritabanı kuralları üyelerin kendi kaydını güncellemesine izin vermiyor. Yöneticiye ilet.' : e.message === 'auth' ? 'Oturum süresi doldu, yeniden giriş yap.' : e.message, 'er');
        }).then(function () { btn.disabled = false; });
      });
      kids.push(h('h3', { text: 'Bilgilerim' }), form);
    } else {
      kids.push(h('p', { class: 'n', style: 'margin-top:14px', text: 'Yönetici ve hoca hesaplarının bilgileri yönetim panelinden yönetilir.' }));
    }

    var pb = h('button', { class: 'uye-b uye-go', type: 'submit', text: 'Parolayı güncelle' });
    var pf = h('form', { novalidate: true }, fld('p-pw', 'Yeni parola', 'password', { minlength: '6', autocomplete: 'new-password' }), pb);
    pf.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var pw = pf.querySelector('#p-pw').value;
      if (pw.length < 6) return note(out, 'Parola en az 6 karakter olmalı.', 'er');
      pb.disabled = true;
      tok().then(function (t) { return idt('update', { idToken: t, password: pw, returnSecureToken: false }); })
        .then(function () { pf.reset(); note(out, 'Parolan güncellendi.', 'ok'); })
        .catch(function (e) { note(out, e.message === 'auth' ? 'Oturum süresi doldu, yeniden giriş yap.' : e.message, 'er'); })
        .then(function () { pb.disabled = false; });
    });
    kids.push(h('h3', { text: 'Parola' }), pf, out);
    kids.push(h('button', { class: 'uye-b uye-go', type: 'button', text: 'Çıkış yap', onclick: logout }));
    modal('Profilim', kids);
  }

  /* ---------- Eko-Plus'ı sayfalardan kaldır, üyelere özel kutuları giriş durumuna bağla ---------- */
  var PLUS_RE = /Eko[\s\-\u2010-\u2015]?Plus(?:['’]([a-zçğıöşü]+))?/gi;
  var SUF = { a: 'na', e: 'ne', ta: 'nda', te: 'nde', taki: 'ndaki', teki: 'ndeki', tan: 'ndan', ten: 'nden', un: 'nın', 'ın': 'nın', 'in': 'nın', 'ün': 'nın', la: 'yla' };
  function brandText(t) {
    return t.replace(PLUS_RE, function (m, s) { return 'Üye Alanı' + (s ? '’' + (SUF[s.toLowerCase()] !== undefined ? SUF[s.toLowerCase()] : s) : ''); });
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, CODE: 1 };
  function fixText(root) {
    if (!root || !D.createTreeWalker) return;
    var base = root.nodeType === 3 ? root.parentNode : root;
    if (!base || SKIP[base.nodeName]) return;
    if (root.nodeType === 3) { if (/plus/i.test(root.nodeValue)) { var r0 = brandText(root.nodeValue); if (r0 !== root.nodeValue) root.nodeValue = r0; } return; }
    var w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return SKIP[n.parentNode.nodeName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n, list = [];
    while ((n = w.nextNode())) if (/plus/i.test(n.nodeValue)) list.push(n);
    list.forEach(function (x) { var r = brandText(x.nodeValue); if (r !== x.nodeValue) x.nodeValue = r; });
  }
  var PLUS_HREF = /(^|\/)eko-plus\/?(#\/(ekstra)?)?$/i;
  function isMem() { return ST.role === 'member'; }
  function tidy(root) {
    root = root || D;
    var q = function (s) { return [].slice.call((root.querySelectorAll ? root : D).querySelectorAll(s)); };
    /* menülerdeki Eko-Plus bağlantısı */
    q('header a, nav a, #dmenu a, .dmenu a').forEach(function (a) { if (/^Eko[\s\-\u2010-\u2015]?Plus$/i.test((a.textContent || '').trim()) || /^Üye Alanı$/.test((a.textContent || '').trim()) && PLUS_HREF.test(a.getAttribute('href') || '')) a.remove(); });
    /* ana sayfa kutuları: Eko-Plus kutusu herkesten gizli (üyede "Üye Alanı" olarak kalır), üyelere özel kutular girişsizken gizli */
    q('a.tile, a.card, a[class*="tile"]').forEach(function (a) {
      var href = a.getAttribute('href') || '', sm = a.querySelector('small'), only = sm && /Üyelere özel/i.test(sm.textContent);
      var hide = !isMem() && (only || PLUS_HREF.test(href) || /(^|\/)mevzuat\/?$/.test(href));
      if (hide) { a.hidden = true; a.style.display = 'none'; a.dataset.uyeHid = '1'; } else if (a.dataset.uyeHid === '1') { a.hidden = false; a.style.display = ''; delete a.dataset.uyeHid; }
    });
    /* sayfa içi eski giriş kutuları → başlıktaki düğmelere yönlendir */
    if (!S) q('.lb-card').forEach(function (c) {
      if (!c.querySelector('form') || c.dataset.uye) return;
      c.dataset.uye = '1';
      c.replaceChildren(h('h3', { text: 'Üyelere özel' }), h('p', { class: 'n', text: 'Bu bölümü görmek için giriş yap ya da üye ol.' }), h('div', { class: 'row', style: 'display:flex;gap:8px;justify-content:center' }, h('button', { class: 'uye-b', type: 'button', onclick: function () { openAuth('in'); }, text: 'Giriş yap' }), h('button', { class: 'uye-b pri', type: 'button', onclick: function () { openAuth('up'); }, text: 'Üye ol' })));
    });
    fixText(root === D ? D.body : root);
    if (D.title && /plus/i.test(D.title)) D.title = brandText(D.title);
  }
  /* eski sayfa içi "giriş / üye ol" düğmeleri artık aynı pencereyi açsın */
  D.addEventListener('click', function (e) {
    if (S || !e.target.closest) return;
    var t = e.target.closest('a,button'); if (!t || t.closest('.uye-box,.uye-ov,.uye-cta')) return;
    var href = t.getAttribute('href') || '';
    if (/eko-plus\/?#\/lab/i.test(href) || /^#\/lab/.test(href) || t.closest('.mzg-card')) {
      e.preventDefault(); e.stopPropagation();
      openAuth(/üye ol|kayıt/i.test(t.textContent) ? 'up' : 'in');
    }
  }, true);

  var pend = false, queue = [];
  function schedule(n) { if (n) queue.push(n); if (pend) return; pend = true; setTimeout(function () { pend = false; var q = queue; queue = []; try { mountBox(); if (q.length > 40) tidy(); else q.forEach(function (n) { if (n.isConnected !== false) tidy(n.nodeType === 1 ? n : n.parentNode); }); } catch (e) {} }, 120); }

  function start() {
    mountBox(); tidy();
    try {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 || n.nodeType === 3) { if (n.nodeType === 1 && (n.classList.contains('uye-ov') || n.classList.contains('uye-box'))) return; schedule(n); } }); });
      }).observe(D.body, { childList: true, subtree: true });
    } catch (e) {}
    /* arka planda üyelik durumunu tazele; durum değiştiyse sayfa bir kez yenilenir */
    if (S) {
      var last = 0; try { last = Number(sessionStorage.getItem('eko_uye_ts') || 0); } catch (e) {}
      if (Date.now() - last > 10 * 60 * 1e3) {
        check().then(function () {
          try { sessionStorage.setItem('eko_uye_ts', String(Date.now())); } catch (e) {}
          renderBox(); tidy();
          if (isMem() !== loadedMember) { var f = 0; try { f = Number(sessionStorage.getItem('eko_uye_rl') || 0); } catch (e) {} if (Date.now() - f > 60e3) { try { sessionStorage.setItem('eko_uye_rl', String(Date.now())); } catch (e) {} location.reload(); } }
        });
      }
    }
    addEventListener('storage', function (e) { if (!e.key || e.key === 'eko_uye' || e.key === 'eko_uye_ok') { try { S = JSON.parse(localStorage.getItem('eko_uye') || 'null'); } catch (x) { S = null; } ST.role = S ? (isOk() ? 'member' : 'pending') : 'guest'; renderBox(); tidy(); } });
    addEventListener('pageshow', function () { mountBox(); tidy(); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
  setTimeout(function () { mountBox(); tidy(); }, 800);

  window.EkoUye = { openAuth: openAuth, openProfile: openProfile, logout: logout };
})();
