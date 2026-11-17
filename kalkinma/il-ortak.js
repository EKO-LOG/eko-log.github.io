/* il-ortak.js — Tüm il sayfaları için ortak ekler (tek yerden yönetilir).
   1) Açılır menü: yuvarlak logoya dokununca sağdan açılan menü (sayfada yoksa eklenir).
   2) Üstteki akan duyuru bandı: metin ../content.json içindeki "b" alanından gelir.
   İl dosyasına eklenecek tek satır (</body>'den hemen önce):  <script src="il-ortak.js" defer></script> */
(function(){
if(document.getElementById("drawer-menu-css"))return;
var H=document.querySelector("header");if(!H)return;
var st=document.createElement("style");st.id="drawer-menu-css";st.textContent="\n.brand-txt{display:none}\n@media (max-width:99999px){.brand-txt{display:inline-flex;align-items:center;flex:none;margin:0 4px 0 -4px;padding:6px 4px;text-decoration:none;white-space:nowrap;font:800 clamp(19px,5.2vw,24px)/1 \"Bricolage Grotesque\",\"Trebuchet MS\",sans-serif;letter-spacing:-.03em;background:linear-gradient(120deg,#c4202e 10%,#f0561f 70%,#ff8a3d);-webkit-background-clip:text;background-clip:text;color:transparent;transition:transform .25s,filter .25s}\n.brand-txt:hover{transform:translateY(-1px);filter:brightness(1.12)}\n.brand-txt::after{content:\"\";width:6px;height:6px;border-radius:50%;margin:6px 0 0 4px;background:#ff8a3d;flex:none}\nheader nav{min-width:0}}\n@media (max-width:99999px) and (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]) .brand-txt{background-image:linear-gradient(120deg,#ff6470 10%,#ff8f5a 65%,#ffc371)}}\n@media (max-width:99999px){:root[data-theme=\"dark\"] .brand-txt{background-image:linear-gradient(120deg,#ff6470 10%,#ff8f5a 65%,#ffc371)}}\n\n\n/* ===== Açılır menü (çekmece) · telefon ve tablet (<1100px) =====\n   Kaydırmalı üst menü yerine: Eko-Log simgesine dokun -> sağdan açılan menü sayfası.\n   Masaüstü sınırını değiştirmek için 1099px değerlerini (CSS + JS'teki matchMedia) birlikte güncelle. */\nheader .mbtn{display:none}\n@media (max-width:99999px){\nhtml.dm-on header nav{display:none!important}\nhtml.dm-on header .brand{display:none!important}\nhtml.dm-on header .mbtn{display:grid}\nhtml.dm-on header .brand-txt{display:inline-flex!important;flex:0 1 auto;margin:0 4px 0 2px}\nhtml.dm-on .eu-tools{margin-left:auto}\n}\nheader .mbtn{flex:none;width:44px;height:44px;margin:-2px 0 -2px 0;padding:0;border:0;border-radius:50%;background:transparent;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}\nheader .mbtn img{display:block;width:38px;height:38px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(255,122,69,.55);transition:width .4s,height .4s,transform .35s cubic-bezier(.22,1,.36,1),box-shadow .25s}\nheader .mbtn:active img{transform:scale(.9)}\nheader .mbtn[aria-expanded=\"true\"] img{box-shadow:0 0 0 3px var(--g2)}\nbody.eu-min header .mbtn img{width:30px;height:30px}\nbody.dm-lock{overflow:hidden}\n.dm{position:fixed;inset:0;z-index:99990;visibility:hidden;pointer-events:none;transition:visibility 0s linear .38s}\n.dm.open{visibility:visible;pointer-events:auto;transition-delay:0s}\n.dm-ov{position:absolute;inset:0;background:rgba(10,5,18,.58);opacity:0;transition:opacity .3s ease;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}\n.dm.open .dm-ov{opacity:1}\n.dm-panel{position:absolute;top:0;right:0;bottom:0;width:min(86vw,440px);display:flex;flex-direction:column;background:#1c1328;color:#f6f0fb;box-shadow:-24px 0 60px -20px rgba(0,0,0,.65);transform:translateX(100%);transition:transform .38s cubic-bezier(.22,1,.36,1);padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\n.dm.open .dm-panel{transform:none}\n.dm-top{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 22px;border-bottom:1px solid rgba(255,255,255,.2)}\n.dm-top img{width:36px;height:36px;border-radius:50%;background:#fff;flex:none}\n.dm-top b{flex:1;font:800 22px/1 \"Bricolage Grotesque\",\"Trebuchet MS\",sans-serif;letter-spacing:-.03em;background:linear-gradient(120deg,#ff6470 10%,#ff8f5a 65%,#ffc371);-webkit-background-clip:text;background-clip:text;color:transparent}\n.dm-x{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.09);color:#fff;display:grid;place-items:center;cursor:pointer;padding:0;transition:background-color .2s,transform .3s cubic-bezier(.22,1,.36,1)}\n.dm-x:hover{background:rgba(255,255,255,.16)}.dm-x:active{transform:scale(.9)}\n.dm-x svg{width:22px;height:22px}\n.dm-list{list-style:none;margin:0;padding:0;flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}\n.dm-list li{margin:0;border-bottom:1px solid rgba(255,255,255,.2)}\n.dm-list a{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:62px;padding:12px 22px;color:#f6f0fb;text-decoration:none;font:500 20px/1.25 \"Instrument Sans\",system-ui,sans-serif;-webkit-tap-highlight-color:transparent;transition:background-color .2s}\n.dm-list a:hover{background:rgba(255,255,255,.07)}\n.dm-list a:active{background:rgba(255,255,255,.13)}\n.dm-list a:focus-visible{outline:3px solid #ff8f5a;outline-offset:-3px}\n.dm-list a.on{font-weight:700;background:rgba(255,255,255,.06)}\n.dm-list a.on::before{content:\"\";position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,#ff6470,#ff8f5a)}\n.dm-list svg{width:20px;height:20px;flex:none;opacity:.85}\n@media (prefers-reduced-motion:reduce){.dm,.dm-ov,.dm-panel{transition:none}}\n@media print{.dm,header .mbtn{display:none!important}}\n\n\n/* ===== Çekmece alt menüleri =====\n   Satır = [sayfa bağlantısı] + [yuvarlak ok düğmesi]. Yazıya dokunmak sayfaya götürür,\n   yuvarlak oka dokunmak o bölümün alt sayfalarını açar/kapatır. */\nheader nav a[hidden],#site-hd nav a[hidden]{display:none!important}\n.dm-row{display:flex;align-items:center}\n.dm-row>a{flex:1 1 auto;min-width:0}\n.dm-row>a:only-child{padding-right:28px}\n.dm-row>a:only-child>svg{opacity:.55}\n.dm-list .dm-tg{flex:none;width:40px;height:40px;margin:0 16px 0 4px;padding:0;display:grid;place-items:center;border-radius:50%;border:1.5px solid rgba(255,255,255,.4);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .2s,border-color .2s,box-shadow .25s,transform .3s cubic-bezier(.22,1,.36,1)}\n.dm-list .dm-tg svg{width:18px;height:18px;opacity:1;transition:transform .32s cubic-bezier(.22,1,.36,1)}\n.dm-list .dm-tg:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.65)}\n.dm-list .dm-tg:active{transform:scale(.9)}\n.dm-list .dm-tg:focus-visible{outline:3px solid #ff8f5a;outline-offset:2px}\n.dm-item.open>.dm-row .dm-tg{background:linear-gradient(135deg,#ff6470,#ff8f5a);border-color:transparent;box-shadow:0 5px 16px -5px rgba(255,100,112,.75)}\n.dm-item.open>.dm-row .dm-tg svg{transform:rotate(180deg)}\n.dm-sub-wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1)}\n.dm-item.open>.dm-sub-wrap{grid-template-rows:1fr}\n.dm-list .dm-sub{position:relative;list-style:none;margin:0;padding:0;min-height:0;overflow:hidden;visibility:hidden;background:rgba(255,255,255,.035);transition:visibility 0s linear .32s}\n.dm-item.open>.dm-sub-wrap>.dm-sub{visibility:visible;transition-delay:0s}\n.dm-list .dm-sub::before{content:\"\";position:absolute;left:30px;top:8px;bottom:8px;width:2px;border-radius:2px;background:rgba(255,255,255,.16)}\n.dm-list .dm-sub li{margin:0;border:0}\n.dm-list .dm-sub a{min-height:48px;padding:10px 22px 10px 50px;font-size:17px;font-weight:400;color:rgba(246,240,251,.92)}\n.dm-list .dm-sub a.on{font-weight:700;color:#fff;background:rgba(255,255,255,.08)}\n.dm-list .dm-sub a.on::before{left:28px;top:12px;bottom:12px;width:5px}\n@media (prefers-reduced-motion:reduce){.dm-sub-wrap,.dm-list .dm-sub,.dm-list .dm-tg,.dm-list .dm-tg svg{transition:none}}\n\n\n/* Yatay menü çubuğu kutusu kaldırıldı: yalnızca yuvarlak logo (menü) ve Eko-Log (ana sayfa) kalır */\nheader,#site-hd{pointer-events:none!important}\nheader .bar,#site-hd .sbar{pointer-events:none;background:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;margin:0!important;max-width:none!important;width:max-content}\nheader .mbtn,header .brand-txt,#site-hd .mbtn,#site-hd .brand-txt,header .eu-tools,header .eu-tools *{pointer-events:auto}\nheader .brand-txt,#site-hd .brand-txt{text-shadow:0 1px 6px rgba(255,255,255,.55)}\n:root[data-theme=\"dark\"] header .brand-txt{text-shadow:0 1px 6px rgba(0,0,0,.5)}\nbody.eu-min header .bar{box-shadow:none!important}\n\n";document.head.appendChild(st);
var bar=H.querySelector(".bar")||H,br=H.querySelector(".brand");
if(!document.getElementById("mbtn")){var b=document.createElement("button");b.type="button";b.className="mbtn";b.id="mbtn";b.title="Menü";b.setAttribute("aria-label","Menüyü aç");b.setAttribute("aria-haspopup","dialog");b.setAttribute("aria-expanded","false");b.setAttribute("aria-controls","dmenu");bar.insertBefore(b,bar.firstChild)}
if(!H.querySelector(".brand-txt")){var t=document.createElement("a");t.className="brand-txt";t.href=br?br.getAttribute("href"):"../index.html";t.textContent="Eko-Log";if(br&&br.parentNode)br.parentNode.insertBefore(t,br.nextSibling);else bar.appendChild(t)}
(function(){
var D=document,R=D.documentElement,H=D.getElementById('site-hd')||D.querySelector('header'),nav=H&&H.querySelector('nav'),btn=D.getElementById('mbtn'),logo=H&&H.querySelector('.brand img');
if(!H||!nav||!btn)return;
var isOpen=false,lastF=null,uidN=0,mq=matchMedia('(max-width:99999px)');
function mk(t,c){var e=D.createElement(t);if(c)e.className=c;return e}
var CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5l7.5 7.5L9 19.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var DOWN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9l6.5 6.5L18.5 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var XI='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/* ---- Üyelik: sitedeki mevcut kuralla aynı (giriş yapılmış VE yönetici onaylı) ---- */
function isMember(){
  try{var s=JSON.parse(localStorage.getItem('eko_uye')||'null');
    if(s&&s.uid&&localStorage.getItem('eko_uye_ok')===s.uid)return true}catch(e){}
  return !!(D.body&&D.body.classList.contains('uye-ok'));
}
function isPlus(a){return /^eko[\s\-\u2010-\u2015]*plus$/i.test((a.textContent||'').trim())}
/* Eko-Plus bağlantısı üye değilse üstteki (yedek) menüde de görünmesin */
function syncNav(){var m=isMember();[].forEach.call(nav.querySelectorAll('a'),function(a){if(isPlus(a))a.hidden=!m})}

/* ---- Alt sayfalar: yalnızca sitede gerçekten var olan rotalar ----
   Hedef = ana öğenin dosya yolu + '#/' + rota  (her dosyada kendi göreli yoluna uyar). */
var SUB={
 'Simülasyon Merkezi':[['vaka','Vaka Analizi'],['ppk','Başkan Simülasyonu'],['borsa','Borsa Simülasyonu'],['bakan','Bakanlık Simülasyonu'],['girisim','Girişimci'],['kur','Dış Ticaret'],['burokrat','Kamu Bürokratı'],['muzakere','Müzakere Masası'],['ihale','Kamu İhalesi'],['hakimlik','Hâkimlik Simülasyonu'],['valilik','Kaymakamlık ve Valilik'],['smmm','Mali Müşavirlik']],
 'Meslekler':[['meslek','Kariyer Meslek Tanıtımı'],['kadrolar','Kariyer Kadroları'],['mulakat','Mülakat Prova Modu'],['mulakat-bilgi','Kurum Mülakatı Bilgilendirme'],['mulakat-basvuru','Mülakat Simülasyonu Başvuruları'],['quiz','Terim Quiz']],
 'İktisadi Ansiklopedi':[['sozluk','Ekonomi Sözlüğü'],['anatomi','Kavramın Anatomisi'],['efsane','İktisadi Şehir Efsaneleri'],['kisiler','İktisat Düşünürleri'],['tarih','Ekonomi Tarihi Çizelgesi'],['sektor','Sektör Dosyaları']],
 'Veri ve Pariteler':[['pariteler','Pariteler'],['veri','İktisat Grafikleri'],['hesap','Hesaplayıcılar'],['kaynak','Kaynaklar'],['ulke','Ülke Karşılaştırma'],['turkiye','Türkiye Ekonomisi Dosyaları'],['urun','Bir Ürünün Hikâyesi'],['iktisatci','İktisatçı Gözünden']],
 'Gazete ve Dergi':[['gazete','Diyalog Gazetesi'],['dergi','İktisadi Kalkınma Dergisi'],['makale','Makale Yazımı'],['ceviri','Çeviri Köşesi'],['arastirma','Ortak Araştırma Projeleri'],['arsiv','Arşiv']],
 'Etkinlikler':[['fikir','Fikir Muharebesi'],['yatay','Yatay Bakış'],['konferanslar','Konferanslar'],['arastirma','Ortak Araştırma Projeleri']]
};
/* Kalkınma, Katıl, Ana Sayfa ve Eko-Plus: alt sayfa yok → doğrudan sayfaya gider */

function norm(p){return p.replace(/index\.html$/,'').replace(/\/$/,'')}
function seg(h){return h.replace(/^#\/?/,'').split('/')[0]}
function childOn(href){
  try{var u=new URL(href,location.href);
    if(norm(u.pathname)!==norm(location.pathname))return false;
    var a=seg(u.hash);return !!a&&a===seg(location.hash)}catch(e){return false}
}

var root=mk('div','dm');root.id='dmenu';
root.innerHTML='<div class="dm-ov"></div><div class="dm-panel" role="dialog" aria-modal="true" aria-label="Ana menü"><div class="dm-top"><b>Eko-Log</b><button type="button" class="dm-x" aria-label="Menüyü kapat">'+XI+'</button></div><ul class="dm-list"></ul></div>';
/* Düğmeye ve menü başlığına mevcut logoyu kopyala (dosyaya ikinci kez gömülmez) */
if(logo){var im=logo.cloneNode(false);im.alt='';im.setAttribute('aria-hidden','true');btn.appendChild(im)}
var top=root.querySelector('.dm-top');
if(logo){var im2=logo.cloneNode(false);im2.alt='';im2.setAttribute('aria-hidden','true');top.insertBefore(im2,top.firstChild)}
D.body.appendChild(root);
var list=root.querySelector('.dm-list'),panel=root.querySelector('.dm-panel');

function setSub(li,tg,label,open){
  li.classList.toggle('open',open);
  tg.setAttribute('aria-expanded',open?'true':'false');
  tg.setAttribute('aria-label',label+(open?' alt sayfalarını kapat':' alt sayfalarını aç'));
}
function add(href,text,on,kids,base){
  var li=mk('li','dm-item'),row=mk('div','dm-row'),a=mk('a'),s=mk('span');
  a.href=href;s.textContent=text;a.appendChild(s);
  var hasKids=!!(kids&&kids.length),anyKidOn=false;
  if(!hasKids)a.insertAdjacentHTML('beforeend',CHEV);   /* düz ok = doğrudan git */
  row.appendChild(a);li.appendChild(row);
  if(hasKids){
    var id='dms'+(++uidN),tg=mk('button','dm-tg'),wrap=mk('div','dm-sub-wrap'),ul=mk('ul','dm-sub');
    tg.type='button';tg.setAttribute('aria-controls',id);tg.innerHTML=DOWN;
    ul.id=id;
    kids.forEach(function(k){
      var l=mk('li'),b=mk('a'),h=base+'#/'+k[0],o=childOn(h);
      b.href=h;b.textContent=k[1];
      if(o){b.className='on';b.setAttribute('aria-current','page');anyKidOn=true}
      l.appendChild(b);ul.appendChild(l);
    });
    wrap.appendChild(ul);li.appendChild(wrap);row.appendChild(tg);
    tg.addEventListener('click',function(){
      var willOpen=!li.classList.contains('open');
      if(willOpen)[].forEach.call(list.querySelectorAll('.dm-item.open'),function(o){
        var ot=o.querySelector('.dm-tg');if(ot)setSub(o,ot,o.getAttribute('data-l'),false)});
      setSub(li,tg,text,willOpen);
    });
    li.setAttribute('data-l',text);
    setSub(li,tg,text,anyKidOn);                          /* bulunduğun bölüm açık gelsin */
  }
  if(on||anyKidOn){a.className='on';if(on)a.setAttribute('aria-current','page')}
  list.appendChild(li);
}
/* Öğeler üstteki menüden (header nav) okunur; alt sayfalar SUB tablosundan eklenir */
function build(){
  syncNav();
  list.textContent='';
  var member=isMember();lastM=member;var h=location.hash,hb=H.querySelector('.brand'),HOME=hb?hb.getAttribute('href'):'#/',
      home=(HOME==='#/')&&(!h||h==='#'||h==='#/');
  add(HOME,'Ana Sayfa',home);
  [].forEach.call(nav.querySelectorAll('a'),function(a){
    var t=a.textContent.trim(),hr=a.getAttribute('href');
    if(!t||!hr)return;
    if(isPlus(a)){if(!member)return;add(hr,t,a.classList.contains('on'));return}   /* Eko-Plus: yalnızca onaylı üye */
    if(getComputedStyle(a).display==='none')return;
    add(hr,t,a.classList.contains('on'),SUB[t],hr.split('#')[0]);
  });
}
function openM(){
  if(isOpen)return;build();isOpen=true;lastF=D.activeElement;
  root.classList.add('open');D.body.classList.add('dm-lock');
  btn.setAttribute('aria-expanded','true');btn.setAttribute('aria-label','Menüyü kapat');
  setTimeout(function(){var x=root.querySelector('.dm-x');if(x)x.focus()},60);
}
function closeM(restore){
  if(!isOpen)return;isOpen=false;
  root.classList.remove('open');D.body.classList.remove('dm-lock');
  btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Menüyü aç');
  if(restore&&lastF&&lastF.focus)lastF.focus();
}
btn.addEventListener('click',function(){isOpen?closeM(true):openM()});
root.querySelector('.dm-ov').addEventListener('click',function(){closeM(true)});
root.querySelector('.dm-x').addEventListener('click',function(){closeM(true)});
/* Yalnızca bağlantılar menüyü kapatır; ok düğmesi sadece alt listeyi açıp kapatır */
root.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.dm-list a');if(a)closeM(false)});
D.addEventListener('keydown',function(e){
  if(!isOpen)return;
  if(e.key==='Escape'){e.preventDefault();closeM(true);return}
  if(e.key==='Tab'){
    var f=[].slice.call(root.querySelectorAll('.dm-x,.dm-list a,.dm-tg')).filter(function(x){return getComputedStyle(x).visibility!=='hidden'}),i=f.indexOf(D.activeElement);
    if(!f.length)return;
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}
    else if(!e.shiftKey&&(i===-1||i===f.length-1)){e.preventDefault();f[0].focus()}
  }
});
/* Sağa kaydırarak kapat */
var sx=0,sy=0;
panel.addEventListener('touchstart',function(e){var t=e.touches[0];sx=t.clientX;sy=t.clientY},{passive:true});
panel.addEventListener('touchend',function(e){var t=e.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);if(dx>70&&dy<50)closeM(true)},{passive:true});
addEventListener('hashchange',function(){closeM(false)});
var onMq=function(){if(!mq.matches)closeM(false)};
mq.addEventListener?mq.addEventListener('change',onMq):mq.addListener(onMq);

/* Üyelik durumu değişince (giriş/çıkış, başka sekme, geri dönüş) menü kendini günceller */
var lastM=isMember();
function refresh(){syncNav();var m=isMember();if(m!==lastM){lastM=m;if(isOpen)build()}}
addEventListener('storage',function(e){if(!e.key||e.key==='eko_uye'||e.key==='eko_uye_ok')refresh()});
addEventListener('pageshow',refresh);
addEventListener('focus',refresh);
try{new MutationObserver(refresh).observe(D.body,{attributes:true,attributeFilter:['class']})}catch(e){}
syncNav();
/* Her şey hazırsa eski kaydırmalı menüyü gizle; betik çalışmazsa eski menü kalır */
R.classList.add('dm-on');
})();
})();
(function(){
if(document.getElementById("ann"))return;
var st=document.createElement("style");st.id="ann-css";st.textContent="#ann{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(90deg,#c4202e,#ff5f8f);color:#fff;text-align:center;font:700 15px/24px system-ui;letter-spacing:.2px;padding:11px 12px;padding-top:calc(11px + env(safe-area-inset-top,0px));box-sizing:content-box}#ann.off{opacity:.45}\n#ann{overflow:hidden;white-space:nowrap}#ann>span{display:inline-block;animation:annm var(--d,20s) linear infinite;will-change:transform}#ann:hover>span,#ann:active>span{animation-play-state:paused}@keyframes annm{to{transform:translateX(-50%)}}body.adm #ann>span{animation:none}#ann b{font-weight:inherit}#ann .annsep{display:inline-block;width:9px;height:9px;margin:0 26px;vertical-align:middle;position:relative;top:-1px;background:linear-gradient(135deg,#fff3b0,#ffc83d);transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 3px #ffffff33,0 0 10px #ffd166cc;animation:annp 1.8s ease-in-out infinite}@keyframes annp{50%{transform:rotate(225deg) scale(.8);box-shadow:0 0 0 5px #ffffff1a,0 0 14px #ffd166}}\n@media(prefers-reduced-motion:reduce){#ann{white-space:normal}#ann>span{animation:none}#ann .annclone{display:none}#ann .annsep{animation:none}}\nbody.hasann header{top:calc(54px + env(safe-area-inset-top,0px))}\nbody.hasann .aurora.banner{border-top:44px solid transparent}";document.head.appendChild(st);
})();
/* Duyuru akışı: ana sayfadakiyle aynı. Metin content.json içindeki "b" alanından gelir (yönetim panelinden değiştirilir). */
(function(){
var DEF='Yeni dönem çalışma grupları açılıyor | Aramıza katılmak için WhatsApp grubumuza gel | Duyurular ve etkinlikler burada';
var URLS=['../content.json','/content.json'],B={on:true,text:DEF},an=null;
function one(u,ms){var ac=window.AbortController?new AbortController():null,tm=setTimeout(function(){if(ac)ac.abort()},ms);
 return fetch(u,{cache:'no-cache',signal:ac?ac.signal:undefined}).then(function(r){clearTimeout(tm);if(!r.ok)throw 0;return r.json()}).catch(function(e){clearTimeout(tm);throw e})}
function load(i){if(i>=URLS.length)return Promise.resolve(null);return one(URLS[i],8000).catch(function(){return null}).then(function(d){return d||load(i+1)})}
function parts(t){return String(t||'').replace(/([.!?…])\s+/g,'$1\n').split(/\n+|\s*[|•·✦]\s*|\s{2,}/).map(function(x){return x.trim()}).filter(Boolean).map(function(x){var m=x.split(/\s*=>\s*/);return{t:m[0],h:(m[1]||'').trim()}}).filter(function(x){return x.t})}
function mk(ps){var g=document.createElement('b');ps.forEach(function(x){var m;if(x.h&&/^(https?:|\/|#|\.\.?\/|[a-z0-9_-]+\.html)/i.test(x.h)){m=document.createElement('a');m.href=x.h;if(/^https?:/i.test(x.h)){m.target='_blank';m.rel='noopener'}m.style.cssText='color:inherit;text-decoration:underline;text-underline-offset:4px'}else m=document.createElement('b');m.textContent=x.t;var d=document.createElement('i');d.className='annsep';d.setAttribute('aria-hidden','true');g.append(m,d)});return g}
function fill(){var sp=an.querySelector('span'),ps=parts(B.text);sp.textContent='';if(!ps.length)return;var g=mk(ps);sp.append(g);var w=g.offsetWidth||1,k=Math.max(1,Math.ceil((an.clientWidth||innerWidth)/w));sp.textContent='';for(var i=0;i<2*k;i++){var c=mk(ps);if(i){c.className='annclone';c.setAttribute('aria-hidden','true')}sp.append(c)}an.style.setProperty('--d',Math.max(12,Math.round(k*w/60))+'s')}
function show(){if(!B||!String(B.text||'').trim())B={on:true,text:DEF};var on=!!B.on;if(!on)return;an=document.createElement('div');an.id='ann';an.setAttribute('role','region');an.setAttribute('aria-label','Duyurular');an.innerHTML='<span></span>';document.body.prepend(an);document.body.classList.add('hasann');fill();
 var t;addEventListener('resize',function(){clearTimeout(t);t=setTimeout(fill,200)})}
load(0).then(function(d){if(d&&d.b)B=d.b;show()});
})();
