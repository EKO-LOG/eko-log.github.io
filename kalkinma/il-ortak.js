/* il-ortak.js — Tüm il sayfaları için ortak ekler.
   Şimdilik: üstteki akan duyuru bandı (kalkınma ana sayfasındakiyle aynı, metin ../content.json içindeki "b" alanından gelir).
   İl dosyasına eklenecek tek satır (</body>'den hemen önce):  <script src="il-ortak.js" defer></script>
   Yeni ortak özellik gerekirse yalnızca bu dosya değişir. */
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
