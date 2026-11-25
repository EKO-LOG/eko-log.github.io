/* Eko-Log Asistanı · tek dosya, her sayfaya <script src="eko-bot.js" defer></script> ile eklenir.
   Ayar: sayfada window.EKO_BOT={proxy:'https://...workers.dev', bilgi:'eko-bot-bilgi.json', kampusDosya:'kampus.json', kayit:{url:'https://...'}} tanımlanabilir.
   proxy boşsa bot "arama modu"nda çalışır (sözlük/lab içinde arar, API gerekmez).
   Ders modu tamamen yerelde (kural tabanlı, yapay zekâsız) çalışır. */
(()=>{
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(e){return ''}})();
if(window.__ekoBot)return;window.__ekoBot=1;
/* ===== TEK AYAR YERİ =====
   PROXY: Cloudflare Worker adresini buraya yaz (boşsa bot "arama modu"nda çalışır).
   YOL: bilgi tabanındaki sayfa adı → sitedeki gerçek yol. Bir bağlantı 404 verirse yalnızca burayı düzelt. */
const PROXY='';
const TURNSTILE='';   /* Cloudflare Turnstile site anahtarı (isteğe bağlı; worker'da TURNSTILE_SECRET ile eşleşmeli) */
const YOL={'iibf-':'eko-plus/','bvchiindex.html':'kalkinma/'};
/* ai:false → sohbet soruları hiçbir yapay zekâya gönderilmez; yalnızca sitedeki içerik eşleşmeleri gösterilir. Açmak için sayfada window.EKO_BOT={ai:true} ya da buradaki değeri true yap (Worker'daki YAPAY_ZEKA da true olmalı). */
const CFG=Object.assign({proxy:PROXY,turnstile:TURNSTILE,bilgi:'eko-bot-bilgi.json',lig:'superlig.json',kampus:{},kampusDosya:'kampus.json',kayit:{url:'',alan:''},ad:'Eko Can',ai:false,tam:false,host:''},window.EKO_BOT||{});
const tl=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const tok=s=>tl(s).split(/[^a-z0-9]+/).filter(w=>w.length>2);

/* ---------- Bulanık eşleştirme: yazım hatası toleransı (yalnızca ilk eşleşme başarısız olursa devreye girer) ----------
   Sözcük dağarcığı kurallardan, ders kartlarından ve bilgi tabanı başlıklarından kendiliğinden dolar.
   Kural: ≥4 harfli, dağarcıkta olmayan sözcük; en yakın sözcüğe (≤5 harf: 1, daha uzun: 2 düzenleme mesafesi) çevrilir. */
const FZ=(()=>{
  const V=new Map();let ARR=null;
  const e1=(w,n)=>{if(w.length>=4){V.set(w,(V.get(w)||0)+(n||1));ARR=null}};
  const dl=(a,b,mx)=>{const la=a.length,lb=b.length;if(Math.abs(la-lb)>mx)return mx+1;
    let p2=null,p=Array.from({length:lb+1},(_,j)=>j);
    for(let i=1;i<=la;i++){const c=[i];let mn=i;
      for(let j=1;j<=lb;j++){let v=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,p2[j-2]+1);
        c[j]=v;if(v<mn)mn=v}
      if(mn>mx)return mx+1;p2=p;p=c}
    return p[lb]};
  const yakin=(w,liste)=>{
    if(!liste&&V.has(w))return w;
    const L=liste||(ARR||(ARR=[...V.keys()])),mx=w.length<=5?1:2;let best=null,bd=9,bw=-1;
    for(const c of L){const n=c.length;if(n<w.length-mx||n>w.length+mx)continue;
      const d=dl(w,c,mx);if(d>mx||(d>1&&c[0]!==w[0]))continue;
      const wt=V.get(c)||0;if(d<bd||(d===bd&&wt>bw)){best=c;bd=d;bw=wt}}
    return best};
  return{
    ekle(s){tok(s).forEach(w=>e1(w))},
    ekle1:e1,
    ekleRe(re){String((re&&re.source)||re||'').replace(/\\[a-zA-Z]|\\./g,' ').split(/[^a-zA-Z0-9]+/).forEach(w=>e1(tl(w)))},
    yakin,
    duzelt(t){let ch=false;const o=String(t).split(' ').map(w=>{if(w.length<4||/\d/.test(w)||V.has(w))return w;const y=yakin(w);if(y&&y!==w){ch=true;return y}return w}).join(' ');return{t:o,degisti:ch}},
    _boyut:()=>V.size}})();
let DB=null,IDX=null,hist=[],busy=false,KANUN=[],KRX=[],SINA=null;
const LABK=(location.pathname.match(/iibf-(iktisat|ekonometri|isletme|ceko|kamu|maliye|uluslararasi)/)||[])[1]||'genel';
const HUKUKLU=['kamu','ceko','maliye'];
const LABAD={iktisat:'İktisat',ekonometri:'Ekonometri',isletme:'İşletme & Finans',ceko:'ÇEKO',kamu:'Kamu Yönetimi',maliye:'Maliye & Vergi',uluslararasi:'Uluslararası İlişkiler'};
const DERS_ACIK=true;    /* Ders anlatımı: AÇIK. Tamamen tarayıcıda çalışır (yerel ders motoru), sunucuya ve yapay zekâya HİÇBİR istek gitmez. */
const DENEME_ACIK=false; /* 3 soruluk deneme sunucu/yapay zekâ gerektirir; bağımsız (yapay zekâsız) sürümde KAPALI. */
let MOD=DERS_ACIK&&LABK!=='genel'?'ders':'genel';
const HK=HUKUKLU.includes(LABK);
const MODLAR=Object.assign({genel:['💬','Genel']},DERS_ACIK?{ders:HK?['⚖️','Hukuk Dersi']:['🎓','Ders Anlat']}:{});
const TERCIH={genel:LABK!=='genel'?[LABAD[LABK]]:[],ders:HK?['Kamu Yönetimi','ÇEKO','Maliye & Vergi']:LABK==='genel'?[]:[LABAD[LABK]]};
const DENE='📝 3 soruluk zor deneme';
const DERSCHIP={
 kamu:['İptal davasını baştan sona anlat','Yetki unsurunu anlat','Tam yargı davası ile iptal davasını karşılaştır',DENE],
 ceko:['Sözleşmede irade sakatlığını anlat','İş sözleşmesinin feshini anlat','Zamanaşımı ile hak düşürücü süreyi karşılaştır',DENE],
 maliye:['Vergi zamanaşımını örnekle anlat','Vergilendirmede kanunilik ilkesini anlat','Vergi ziyaı cezasını anlat',DENE],
 iktisat:['Arz-talep dengesini anlat','Esneklik nedir? Örnekle anlat','Enflasyon ve Phillips eğrisini anlat',DENE],
 ekonometri:['OLS ve varsayımlarını anlat','t testi ve p değerini anlat','Çoklu doğrusal bağlantıyı anlat',DENE],
 isletme:['Net bugünkü değeri anlat','Finansal oranları anlat','Borç–alacak fişi mantığını anlat',DENE],
 uluslararasi:['Realizm ile liberalizmi karşılaştır','İnşacılığı anlat','Güvenlik ikilemini anlat',DENE],
 genel:['Bir konuyu anlat: örn. "enflasyon nedir, anlat"',DENE]};
const SAYFA_CHIP=(()=>{const p=location.pathname;
 if(/simulasyon-merkezi|nnfjindex/.test(p))return['Hangi simülasyonla başlamalıyım?','Başkan simülasyonu nedir?'];
 if(/iibf-/.test(p))return['Bu laboratuvarda neler yapabilirim?','Bu sayfadaki quizler neleri ölçüyor?'];
 if(/kalkinma/.test(p))return['Hangi illerin sayfası hazır?','Malatya ekonomisini özetle'];
 if(/mevzuat/.test(p))return['Mevzuat sayfasında hangi kanunlar var?','İYUK nedir?'];
 if(/ansiklopedi/.test(p))return['Sözlükte nasıl arama yapılır?','Düşünürler bölümünde kimler var?'];
 return['Enflasyon nedir?','Simülasyon Merkezi nerede?']})();
const MODCHIP={
 genel:['🧭 Bu sitede neler yapabilirim?','📊 Çalışmamı değerlendir','💡 Nasıl çalışmalıyım?','💼 Mezun olunca ne iş yapılır?',...SAYFA_CHIP],
 ders:DERSCHIP[LABK]||DERSCHIP.genel,
};

/* ---------- Stil: sitenin kendi CSS değişkenlerini kullanır (açık/koyu tema otomatik) ---------- */
const css=document.createElement('style');css.textContent=`
#eb-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9998;width:58px;height:58px;border:0;border-radius:50%;cursor:pointer;font-size:26px;color:#fff;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45));box-shadow:0 12px 28px -10px rgba(196,32,46,.8)}
#eb{position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9999;width:min(400px,calc(100vw - 24px));height:min(560px,calc(100vh - 120px));display:none;flex-direction:column;overflow:hidden;border-radius:24px;background:var(--surf,#fff);color:var(--ink,#1d1526);border:1px solid var(--line,#eee3e6);box-shadow:0 30px 70px -24px rgba(60,10,40,.55);font:15px/1.55 "Instrument Sans",system-ui,sans-serif}
#eb.on{display:flex}
#eb header{position:static;display:flex;align-items:center;gap:10px;padding:14px 16px;color:#fff;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45))}
#eb header b{font:700 17px "Bricolage Grotesque",sans-serif;flex:1}#eb header button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
#eb-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.eb-m{max-width:88%;padding:10px 13px;border-radius:16px;white-space:pre-wrap;word-wrap:break-word}
.eb-u{align-self:flex-end;color:#fff;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45));border-bottom-right-radius:4px}
.eb-b{align-self:flex-start;background:var(--soft,#f5ecef);border-bottom-left-radius:4px}
.eb-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.eb-src a{font-size:12.5px;padding:4px 10px;border-radius:999px;text-decoration:none;border:1px solid var(--line,#eee3e6);background:var(--surf,#fff)}
.eb-chips{display:flex;flex-wrap:wrap;gap:6px}.eb-chips button{font:inherit;font-size:13.5px;padding:7px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--line,#eee3e6);background:var(--surf,#fff);color:inherit}
#eb form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#eee3e6)}
#eb input{flex:1;font:inherit;padding:11px 14px;border-radius:999px;border:1px solid var(--line,#eee3e6);background:var(--bg,#fbf6f7);color:inherit}
#eb form button{border:0;border-radius:999px;padding:0 18px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45))}
#eb-fab[data-n]::after{content:attr(data-n);position:absolute;top:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:#fff;color:var(--g1,#c4202e);font:800 14px/22px sans-serif}#eb-fab{position:fixed}#eb-mod{display:flex;gap:6px;padding:6px 12px 0;overflow-x:auto}#eb-mod button{font:inherit;font-size:12.5px;white-space:nowrap;padding:5px 11px;border-radius:999px;cursor:pointer;border:1px solid var(--line,#eee3e6);background:var(--surf,#fff);color:inherit}#eb-mod button.on{color:#fff;border-color:transparent;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45))}.eb-w a{border-color:var(--g2,#ff7a45)!important}.eb-say{background:none;border:0;cursor:pointer;font-size:14px;opacity:.7;padding:4px 0}#eb small{padding:0 14px 8px;color:var(--mut,#6a5f76);font-size:11.5px}
/* TAM SAYFA modu (eko-bot.html): balon yok, sohbet sayfayı doldurur */
#eb.tam{position:relative!important;right:auto!important;bottom:auto!important;z-index:1;width:100%;max-width:920px;margin:0 auto;height:calc(100vh - 230px);height:calc(100dvh - 230px);min-height:460px;border-radius:22px;box-shadow:0 24px 60px -30px rgba(60,10,40,.45)}
#eb.tam header button:last-child{display:none}#eb.tam .eb-m{max-width:80%;font-size:15.5px}#eb.tam #eb-log{padding:18px}
@media(max-width:640px){#eb.tam{height:calc(100dvh - 190px);min-height:380px;border-radius:16px}#eb.tam .eb-m{max-width:92%}}`;
document.head.appendChild(css);
{const gs=document.createElement('style');gs.textContent='a[href$="gundem.html"]{display:none!important}';document.head.appendChild(gs)} /* Gündem kalıcı olarak kapalı: menü bağlantısı gizli */

const $=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const fab=$('button','',null);fab.id='eb-fab';fab.textContent='💬';fab.setAttribute('aria-label',CFG.ad+"'ı aç");
const box=$('div');box.id='eb';box.setAttribute('role','dialog');box.setAttribute('aria-label',CFG.ad);
box.innerHTML=`<header><b>${CFG.ad}</b><button id="eb-an" ${CFG.ai?'':'hidden'} style="font-size:12px;border:1px solid #fff8;border-radius:999px;padding:3px 10px" aria-label="Analiz izni">Analiz</button><button aria-label="Kapat">✕</button></header><div id="eb-log" aria-live="polite"></div><div id="eb-mod" role="tablist"></div><small>${CFG.ai?'Yapay zekâ hata yapabilir. Hukuki konularda bilgilendirme amaçlıdır; resmî metin için kaynağa bakın. Sorular ve geri bildirimler iyileştirme için kaydedilebilir.':'Bu asistan yapay zekâ kullanmaz: yalnızca sitedeki içeriklerde arama yapar ve sorularını bir sunucuya göndermez. Hukuki konularda bilgilendirme amaçlıdır; resmî metin için kaynağa bakın.'}</small><form><input placeholder="Bir kavram, simülasyon ya da sayfa sor…" autocomplete="off"><button>Gönder</button></form>`;
if(CFG.tam){(document.querySelector(CFG.host||'#eko-bot-tam')||document.body).appendChild(box)}else document.body.append(box); /* yuvarlak balon (fab) kaldırıldı: Eko Can yalnızca çekmeceli menüden (eko-bot.html tam sayfa) açılır */
/* Sitenin kendi arama düğmesi (#pl-b) sağ altta varsa botun balonunu onun hemen üstüne diz */
function yerles(){const p=document.getElementById('pl-b');let b=null;
  if(p){const r=p.getBoundingClientRect();if(r.width&&getComputedStyle(p).display!=='none'&&r.top>innerHeight/2)b=Math.round(innerHeight-r.top+12)}
  fab.style.bottom=b===null?'calc(16px + env(safe-area-inset-bottom,0px))':b+'px';
  box.style.bottom=b===null?'calc(84px + env(safe-area-inset-bottom,0px))':(b+68)+'px'}
yerles();addEventListener('resize',yerles);[800,2000,4500].forEach(t=>setTimeout(yerles,t));
const log=box.querySelector('#eb-log'),inp=box.querySelector('input');
Object.keys(MODLAR).forEach(k=>{const b=$('button','',MODLAR[k][0]+' '+MODLAR[k][1]);b.dataset.k=k;b.onclick=()=>modSec(k);box.querySelector('#eb-mod').appendChild(b)});
modSec(MOD,true);

/* ---------- Sayfa bağlamı: kullanıcı şu an nerede? ---------- */
const ctx=()=>({sayfa:document.title,rota:location.pathname.split('/').pop()+location.hash,
  gorunen:(document.querySelector('main h1,h1')||{}).textContent||''});

/* ---------- Süper Lig soru-cevap (kural tabanlı; veri: superlig.json) ---------- */
let LIG=null;
function ligCevap(q){
  const n=tl(q);
  const AL={gs:'galatasaray',fb:'fenerbahce',bjk:'besiktas',ts:'trabzonspor'};
  const GEN=new Set(['istanbul','kulubu','futbol','club','football','anonim','sirketi']);
  const adlar=[...new Set([].concat((LIG&&LIG.maclar||[]).flatMap(m=>[m.ev,m.dep]),(LIG&&LIG.puan||[]).map(p=>p.takim)).filter(Boolean))];
  const kel=n.split(/[^a-z0-9]+/).map(w=>AL[w]||w).filter(w=>w.length>=4);
  const tk=adlar.filter(a=>tl(a).split(/[^a-z0-9]+/).some(t=>t.length>=4&&!GEN.has(t)&&kel.some(w=>t.startsWith(w)||(t.length>=5&&w.startsWith(t)))));
  const lig=/\bsuper lig/.test(n);
  const puan=/puan durumu|puan tablosu|siralama|\blider\b|lideri|kacinci/.test(n)&&(lig||tk.length||/\blig\b/.test(n));
  const mac=/\b(mac\w*|skor\w*|sonuc\w*|kac kac|kim kazandi|kazandi|gol\w*|kart\w*|istatistik\w*|devre\w*|sut|korner\w*)\b/.test(n)&&(tk.length||lig);
  if(!puan&&!mac)return null;
  if(!LIG||!((LIG.maclar||[]).length||(LIG.puan||[]).length))return 'Süper Lig verisi henüz yok.';
  const zt=t=>{try{return new Date(t).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
  const out=[];
  if(puan&&!(mac&&tk.length&&!/puan|siralama|kacinci/.test(n))){
    const P=LIG.puan||[];
    if(!P.length)out.push('Puan durumu verisi henüz yok.');
    else{
      const sat=p=>p.sira+'. '+p.takim+' — '+p.puan+' puan (O'+p.o+' G'+p.g+' B'+p.b+' M'+p.m+', AV '+(p.av>0?'+':'')+p.av+')';
      const sec=tk.length?P.filter(p=>tk.includes(p.takim)):/\blider\b|lideri/.test(n)?P.slice(0,1):P;
      out.push('**Süper Lig puan durumu**',...(sec.length?sec:P).map(sat))}
  }
  if(mac){
    let M=(LIG.maclar||[]).filter(m=>m.durum!=='once');
    if(tk.length)M=M.filter(m=>tk.length>1?(tk.includes(m.ev)&&tk.includes(m.dep)):(tk.includes(m.ev)||tk.includes(m.dep)));
    M=M.slice(0,/\bson\b/.test(n)?1:tk.length?3:5);
    if(!M.length)out.push(tk.length?'Bu takım için Süper Lig verisinde maç yok.':'Süper Lig verisinde maç yok.');
    const ikon={gol:'⚽',pen:'⚽ (penaltı)',kk:'⚽ (kendi kalesine)',sari:'🟨',kirmizi:'🟥'};
    const kartIst=/kart|sari|kirmizi/.test(n),istIst=/istatistik|sut|korner|topla|faul|ofsayt/.test(n);
    M.forEach(m=>{
      const bitti=m.durum==='bitti';
      out.push('**'+m.ev+' '+m.evSkor+'-'+m.depSkor+' '+m.dep+'** ('+(bitti?'maç sonu':m.durum==='devre'?'devre arası':'devre arası verisi')+', '+zt(m.tarih)+')');
      const d=m.devre;
      if(bitti&&d&&d.skor)out.push('İlk yarı: '+d.skor[0]+'-'+d.skor[1]);
      const ol=(bitti?m.olaylar:(d&&d.olaylar))||[];
      const gl=ol.filter(o=>/^(gol|pen|kk)$/.test(o.tur));
      if(gl.length)out.push(...gl.map(o=>ikon[o.tur]+' '+o.dk+' '+o.oyuncu+(o.takim?' ('+o.takim+')':'')));
      else if(bitti||d)out.push('Gol yok.');
      if(kartIst){const kt=ol.filter(o=>/^(sari|kirmizi)$/.test(o.tur));out.push(...(kt.length?kt.map(o=>ikon[o.tur]+' '+o.dk+' '+o.oyuncu+(o.takim?' ('+o.takim+')':'')):['Kart kaydı yok.']))}
      if(istIst){const I=(bitti?m.ist:d&&d.ist)||{},ks=Object.keys(I);out.push(...(ks.length?ks.map(k=>k+': '+I[k][0]+' – '+I[k][1]):['İstatistik kaydı yok.']))}
      out.push('')});
  }
  if(LIG.guncelleme)out.push('🗓 Veri: '+zt(LIG.guncelleme)+' (devre arası ve maç sonunda güncellenir).');
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
/* ---------- Yerel arama (BM25 benzeri, Türkçe normalizasyonlu) ---------- */
/* Yükleme iki parçaya ayrıldı: HAFİF (kampus.json + lig; küçük, kampüs/sohbet cevapları için yeter) ve AĞIR (bilgi tabanı + arama indeksi).
   Böylece “vize ne zaman?” gibi sorular büyük dosya inmeden anında cevaplanır; ağır parça arka planda, paralel iner ve indeks dilim dilim kurulur. */
const JSONAL=async(u,taze)=>{const r=await fetch(/^https?:/.test(u)?u:ROOT+u,taze?{cache:'no-cache'}:{});if(!r.ok)throw new Error(r.status);return r.json()};
let HAFIFP=null,DBP=null,JKURAL=[];
function yukleHafif(){return HAFIFP||(HAFIFP=(async()=>{
  const [K,Lg]=await Promise.all([
    JSONAL(CFG.kampusDosya,1).catch(()=>null),
    JSONAL((/^https?:/.test(CFG.lig)?CFG.lig:ROOT+CFG.lig)+'?t='+Date.now(),1).catch(()=>null)]);
  /* kampus.json: bilgi + soru kalıpları + konumlar (JS'e dokunmadan güncellenir) */
  if(K){try{
    Object.assign(KAMPUS,K.kampus||{},CFG.kampus||{});
    JKURAL=(K.kurallar||[]).map(r=>{try{
      const an=(r.anahtar||[]).map(x=>nt(x)).filter(Boolean);
      if(!r.re&&!an.length)return null;
      const re=r.re?new RegExp(r.re):new RegExp('(?:'+an.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')');
      const dv=(r.devam||[]).map(d=>{try{return[new RegExp(d.re),d.t]}catch(e){return null}}).filter(Boolean);
       const bas=String(r.t||'').split('\n')[0].replace(/\*\*/g,'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
       return[re,r.t,r.on?new RegExp(r.on):null,r.genel?1:0,dv,bas]}catch(e){return null}}).filter(Boolean);
    YER=(K.yer||[]).map(y=>{try{return[new RegExp(y.re),y.ad,y.sorgu||y.ad,y.not||'']}catch(e){return null}}).filter(Boolean);
    JKURAL.forEach(k=>FZ.ekleRe(k[0]));
    Object.keys(KAMPUS).forEach(k=>FZ.ekle(k));
  }catch(e){}}
  LIG=Lg;
})())}
function yukleDB(){return DBP||(DBP=(async()=>{
  let chunks=[],kz=[],ok=true;
  try{const [J]=await Promise.all([JSONAL(CFG.bilgi,1),yukleHafif()]);chunks=J.chunks||[];kz=J.kanunlar||[]}catch(e){ok=false;chunks=[];kz=[]}
  /* indeks dilim dilim kurulur: telefonda arayüz donmasın */
  const df={},ix=[],tit=new Set();
  for(let i=0;i<chunks.length;i+=250){
    chunks.slice(i,i+250).forEach(c=>{const t=tok(c.t+' '+c.t+' '+c.x),f={};t.forEach(w=>f[w]=(f[w]||0)+1);Object.keys(f).forEach(w=>df[w]=(df[w]||0)+1);ix.push({f,n:t.length,tt:tl(c.t)});FZ.ekle(c.t);tok(c.t).forEach(w=>tit.add(w))});
    if(i+250<chunks.length)await new Promise(r=>setTimeout(r,0))}
  ix.df=df;ix.keys=[...new Set(Object.keys(df).filter(w=>w.length>=4&&df[w]>=2).concat([...tit].filter(w=>w.length>=4)))];   /* düzeltme adayları: başlık sözcükleri + ≥2 kayıtta geçenler */
  KANUN=kz;try{kanunKur()}catch(e){}
  IDX=ix;DB=chunks;
  if(!ok)DBP=null;   /* ağ hatasında bir sonraki soruda yeniden dene */
})())}
function yukle(){return Promise.all([yukleHafif(),yukleDB()])}
const STOP=new Set('nedir nelerdir kimdir midir mudur nasil neden niye hangi kac kim kimin nerede anlat anlatir misin misiniz acikla aciklar ver bana bize icin ile olan olarak bir var yok hakkinda konusunda ilgili gibi daha cok icinde simdi lutfen soyle goster ogret'.split(' '));
/*DERS-BASLA: yerel ders motoru (yapay zekâ YOK). Elle yazılmış ders kartları + sitedeki içerikten derlenen genel ders + kural tabanlı mini soru.
   Yeni ders eklemek için KART dizisine bir nesne ekle:
   {id, a:alan, k:/tl() ile sadeleşmiş (küçük harf, aksansız) arama kalıbı/, b:başlık, g:büyük resim, c:[kavramlar], i:[adımlar], o:örnek, h:[sık hatalar], s:sınav cümlesi, l:laboratuvar yönlendirmesi, ip:hafıza ipucu, m:[soru,[cevap kalıpları],açıklama], ara:'kaynak arama sözcüğü'}
   Karşılaştırma için FARK dizisine ekle. Kart metinlerindeki madde/süre bilgisini yayımlamadan önce Mevzuat sayfasından doğrula. */
const DERS=(()=>{
const N=v=>'(^|[^0-9])'+v+'([^0-9]|$)';
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const agSec=(l,w)=>{const ws=l.map(c=>Math.max(0,w(c.b)||0)),T=ws.reduce((a,b)=>a+b,0);if(!T)return rnd(l);let r=Math.random()*T;for(let i=0;i<l.length;i++){r-=ws[i];if(r<=0)return l[i]}return l[l.length-1]};
const HUK=['kamu','ceko','maliye'];
const KART=[
/* ---------------- KAMU YÖNETİMİ ---------------- */
{id:'iptal',a:'kamu',k:/iptal dava/,b:'İptal Davası',ara:'iptal davası',
 g:'İdare hukuka aykırı bir işlem yaptığında bunu ortadan kaldırtacak bir yol olmasaydı, idarenin hukuka bağlı olması sözde kalırdı. İptal davası, idari işlemin hukuka aykırılığını ileri sürerek iptalini isteme yoludur.',
 c:['İdari işlem: idarenin kamu gücüne dayanarak tek yanlı yaptığı, hukuki sonuç doğuran işlemdir. Dava konusu kesin ve icrai (uygulanabilir) bir işlem olmalıdır.',
  'Menfaat ihlali: davacının kişisel, meşru ve güncel bir menfaatinin işlemle ihlal edilmiş olması gerekir. Herkes her işlemi dava edemez.',
  'İptal sebepleri (İYUK m.2): yetki, şekil, sebep, konu ve maksat yönlerinden biriyle hukuka aykırılık.',
  'Süre: kural olarak işlemin tebliğinden itibaren 60 gün (İYUK m.7). Süre geçirilirse dava reddedilir.',
  'Yürütmenin durdurulması (İYUK m.27): işlem uygulanırsa telafisi güç zarar doğacaksa ve işlem açıkça hukuka aykırıysa, dava sürerken işlemin uygulanması durdurulabilir.'],
 i:['İşlemin kesin ve icrai olup olmadığına bak.','Menfaat ihlali var mı? Varsa görevli idare mahkemesine (vergi uyuşmazlığında vergi mahkemesine) 60 gün içinde dava aç.','Hukuka aykırılığın hangi unsurda (yetki, şekil, sebep, konu, maksat) olduğunu gerekçelendir.','Gerekirse yürütmenin durdurulmasını da iste.','Mahkeme işlemi iptal ederse işlem geriye etkili ortadan kalkar ve idare kararın gereğini yerine getirmek zorundadır.'],
 o:'Örnek olay (kurgu): Belediye, ruhsatlı bir işyerini sahibinin savunmasını almadan kapatır. İşyeri sahibi kapatma kararının tebliğinden itibaren 60 gün içinde idare mahkemesinde iptal davası açar; savunma alınmaması şekil yönünden hukuka aykırılık olarak ileri sürülür. İşyeri kapalı kaldıkça zarar büyüyorsa yürütmenin durdurulması da istenir.',
 h:['İptal davasını tazminat davası sanmak: iptal davası işlemi ortadan kaldırır, zararı ödetmez (o, tam yargı davasının konusudur).','Süreyi “olayı öğrendiğim gün” diye saymak: kural tebliğ tarihidir.','Her hukuka aykırılıkta iptal edilir sanmak: şekil sakatlığı yalnızca esaslı ise iptal sebebidir.'],
 ip:'Yetki, Şekil, Sebep, Konu, Maksat → YŞSKM. Yetki ile şekil “dış” unsurlar (kim, nasıl), sebep, konu ve maksat “iç” unsurlardır (neden, ne, niçin).',
 s:'İptal davası, menfaati ihlal edilen kişinin, idari işlemin yetki, şekil, sebep, konu ve maksat yönlerinden hukuka aykırı olduğunu ileri sürerek iptalini istediği, işlemin hukuka uygunluğunu denetleyen (objektif) yargı yoludur; süre 60 gündür (İYUK m.7).',
 m:['İptal davasında hukuka aykırılık hangi beş unsur yönünden ileri sürülebilir? (beşini say)',['yetki','sekil','sebep','konu','maksat'],'Yetki, şekil, sebep, konu ve maksat (İYUK m.2).']},
{id:'yetki',a:'kamu',k:/yetki unsur|yetki sakat|yetki yonunden/,b:'İdari İşlemde Yetki Unsuru',ara:'yetki unsuru',
 g:'İdare yalnızca kanunun verdiği yetki kadar iş yapabilir. Yetki unsuru, işlemi kimin, nerede, ne zaman ve hangi konuda yapabileceğini belirler.',
 c:['Yetki, idari işlemi yapma gücünün kanunla bir makama ya da göreve tanınmasıdır; kanunsuz yetki kullanılamaz.',
  'Yetki üç yönden sınırlıdır: konu bakımından (hangi işi), yer bakımından (hangi bölgede), zaman bakımından (hangi dönemde).',
  'Yetki sakatlığı olan işlem iptal sebebidir. Çok ağır ve açık (ör. hiçbir yetkisi olmayan kişinin işlem yapması) sakatlıklarda işlem yok hükmünde sayılabilir; doktrin bunu “yetki gaspı/kesin hükümsüzlük” diye anar.',
  'Yetki devri ve vekâlet: yetki kural olarak devredilemez; devir ancak kanunun izin verdiği şekilde olur.'],
 o:'Örnek olay (kurgu): A ilçesinin kaymakamı, B ilçesindeki bir derneğin faaliyetini durdurur. Yer bakımından yetkisi olmayan makam işlem yaptığı için işlem yetki yönünden sakattır ve iptal edilebilir.',
 h:['Yetkiyi “görev” ile karıştırmak: görev, bir kurumun hangi işlerle uğraştığı; yetki, o işi yapma gücüdür (günlük dilde yakındır, sınavda ayır).','Yetki sakatlığının her durumda işlemi yok hükmünde yaptığını sanmak: kural iptal edilebilirliktir, yokluk istisnadır.'],
 s:'Yetki unsuru, işlemi yapma gücünün kanunla verilmesi demektir; konu, yer ve zaman bakımından sınırlıdır. Yetkisiz yapılan işlem iptal edilebilir, çok ağır hâllerde yok hükmündedir.',
 m:['Yetki sakatlığı hangi üç yönden ortaya çıkabilir?',['konu','yer','zaman'],'Konu, yer ve zaman bakımından.']},
/* ---------------- ÇEKO / ÖZEL HUKUK ---------------- */
{id:'irade',a:'ceko',k:/irade sakat|hata.*hile|hile.*korkutma|irade bozuk/,b:'İrade Sakatlığı (Hata, Hile, Korkutma)',ara:'irade sakatlığı',
 g:'Sözleşme iki iradenin uyuşmasıyla kurulur. Ama biri yanılarak, aldatılarak ya da korkutularak irade beyan ederse bu irade “sağlıklı” değildir; hukuk, o kişiye sözleşmeden dönme imkânı tanır.',
 c:['Hata: kişinin kendi kendine yanılması (ör. esaslı bir niteliği yanlış sanması). Her hata değil, esaslı hata sözleşmeyi bağlamaz.',
  'Hile: karşı tarafın (ya da onun bildiği üçüncü kişinin) kasıtlı aldatması. Aldatma olmasaydı sözleşme yapılmazdı.',
  'Korkutma: haksız ve ağır bir tehditle sözleşmeye zorlama.',
  'Sonuç: sözleşme kendiliğinden geçersiz olmaz; sakat iradeli taraf için bağlayıcı değildir. Taraf, süresi içinde (TBK’da bir yıl) bildirimde bulunmazsa sözleşmeyi onamış sayılır.',
  'Kesin hükümsüzlükten farkı: kesin hükümsüzlükte (ör. emredici kurala veya ahlaka aykırılık) sözleşme baştan geçersizdir ve herkes ileri sürebilir; irade sakatlığında yalnızca sakatlanan taraf ileri sürebilir ve süre vardır.'],
 o:'Örnek olay (kurgu): Alıcı, satıcının “orijinal” dediği tabloyu satın alır. Satıcı gerçekten orijinal sanıyorsa alıcının hatası söz konusu olabilir; satıcı kopya olduğunu bile bile söylemişse hile vardır. Alıcı, sakatlığı öğrendikten sonra süresi içinde bildirimde bulunmalıdır.',
 h:['Hata ile hileyi karıştırmak: hatada yanılma kişinin kendindendir, hilede karşı taraf kasıtlı aldatır.','İrade sakatlığını kesin hükümsüzlük sanmak: süre ve ileri sürme yetkisi farkını unutma.','Korkutmada her tehdidi yeterli saymak: tehdit haksız ve ağır olmalıdır.'],
 s:'Hata, hile ve korkutma irade sakatlığı sebepleridir; bu hâllerde sözleşme sakatlanan taraf bakımından bağlayıcı değildir ve taraf süresi içinde bildirimde bulunmazsa sözleşmeyi onamış sayılır. Madde numaraları için TBK’nın ilgili hükümlerine bakınız.',
 m:['Hata, hile ve korkutmadan hangisinde sakatlığa karşı tarafın kasıtlı aldatması yol açar?',['hile'],'Hile.']},
{id:'fesih',a:'ceko',k:/fesh|fesih|isten cikar|is sozlesmesi/,b:'İş Sözleşmesinin Feshi',ara:'iş sözleşmesinin feshi',
 g:'İş ilişkisi sürekli bir ilişkidir; fesih, taraflardan birinin tek taraflı beyanla bunu sona erdirmesidir. İşçi ekonomik olarak zayıf taraf olduğu için kanun, özellikle işverenin feshine sınırlar koyar.',
 c:['Bildirim süreli fesih (4857 s. İş K. m.17): belirsiz süreli sözleşmede kıdeme göre 2, 4, 6 veya 8 hafta önceden bildirim gerekir.',
  'Haklı nedenle derhal fesih (m.24 işçi, m.25 işveren): bildirim süresi beklenmez. İşveren, haklı nedeni öğrendiği günden başlayarak 6 iş günü içinde, her hâlde fiilin üzerinden 1 yıl geçmeden fesih hakkını kullanmalıdır (m.26).',
  'İş güvencesi (m.18-21): en az 30 işçi çalıştıran işyerinde, en az 6 ay kıdemi olan ve belirsiz süreli sözleşmeyle çalışan işçiyi işveren geçerli sebep olmadan çıkaramaz.',
  'İşe iade: fesih bildiriminden itibaren 1 ay içinde arabulucuya başvurulur; anlaşma olmazsa son tutanaktan itibaren 2 hafta içinde dava açılır (7036 s. Kanun).'],
 o:'Örnek olay (kurgu): 40 işçili bir işyerinde 2 yıl kıdemli işçi, “performans düşük” denilerek çıkarılır. Kıdem 1,5-3 yıl arasında olduğundan bildirim süresi 6 haftadır. İşçi geçerli sebep olmadığını düşünüyorsa 1 ay içinde arabulucuya başvurur.',
 h:['Haklı neden ile geçerli sebebi karıştırmak: haklı neden derhal fesih içindir; geçerli sebep, iş güvencesi kapsamındaki bildirim süreli fesih içindir.','İş güvencesinin her işçiye uygulandığını sanmak: işçi sayısı, kıdem ve sözleşme türü şartları vardır.','Süreleri atlamak: arabulucuya başvuru süresi kaçarsa dava şartı eksik kalır.'],
 s:'İş sözleşmesi bildirim süreli ya da haklı nedenle derhal feshedilebilir; 30 ve üzeri işçili işyerinde 6 ay kıdemli işçi için işveren geçerli sebep göstermek zorundadır, aksi hâlde işçi işe iade talep eder. Kesin süre ve maddeler için mevzuat.gov.tr’ye bakınız.',
 m:['Kıdemi 4 yıl olan işçiye uygulanacak bildirim süresi kaç haftadır?',[N('8')+'|sekiz'],'8 hafta (3 yıldan fazla kıdem).']},
/* ---------------- MALİYE & VERGİ ---------------- */
{id:'vzaman',a:'maliye',k:/vergi zamanasim|zamanasimi.*vergi|vergide zamanasim/,b:'Vergide Zamanaşımı',ara:'vergi zamanaşımı',
 g:'Devlet vergi alacağını sonsuza kadar takip edemez. Hukuki güvenlik için, belli bir süre içinde işlem yapılmazsa vergi alacağı ortadan kalkar.',
 c:['Tahakkuk zamanaşımı (VUK m.114): vergi alacağı, vergiyi doğuran olayın ilişkin olduğu takvim yılını izleyen takvim yılı başından başlayarak 5 yıl içinde tahakkuk ettirilmezse zamanaşımına uğrar.',
  'Tahsil zamanaşımı (6183 s. AATUHK m.102): kesinleşmiş amme alacağı, vadesini izleyen takvim yılı başından başlayarak 5 yıl içinde tahsil edilmezse zamanaşımına uğrar.',
  'Süreyi durduran ve kesen hâller vardır (VUK m.115 ve 6183 s. Kanun’un ilgili hükümleri); kesilme hâlinde süre yeniden işler.'],
 o:'Örnek: 2020 yılına ait gelir vergisi için tahakkuk süresi 1 Ocak 2021’de başlar; 5 yıl sonra, 31 Aralık 2025 sonunda dolar. Bu tarihe kadar vergi tarh edilmemişse alacak zamanaşımına uğrar.',
 h:['Süreyi olayın yapıldığı günden başlatmak: başlangıç, ilişkin olduğu yılı izleyen takvim yılı başıdır.','Tahakkuk ile tahsil zamanaşımını karıştırmak: biri alacağın doğup tarh edilmesi, diğeri kesinleşmiş alacağın ödettirilmesi aşamasıdır.'],
 s:'Vergi alacağı, ilişkin olduğu takvim yılını izleyen yılbaşından başlayan 5 yıllık süre içinde tahakkuk ettirilmezse zamanaşımına uğrar (VUK m.114); tahsil için ayrı bir zamanaşımı vardır.',
 m:['2022 yılına ait vergi için tahakkuk zamanaşımı hangi yılın başında başlar?',['2023'],'Takip eden takvim yılı başında: 1 Ocak 2023.']},
{id:'kanunilik',a:'maliye',k:/kanunilik/,b:'Vergilendirmede Kanunilik İlkesi',ara:'vergi kanunilik',
 g:'Vergi, devletin kişinin malına müdahalesidir. Keyfî olmaması için ne, kimden, ne kadar alınacağı önceden ve kanunla belli olmalıdır.',
 c:['Anayasa m.73/3: vergi, resim, harç ve benzeri mali yükümlülükler kanunla konulur, değiştirilir veya kaldırılır.',
  'Unsurların kanunla belirlenmesi: mükellef, vergiyi doğuran olay, matrah ve oran kanunda yer almalıdır; yürütmeye bırakılan boşluk bırakılamaz.',
  'İstisna: Anayasa m.73/4 uyarınca kanunun gösterdiği alt ve üst sınırlar içinde oran, muafiyet, istisna ve indirimlerde değişiklik yetkisi Cumhurbaşkanına verilebilir.',
  'Kıyas yasağı: kanunda yazılı olmayan bir durum, benzerliğe dayanarak vergilendirilemez. Yorum serbesttir, kıyasla yükümlülük doğurulamaz.'],
 o:'Örnek (kurgu): Bir belediye, kanunda dayanağı olmayan “çevre katkı payı” adıyla yurttaştan para toplarsa, vergi benzeri mali yükümlülük kanunla konulmadığı için kanunilik ilkesine aykırı olur.',
 h:['Kanuniliği yalnızca “vergi kanunla konur” diye bilmek: unsurların kanunla belirlenmesi de gerekir.','Yorum ile kıyası karıştırmak.'],
 s:'Vergilendirmede kanunilik, vergi ve benzeri yükümlülüklerin ancak kanunla konulabilmesi, unsurlarının kanunla belirlenmesi ve kıyasla vergi doğurulamaması demektir (Anayasa m.73).',
 m:['Vergilendirmede kanunilik ilkesi Anayasa’nın kaçıncı maddesine dayanır?',[N('73')],'Anayasa m.73.']},
{id:'ziyai',a:'maliye',k:/ziyai|vergi ziyai/,b:'Vergi Ziyaı Cezası',ara:'vergi ziyaı cezası',
 g:'Vergi, doğru ve zamanında beyan edilmezse devlet gelir kaybeder. Vergi ziyaı cezası, bu kaybı doğuran hata, ihmal ya da hareketlere karşı idari yaptırımdır.',
 c:['Vergi ziyaı (VUK m.341): mükellefin ya da sorumlunun hareketi sonucu verginin zamanında tahakkuk ettirilmemesi veya eksik tahakkuk ettirilmesidir.',
  'Ceza (VUK m.344): ziyaa uğratılan verginin bir katı tutarında vergi ziyaı cezası kesilir.',
  'Vergi kaçakçılığı (VUK m.359) farklıdır: sahte belge gibi hileli fiiller hapis cezası gerektiren suçtur; vergi ziyaı ise idari yaptırımdır.',
  'Pişmanlık ve ıslah (VUK m.371): vergi ziyaına yol açan fiilin idare tespit etmeden önce kendiliğinden bildirilmesi hâlinde cezada indirim/kaldırma imkânı vardır; şartlar için maddeye bakınız.'],
 o:'Örnek (kurgu): Mükellef 100.000 TL’lik vergiyi beyan etmez; idare bunu tespit eder. Tarh edilen 100.000 TL vergiye ek olarak 100.000 TL vergi ziyaı cezası (bir kat) ve gecikme faizi uygulanır.',
 h:['Vergi ziyaını suç sanmak: ziyaı cezası idari yaptırımdır; kaçakçılık ise suçtur.','Cezayı verginin yerine geçen bir ödeme sanmak: ceza, verginin üstüne eklenir.'],
 s:'Vergi ziyaı, verginin zamanında ya da eksik tahakkuk ettirilmesidir (VUK m.341) ve ziyaa uğratılan verginin bir katı kadar idari ceza gerektirir (VUK m.344).',
 m:['Vergi ziyaı cezası, ziyaa uğratılan verginin kaç katıdır?',['\\bbir\\b|'+N('1')],'Bir katıdır (VUK m.344).']},
/* ---------------- İKTİSAT ---------------- */
{id:'arztalep',a:'iktisat',k:/arz.?talep|arz ve talep|talep egris|piyasa dengesi|denge fiyat/,b:'Arz–Talep ve Piyasa Dengesi',ara:'arz talep',
 g:'Kaynaklar kıt, istekler sınırsızdır. Piyasada bir malın fiyatını, alıcıların ne kadar almak, satıcıların ne kadar satmak istediği belirler. Arz–talep modeli bu fiyatın nasıl oluştuğunu gösteren en temel araçtır.',
 c:['Talep yasası: diğer şeyler sabitken fiyat artarsa talep edilen miktar azalır; talep eğrisi negatif eğimlidir (ikame ve gelir etkisi).',
  'Arz yasası: diğer şeyler sabitken fiyat artarsa arz edilen miktar artar; arz eğrisi pozitif eğimlidir (artan marjinal maliyet).',
  'Denge: iki eğrinin kesiştiği noktadır; bu fiyatta arz edilen miktar talep edilen miktara eşittir.',
  'Ceteris paribus (diğer şeyler sabit): eğri üzerindeki hareketi (kendi fiyat değişimi) eğrinin kaymasından (fiyat dışı belirleyiciler) ayırır.'],
 i:['Fiyat dengenin üstündeyse fazla arz oluşur; satıcılar fiyatı düşürür.','Fiyat dengenin altındaysa fazla talep (kıtlık) oluşur; fiyat yükselir.','Bir eğri kayarsa yeni denge kurulur: talep artarsa fiyat ve miktar artar; arz artarsa fiyat düşer, miktar artar.'],
 o:'Sayısal örnek: Talep Qd = 100 − 2P, arz Qs = 20 + 2P. Denge için 100 − 2P = 20 + 2P → 80 = 4P → P = 20, Q = 60. Fiyat 30 olsaydı Qd = 40, Qs = 80 olurdu: 40 birim fazla arz oluşur ve fiyat aşağı çekilir.',
 h:['Fiyat değişimini talep eğrisinin kayması sanmak: o, eğri üzerinde harekettir.','Talebi “isteme” ile karıştırmak: talep, satın alma gücüyle desteklenen isteğin ifadesidir.'],
 s:'Denge, arz edilen ve talep edilen miktarın eşitlendiği fiyat–miktar noktasıdır; dengenin üstündeki fiyatta fazla arz, altındaki fiyatta fazla talep oluşur ve fiyat dengeye doğru hareket eder.',
 l:'İktisat laboratuvarında arz–talep ile ilgili modülü aç, talep eğrisini kaydır ve denge fiyat ile miktarın nasıl değiştiğini gözle.',
 m:['Talep Qd = 80 − 2P ve arz Qs = 20 + 4P ise denge fiyatı kaçtır?',[N('10')],'80 − 2P = 20 + 4P → 60 = 6P → P = 10 (Q = 60).']},
{id:'esneklik',a:'iktisat',k:/esneklik|elastiki/,b:'Esneklik',ara:'esneklik',
 g:'Fiyat ya da gelir değişince alıcılar ne kadar tepki veriyor? Esneklik bu tepkinin şiddetini birimden bağımsız ölçer; indirim, vergi ve zam kararlarının sonucunu belirler.',
 c:['Talebin fiyat esnekliği = talep edilen miktardaki yüzde değişme ÷ fiyattaki yüzde değişme (mutlak değerce yorumlanır).',
  '|E| > 1 ise talep esnek (tepki güçlü); |E| < 1 ise esnek değil (inelastik); |E| = 1 ise birim esnektir.',
  'Belirleyiciler: yakın ikame mal bolluğu, malın zorunlu ya da lüks olması, bütçedeki payı, zaman (uzun dönemde esneklik artar).',
  'Gelir esnekliği: gelir artınca talebin tepkisi. Pozitifse normal mal, negatifse düşük (düşük kaliteli) mal; 1’den büyükse lüks mal.'],
 i:['Toplam harcama (hasılat) = P × Q.','Talep esnekse fiyat düşünce hasılat artar; esnek değilse fiyat düşünce hasılat azalır.'],
 o:'Fiyat %10 artıyor, talep edilen miktar %20 azalıyor: E = 20 ÷ 10 = 2 (esnek). Hasılat 1,1 × 0,8 = 0,88 olur, yani düşer: miktar kaybı fiyat kazancından büyük.',
 h:['Esnekliği eğimle karıştırmak: eğim birime bağlıdır, esneklik yüzde değişmelere bakar (doğrusal eğride esneklik noktadan noktaya değişir).','Talepte negatif işareti unutmak ya da yanlış yorumlamak: genelde mutlak değer alınır.'],
 s:'Esneklik, bir değişkendeki yüzde değişmeye karşı diğerinin yüzde kaç değiştiğini gösteren duyarlılık ölçüsüdür; |E| > 1 ise esnek, < 1 ise esnek değildir.',
 m:['Fiyat %5 artıyor, talep edilen miktar %10 azalıyor. Talebin fiyat esnekliği (mutlak değer) kaçtır?',[N('2')],'E = 10 ÷ 5 = 2; talep esnektir.']},
{id:'enflasyon',a:'iktisat',k:/phillips|enflasyon/,b:'Enflasyon ve Phillips Eğrisi',ara:'enflasyon',
 g:'Fiyatlar genel olarak sürekli artıyorsa paranın alım gücü düşer. Enflasyon bu sürekli artıştır; Phillips eğrisi ise kısa dönemde enflasyon ile işsizlik arasında ters bir ilişki olduğunu söyler.',
 c:['Enflasyon: genel fiyat düzeyinde sürekli artış (tek bir malın pahalanması değil). Çoğunlukla TÜFE ile ölçülür.',
  'Talep çekişli enflasyon: toplam talep üretim kapasitesini aşar. Maliyet itişli enflasyon: ücret, enerji, ithalat gibi girdi maliyetleri yükselir.',
  'Nominal ve reel: nominal değer fiyat etkisiyle ölçülür, reel değer fiyat etkisinden arındırılır. Reel faiz ≈ nominal faiz − enflasyon (Fisher).',
  'Phillips eğrisi: kısa dönemde işsizlik düşerken enflasyon artar. Friedman ve Phelps’in eleştirisi: beklentiler uyum sağlayınca ilişki kaybolur; uzun dönemde eğri doğal işsizlik oranında dikeydir.'],
 o:'Nominal faiz %40, enflasyon %30 ise reel faiz yaklaşık %10’dur. Enflasyon %45’e çıkarsa reel faiz yaklaşık −%5 olur: tasarruf sahibi alım gücü kaybeder.',
 h:['Tek malın pahalanmasını enflasyon saymak: genel düzey önemlidir.','Dezenflasyon ile deflasyonu karıştırmak: dezenflasyonda fiyatlar hâlâ artar ama yavaşlar, deflasyonda fiyatlar düşer.','Phillips eğrisini uzun dönemde de geçerli sanmak.'],
 s:'Enflasyon, genel fiyat düzeyinde sürekli artıştır; Phillips eğrisi kısa dönemde enflasyon ile işsizlik arasındaki ters ilişkiyi gösterir, uzun dönemde beklentiler nedeniyle bu ilişki kaybolur.',
 l:'İktisat laboratuvarında enflasyon veya Phillips eğrisiyle ilgili modülde beklenen enflasyonu değiştir ve eğrinin nasıl kaydığını gözle.',
 m:['Nominal faiz %25, enflasyon %20 ise yaklaşık reel faiz yüzde kaçtır?',[N('5')],'Reel faiz ≈ 25 − 20 = %5.']},
/* ---------------- EKONOMETRİ ---------------- */
{id:'ols',a:'ekonometri',k:/\bols\b|en kucuk kareler|regresyon/,b:'OLS ve Gauss–Markov Varsayımları',ara:'OLS en küçük kareler',
 g:'Bir değişkenin (ör. harcama) başka bir değişkenle (ör. gelir) ilişkisini en iyi özetleyen doğruyu bulmak istiyoruz. OLS, gözlemlere en yakın doğruyu, hata karelerinin toplamını en küçük yaparak bulur.',
 c:['Model: Y = β0 + β1X + u. β1, X bir birim artınca Y’nin ortalama değişimini; u, modele girmeyen etkileri (hata terimi) gösterir.',
  'OLS: artıkların (gözlenen − tahmin) kareleri toplamını (RSS) en küçük yapan β̂ değerlerini seçer.',
  'Gauss–Markov varsayımları: parametrelerde doğrusallık, hata teriminin beklenen değeri sıfır ve açıklayıcılarla ilintisiz, sabit varyans, hatalar arasında ilinti yok, çoklu modelde tam çoklu doğrusal bağlantı yok.',
  'Bu varsayımlar sağlanırsa OLS, doğrusal sapmasız tahminciler arasında en küçük varyanslıdır (BLUE). Normallik, BLUE için değil, küçük örneklemde t ve F testleri için gerekir.'],
 i:['Tek açıklayıcıda: β̂1 = Σ(X − X̄)(Y − Ȳ) ÷ Σ(X − X̄)²','β̂0 = Ȳ − β̂1·X̄'],
 o:'X = 1, 2, 3 ve Y = 2, 4, 6 olsun. X̄ = 2, Ȳ = 4. Pay = (−1)(−2) + 0 + (1)(2) = 4, payda = 1 + 0 + 1 = 2 → β̂1 = 2; β̂0 = 4 − 2×2 = 0. Doğru Y = 2X ve artıkların hepsi sıfırdır.',
 h:['Yüksek R² gördüğünde “model iyi” demek: R² uyumu söyler, varsayımların sağlandığını söylemez.','Korelasyonu nedensellik saymak.','Varsayım ihlalini “OLS çöktü” diye anlamak: ihlalin türü, sapmasızlığın mı etkinliğin mi bozulduğunu belirler (ör. değişen varyansta tahmin sapmasız kalır, ama en küçük varyanslı olmaz).'],
 s:'OLS, artıkların kareleri toplamını en küçük yapan tahmin yöntemidir; Gauss–Markov varsayımları sağlandığında doğrusal sapmasız tahminciler arasında en küçük varyanslıdır (BLUE).',
 l:'Ekonometri laboratuvarında regresyonla ilgili modülde bir uç değer ekleyip eğimin nasıl değiştiğini gözle.',
 m:['OLS neyi en küçük yapar?',['kare','artik|hata'],'Artıkların (hataların) kareleri toplamını.']},
{id:'tp',a:'ekonometri',k:/\bt test|p deger|anlamlilik|hipotez/,b:'t Testi ve p Değeri',ara:'t testi p değeri',
 g:'Bir katsayı tahmin ettik: bu gerçekten sıfırdan farklı mı, yoksa şans eseri mi çıktı? t testi ve p değeri bu soruya cevap arar.',
 c:['Hipotezler: H0: β = 0 (etki yok), H1: β ≠ 0.',
  't istatistiği = β̂ ÷ SE(β̂): tahmin, standart hatasının kaç katı?',
  'p değeri: H0 doğruysa bu kadar ya da daha uç bir t değerini görme olasılığı. p < α (ör. 0,05) ise H0 reddedilir ve katsayı istatistiksel olarak anlamlıdır.',
  'Güven aralığı: β̂ ± t_kritik × SE. Aralık 0’ı içermiyorsa ilgili düzeyde anlamlıdır.'],
 o:'β̂ = 0,8 ve SE = 0,2 → t = 4. Büyük örneklemde |t| > 2 yaklaşık %5 kritik değerinin üstünde olduğundan H0 reddedilir. β̂ = 0,3 ve SE = 0,25 → t = 1,2: anlamlı değil.',
 h:['p değerini “H0’ın doğru olma olasılığı” sanmak: değildir.','Anlamlılığı etki büyüklüğü sanmak: büyük örneklemde minicik etki de anlamlı çıkabilir.','Anlamlı değil sonucunu “etki yok” diye okumak: yalnızca kanıt yetersizdir.'],
 s:'t istatistiği, katsayı tahmininin standart hatasına oranıdır; p değeri H0 doğruyken bu kadar uç bir sonucun görülme olasılığıdır. p, α düzeyinden küçükse H0 reddedilir.',
 m:['β̂ = 1,5 ve SE = 0,5 ise t istatistiği kaçtır?',[N('3')],'t = 1,5 ÷ 0,5 = 3.']},
{id:'cdb',a:'ekonometri',k:/coklu dogrusal|coklu baglanti|cok.*baglanti|multicollinear|\bvif\b/,b:'Çoklu Doğrusal Bağlantı',ara:'çoklu doğrusal bağlantı',
 g:'Açıklayıcı değişkenler neredeyse birbirinin kopyasıysa model, Y’yi hangisinin etkilediğini ayıramaz.',
 c:['Tam çoklu doğrusal bağlantı: bir değişken diğerlerinin kesin doğrusal birleşimidir; OLS tahmini yapılamaz.',
  'Yüksek (tam olmayan) bağlantı: tahmin yapılır ve sapmasızlık bozulmaz, ancak standart hatalar şişer, t değerleri küçülür.',
  'Belirtiler: yüksek R² ama tek tek anlamsız t değerleri; açıklayıcılar arasında yüksek korelasyon; yüksek VIF (pratikte sıkça 10 üstü kaygı verici sayılır, kesin bir eşik değildir).',
  'Çözümler: gereksiz değişkeni çıkarmak, örneklemi büyütmek, değişkenleri birleştirmek ya da dönüştürmek.'],
 o:'Konut fiyatı modelinde hem “metrekare” hem “oda sayısı” var ve ikisi birlikte hareket ediyor: model ikisinin ayrı etkisini ayıramaz. İkisi tek tek anlamsız çıkabilirken F testi bütün olarak anlamlı olabilir.',
 h:['“OLS sapmalı olur” demek: sorun sapma değil, kesinlik (standart hata) sorunudur.','Öngörüyü bozduğunu sanmak: tek tek katsayıların yorumu bozulur; öngörü çoğu zaman etkilenmez.'],
 s:'Çoklu doğrusal bağlantı, açıklayıcıların birbirine yüksek derecede bağlı olmasıdır; tahminler sapmasız kalır ancak standart hatalar şişer ve tek tek katsayılar anlamsızlaşabilir.',
 m:['Çoklu doğrusal bağlantıda hangi büyüklük şişer?',['standart hata|std hata'],'Standart hatalar şişer; bu yüzden t değerleri küçülür.']},
/* ---------------- İŞLETME & FİNANS ---------------- */
{id:'nbd',a:'isletme',k:/net bugunku|\bnbd\b|\bnpv\b/,b:'Net Bugünkü Değer (NBD)',ara:'net bugünkü değer',
 g:'Bugünkü 100 TL ile bir yıl sonraki 100 TL aynı değil. NBD, projenin gelecekteki nakit akımlarını bugüne çekerek “bu proje değer katıyor mu?” sorusuna cevap verir.',
 c:['NBD = −Başlangıç yatırımı + Σ [Nakit akımı_t ÷ (1 + r)^t]; r iskonto oranıdır (fırsat maliyeti, gerekli getiri).',
  'Karar kuralı: NBD > 0 ise proje değer katar, kabul; NBD < 0 ise reddet.',
  'İskonto oranı yükselirse NBD düşer: uzak nakit akımları daha çok değer kaybeder.'],
 o:'Yatırım 1.000 TL; 1. yıl 600 TL, 2. yıl 600 TL; r = %10. Bugünkü değer = 600 ÷ 1,1 + 600 ÷ 1,21 = 545,45 + 495,87 = 1.041,32. NBD = 1.041,32 − 1.000 = 41,32 TL > 0 → kabul.',
 h:['Nakit akımlarını iskonto etmeden toplamak.','Muhasebe kârını nakit akımıyla karıştırmak.','NBD ile iç verimlilik oranını karıştırmak: NBD tutar (TL), iç verimlilik oranı yüzde verir.'],
 s:'NBD, bir projenin gelecekteki nakit akımlarının iskonto edilmiş toplamından başlangıç yatırımının çıkarılmasıyla bulunur; NBD pozitifse proje kabul edilir.',
 m:['Yatırım 100 TL; 1 yıl sonra 121 TL gelir getiriyor; r = %10. NBD kaç TL’dir?',[N('10')],'121 ÷ 1,1 = 110; NBD = 110 − 100 = 10 TL.']},
{id:'oran',a:'isletme',k:/finansal oran|oran analiz|cari oran|likidite oran/,b:'Finansal Oranlar',ara:'finansal oranlar',
 g:'Bir işletmenin bilançosuna bakıp “iyi mi, kötü mü” demek zordur. Oranlar, rakamları birbirine bölerek farklı işletmeleri ve yılları karşılaştırılabilir hâle getirir.',
 c:['Likidite: kısa vadeli borcu ödeme gücü. Cari oran = dönen varlıklar ÷ kısa vadeli yabancı kaynaklar.',
  'Kaldıraç (borçluluk): toplam borç ÷ toplam varlık; borç yükünü gösterir.',
  'Faaliyet (verimlilik): stok devir hızı = satışların maliyeti ÷ ortalama stok.',
  'Kârlılık: net kâr marjı = net kâr ÷ net satışlar; özkaynak kârlılığı (ROE) = net kâr ÷ özkaynak.'],
 o:'Dönen varlıklar 300 TL, kısa vadeli borçlar 200 TL → cari oran 1,5: her 1 TL kısa vadeli borca karşı 1,5 TL dönen varlık vardır. Tek başına “iyi” denmez; sektör ortalamasıyla ve geçmiş yıllarla karşılaştırılır.',
 h:['Oranı tek başına yorumlamak: sektör ve zaman karşılaştırması şart.','Yüksek cari oranı her zaman iyi saymak: atıl nakit ya da stok birikmiş olabilir.'],
 s:'Finansal oranlar, bilanço ve gelir tablosu kalemlerinin birbirine oranıdır; likidite, kaldıraç, faaliyet ve kârlılık başlıklarında sektör ve zaman karşılaştırmasıyla yorumlanır.',
 m:['Dönen varlıklar 400 TL, kısa vadeli borçlar 250 TL ise cari oran kaçtır?',['1[,.]6'],'400 ÷ 250 = 1,6.']},
{id:'fis',a:'isletme',k:/borc.?alacak|yevmiye|muhasebe fis|\bfis\b/,b:'Borç–Alacak ve Çift Taraflı Kayıt',ara:'borç alacak muhasebe',
 g:'Her işlemin iki yüzü vardır: bir şey girer, bir şey çıkar. Çift taraflı kayıt bunu borç ve alacak olarak iki tarafa yazarak muhasebe denkliğini korur.',
 c:['Temel denklem: Varlıklar = Kaynaklar (yabancı kaynak + özkaynak).',
  'Her kayıtta toplam borç, toplam alacağa eşittir.',
  'Varlık hesapları artınca borçlanır, azalınca alacaklanır. Kaynak (borç ve özkaynak) hesapları artınca alacaklanır, azalınca borçlanır. Gelir hesapları alacaklanır, gider hesapları borçlanır.'],
 o:'İşletme 1.000 TL’lik malı peşin (nakit) alır (KDV hesaba katılmadan): 153 Ticari Mallar (borç) 1.000 / 100 Kasa (alacak) 1.000. Mal varlığı arttığı için borç, kasa varlığı azaldığı için alacak yazılır.',
 h:['“Borç”u “kötü” sanmak: borç ve alacak yalnızca hesabın sol ve sağ tarafıdır.','Hesabın niteliğini (varlık, kaynak, gelir, gider) bilmeden kural uygulamak.'],
 s:'Çift taraflı kayıtta her işlem en az bir hesabı borçlandırır, en az bir hesabı alacaklandırır; toplam borç toplam alacağa eşit olmalıdır.',
 m:['Kasaya nakit girdi (kasa artıyor). Kasa hesabı borçlanır mı alacaklanır mı?',['borc'],'Kasa bir varlık hesabıdır; artınca borçlanır.']},
/* ---------------- ULUSLARARASI İLİŞKİLER ---------------- */
{id:'guvenlikik',a:'uluslararasi',k:/guvenlik ikilem/,b:'Güvenlik İkilemi',ara:'güvenlik ikilemi',
 g:'Anarşik sistemde bir devlet kendini korumak için silahlandığında, farkında olmadan komşusunu tehdit etmiş olur. Savunma amaçlı önlem, karşı tarafın gözünde tehdit algısına dönüşür.',
 c:['Güvenlik ikilemi (Herz, Butterfield, Jervis): bir devletin güvenliğini artırma çabası diğerinin güvensizliğini artırır; o da karşılık verince herkes daha güvensiz hâle gelir.',
  'Niyet belirsizliği: karşı tarafın silahlanmasının savunma mı saldırı mı amaçlı olduğu bilinemez.',
  'Spiral: eylem–tepki zinciri silahlanma yarışına dönüşebilir.',
  'Jervis: saldırı ile savunma silahları ayırt edilebiliyorsa ve savunma üstünse ikilemin şiddeti azalır.'],
 o:'Örnek (kurgu): A ülkesi sınırına savunma amaçlı füze yerleştirir; B bunu saldırı hazırlığı sayıp kendi füzelerini artırır; A bunu tehdit görüp daha fazla silahlanır. İki ülke de başlangıçtan daha güvensizdir. Soğuk Savaş’taki silahlanma yarışı sıkça örnek verilir.',
 h:['İkilemi kötü niyetli saldırganlığa indirgemek: ikilemin özü, niyetler iyi olsa da ortaya çıkan sonuçtur.','Çözümün yalnızca güç dengesi olduğunu sanmak: liberaller kurumlara ve güven artırıcı önlemlere, inşacılar ortak kimlik ve normlara dikkat çeker.'],
 s:'Güvenlik ikilemi, anarşik sistemde bir devletin kendi güvenliği için aldığı önlemlerin diğerlerinin güvensizliğini artırarak herkes için güvensizliğe yol açmasıdır.',
 m:['Güvenlik ikileminin temel nedeni nedir? (kısaca)',['anars|belirsiz|niyet'],'Anarşik sistemde niyetlerin belirsizliği.']},
{id:'insaci',a:'uluslararasi',k:/insaci|konstruktivizm/,b:'İnşacılık',ara:'inşacılık',
 g:'Realizm ve liberalizm çıkarları verili alır. İnşacılık sorar: çıkarlar ve kimlikler nereden geliyor?',
 c:['Temel iddia: uluslararası yapı yalnızca maddi güçten değil, paylaşılan fikir, norm ve kimliklerden oluşur; bunlar toplumsal olarak inşa edilir.',
  'Wendt (1992): “Anarşi devletlerin onu ne yaptığıdır.” Anarşi tek bir mantık dayatmaz; Hobbesçu (düşmanlık), Lockeçu (rekabet) ya da Kantçı (dostluk) kültürler olabilir.',
  'Kimlik ve çıkar: aktörler kendilerini ve ötekini nasıl tanımlarsa çıkarlarını da öyle tanımlar; normlar davranışı hem kısıtlar hem tanımlar.',
  'Yöntem: söylem, norm ve tarihsel değişim analizi; ör. Soğuk Savaş’ın sonunun fikir ve kimlik değişimiyle açıklanması.'],
 o:'Örnek: Aynı sayıda nükleer silaha sahip iki ülke arasında biri “müttefik”, diğeri “düşman” diye tanımlanıyorsa tehdit algısı farklıdır. İnşacılara göre fark silahta değil, ilişkinin toplumsal olarak nasıl anlamlandırıldığındadır.',
 h:['“Her şey fikirden ibaret, güç önemsiz” demek: maddi güç yok sayılmaz, anlamı fikirlerle verilir.','İnşacılığı realizm–liberalizm gibi bir politika reçetesi sanmak: o, dünyayı nasıl anlayacağımıza dair bir yaklaşımdır.'],
 s:'İnşacılığa göre uluslararası politikanın yapısı maddi güçle birlikte paylaşılan norm, fikir ve kimliklerle inşa edilir; çıkarlar verili değil, kimliklerden doğar (Wendt).',
 m:['Wendt’e göre anarşi tek bir davranış mantığı dayatır mı?',['hay[ir]|dayatmaz|kultur|ne yap|insa'],'Hayır: anarşi devletlerin onu ne yaptığına göre Hobbesçu, Lockeçu ya da Kantçı olabilir.']},
{id:'firsat',a:'iktisat',k:/firsat maliyet/,b:'Fırsat Maliyeti',ara:'fırsat maliyeti',
 g:'Kaynaklar kıt olduğu için her seçim bir şeyden vazgeçmektir. Fırsat maliyeti, seçtiğin şey yüzünden kaybettiğin en iyi alternatifin değeridir.',
 c:['Tanım: bir seçimde vazgeçilen en iyi alternatifin değeri (tüm alternatiflerin toplamı değil).','Ekonomik maliyet = açık (parasal) maliyet + örtük maliyet (vazgeçilen gelir gibi).','Üretim olanakları sınırında bir malın üretimini artırmak diğerinden vazgeçmeyi gerektirir; eğri genelde artan fırsat maliyeti yüzünden dışbükeydir.'],
 o:'İki saatini çalışarak 200 TL kazanabilecekken derse ayırırsan, dersin fırsat maliyeti 200 TL’dir (ödediğin bir ücret olmasa da).',
 h:['Fırsat maliyetini yalnızca para harcaması sanmak.','Vazgeçilen tüm alternatifleri toplamak: yalnızca en iyisi sayılır.'],
 s:'Fırsat maliyeti, bir seçim yapıldığında vazgeçilen en iyi alternatifin değeridir; kıtlığın doğrudan sonucudur.',
 m:['Birden fazla alternatiften biri seçilince hangi alternatifin değeri fırsat maliyetidir?',['en iyi|en yuksek|ikinci'],'Vazgeçilen en iyi alternatifin değeri.']},
{id:'r2',a:'ekonometri',k:/\br2\b|r kare|belirlilik katsay|uyum iyilig/,b:'R² (Belirlilik Katsayısı)',ara:'R kare belirlilik katsayısı',
 g:'Model Y’deki değişimin ne kadarını açıklıyor? R², bu payı 0 ile 1 arasında bir sayıyla söyler.',
 c:['R² = 1 − RSS ÷ TSS = ESS ÷ TSS; TSS toplam, ESS açıklanan, RSS açıklanamayan değişimdir.','Modele değişken eklemek R²’yi asla düşürmez; bu yüzden değişken sayısı farklı modeller düzeltilmiş R² ile karşılaştırılır.','Yüksek R² varsayımların sağlandığını ya da nedenselliği göstermez.'],
 o:'TSS = 200 ve RSS = 50 ise R² = 1 − 50 ÷ 200 = 0,75: Y’deki değişimin %75’i modelle açıklanıyor.',
 h:['Yüksek R² = iyi model sanmak.','Farklı bağımlı değişkenli modellerin R²’sini kıyaslamak.'],
 s:'R², bağımlı değişkendeki toplam değişimin model tarafından açıklanan oranıdır (1 − RSS/TSS).',
 m:['TSS = 200 ve RSS = 50 ise R² kaçtır?',['0[,.]75|75'],'R² = 1 − 50 ÷ 200 = 0,75.']},
{id:'basabas',a:'isletme',k:/basabas/,b:'Başabaş Noktası',ara:'başabaş noktası',
 g:'Bir işletme kaç birim satınca ne kâr ne zarar eder? Başabaş noktası bu sorunun cevabıdır.',
 c:['Başabaş miktarı = sabit giderler ÷ (birim satış fiyatı − birim değişken maliyet).','Fiyat − birim değişken maliyet = birim katkı payıdır.','Katkı payı büyüdükçe ya da sabit gider azaldıkça başabaş noktası düşer.'],
 o:'Sabit gider 10.000 TL, fiyat 50 TL, birim değişken maliyet 30 TL ise katkı payı 20 TL; başabaş = 10.000 ÷ 20 = 500 birim.',
 h:['Paydaya yalnızca fiyatı koymak.','Sabit gideri birim başına değişken sanmak.'],
 s:'Başabaş noktası, toplam gelirin toplam maliyete eşit olduğu satış miktarıdır: sabit gider ÷ birim katkı payı.',
 m:['Sabit gider 6.000 TL, fiyat 40 TL, birim değişken maliyet 25 TL ise başabaş miktarı kaçtır?',[N('400')],'6.000 ÷ (40 − 25) = 400 birim.']},
{id:'kamuhizmeti',a:'kamu',k:/kamu hizmet/,b:'Kamu Hizmetinin Temel İlkeleri',ara:'kamu hizmeti',
 g:'Kamu hizmeti toplumun ortak ihtiyaçlarını karşıladığı için, nasıl yürütüleceğine dair üç temel ilke geliştirilmiştir (doktrinde Rolland kuralları).',
 c:['Süreklilik: hizmet kesintisiz yürütülür.','Eşitlik: yararlananlar arasında ayrım yapılmaz.','Değişkenlik (uyarlanabilirlik): hizmet, ihtiyaç ve koşullara göre değiştirilebilir; yararlanan mevcut düzenin sürmesini hak olarak isteyemez.'],
 o:'Belediye, otobüs seferlerini yolcu yoğunluğuna göre yeniden düzenler (değişkenlik); ama seferler keyfî biçimde kesilemez (süreklilik).',
 h:['Değişkenliği idarenin keyfîliği sanmak: değişiklik kamu yararına dayanmalıdır.','Eşitliği herkese aynı şeyi vermek sanmak: eşit durumdakilere eşit davranılır.'],
 s:'Kamu hizmeti; süreklilik, eşitlik ve değişkenlik (uyarlanabilirlik) ilkelerine göre yürütülür.',
 m:['Kamu hizmetinin üç temel ilkesini say.',['surekli','esitlik','degisken|uyarlan'],'Süreklilik, eşitlik ve değişkenlik (uyarlanabilirlik).']},
{id:'dolayli',a:'maliye',k:/dolayli|dolaysiz|vergi turleri/,b:'Dolaylı ve Dolaysız Vergiler',ara:'dolaylı vergi dolaysız vergi',
 g:'Vergiyi kim öder ve yükü kim taşır? Bu fark, vergileri dolaysız ve dolaylı diye ayırır.',
 c:['Dolaysız vergi: gelir ve servet üzerinden alınır, yük kural olarak mükellefte kalır (ör. gelir vergisi).','Dolaylı vergi: harcama ve işlem üzerinden alınır, yük fiyatla tüketiciye yansıtılır (ör. KDV, ÖTV).','Dolaylı vergilerde vergiyi idareye ödeyen (mükellef) ile yükü taşıyan (tüketici) farklı kişidir.'],
 o:'Market, KDV’yi tahsil edip idareye öder; ama KDV’nin yükü fiyata yansıdığı için alıcıdadır.',
 h:['KDV mükellefi ile vergi yükünü taşıyanı aynı sanmak.'],
 s:'Dolaysız vergiler gelir ve servetten alınıp yükü mükellefte kalan; dolaylı vergiler harcamadan alınıp yükü başkasına yansıtılabilen vergilerdir.',
 m:['KDV dolaylı vergi midir, dolaysız mı?',['dolayli'],'Dolaylı vergidir.']},
{id:'gucdengesi',a:'uluslararasi',k:/guc dengesi|dengeleme|waltz/,b:'Güç Dengesi',ara:'güç dengesi',
 g:'Hiçbir devlet çok güçlenip diğerlerini ezmesin diye devletler kendi aralarında dengeler kurar. Realizm bunu sistemin doğal sonucu sayar.',
 c:['Waltz’a göre anarşik sistemde güç dengesi, devletlerin hayatta kalma çabasının kendiliğinden sonucudur.','İç dengeleme: silahlanma ve ekonomik güçlenme. Dış dengeleme: ittifak kurma.','Walt: devletler yalnızca güce değil, tehdide karşı dengelenir (tehdit dengesi).','Bandwagoning: güçlü olana karşı durmak yerine onun yanında saf tutmaktır.'],
 o:'İki küçük devlet, bölgede hızla güçlenen üçüncü devlete karşı ittifak kurarsa dış dengeleme yapmış olur.',
 h:['Güç dengesini bilinçli bir barış politikası sanmak: realistlere göre sistemin sonucudur.'],
 s:'Güç dengesi, anarşik sistemde devletlerin bir devletin üstünlüğünü önlemek için iç (silahlanma) ve dış (ittifak) dengeleme yapmasıdır (Waltz).',
 m:['Devletler dengelenmek için hangi iki yolu kullanır?',['\\bic\\b|ic denge|silahlan','ittifak|dis denge'],'İç dengeleme (silahlanma, güçlenme) ve dış dengeleme (ittifak).']},
{id:'haksizfiil',a:'ceko',k:/haksiz fiil/,b:'Haksız Fiil',ara:'haksız fiil',
 g:'Sözleşme olmasa bile birine zarar verdiysen sorumlu olabilirsin. Haksız fiil, sözleşme dışı zarar veren davranışın tazmin yükümlülüğü doğurmasıdır.',
 c:['Genel kural (TBK m.49/1): kusurlu ve hukuka aykırı bir fiille başkasına zarar veren, bu zararı gidermekle yükümlüdür.','Unsurlar: hukuka aykırı fiil, zarar, fiil ile zarar arasında illiyet (nedensellik) bağı ve kusur.','Zamanaşımı (TBK m.72): zarar görenin zararı ve tazminat yükümlüsünü öğrenmesinden itibaren 2 yıl, her hâlde fiilin işlenmesinden itibaren 10 yıl.','Sözleşmeye aykırılıktan farkı: haksız fiilde taraflar arasında önceden bir borç ilişkisi yoktur.'],
 o:'Örnek olay (kurgu): Sürücü kırmızı ışıkta geçerek yayaya çarpar. Hukuka aykırı fiil (trafik kuralı ihlali), zarar (tedavi gideri), illiyet bağı ve kusur vardır; sürücü zararı tazmin eder.',
 h:['Kusuru unutmak: genel kuralda kusur şarttır (kusursuz sorumluluk ayrıca kanunda düzenlenen hâllerdedir).','Haksız fiil ile sözleşmeye aykırılığı karıştırmak.'],
 s:'Haksız fiil, kusurlu ve hukuka aykırı bir fiille zarar verilmesidir; fiil, zarar, illiyet bağı ve kusur unsurları gerçekleşirse tazmin borcu doğar (TBK m.49).',
 m:['Haksız fiilde tazmin sorumluluğunun unsurlarından üçünü say.',['hukuka aykir|fiil','zarar','illiyet|nedensellik|kusur'],'Hukuka aykırı fiil, zarar, illiyet bağı ve kusur.']},
{id:'gsyh',a:'iktisat',k:/gsyh|gayri safi|milli gelir/,b:'GSYH (Milli Gelir)',ara:'GSYH milli gelir',
 g:'Bir ülkenin ekonomisi ne kadar üretiyor? GSYH, belli bir dönemde ülke sınırları içinde üretilen nihai mal ve hizmetlerin piyasa değeridir.',
 c:['Harcama yöntemi: Y = C + I + G + (X − M); tüketim, yatırım, kamu harcaması ve net ihracat.','Yalnızca nihai mal ve hizmet sayılır; ara mal sayılırsa çifte sayım olur.','Nominal GSYH cari fiyatlarla, reel GSYH sabit fiyatlarla ölçülür; büyüme reel GSYH’deki artıştır.','GSYH üretimi ölçer; refahı, gelir dağılımını ya da çevre kaybını doğrudan ölçmez.'],
 o:'C = 600, I = 200, G = 150, X = 100, M = 50 ise GSYH = 600 + 200 + 150 + (100 − 50) = 1.000.',
 h:['İthalatı çıkarmayı unutmak.','Nominal artışı büyüme sanmak.','Ara malları da toplamak.'],
 s:'GSYH, bir ülke sınırları içinde belli dönemde üretilen nihai mal ve hizmetlerin piyasa değeridir; harcama yönteminde Y = C + I + G + (X − M).',
 m:['C = 500, I = 150, G = 100, X = 80, M = 30 ise GSYH kaçtır?',[N('800')],'500 + 150 + 100 + (80 − 30) = 800.']},
{id:'hetero',a:'ekonometri',k:/degisen varyans|heterosked/,b:'Değişen Varyans',ara:'değişen varyans',
 g:'OLS, hata teriminin varyansının tüm gözlemlerde aynı olduğunu varsayar. Hata yayılımı gelirle birlikte büyüyorsa bu varsayım bozulmuştur.',
 c:['Değişen varyans: hata terimi varyansının gözlemden gözleme değişmesi (örn. gelir arttıkça harcamanın dağılımının açılması).','Sonuç: OLS tahminleri sapmasız kalır ama en küçük varyanslı değildir; standart hatalar yanlış hesaplanır, t ve F testleri güvenilmez olur.','Tespit: hata–tahmin grafiği, Breusch–Pagan ve White testleri.','Çözüm: dayanıklı (White) standart hatalar, ağırlıklı en küçük kareler, değişken dönüşümü (ör. logaritma).'],
 o:'Harcama–gelir verisinde düşük gelirli hanelerin harcaması birbirine yakınken yüksek gelirlilerde çok dağınıksa, hata varyansı gelirle artıyordur.',
 h:['“Değişen varyans katsayıları sapmalı yapar” demek: sapma değil, etkinlik ve standart hata sorunudur.','Testleri çıktıdaki anlamlılığa güvenerek yorumlamak: hata düzeltilmeden t değerleri yanıltır.'],
 s:'Değişen varyans, hata terimi varyansının sabit olmamasıdır; OLS sapmasız kalır, ancak etkin olmaz ve standart hatalar yanlış çıktığı için çıkarsama bozulur.',
 m:['Değişen varyansta OLS katsayı tahminleri sapmalı mıdır?',['hay[ir]|sapmasiz'],'Hayır, sapmasız kalır; sorun etkinlik ve standart hatalardadır.']},
{id:'hiyerarsi',a:'kamu',k:/hiyerarsi|vesayet/,b:'Hiyerarşi ve İdari Vesayet',ara:'idari vesayet hiyerarşi',
 g:'İdare kendi içinde nasıl denetlenir, yerinden yönetim kuruluşları merkezden nasıl denetlenir? İki farklı denetim türü vardır.',
 c:['Hiyerarşi: aynı tüzel kişilik içinde üstün astı emir, talimat, atama ve denetim yoluyla yönlendirmesidir; kanunda ayrıca belirtilmesine gerek yoktur.','İdari vesayet: merkezî idarenin, ayrı tüzel kişiliği olan yerinden yönetim kuruluşları (belediye, üniversite vb.) üzerindeki denetimidir; ancak kanunla verilen yetki ve usulle kullanılabilir.','Vesayet istisnadır: kanunda açıkça yetki verilmeden vesayet makamı işleme müdahale edemez.','Ayrım ölçütü: iki taraf aynı tüzel kişiliğe mi bağlı, yoksa ayrı tüzel kişilik mi?'],
 o:'Bakanın bakanlık memuruna talimat vermesi hiyerarşidir. İçişleri Bakanlığının, kanunun izin verdiği hâllerde bir belediye meclisi kararını denetlemesi vesayettir.',
 h:['Vesayeti hiyerarşi gibi sınırsız saymak.','Her denetimi hiyerarşi saymak: tüzel kişilik farkına bak.'],
 s:'Hiyerarşi aynı tüzel kişilik içinde üstün astı denetlemesidir ve kanuna ihtiyaç duymaz; idari vesayet ayrı tüzel kişilikler arasındadır ve yalnızca kanunla belirlenen yetkilerle kullanılır.',
 m:['Hangisi kanunda açıkça düzenlenmeden de var sayılır: hiyerarşi mi, idari vesayet mi?',['hiyerar'],'Hiyerarşi; vesayet ancak kanunla kullanılabilir.']},
{id:'adalet',a:'maliye',k:/yatay|dikey adalet|odeme gucu|vergide adalet|vergi adalet/,b:'Vergide Adalet (Yatay ve Dikey)',ara:'vergi adaleti ödeme gücü',
 g:'Vergi yükü nasıl dağıtılırsa adil olur? Ölçüt ödeme gücüdür (Anayasa m.73/1: herkes, kamu giderlerini karşılamak üzere, mali gücüne göre vergi öder).',
 c:['Yatay adalet: ödeme gücü aynı olanlar aynı vergiyi öder.','Dikey adalet: ödeme gücü yüksek olan daha fazla vergi öder (artan oranlılık bunun aracıdır).','Ödeme gücü göstergeleri: gelir, servet, harcama.','Gelir vergisinin artan oranlı tarifesi dikey adaleti sağlamaya çalışır.'],
 o:'Aynı maaşı alan iki çalışandan birinin diğerinden fazla vergi ödemesi yatay adalete aykırıdır. Yüksek gelirlinin daha yüksek oranla vergilenmesi dikey adalete hizmet eder.',
 h:['Yatay ile dikeyi karıştırmak: yatay “eşit durumda eşit”, dikey “farklı durumda farklı”dır.','Dikey adaleti yalnızca ağır vergi sanmak: ölçüt ödeme gücüdür.'],
 s:'Vergide adalet ödeme gücü ölçütüne dayanır: yatay adalet eşit durumdakilere eşit, dikey adalet daha güçlü olana daha fazla vergi yüklenmesidir (Anayasa m.73).',
 m:['Aynı ödeme gücündekilerin aynı vergiyi ödemesi hangi adalet türüdür?',['yatay'],'Yatay adalet.']},
{id:'bagimlilik',a:'uluslararasi',k:/karsilikli bagimlilik|keohane/,b:'Karmaşık Karşılıklı Bağımlılık',ara:'karşılıklı bağımlılık',
 g:'Devletler arasında ticaret, finans ve iletişim ağları yoğunlaştıkça güç siyaseti nasıl değişir? Keohane ve Nye bu soruya liberal bir cevap verir.',
 c:['Keohane ve Nye (1977): karmaşık karşılıklı bağımlılık dünyasında toplumlar arasında çok sayıda iletişim kanalı vardır.','Gündemde hiyerarşi yoktur: askerî güvenlik her zaman en üstte değildir, ekonomi ve çevre gibi konular da öncelik kazanır.','Askerî gücün rolü azalır: özellikle birbirine bağımlı devletler arasında güç kullanımı maliyetli hâle gelir.','Bağımlılık simetrik olmayabilir: daha az bağımlı taraf pazarlıkta güç kazanır.'],
 o:'İki ülke ticaret, yatırım, turizm ve enerji yoluyla yoğun bağlıysa aralarındaki bir anlaşmazlık güç kullanımı yerine müzakere ve kurumlar yoluyla çözülmeye daha yatkındır.',
 h:['Karşılıklı bağımlılığı otomatik barış sanmak: asimetrik bağımlılık güç aracına dönüşebilir.','Realizmi tamamen reddettiğini sanmak: devletleri hâlâ önemli aktör sayar.'],
 s:'Karmaşık karşılıklı bağımlılık; çok kanallı ilişkiler, gündemde hiyerarşinin olmaması ve askerî gücün azalan rolüyle tanımlanır (Keohane ve Nye).',
 m:['Karmaşık karşılıklı bağımlılığın üç özelliğinden hangisi askerî güvenliğin gündemin tepesinde olmadığını söyler?',['hiyerar|gundem'],'Gündemde hiyerarşinin olmaması.']},
{id:'portfoy',a:'isletme',k:/portfoy|sistematik risk|cesitlendirme/,b:'Portföy, Risk ve Çeşitlendirme',ara:'portföy risk çeşitlendirme',
 g:'Bütün yumurtaları tek sepete koymamak: farklı varlıklara yatırım yapmak riski azaltır, ama bir kısmını yok edemez.',
 c:['Toplam risk = sistematik risk + sistematik olmayan (firmaya özgü) risk.','Sistematik olmayan risk, varlık sayısı arttıkça çeşitlendirmeyle azaltılabilir (ör. bir şirketin grev ya da yönetim sorunu).','Sistematik risk (piyasa riski) çeşitlendirmeyle yok edilemez (ör. faiz, kur, resesyon); beta ile ölçülür.','Beta > 1 ise varlık piyasadan daha oynaktır, beta < 1 ise daha az oynaktır.'],
 o:'Yalnızca bir havayolu hissesi tutan yatırımcı, o şirketin sorunundan çok etkilenir. Farklı sektörlerden 20 hisse tutarsa firmaya özgü riskin çoğunu azaltır; ama piyasa genel düştüğünde yine kaybeder.',
 h:['Çeşitlendirmenin tüm riski sıfırlayacağını sanmak.','Betayı toplam risk sanmak: beta yalnızca sistematik riski ölçer.'],
 s:'Çeşitlendirme, sistematik olmayan (firmaya özgü) riski azaltır; sistematik (piyasa) riski azaltamaz ve bu risk beta ile ölçülür.',
 m:['Çeşitlendirmeyle hangi risk türü azaltılabilir?',['sistematik olmayan|firmaya ozg|ozgun|spesifik'],'Sistematik olmayan (firmaya özgü) risk.']},
{id:'amortisman',a:'isletme',k:/amortisman/,b:'Amortisman (Doğrusal Yöntem)',ara:'amortisman',
 g:'Bir makine yıllarca gelir sağlar; maliyetini tek yılın gideri yapmak yanıltıcıdır. Amortisman, maliyeti kullanım ömrüne yayar.',
 c:['Doğrusal yöntem: yıllık amortisman = (maliyet − kalıntı değer) ÷ faydalı ömür.','Birikmiş amortisman, varlığın defter değerini azaltır: defter değeri = maliyet − birikmiş amortisman.','Amortisman nakit çıkışı değil, muhasebe gideridir; kârı düşürür, nakit akımını doğrudan düşürmez.'],
 o:'Makine 10.000 TL, kalıntı değer 1.000 TL, ömür 3 yıl: yıllık amortisman (10.000 − 1.000) ÷ 3 = 3.000 TL. Birinci yıl sonunda defter değeri 7.000 TL olur.',
 h:['Kalıntı değeri çıkarmayı unutmak.','Amortismanı nakit gideri sanmak.'],
 s:'Amortisman, duran varlığın maliyetinin faydalı ömrüne yayılarak gidere dönüştürülmesidir; doğrusal yöntemde (maliyet − kalıntı değer) ÷ ömür alınır.',
 m:['Maliyet 12.000 TL, kalıntı değer 2.000 TL, ömür 5 yıl ise yıllık doğrusal amortisman kaçtır?',[N('2000')+'|2\\.000'],'(12.000 − 2.000) ÷ 5 = 2.000 TL.']},
{id:'temerrut',a:'ceko',k:/temerrut/,b:'Borçlunun Temerrüdü',ara:'temerrüt',
 g:'Borç vadesinde ödenmediğinde alacaklı hemen her hakkı kullanamaz; borçlunun temerrüde düşmesi gerekir.',
 c:['Temerrüt şartları: muaccel (ifa zamanı gelmiş) bir borç, ifa edilmemesi ve kural olarak alacaklının ihtarı (TBK m.117).','İhtar gerekmeyen hâl: ifa günü, sözleşmeyle ya da ihtarla belirlenmişse ihtar gerekmez, bu gün geçince temerrüt kendiliğinden gerçekleşir.','Sonuç: borçlu, gecikmeden doğan zararı ödemekle yükümlü olur; para borcunda temerrüt faizi işler.','Alacaklı, kanundaki şartlarla ek süre verip seçimlik haklarını kullanabilir.'],
 o:'Alıcı, 1 Mart’ta ödenecek bedeli ödemezse ve tarih sözleşmede belirliyse ihtar gerekmeden temerrüde düşer. Ödeme günü belirsizse alacaklı önce ihtarname çeker.',
 h:['Her gecikmeyi temerrüt saymak: muacceliyet ve ihtar (ya da belirli vade) şarttır.','Temerrütle zamanaşımını karıştırmak.'],
 s:'Temerrüt, muaccel borcun ifa edilmemesi ve ihtar ya da belirli ifa günü geçmesiyle borçlunun gecikme sonuçlarına katlanmasıdır (TBK m.117).',
 m:['Hangi durumda temerrüt için ayrıca ihtar gerekmez?',['belirli|belirlen|vade|gun'],'İfa günü sözleşmeyle ya da ihtarla belirlenmişse.']},
{id:'tekel',a:'iktisat',k:/tam rekabet|tekel|monopol/,b:'Tam Rekabet ve Tekel',ara:'tam rekabet tekel',
 g:'Piyasada kaç satıcı var ve fiyatı kim belirliyor? Bu soru, firmaların davranışını ve toplumun refahını değiştirir.',
 c:['Tam rekabet: çok sayıda alıcı ve satıcı, türdeş mal, serbest giriş–çıkış. Firma fiyat alıcısıdır; kâr azamisi için P = MC (marjinal maliyet) seçer.','Tekel: tek satıcı ve girişe engel. Firma fiyat belirleyicidir; kâr azamisi MR (marjinal hasılat) = MC noktasında üretir ve talep eğrisinden fiyatı okur, bu yüzden P > MC.','Tekelde üretim daha az, fiyat daha yüksektir; bu, ölü ağırlık kaybına yol açar.','Rekabeti koruma ve düzenleme (ör. Rekabet Kurumu) bu kayıpları azaltmaya çalışır.'],
 o:'Marjinal hasılat 8, marjinal maliyet 8 olduğunda tekel miktarı belirler; talep eğrisi o miktarda 12 TL gösteriyorsa fiyat 12 TL’dir ve P (12) > MC (8) olur.',
 h:['Tekelin fiyatını MC’ye eşitlemek: tekelde eşitlenen MR ile MC’dir.','Tekelin sınırsız fiyat koyabileceğini sanmak: talep eğrisiyle sınırlıdır.'],
 s:'Tam rekabette firma P = MC düzeyinde üretir; tekel MR = MC noktasında üretir ve P > MC olduğundan daha az üretip daha yüksek fiyat koyar.',
 m:['Kâr azamisi yapan bir tekel hangi iki büyüklüğü eşitler?',['marjinal has|\\bmr\\b','marjinal mal|\\bmc\\b|marjinal maliyet'],'Marjinal hasılat (MR) ile marjinal maliyeti (MC).']},
{id:'otokor',a:'ekonometri',k:/otokorelasyon|durbin/,b:'Otokorelasyon',ara:'otokorelasyon',
 g:'Zaman serilerinde bu dönemin hatası, geçen dönemin hatasıyla ilişkiliyse “hatalar birbirinden bağımsızdır” varsayımı bozulur.',
 c:['Otokorelasyon: hata terimlerinin birbiriyle ilişkili olması (zaman serilerinde sık, özellikle pozitif).','Sonuç: OLS tahminleri sapmasız kalır ama etkin değildir; standart hatalar yanlıştır, t ve F testleri güvenilmez olur.','Durbin–Watson (DW) istatistiği: yaklaşık 2 ise birinci derece otokorelasyon yoktur; 0’a yakınsa pozitif, 4’e yakınsa negatif otokorelasyon vardır.','Çözüm: modeli yeniden belirlemek (eksik değişken, gecikme), Newey–West dayanıklı standart hataları, genelleştirilmiş en küçük kareler.'],
 o:'Aylık satış modelinde bir ay beklenenden yüksek çıktıysa sonraki ay da yüksek çıkıyorsa hatalar pozitif otokorelasyonludur; DW değeri 2’nin çok altında çıkar.',
 h:['“Otokorelasyon katsayıları sapmalı yapar” demek: sapma değil, etkinlik ve standart hata sorunudur.','Çapraz kesit verisinde de aynı sorunu beklemek: en çok zaman serisinde görülür.'],
 s:'Otokorelasyon, hata terimlerinin birbiriyle ilişkili olmasıdır; OLS sapmasız kalır ama etkin olmaz; DW ≈ 2 otokorelasyon olmadığını gösterir.',
 m:['Birinci derece otokorelasyon yoksa Durbin–Watson istatistiği yaklaşık kaçtır?',[N('2')],'Yaklaşık 2.']},
{id:'vsurec',a:'maliye',k:/vergileme sureci|vergi asamalari|tarh.*tahsil|tahakkuk ve tahsil/,b:'Vergileme Süreci (Tarh, Tebliğ, Tahakkuk, Tahsil)',ara:'tarh tebliğ tahakkuk tahsil',
 g:'Vergi borcu doğduğu anda tahsil edilmez. Kanunda yazan vergi, bir dizi aşamadan geçerek mükelleften alınır.',
 c:['Vergiyi doğuran olay: kanunda öngörülen olayın gerçekleşmesi (ör. gelir elde etmek); borç bununla doğar.','Tarh: verginin miktarının hesaplanıp mükellef adına belirlenmesi.','Tebliğ: tarhın mükellefe bildirilmesi; itiraz ve dava süreleri tebliğle işlemeye başlar.','Tahakkuk: verginin kesinleşmesi, yani ödenecek bir borç hâline gelmesi.','Tahsil: verginin ödenmesi ya da cebren alınması.'],
 o:'Mükellef beyannameyle gelirini bildirir (beyana dayalı tarh), idare vergiyi hesaplar, ödeme zamanı gelince mükellef öder. Eksik beyan tespit edilirse idare re’sen tarh yapıp tebliğ eder.',
 h:['Tarhı tahsil sanmak: tarh hesaplama, tahsil ödemedir.','Dava süresini tarh tarihinden saymak: süre tebliğden başlar.'],
 s:'Vergileme süreci vergiyi doğuran olay, tarh, tebliğ, tahakkuk ve tahsil aşamalarından oluşur; tarh verginin hesaplanması, tahsil ise ödenmesidir.',
 m:['Verginin miktarının hesaplanıp mükellef adına belirlenmesi hangi aşamadır?',['tarh'],'Tarh.']},
/* ---------------- 2. PARTİ (10 kart): KAMU · ÇEKO · UİLİŞKİLER · MALİYE ---------------- */
{id:'yurutme',a:'kamu',k:/yurutmenin durdur|yurutmeyi durdur/,b:'Yürütmenin Durdurulması',ara:'yürütmenin durdurulması',
 g:'İptal davası aylar, hatta yıllar sürebilir. Bu sürede işlem uygulanır ve zarar kalıcı hâle gelirse sonunda kazanılan dava işe yaramaz. Yürütmenin durdurulması, dava sürerken işlemin uygulanmasını geçici olarak durduran tedbirdir.',
 c:['Yürütmenin durdurulması (YD): iptal davasında nihai karar verilene kadar idari işlemin uygulanmasının mahkemece durdurulmasıdır. İşlemi ortadan kaldırmaz, yalnızca uygulanmasını askıya alır.',
  'İki şart birlikte aranır (İYUK m.27): işlemin uygulanması hâlinde telafisi güç veya imkânsız zararların doğması ve işlemin açıkça hukuka aykırı olması.',
  'İstem, dava dilekçesiyle birlikte ya da dava sürerken yapılabilir. YD kararı geçicidir; dava sonunda işlem iptal edilebilir ya da dava reddedilebilir.',
  'İdare, mahkeme kararlarının gereğini gecikmeden, en geç 30 gün içinde yerine getirmek zorundadır (İYUK m.28).',
  'Kanun bazı konularda yürütmenin durdurulmasını sınırlamıştır; ayrıntı için İYUK m.27’yi Mevzuat sayfasından oku.'],
 i:['Önce işlemin hangi unsurda hukuka aykırı olduğunu belirle (açıklık şartı için).','Uygulanırsa doğacak zararın neden telafi edilemeyeceğini somut olarak yaz.','İptal davasını açarken (ya da sonradan) YD istemini ayrıca belirt.','Mahkeme iki şartı birlikte bulursa işlemin uygulanması durur; idare kararın gereğini yapar.'],
 o:'Örnek olay (kurgu): Belediye, ruhsatlı işyerini savunma almadan kapatır. İşyeri sahibi iptal davası açar ve YD ister. İşyeri kapalı kaldıkça müşteri kaybı geri döndürülemeyecekse ve işlem savunma alınmadığı için açıkça hukuka aykırıysa, mahkeme işlemin uygulanmasını dava bitene kadar durdurur.',
 h:['YD’yi iptal sanmak: işlem yaşamaya devam eder, yalnızca uygulanması durur.','İki şartı “veya” ile okumak: telafisi güç zarar ve açık hukuka aykırılık birlikte aranır.','YD’yi tazminat sanmak: zararı ödetmez, zararı önler.'],
 ip:'İki anahtar, tek kapı: “açıkça hukuka aykırı” + “telafisi güç zarar”. Biri eksikse YD yok.',
 s:'Yürütmenin durdurulması, iptal davası sürerken işlemin uygulanmasının askıya alınmasıdır; işlemin uygulanması hâlinde telafisi güç veya imkânsız zararların doğması ve işlemin açıkça hukuka aykırı olması şartlarının birlikte gerçekleşmesini gerektirir (İYUK m.27).',
 m:['Yürütmenin durdurulması için aranan iki şarttan ilki işlemin açıkça hukuka aykırı olması. Diğeri nedir?',['telafi'],'İşlemin uygulanması hâlinde telafisi güç veya imkânsız zararların doğması (İYUK m.27).']},
{id:'kamulastirma',a:'kamu',k:/kamulastirma|istimlak/,b:'Kamulaştırma',ara:'kamulaştırma',
 g:'Yol, okul, baraj gibi kamusal ihtiyaçlar özel mülkiyetteki taşınmazlara ihtiyaç duyabilir. Kamulaştırma, mülkiyet hakkı ile kamu yararı arasındaki dengeyi kuran yoldur: mülk alınır ama karşılığı ödenir.',
 c:['Kamulaştırma: devlet ve kamu tüzel kişilerinin, kamu yararının gerektirdiği hâllerde, özel mülkiyetteki taşınmazı bedelini ödeyerek malikin rızası aranmadan edinmesidir.',
  'Anayasa m.46: kamu yararı kararı, gerçek karşılığın ödenmesi ve kanunda gösterilen usule uyulması gerekir. Bedel kural olarak peşin ödenir.',
  '2942 sayılı Kamulaştırma Kanunu: idare önce malikle anlaşarak satın almayı dener (satın alma usulü); anlaşma sağlanamazsa bedelin tespiti ve tescil davası açılır.',
  'Kamulaştırma bedelini tespit eden mahkeme adli yargıdadır (asliye hukuk mahkemesi). Kamu yararı kararı ise idari işlemdir ve idare mahkemesinde iptal davasına konu olur.'],
 i:['Kamu yararı kararı alınır (idari işlem).','Taşınmazın değeri belirlenir ve malikle satın alma görüşmesi yapılır.','Anlaşma olmazsa idare bedelin tespiti ve tescil için dava açar.','Bedel ödenir ya da mahkemeye yatırılır, taşınmaz idare adına tescil edilir.'],
 o:'Örnek olay (kurgu): Belediye, imar planındaki yol için bir parseli kamulaştırmak ister. Önce malikle satın alma görüşmesi yapar; anlaşılamazsa asliye hukuk mahkemesinde bedel tespiti ve tescil davası açar. Malik, kamu yararı kararını idare mahkemesinde iptal davasıyla, bedeli ise adli yargıda tartışır.',
 h:['Kamulaştırmayı karşılıksız el koyma sanmak: gerçek karşılık ödenir.','Kamu yararı kararı ile bedeli aynı mahkemede tartışmak: ayrı yargı yolları vardır.','Malikin rızasını şart saymak: kamulaştırmada rıza aranmaz.'],
 ip:'Kamu yararı kararı → idari yargı; bedel → adli yargı.',
 s:'Kamulaştırma, kamu yararının gerektirdiği hâllerde devletin ve kamu tüzel kişilerinin özel mülkiyetteki taşınmazları karşılığını ödeyerek malikin rızası aranmaksızın edinmesidir (Anayasa m.46, 2942 sayılı Kanun).',
 m:['Kamulaştırma bedelinin tespiti hangi yargı koluna aittir: idari mi, adli mi?',['adli|asliye|hukuk'],'Adli yargıya (asliye hukuk mahkemesi). Kamu yararı kararına karşı iptal davası ise idari yargıdadır.']},
{id:'ihale',a:'kamu',k:/kamu ihale|4734|ihale ilke|ihale kanun/,b:'Kamu İhale Kanunu ve Temel İlkeleri',ara:'kamu ihale',
 g:'Kamu parasıyla mal, hizmet ve yapım alınırken kimin işi alacağı keyfî olsaydı kaynaklar israf olur, yolsuzluk kapısı açılırdı. Kamu İhale Kanunu, bu alımların açık ve denetlenebilir kurallarla yapılmasını sağlar.',
 c:['4734 sayılı Kamu İhale Kanunu: kamu kaynağıyla yapılan mal, hizmet ve yapım işlerinin ihale usullerini belirler.',
  'Temel ilkeler (m.5): saydamlık, rekabet, eşit muamele, güvenilirlik, gizlilik, kamuoyu denetimi, ihtiyaçların uygun şartlarla ve zamanında karşılanması, kaynakların verimli kullanılması.',
  'Temel ihale usulleri açık ihale usulü ile belli istekliler arasında ihale usulüdür. Pazarlık usulü ve doğrudan temin istisnaidir ve yalnızca kanundaki şartlar varsa uygulanır.',
  'Uyuşmazlık: ihale sürecine itiraz eden istekli önce idareye şikâyet eder, sonuç alamazsa Kamu İhale Kurumu’na itirazen şikâyette bulunur.'],
 i:['İdare ihtiyacı belirler ve ihale dokümanını hazırlar.','İhale ilan edilir, istekliler teklif verir.','Teklifler değerlendirilir, ihale karara bağlanır.','Sözleşme imzalanır; sürecin her aşamasında şikâyet yolu açıktır.'],
 o:'Örnek olay (kurgu): Bir belediye yol yapım ihalesinde şartnameye yalnızca tek bir firmanın sağlayabileceği bir özellik koyar. Diğer istekliler bunun rekabeti ve eşit muameleyi engellediğini ileri sürerek önce idareye şikâyet eder, sonuç alamazlarsa Kamu İhale Kurumu’na itirazen şikâyette bulunurlar.',
 h:['Doğrudan temini genel kural sanmak: temel usuller açık ihale ve belli istekliler arasında ihaledir.','İhaleyi yalnızca en düşük fiyat yarışı saymak: ilkeler (saydamlık, eşit muamele vb.) bütün süreci bağlar.','Şikâyet yolunu atlayıp doğrudan Kurum’a gitmek: önce idareye şikâyet gerekir.'],
 ip:'Kamu parası, açık kapı: Saydamlık, Rekabet, Eşit muamele, Güvenilirlik, Gizlilik, Kamuoyu denetimi, Uygunluk, Verimlilik.',
 s:'Kamu İhale Kanunu m.5’e göre ihalelerde saydamlık, rekabet, eşit muamele, güvenilirlik, gizlilik, kamuoyu denetimi, ihtiyacın uygun şartlarla ve zamanında karşılanması ve kaynakların verimli kullanılması ilkeleri esastır.',
 m:['Kamu ihalesinde istekliler arasında ayrım yapılmamasını sağlayan ilke nedir?',['esit'],'Eşit muamele ilkesi.']},
{id:'icap',a:'ceko',k:/icap|sozlesmenin kurulma|kabul beyani/,b:'Sözleşmenin Kurulması: İcap ve Kabul',ara:'icap kabul sözleşme',
 g:'Her konuşma bir sözleşme doğurmaz. Hukuk, ne zaman “anlaştık” denebileceğini icap ve kabul kavramlarıyla belirler.',
 c:['Sözleşme, tarafların karşılıklı ve birbirine uygun irade beyanlarıyla kurulur (TBK m.1). İlk beyana icap, ona uygun cevaba kabul denir.',
  'İcap, sözleşme kurmaya yönelik, içeriği yeterince belirli ve bağlanma iradesi taşıyan beyandır. Fiyat listesi gibi genel tanıtımlar çoğu zaman icap değil, icaba davettir.',
  'İcabın bağlayıcılığı: süre verilmişse süre boyunca bağlar; hazır olanlar (yüz yüze, telefon) arasında hemen kabul edilmezse bağlayıcılığı sona erer (TBK m.3–4).',
  'Sükût (susma) kural olarak kabul sayılmaz. Kanunun ya da işin niteliğinin sükûta anlam yüklediği istisnalar vardır.',
  'Şekil: kural olarak şekil serbestisi geçerlidir (TBK m.12). Kanun şekil öngörmüşse (ör. taşınmaz satışında resmî şekil) buna uyulmazsa sözleşme geçersizdir.'],
 i:['Beyan icap mı, yoksa görüşme daveti mi? (bağlanma iradesi ve belirlilik)','İcap hâlâ bağlayıcı mı? (süre, hazır olanlar/olmayanlar)','Kabul icaba uygun mu? Değişiklik içeren “kabul” yeni bir icaptır.','Kanun özel şekil istiyor mu? İstiyorsa şekle uyulmuş mu?'],
 o:'Örnek olay (kurgu): Ali, bahçe aletini 100 TL’ye satmayı telefonda Ayşe’ye teklif eder. Ayşe hemen “alıyorum” derse sözleşme kurulur. “Yarın dönerim” derse hazır olanlar arasında icap sona erer; Ayşe’nin ertesi günkü “alıyorum”u artık yeni bir icap olur.',
 h:['Her teklifi icap sanmak: icap, bağlanma iradesi taşımalıdır.','Susmayı kabul saymak: kural olarak sükût kabul değildir.','Şekil yoksa sözleşme yok demek: kural şekil serbestisidir.'],
 ip:'İcap → kabul → kurulum. Hazır olanlar arasında kural “şimdi ya da hiç”.',
 s:'Sözleşme, tarafların karşılıklı ve birbirine uygun irade beyanlarıyla kurulur (TBK m.1); ilk beyan icap, uygun cevap kabuldür. Hazır olanlar arasında icap hemen kabul edilmezse bağlayıcılığını yitirir.',
 m:['Sözleşmeyi kuran ilk irade beyanına ne ad verilir?',['icap'],'İcap.']},
{id:'ayip',a:'ceko',k:/ayip|ayiba karsi|tekefful/,b:'Satışta Ayıba Karşı Tekeffül',ara:'ayıp tekeffül satış',
 g:'Aldığın mal vaat edilen gibi çıkmazsa ne yapabilirsin? Ayıba karşı tekeffül, satıcının sorumluluğunu ve alıcının seçebileceği hakları düzenler.',
 c:['Ayıp: satılan malın vaat edilen niteliklerden yoksun olması ya da değerini veya kullanım amacına elverişliliğini önemli ölçüde azaltan bir kusur taşımasıdır. Satıcı bundan sorumludur (TBK m.219 vd.). Satıcının kusuru aranmaz.',
  'Alıcının külfeti: malı olağan akışa göre imkân bulunur bulunmaz gözden geçirmek (muayene) ve ayıbı uygun sürede satıcıya bildirmek (TBK m.223). Bildirmezse malı kabul etmiş sayılır. Gizli ayıpta bildirim, ayıp ortaya çıkınca hemen yapılır.',
  'Seçimlik haklar (TBK m.227): sözleşmeden dönme, ayıp oranında bedel indirimi, ücretsiz onarım veya ayıpsız misli ile değiştirme.',
  'Zamanaşımı: ayıp haklarında süre teslimden itibaren 2 yıldır (TBK m.231); satıcı ağır kusurluysa bu süre ona karşı ileri sürülemez.',
  'Tüketici işlemlerinde 6502 sayılı Kanun ayrıca ve alıcı lehine hükümler getirir.'],
 i:['Ayıp var mı ve açık mı, gizli mi?','Alıcı bildirimi zamanında yaptı mı?','Seçimlik haklardan hangisi uygun? (dönme, indirim, onarım, değiştirme)','Süre (2 yıl) geçti mi?'],
 o:'Örnek olay (kurgu): Ali ikinci el bir araç alır; üç gün sonra gizli bir motor arızası ortaya çıkar. Ali durumu hemen satıcıya bildirir ve ücretsiz onarım ya da bedel indirimi ister.',
 h:['Bildirimi geciktirmek: açık ayıpta bildirmeyen alıcı malı kabul etmiş sayılır.','Hakları sıralı sanmak: dört hak seçimliktir (şartları varsa alıcı seçer).','Satıcının kusurlu olması gerektiğini sanmak: ayıptan kusursuz da sorumludur.'],
 ip:'Muayene → Bildirim → Seçim: gördüğünde hemen söyle, sonra dört yoldan birini seç.',
 s:'Satıcı, satılanın ayıplarından kusuru olmasa da sorumludur; alıcı malı muayene edip ayıbı uygun sürede bildirmelidir, aksi hâlde malı kabul etmiş sayılır. Alıcı dönme, bedel indirimi, onarım veya değiştirme haklarından birini seçer (TBK m.219 vd.).',
 m:['Alıcı, açıkça görülebilen ayıbı süresinde satıcıya bildirmezse ne olur?',['kabul'],'Satılanı kabul etmiş sayılır ve ayıp haklarını kaybeder (TBK m.223).']},
{id:'sebepsiz',a:'ceko',k:/sebepsiz zengin/,b:'Sebepsiz Zenginleşme',ara:'sebepsiz zenginleşme',
 g:'Hukuka uygun bir sebebi olmadan başkasının malvarlığından kazanç sağlayan kişi, bu kazancı geri vermelidir. Bu kural, hataen yapılan ödemelerin iadesinin temelidir.',
 c:['Sebepsiz zenginleşme (TBK m.77): haklı bir sebep olmaksızın bir kimsenin malvarlığından zenginleşen, bu zenginliği iade etmekle yükümlüdür.',
  'Şartlar: zenginleşme, başkasının buna bağlı olarak fakirleşmesi, ikisi arasında illiyet bağı ve geçerli bir sebebin bulunmaması (ya da sonradan ortadan kalkması).',
  'Kusur aranmaz; amaç zararı değil, haksız kazancı geri döndürmektir.',
  'İyiniyetli zenginleşen, iade zamanında elinde kalan kadarıyla sorumludur (TBK m.79).',
  'Zamanaşımı: zenginleşmeyi öğrenmeden itibaren 2 yıl, her hâlde doğumundan itibaren 10 yıl (TBK m.82).'],
 i:['Karşı tarafın malvarlığında bir artış (ya da azalmama) var mı?','Bu artış, bizim fakirleşmemizden mi kaynaklanıyor?','Artışın hukuki sebebi (sözleşme, kanun) var mı?','Yoksa iade istenir; süreleri (2 ve 10 yıl) kontrol et.'],
 o:'Örnek olay (kurgu): Müşteri aynı faturayı yanlışlıkla iki kez öder. İkinci ödemenin hukuki sebebi yoktur; faturayı alan işletme sebepsiz zenginleşmiştir ve fazla ödemeyi iade etmelidir.',
 h:['Kusur aramak: sebepsiz zenginleşmede kusur şart değildir.','Tüm zararı istemek: iade, zenginleşme kadar olur.','Haksız fiille karıştırmak: haksız fiilde zarar ve kusur, burada haksız kazanç esastır.'],
 ip:'Z-F-İ-S: Zenginleşme, Fakirleşme, İlliyet, Sebepsizlik.',
 s:'Haklı bir sebep olmaksızın başkasının malvarlığından zenginleşen kişi, bu zenginliği iade etmekle yükümlüdür (TBK m.77); zamanaşımı öğrenmeden itibaren 2, her hâlde 10 yıldır.',
 m:['Sebepsiz zenginleşme davasında zamanaşımı, öğrenme tarihinden itibaren kaç yıldır?',[N('2')+'|\\biki\\b'],'2 yıl (her hâlde doğumundan itibaren 10 yıl; TBK m.82).']},
{id:'realizm',a:'uluslararasi',k:/^(?!.*(liberal|karsilastir|fark)).*realizm/,b:'Realizm',ara:'realizm',
 g:'Devletlerin üzerinde onları zorlayacak bir merkezî otorite yoksa güvenlik nasıl sağlanır? Realizm, bu soruya güç ve hayatta kalma temelinde cevap veren geleneksel yaklaşımdır.',
 c:['Realizm: devletleri uluslararası sistemin temel aktörleri, sistemi ise merkezî otoritenin bulunmadığı bir anarşi olarak görür.',
  'Temel varsayımlar: devlet merkezlilik, devletlerin rasyonel aktör olması, çıkarın güç cinsinden tanımlanması ve güvenliğin (hayatta kalmanın) önceliği. Devletler kendi güvenliğini kendileri sağlamak zorundadır (kendi kendine yardım).',
  'Klasik realizm (Morgenthau): güç arayışını insan doğasına bağlar. Neorealizm / yapısal realizm (Waltz): davranışı sistemin anarşik yapısıyla açıklar.',
  'Savunmacı realizm (Waltz) devletlerin güvenliği azamiye çıkarmak istediğini; saldırgan realizm (Mearsheimer) ise gücü azamiye çıkarmak istediğini savunur.',
  'Eleştiri: işbirliğini, kurumların rolünü, iç siyaseti ve kimlikleri yeterince açıklayamadığı söylenir.'],
 o:'Bir devlet komşusunun silahlanmasına karşılık kendi savunma bütçesini artırır. Realistler bunu, anarşik ortamda kendi kendine yardım ve güvenlik kaygısıyla açıklar (güvenlik ikilemiyle bağlantılıdır).',
 h:['Realizmi savaş yanlılığı sanmak: realizm, güç dengesini ve çatışma koşullarını tarif eder.','Realizmi yalnız insan doğasına bağlamak: neorealizm açıklamayı sistemin yapısına taşır.','Anarşiyi kaos sanmak: burada anarşi, merkezî otorite yokluğu demektir.'],
 ip:'Realizm = Anarşi + Güç + Hayatta kalma.',
 s:'Realizm, uluslararası sistemi anarşik gören, devletleri çıkarını güç cinsinden tanımlayan ve güvenlik ile hayatta kalmayı öncelikli sayan bir yaklaşımdır; klasik realizm gücü insan doğasıyla, neorealizm sistemin yapısıyla açıklar.',
 m:['Realizme göre uluslararası sistemin yapısı nedir: anarşi mi, hiyerarşi mi?',['anar'],'Anarşi; devletlerin üzerinde merkezî bir otorite yoktur.']},
{id:'liberalizm',a:'uluslararasi',k:/^(?!.*(realizm|karsilastir|fark)).*((?<![a-z])liberalizm|demokratik baris|kurumsal liberal)/,b:'Liberalizm ve Kurumsal Liberalizm',ara:'liberalizm uluslararası ilişkiler',
 g:'Anarşi olsa da devletler işbirliği yapabilir mi? Liberalizm, kurumların, ticaretin ve demokrasinin barışı destekleyebileceğini savunur.',
 c:['Liberalizm: uluslararası ilişkilerde işbirliğinin mümkün ve çıkara uygun olduğunu, ilerlemenin mümkün olduğunu savunur.',
  'Demokratik barış tezi: demokrasiler birbirleriyle savaşmaz ya da çok daha az savaşır (Kant’ın “Ebedî Barış” düşüncesine dayanır).',
  'Kurumsal liberalizm (Keohane): kurumlar bilgi paylaşımını artırıp işlem maliyetlerini düşürerek işbirliğini kolaylaştırır. Anarşiyi kabul eder ama işbirliğinin mümkün olduğunu söyler.',
  'Ticari barış: karşılıklı ekonomik bağımlılık savaşın maliyetini artırır.',
  'Eleştiri (realist): kurumlar güçlü devletlerin çıkarlarını yansıtır; güvenlik tehdidi karşısında işbirliği kırılgandır.'],
 o:'Fransa ile Almanya’nın savaştan sonra kömür ve çeliği ortak bir kurum altında yönetmesi (1951 Avrupa Kömür ve Çelik Topluluğu) liberallerce, kurumlar ve karşılıklı bağımlılık yoluyla barışın örneği olarak gösterilir.',
 h:['Liberalizmi anarşiyi yok sayan bir görüş sanmak: kurumsal liberalizm anarşiyi kabul eder.','Demokratik barışı “demokrasiler hiç savaşmaz” diye mutlaklaştırmak: tez, demokrasilerin birbirleriyle savaşmadığı eğilimine dayanır.','Liberalizmi yalnız ekonomik liberalizm sanmak: burada siyaset kuramından söz ediyoruz.'],
 ip:'Liberalizm = Kurumlar + Ticaret + Demokrasi → İşbirliği.',
 s:'Liberalizm, işbirliğinin mümkün olduğunu savunur; demokratik barış tezi demokrasilerin birbirleriyle savaşmadığını, kurumsal liberalizm ise kurumların işbirliğini kolaylaştırdığını ileri sürer.',
 m:['Demokratik barış tezi neyi savunur? (kısaca yaz)',['demokra','savas'],'Demokrasilerin birbirleriyle savaşmadığını (ya da çok daha az savaştığını).']},
{id:'bmgk',a:'uluslararasi',k:/guvenlik konsey|bmgk|\bveto\b/,b:'BM Güvenlik Konseyi',ara:'BM Güvenlik Konseyi',
 g:'Uluslararası barışı korumakla yetkili ve kararları bağlayıcı olan tek BM organı Güvenlik Konseyi’dir. Gücü de zayıflığı da yapısından gelir: beş daimi üye ve veto.',
 c:['BM Güvenlik Konseyi: uluslararası barış ve güvenliğin korunmasından birincil derecede sorumlu BM organıdır (BM Şartı m.24).',
  'Üyeler: 15. Beşi daimi (ABD, Rusya, Çin, Fransa, Birleşik Krallık), on geçici (iki yıl için seçilir).',
  'Karar: usule ilişkin olmayan konularda 9 olumlu oy gerekir ve daimi üyelerden hiçbirinin olumsuz oy (veto) kullanmaması gerekir (Şart m.27).',
  'Kararlar bağlayıcıdır (Şart m.25). VII. Bölüm kapsamında yaptırım uygulanabilir, güç kullanımına izin verilebilir.',
  'Eleştiri: veto, kararları felç edebilir; yapı 1945 güç dengesini yansıtır ve reform tartışması sürer.'],
 o:'Bir devlet aleyhine yaptırım tasarısı 9 olumlu oy alsa bile daimi üyelerden biri veto ederse kabul edilmez. Daimi üyenin çekimser kalması ise veto sayılmaz.',
 h:['Genel Kurul kararlarını da bağlayıcı sanmak: Genel Kurul kararları genelde tavsiye niteliğindedir.','Çekimserliği veto saymak: veto, olumsuz oy kullanmaktır.','Tüm 15 üyenin veto hakkı olduğunu sanmak: yalnızca beş daimi üyede vardır.'],
 ip:'5 daimi + 10 geçici = 15. Karar için 9 evet, 0 veto.',
 s:'Güvenlik Konseyi, uluslararası barış ve güvenliğin korunmasından sorumlu, 5 daimi ve 10 geçici üyeden oluşan BM organıdır; kararlar için 9 olumlu oy gerekir ve daimi üyelerin veto etmemesi aranır.',
 m:['Güvenlik Konseyi’nde kaç daimi üye vardır?',[N('5')+'|\\bbes\\b'],'5 daimi üye: ABD, Rusya, Çin, Fransa, Birleşik Krallık.']},
{id:'vdava',a:'maliye',k:/vergi mahkemesi|vergi dava|vergi uyusmazlik|uzlasma/,b:'Vergi Uyuşmazlıklarında Dava ve Uzlaşma',ara:'vergi mahkemesi dava uzlaşma',
 g:'Mükellef, idarenin tarh ettiği vergiyi ya da kestiği cezayı hukuka aykırı buluyorsa susmak zorunda değildir. Uzlaşma ve dava yolları, uyuşmazlığın çözüm kapılarıdır.',
 c:['Mükellef, tebliğ edilen vergi veya ceza ihbarnamesine karşı vergi mahkemesinde dava açabilir (İYUK).',
  'Dava açma süresi: vergi, resim, harç gibi mali yükümlerde tebliğden itibaren 30 gündür; diğer idari davalarda 60 gündür (İYUK m.7).',
  'Uzlaşma: vergi aslı ve cezalarına ilişkin olarak idare ile mükellef arasında, kanundaki şartlar varsa yapılan bir uyuşmazlık çözüm yoludur (VUK’taki uzlaşma hükümleri).',
  'Vergi mahkemesi kararlarına karşı istinaf (bölge idare mahkemesi) ve temyiz (Danıştay) yolları kararın türüne ve parasal sınırlara göre açıktır.',
  'Süre kaçırılırsa tarhiyat kesinleşir ve dava reddedilir.'],
 i:['İhbarnamenin tebliğ tarihini belirle.','Gerekiyorsa uzlaşma başvurusunu değerlendir.','Dava açma süresini (30 gün) tebliğden hesapla.','Dava aç, karara karşı istinaf ve temyiz yollarını değerlendir.'],
 o:'Örnek olay (kurgu): Mükellefe vergi ziyaı cezalı bir ihbarname tebliğ edilir. Mükellef, ihbarnamenin tebliğinden itibaren 30 gün içinde vergi mahkemesinde dava açar; süreyi kaçırırsa dava süre yönünden reddedilir.',
 h:['Vergi uyuşmazlığında 60 gün sanmak: vergide süre 30 gündür.','Süreyi tarh tarihinden saymak: süre tebliğden başlar.','Uzlaşmayı dava sanmak: uzlaşma idareyle yapılan çözüm yoludur, mahkeme işlemi değildir.'],
 ip:'Vergide 30, genel idari davada 60.',
 s:'Vergi uyuşmazlıklarında mükellef, ihbarnamenin tebliğinden itibaren 30 gün içinde vergi mahkemesinde dava açabilir (İYUK m.7); dava açmadan önce kanundaki şartlarla uzlaşma yoluna da başvurabilir.',
 m:['Vergi mahkemesinde dava açma süresi tebliğden itibaren kaç gündür?',[N('30')+'|otuz'],'30 gün (İYUK m.7).']},
/* ---------------- 3. PARTİ (10 kart): İKTİSAT · EKONOMETRİ · İŞLETME · KAMU · ÇEKO · MALİYE · Uİ ---------------- */
{id:'issizlik',a:'iktisat',k:/issizlik/,b:'İşsizlik Türleri ve Doğal İşsizlik',ara:'işsizlik',
 g:'İşsizlik tek bir olgu değildir: kimi işsizlik normal ve kaçınılmazdır, kimi ekonominin hasta olduğunu gösterir. Türleri ayırmak, doğru politikayı seçmenin ilk adımıdır.',
 c:['İşsizlik oranı = işsizler ÷ işgücü. İşgücü, çalışanlar ile iş arayıp çalışmaya hazır olanların toplamıdır; iş aramayan ya da çalışmaya hazır olmayan kişi işgücüne girmez.',
  'Friksiyonel (geçici) işsizlik: iş değiştirenlerin ve yeni iş arayanların uygun işle buluşana kadar geçen süredeki işsizliği.',
  'Yapısal işsizlik: ekonomideki yapısal değişim ya da beceri uyumsuzluğu nedeniyle, mevcut işgücünün açık işlere uymaması.',
  'Konjonktürel işsizlik: toplam talebin yetersiz kaldığı durgunluk dönemlerindeki işsizlik.',
  'Doğal işsizlik oranı = friksiyonel + yapısal işsizlik (konjonktürel işsizlik yoktur). Tam istihdam, işsizliğin doğal oranda olduğu durumdur, sıfır işsizlik demek değildir.'],
 o:'Mezun olan bir mühendis ilk işini bulana kadar iki ay işsiz kalırsa bu friksiyonel işsizliktir. Fabrikası kapanan ve yeni sektörde aranan becerilere sahip olmayan işçinin durumu yapısaldır. Satışlar düştüğü için işten çıkarılanlar konjonktürel işsizlerdir.',
 h:['Tam istihdamı sıfır işsizlik sanmak: doğal işsizlik oranında olan ekonomi tam istihdamdadır.','Konjonktürel işsizliği doğal oranın parçası saymak: o, doğal oranın dışında kalan kısımdır.','İş aramaktan vazgeçenleri işsiz saymak: işgücü tanımına girmedikleri için resmî oranda görünmezler.'],
 ip:'Doğal işsizlik = Friksiyonel + Yapısal. Konjonktürel olan “talep hastalığıdır”.',
 s:'İşsizlik; friksiyonel, yapısal ve konjonktürel olmak üzere türlere ayrılır. Doğal işsizlik oranı friksiyonel ve yapısal işsizliğin toplamıdır; tam istihdam bu orandadır.',
 m:['Toplam talebin yetersiz kalmasından doğan işsizlik hangi türdür?',['konjonkt'],'Konjonktürel işsizlik.']},
{id:'parapol',a:'iktisat',k:/para politika|para arz|faiz politika|politika faiz|merkez bankasi/,b:'Para Arzı ve Para Politikası',ara:'para politikası',
 g:'Ekonomideki para miktarını ve faizi merkez bankası etkiler. Para politikası, enflasyonu ve büyümeyi yönetmenin başlıca araçlarından biridir.',
 c:['Para arzı: M1 (dolaşımdaki para + vadesiz mevduat) dardır; M2, M1’e vadeli mevduatı ekler. Daha geniş tanımlar da vardır.',
  'Para politikası araçları: politika faizi, zorunlu karşılık oranı ve açık piyasa işlemleridir.',
  'Genişletici para politikası: faiz düşer, kredi ve talep artar; büyüme ve enflasyon baskısı yükselir.',
  'Daraltıcı para politikası: faiz artar, kredi ve talep azalır; enflasyonu düşürmeyi hedefler, büyümeyi yavaşlatabilir.',
  'Parasalcı (miktar teorisi) bakış: MV = PY. Para arzı aşırı artarsa uzun dönemde fiyatlar yükselir.'],
 o:'Enflasyon hedefin üzerine çıkarsa merkez bankası politika faizini artırır. Krediler pahalılaşır, talep soğur ve fiyat artışı yavaşlar; ancak büyüme de bir süre zayıflayabilir.',
 h:['Faiz artınca talebin artacağını sanmak: faiz artışı talebi azaltır.','Para politikasını bütçe politikasıyla karıştırmak: para politikası merkez bankasının, maliye politikası hükûmetin alanıdır.','Her para arzı artışının hemen enflasyon yaratacağını sanmak: etki zamana ve ekonominin durumuna bağlıdır.'],
 ip:'Faiz ↑ → kredi ↓ → talep ↓ → enflasyon ↓ (daraltıcı). Faiz ↓ ise tersi (genişletici).',
 s:'Para politikası, merkez bankasının politika faizi, zorunlu karşılık ve açık piyasa işlemleriyle para arzını ve faizi yönetmesidir; faiz artışı daraltıcı, faiz indirimi genişleticidir.',
 m:['Merkez bankası politika faizini artırırsa para politikası nasıl nitelenir?',['daralt|sikilas'],'Daraltıcı (sıkılaştırıcı) para politikası.']},
{id:'ftest',a:'ekonometri',k:/f testi|f istatistik|ftest/,b:'F Testi (Modelin Bütünsel Anlamlılığı)',ara:'F testi',
 g:'t testi tek bir katsayıya bakar. Peki model bir bütün olarak işe yarıyor mu? Bu soruyu F testi cevaplar.',
 c:['F testinin sıfır hipotezi: modeldeki tüm eğim katsayıları sıfırdır (sabit terim hariç). Yani açıklayıcı değişkenler birlikte Y’yi açıklamaz.',
  'Karar: F istatistiğinin p değeri anlamlılık düzeyinden (genelde 0,05) küçükse sıfır hipotezi reddedilir; model bütünüyle anlamlıdır.',
  'Hesap: F = (R² / k) ÷ ((1 − R²) / (n − k − 1)). Burada k açıklayıcı değişken sayısı, n gözlem sayısıdır.',
  'Tek açıklayıcı değişkenli modelde F = t²’dir.',
  'F anlamlı olup tek tek t’ler anlamsız çıkabilir; bu durum çoklu doğrusal bağlantı belirtisi olabilir.'],
 o:'Üç açıklayıcı değişkenli bir modelde F testinin p değeri 0,001 çıkarsa modelin bütünsel olarak anlamlı olduğuna karar verilir. Ancak her katsayının tek tek anlamlı olduğu sonucu çıkmaz.',
 h:['F testini tek katsayı testi sanmak: o t testinin işidir.','F anlamlı diye her değişkenin anlamlı olduğunu düşünmek.','Sıfır hipotezini “model anlamlıdır” diye yazmak: sıfır hipotezi “tüm eğim katsayıları sıfırdır”dır.'],
 ip:'t tek tek bakar, F topluca bakar.',
 s:'F testi, modeldeki tüm eğim katsayılarının birlikte sıfır olup olmadığını sınar; p değeri anlamlılık düzeyinden küçükse sıfır hipotezi reddedilir ve model bütünüyle anlamlıdır.',
 m:['F testinin sıfır hipotezinde modeldeki eğim katsayıları neye eşit alınır?',[N('0')+'|sifir'],'Sıfıra; yani tüm eğim katsayıları birlikte sıfırdır.']},
{id:'kukla',a:'ekonometri',k:/kukla|dummy/,b:'Kukla (Dummy) Değişken',ara:'kukla değişken',
 g:'Cinsiyet, bölge ya da sektör gibi nitel bilgileri regresyona sokmak için bunları 0 ve 1’e çeviririz. Böylece “grup farkı” sayısal olarak ölçülür.',
 c:['Kukla değişken: bir özelliğin var (1) ya da yok (0) olduğunu gösteren değişkendir.',
  'Yorum: kukla katsayısı, o grubun baz (dışarıda bırakılan) gruba göre ortalama farkıdır (diğer değişkenler sabitken).',
  'k kategorili bir nitel değişken için sabit terimli modele en fazla k − 1 kukla eklenir. Hepsini eklemek “kukla değişken tuzağı”dır (mükemmel çoklu doğrusal bağlantı).',
  'Etkileşim terimi (kukla × sürekli değişken) eğim farkını ölçer; yalnızca kukla ise sabit kesenin (başlangıç düzeyinin) farkını verir.'],
 o:'Ücret = 3000 + 150·Eğitim − 200·Kadın modelinde Kadın kuklası 1 ise kadın çalışanlar, aynı eğitim düzeyinde erkeklere göre ortalama 200 birim daha az kazanır.',
 h:['Tüm kategoriler için kukla koymak: bir kategori baz alınmalıdır.','Katsayıyı mutlak düzey sanmak: kukla katsayısı baza göre farktır.','Kuklayı sayısal sıralı değişken gibi yorumlamak: 0 ve 1 yalnızca grubu işaretler.'],
 ip:'k kategori → k − 1 kukla. Baz grubu unutma.',
 s:'Kukla değişken, nitel bir özelliği 0 ve 1 ile temsil eder; katsayısı baz gruba göre farkı gösterir ve k kategori için k − 1 kukla kullanılır.',
 m:['Üç kategorili bir nitel değişken için sabit terimli modele en fazla kaç kukla değişken eklenir?',[N('2')+'|\\biki\\b'],'2 (k − 1); hepsini eklemek kukla değişken tuzağına yol açar.']},
{id:'ivo',a:'isletme',k:/ic verim|ic getiri|\bivo\b|\birr\b/,b:'İç Verim Oranı (İVO)',ara:'iç verim oranı',
 g:'NBD, yatırımın kaç lira kazandırdığını söyler. İç verim oranı ise yatırımın yıllık yüzde kaç getirdiğini söyler; karar vermek için gerekli getiriyle karşılaştırılır.',
 c:['İç verim oranı (İVO): yatırımın net bugünkü değerini sıfıra eşitleyen iskonto oranıdır.',
  'Karar kuralı: İVO, gerekli getiri (sermaye maliyeti) oranından büyükse proje kabul edilir; küçükse reddedilir.',
  'Yorum: İVO, projenin parayı yıllık ortalama hangi oranda kazandırdığını gösterir.',
  'NBD ve İVO çoğu zaman aynı kararı verir; ancak karşılıklı dışlayan projeler ya da gelişi gidişi değişken nakit akışlarında çelişebilir. Bu durumda NBD genelde tercih edilir.',
  'Nakit akışlarının işareti birden fazla kez değişirse birden fazla İVO çıkabilir.'],
 o:'Bugün 1000 TL harcayıp bir yıl sonra 1100 TL alan yatırımın İVO’su %10’dur. Sermaye maliyeti %8 ise İVO > %8 olduğu için proje kabul edilir.',
 h:['İVO’yu sermaye maliyetiyle karşılaştırmadan karar vermek.','İVO yüksek diye her zaman o projeyi seçmek: karşılıklı dışlayan projelerde NBD’ye bak.','İVO’yu iskonto oranı sanmak: İVO bir sonuçtur, iskonto oranı ise sizin gereken getiriniz.'],
 ip:'İVO, NBD’yi sıfır yapan oran. İVO > gerekli getiri ise kabul.',
 s:'İç verim oranı, yatırımın net bugünkü değerini sıfıra eşitleyen iskonto oranıdır; sermaye maliyetinden büyükse proje kabul edilir.',
 m:['İç verim oranı, net bugünkü değeri kaça eşitleyen iskonto oranıdır?',[N('0')+'|sifir'],'Sıfıra.']},
{id:'wacc',a:'isletme',k:/ortalama sermaye maliyet|wacc|sermaye maliyet|aosm/,b:'Ağırlıklı Ortalama Sermaye Maliyeti (WACC)',ara:'sermaye maliyeti',
 g:'Şirket yatırımlarını hem borçla hem özkaynakla finanse eder; ikisinin maliyeti farklıdır. WACC, bu iki kaynağın ağırlıklı ortalama maliyetidir ve yatırım kararlarında iskonto oranı olarak kullanılır.',
 c:['WACC = (E/V)·Re + (D/V)·Rd·(1 − t).',
  'E özkaynak, D borç, V = E + D; Re özkaynak maliyeti, Rd borç maliyeti, t vergi oranıdır.',
  'Borç maliyeti vergi sonrasıdır: faiz gideri vergiden düşüldüğü için borç, “vergi kalkanı” sayesinde ucuzlar.',
  'Özkaynak maliyeti genelde borç maliyetinden yüksektir, çünkü ortaklar daha fazla risk taşır.',
  'Kullanım: projelerin nakit akışları WACC ile iskonto edilerek NBD bulunur.'],
 i:['Özkaynak ve borcun piyasa değerlerinden ağırlıkları bul.','Özkaynak maliyetini (Re) ve borç maliyetini (Rd) belirle.','Borç maliyetini (1 − t) ile vergi sonrasına çevir.','Ağırlıklı toplamı hesapla; sonucu iskonto oranı olarak kullan.'],
 o:'Özkaynak 60, borç 40; Re %15, Rd %10, vergi %20 ise WACC = 0,6·15 + 0,4·10·0,8 = 9 + 3,2 = %12,2 bulunur.',
 h:['Borç maliyetini vergisiz almak.','Defter değeri yerine piyasa değeri ağırlıklarının kullanılması gerektiğini unutmak.','WACC’yi her projenin riskine uygun saymak: farklı riskteki projeler için ayrı oran gerekebilir.'],
 ip:'WACC = Özkaynak payı × Re + Borç payı × Rd × (1 − t).',
 s:'WACC, şirketin özkaynak ve borç maliyetlerinin sermaye yapısındaki paylarına göre ağırlıklı ortalamasıdır; borç maliyeti vergi sonrası alınır.',
 m:['Faiz giderinin vergiden düşülmesi sayesinde borç maliyetinin azalmasına ne denir?',['kalkan'],'Vergi kalkanı.']},
{id:'idaresorum',a:'kamu',k:/idarenin (hukuki )?sorumlu|idare.*sorumlulu|hizmet kusuru/,b:'İdarenin Sorumluluğu (Hizmet Kusuru ve Kusursuz Sorumluluk)',ara:'idarenin sorumluluğu tam yargı',
 g:'İdare eylem ve işlemleriyle vatandaşa zarar verebilir. Anayasa, idarenin bu zararı ödemekle yükümlü olduğunu söyler; sorun, hangi şartlarda ve hangi dava yoluyla ödeneceğidir.',
 c:['Anayasa m.125: idare, kendi eylem ve işlemlerinden doğan zararı ödemekle yükümlüdür. Zarar, tam yargı davasıyla istenir.',
  'Kusur sorumluluğu: zararın hizmetin kötü işlemesi, geç işlemesi ya da hiç işlememesinden (hizmet kusuru) doğması hâlidir.',
  'Kusursuz sorumluluk: idarenin kusuru olmasa da sorumlu tutulduğu durumdur. Başlıca dayanakları risk ilkesi (tehlikeli faaliyet) ve fedakârlığın denkleştirilmesi (kamu yararı için kişinin özel zarara uğraması) ilkesidir.',
  'Görevlinin görevle ilgisiz kişisel kusuru ile hizmet kusuru ayrı değerlendirilir; hizmetle ilgili zararda başvuru idareye karşı yapılır.',
  'Usul: işlemden doğan zararda 60 gün, eylemden doğan zararda önce idareye başvuru yapılır (İYUK m.13).'],
 o:'Örnek olay (kurgu): Polisin tehlikeli bir silahı kullandığı operasyonda yoldan geçen bir vatandaş yaralanır. Kimsenin kusuru ispatlanamasa bile, idarenin yürüttüğü tehlikeli faaliyetten doğan zarar için risk ilkesi gereği idare tazminat ödeyebilir.',
 h:['İdare sorumluluğunu yalnızca kusura bağlamak: kusursuz sorumluluk da vardır.','Tam yargı davasını iptal davasıyla karıştırmak: tazminat tam yargıdadır.','Eylemden doğan zararda doğrudan dava açmak: önce idareye başvuru gerekir.'],
 ip:'Kusurlu → hizmet kusuru; kusursuz → risk veya fedakârlığın denkleştirilmesi.',
 s:'İdare, eylem ve işlemlerinden doğan zararı ödemekle yükümlüdür (Anayasa m.125); sorumluluk hizmet kusuruna ya da kusursuz sorumluluğa (risk, fedakârlığın denkleştirilmesi) dayanır ve tam yargı davasıyla istenir.',
 m:['İdarenin kusuru olmasa da zarardan sorumlu tutulduğu duruma ne denir?',['kusursuz'],'Kusursuz sorumluluk.']},
{id:'kefalet',a:'ceko',k:/kefalet|kefil/,b:'Kefalet Sözleşmesi',ara:'kefalet',
 g:'Alacaklı borçlunun ödeme gücüne güvenmiyorsa ikinci bir güvence ister. Kefalet, üçüncü bir kişinin borçlu ödemezse kendisinin ödeyeceğini taahhüt ettiği sözleşmedir.',
 c:['Kefalet (TBK m.581): kefil, borçlunun borcunu ödememesi hâlinde alacaklıya karşı sorumlu olmayı üstlenir.',
  'Şekil: yazılı olmalıdır; ayrıca kefilin sorumlu olacağı azami miktarı ve kefalet tarihini kendi el yazısıyla belirtmesi gerekir (TBK m.583).',
  'Eş rızası: evli kişinin kefil olabilmesi için eşinin yazılı rızası gerekir (TBK m.584).',
  'Fer’ilik: kefalet asıl borca bağlıdır; asıl borç geçersizse kefalet de geçersizdir.',
  'Adi kefalette alacaklı önce asıl borçluya başvurmak zorundadır (belirli şartlarla); müteselsil kefalette doğrudan kefile gidebilir.'],
 o:'Örnek olay (kurgu): Ali’nin banka kredisine Mehmet kefil olur. Mehmet, sözleşmeye azami kefalet miktarını ve tarihini kendi el yazısıyla yazar; evliyse eşinin yazılı rızası alınır. Ali ödemezse banka, kefalet türüne göre Mehmet’ten tahsil yoluna gider.',
 h:['Sözlü kefaleti geçerli saymak: yazılı şekil şarttır.','Eş rızasını unutmak: evli kefil için gereklidir.','Kefilin sorumluluğunun sınırsız olduğunu sanmak: azami miktar yazılı olarak belirtilir.'],
 ip:'Kefalet = Yazılı + el yazısıyla miktar ve tarih + eş rızası.',
 s:'Kefalet sözleşmesi yazılı şekilde yapılır; kefil sorumlu olacağı azami miktarı ve tarihi el yazısıyla yazar, evli ise eşinin yazılı rızası aranır (TBK m.581 vd.).',
 m:['Kefalet sözleşmesi hangi şekilde yapılmak zorundadır?',['yazili'],'Yazılı şekilde (TBK m.583).']},
{id:'kdv',a:'maliye',k:/\bkdv\b|katma deger/,b:'Katma Değer Vergisi (KDV) ve İndirim Mekanizması',ara:'katma değer vergisi',
 g:'KDV, her üretim ve dağıtım aşamasında alınır ama sonunda yükünü yalnızca son tüketici taşır. Bunu sağlayan şey indirim mekanizmasıdır.',
 c:['KDV (3065 sayılı Kanun): mal teslimi ve hizmet ifası gibi işlemlerden alınan, dolaylı ve çok aşamalı bir tüketim vergisidir.',
  'İndirim mekanizması: ödenecek KDV = hesaplanan KDV (satışlardan) − indirilecek KDV (alışlardan). Fark negatifse bir sonraki döneme devreder (belirli şartlarla iade de mümkündür).',
  'Vergiyi doğuran olay, kanunda gösterilen teslim veya hizmetin yapılmasıdır.',
  'Yük kimde? Mükellef vergiyi devlete öder ama bedele ekleyerek bunu alıcıya yansıtır; nihai yük son tüketicidedir.',
  'Oranlar mal ve hizmet gruplarına göre değişir ve güncel hâli Gelir İdaresi’nden kontrol edilmelidir.'],
 o:'Oranı %20 varsayalım. Üretici 1.000 TL’lik malı satınca 200 TL KDV hesaplar. Hammadde alırken ödediği 120 TL KDV’yi indirirse devlete 80 TL öder. Zincirin sonundaki tüketici toplam KDV’yi fiyatın içinde öder.',
 h:['KDV’yi mükellefin kendi gelirinden ödediğini sanmak: yük son tüketicide kalır.','Hesaplanan KDV’yi doğrudan ödenecek KDV saymak: önce indirilecek KDV düşülür.','KDV’yi gelir üzerinden alınan vergi sanmak: işlem (tüketim) üzerinden alınır.'],
 ip:'Ödenecek KDV = Hesaplanan − İndirilecek.',
 s:'KDV, mal teslimi ve hizmet ifası üzerinden alınan çok aşamalı bir dolaylı vergidir; ödenecek KDV, hesaplanan KDV’den indirilecek KDV’nin çıkarılmasıyla bulunur ve nihai yükü son tüketici taşır.',
 m:['Ödenecek KDV, hesaplanan KDV’den hangi büyüklük düşülerek bulunur?',['indir'],'İndirilecek KDV düşülerek bulunur.']},
{id:'yumusakguc',a:'uluslararasi',k:/yumusak guc|soft power|sert guc|akilli guc|\bnye\b/,b:'Yumuşak Güç (Joseph Nye)',ara:'yumuşak güç',
 g:'Güç yalnızca silah ve para değildir. Bazı devletler, başkalarının kendilerini örnek almasını ve istediklerini gönüllü yapmasını sağlayarak da etkili olur.',
 c:['Yumuşak güç (Joseph Nye): zorlama ya da ödülle değil, cazibe ve ikna yoluyla istediğini elde etme yeteneğidir.',
  'Kaynakları: kültür, siyasi değerler ve meşru, ahlaken inandırıcı dış politika.',
  'Sert güç: askerî güç ve ekonomik baskı ya da ödüllerle başkalarını davranışa zorlamaktır.',
  'Akıllı güç: sert ve yumuşak gücün bir stratejide birlikte, duruma uygun biçimde kullanılmasıdır.',
  'Eleştiri: yumuşak gücün ölçülmesi ve sonuca etkisinin kanıtlanması zordur.'],
 o:'Bir ülkenin filmleri, üniversiteleri ve kültürü yurt dışında hayranlık uyandırıyorsa, o ülkenin dış politikası da daha az dirençle karşılaşabilir. Bu etki, askerî tehdit olmadan, cazibe yoluyla kazanılan bir güçtür.',
 h:['Yumuşak gücü yalnızca “propaganda” saymak: kaynakları kültür, değerler ve politikadır.','Sert gücü yok saymak: kuram ikisini tamamlayıcı görür (akıllı güç).','Yumuşak gücü devletin kontrol ettiği bir araç sanmak: büyük kısmı sivil toplum, kültür ve piyasa kaynaklıdır.'],
 ip:'Sert güç: “yap!” Yumuşak güç: “yapmak isterim.”',
 s:'Yumuşak güç, devletin zorlama veya ödül yerine cazibe ve ikna yoluyla istediğini elde etme yeteneğidir; kaynakları kültür, siyasi değerler ve meşru dış politikadır (Nye).',
 m:['Yumuşak güç kavramını geliştiren kuramcı kimdir?',['nye'],'Joseph Nye.']},
/* ---------------- 4. PARTİ (10 kart) ---------------- */
{id:'carpan',a:'iktisat',k:/carpan/,b:'Çarpan Etkisi',ara:'çarpan',
 g:'Bir lira harcama, bir liradan fazla gelir yaratabilir; çünkü harcanan para başkasının gelirine dönüşür ve o da harcar. Çarpan, bu zincirleme etkinin büyüklüğünü ölçer.',
 c:['Çarpan: otonom harcamadaki (yatırım, kamu harcaması vb.) bir değişmenin, milli gelirde bunun kat kat fazlası bir değişme yaratmasıdır.',
  'Basit harcama çarpanı = 1 ÷ (1 − MTE) = 1 ÷ MTA. MTE marjinal tüketim eğilimi, MTA marjinal tasarruf eğilimidir (vergisiz, kapalı ekonomide).',
  'Vergi çarpanı = − MTE ÷ (1 − MTE); mutlak değerce harcama çarpanından küçüktür. Denk bütçe çarpanı 1’dir.',
  'Sızıntılar (tasarruf, vergi, ithalat) çarpanı küçültür; MTE büyüdükçe çarpan büyür.'],
 o:'MTE 0,8 ise çarpan 1 ÷ 0,2 = 5’tir. Yatırım harcaması 100 TL artarsa milli gelir toplamda 500 TL artar.',
 h:['Çarpanı 1 ÷ MTE sanmak: payda (1 − MTE)’dir.','Vergi çarpanını pozitif almak: vergi artışı geliri azaltır, işareti negatiftir.','Sızıntıları unutmak: ithalat ve vergi çarpanı düşürür.'],
 ip:'Çarpan = 1 ÷ MTA. Tasarruf eğilimi küçükse çarpan büyüktür.',
 s:'Çarpan, otonom harcamadaki değişmenin milli geliri kat kat değiştirmesidir; basit harcama çarpanı 1 ÷ (1 − MTE)’dir.',
 m:['Marjinal tüketim eğilimi 0,8 iken basit harcama çarpanı kaçtır?',[N('5')+'|\\bbes\\b'],'1 ÷ (1 − 0,8) = 5.']},
{id:'odemelerdengesi',a:'iktisat',k:/odemeler dengesi|cari acik|cari islem|cari denge/,b:'Ödemeler Dengesi ve Cari Açık',ara:'ödemeler dengesi cari açık',
 g:'Bir ülkenin dünyayla yaptığı bütün mal, hizmet ve finansal işlemlerin kaydı ödemeler dengesidir. Cari açık, ülkenin kazandığından fazla harcadığını ve farkı dışarıdan finanse ettiğini gösterir.',
 c:['Ödemeler dengesi üç ana hesaptan oluşur: cari işlemler hesabı (mal ve hizmet ticareti, birincil ve ikincil gelirler), sermaye hesabı ve finansal hesap. Net hata ve noksan da eklenir.',
  'Çift taraflı kayıt gereği, bütün kalemler birlikte düşünüldüğünde ödemeler dengesi sıfıra eşittir.',
  'Cari açık: cari işlemler hesabının eksi vermesidir. Açık ekonomide cari işlemler dengesi = yurt içi tasarruf − yatırım (S − I) olarak da yazılır.',
  'Finansman: cari açık, net sermaye girişi (doğrudan yatırım, portföy yatırımı, borçlanma) veya rezerv kullanımıyla kapatılır.'],
 o:'Bir ülke ihracat, turizm ve diğer gelirlerinden daha fazlasını ithalata ve dış ödemeye harcarsa cari açık verir. Farkı yabancı yatırım ve dış borçla ya da rezervlerinden karşılar.',
 h:['Dış ticaret dengesini cari işlemler dengesiyle aynı sanmak: cari işlemler daha geniştir.','Cari açığı bütçe açığıyla karıştırmak: ikincisi kamu gelir-gider farkıdır.','Ödemeler dengesinin sıfır olmasını “açık yok” saymak: kalemler tek tek açık verebilir.'],
 ip:'Cari işlemler dengesi = Tasarruf − Yatırım.',
 s:'Cari işlemler dengesi, yurt içi tasarruf ile yatırım arasındaki farka eşittir; cari açık, dış finansman (sermaye girişi ya da rezerv) ile kapatılır.',
 m:['Cari işlemler dengesi, yurt içi tasarruf ile hangi büyüklüğün farkına eşittir?',['yatirim'],'Yatırım (S − I).']},
{id:'guvenaraligi',a:'ekonometri',k:/guven aralig|guven arali|guven duzey/,b:'Güven Aralığı',ara:'güven aralığı',
 g:'Katsayı tahmini tek bir sayıdır, ama örneklemden örnekleme değişir. Güven aralığı, bu belirsizliği bir aralık olarak gösterir.',
 c:['Katsayı için (1 − α) güven aralığı: β̂ ± t(α/2) × se(β̂). t değeri n − k − 1 serbestlik derecesine göre alınır.',
  'Yorum: aynı yöntemle çok sayıda örneklem alınıp aralık hesaplansa, aralıkların yaklaşık %95’i gerçek katsayıyı içerir. Gerçek β sabittir, rastgele olan aralıktır.',
  'Genişlik: standart hata küçüldükçe (örneklem büyüdükçe) aralık daralır; güven düzeyi yükseldikçe genişler.',
  'Test bağlantısı: %95 güven aralığı sıfırı içermiyorsa H₀: β = 0, %5 düzeyinde reddedilir; katsayı anlamlıdır.'],
 o:'β̂ = 2,0, se = 0,5 ve t ≈ 2 ise %95 güven aralığı yaklaşık [1,0 ; 3,0]’dır. Aralık sıfırı içermediği için katsayı %5 düzeyinde anlamlıdır.',
 h:['“β bu aralıkta %95 olasılıkla” demek: β sabittir; olasılık, aralığı üreten yöntemle ilgilidir.','Aralığı daraltmak için güven düzeyini artırmak: tersine genişletir.','Sıfırı içeren aralığı “etki sıfırdır” diye yorumlamak: yalnızca sıfırın makul olduğunu söyler.'],
 ip:'β̂ ± t × se. Sıfır içeride mi? İçerideyse anlamsız, dışarıdaysa anlamlı.',
 s:'Güven aralığı, katsayı tahmininin β̂ ± t × se biçiminde bir aralıkla gösterilmesidir; %95 aralık sıfırı içermiyorsa katsayı %5 düzeyinde anlamlıdır.',
 m:['Katsayının %95 güven aralığı sıfırı içermiyorsa %5 düzeyinde katsayı hakkında ne söylenir?',['anlamli'],'Katsayı istatistiksel olarak anlamlıdır (H₀: β = 0 reddedilir).']},
{id:'ndc',a:'isletme',k:/nakit donusum|\bndc\b|calisma sermayesi|isletme sermayesi/,b:'Çalışma Sermayesi ve Nakit Dönüşüm Çevrimi',ara:'nakit dönüşüm çevrimi',
 g:'Şirket mal alır, satar ve parasını tahsil eder; bu arada tedarikçisine ödeme yapar. Paranın bu çevrimde kaç gün bağlı kaldığı, işletmenin nakit ihtiyacını belirler.',
 c:['Çalışma sermayesi (net): dönen varlıklar − kısa vadeli yabancı kaynaklar. İşletmenin günlük faaliyetlerini finanse edebilme kapasitesini gösterir.',
  'Nakit dönüşüm çevrimi (NDÇ) = stok devir süresi + alacak tahsil süresi − borç ödeme süresi.',
  'Stok devir süresi = 365 ÷ stok devir hızı. Alacak tahsil süresi, satışın ne kadar sürede tahsil edildiğidir; borç ödeme süresi ise tedarikçiye ne kadar sürede ödendiğidir.',
  'Yorum: NDÇ kısaldıkça işletmede daha az nakit bağlı kalır, finansman ihtiyacı azalır.'],
 o:'Stok devir süresi 60, alacak tahsil süresi 40, borç ödeme süresi 30 gün ise NDÇ = 60 + 40 − 30 = 70 gündür.',
 h:['Borç ödeme süresini toplamaya katmak: NDÇ’de çıkarılır.','NDÇ uzunsa iyi olduğunu sanmak: uzun NDÇ nakdin uzun süre bağlandığı anlamına gelir.','Çalışma sermayesini yalnızca nakit sanmak: dönen varlıkların tamamıdır (kısa vadeli borç düşülerek).'],
 ip:'NDÇ = Stok + Alacak − Borç (günler).',
 s:'Nakit dönüşüm çevrimi, stok devir süresi ile alacak tahsil süresinin toplamından borç ödeme süresinin çıkarılmasıyla bulunur ve nakdin işletmede kaç gün bağlı kaldığını gösterir.',
 m:['Stok devir süresi 60, alacak tahsil süresi 40, borç ödeme süresi 30 gün ise nakit dönüşüm çevrimi kaç gündür?',[N('70')+'|yetmis'],'60 + 40 − 30 = 70 gün.']},
{id:'gordon',a:'isletme',k:/gordon|temettu buyume|temettu iskonto|hisse deger/,b:'Gordon Büyüme Modeli (Hisse Değerlemesi)',ara:'gordon büyüme modeli temettü',
 g:'Bir hisse senedinin değeri, ondan beklenen gelecek temettülerin bugünkü değeridir. Temettüler sabit oranda büyüyorsa bu değer tek bir formülle bulunur.',
 c:['Gordon (sabit büyüme) modeli: P₀ = D₁ ÷ (r − g). D₁ gelecek yılın temettüsü, r özkaynak maliyeti (gerekli getiri), g temettünün sürekli büyüme oranıdır.',
  'D₁ = D₀ × (1 + g).',
  'Model yalnızca r > g iken anlamlıdır; g sonsuza dek sabit varsayılır.',
  'Yorum: r düştükçe ya da g yükseldikçe hisse değeri artar.'],
 o:'D₀ = 2 TL, g = %5, r = %15 ise D₁ = 2,1 TL ve P₀ = 2,1 ÷ (0,15 − 0,05) = 21 TL’dir.',
 h:['D₀ ile D₁’i karıştırmak: formül gelecek yılın temettüsünü kullanır.','r ≤ g iken formülü uygulamak.','g’yi geçmiş yıllardaki dalgalı artışa bakarak sabit saymak: modelin varsayımı sürekli sabit büyümedir.'],
 ip:'Hisse değeri = Gelecek temettü ÷ (r − g).',
 s:'Gordon modeline göre hisse değeri, gelecek yılın temettüsünün gerekli getiri ile büyüme oranı arasındaki farka bölünmesiyle bulunur: P₀ = D₁ ÷ (r − g).',
 m:['D₁ = 3 TL, r = %12, g = %2 ise Gordon modeline göre hisse değeri kaç TL’dir?',[N('30')+'|otuz'],'3 ÷ (0,12 − 0,02) = 30 TL.']},
{id:'yerindenyonetim',a:'kamu',k:/yerinden yonetim|mahalli idare|yerel yonetim|merkezi yonetim|merkezden yonetim/,b:'Merkezden ve Yerinden Yönetim (Mahalli İdareler)',ara:'yerinden yönetim mahalli idare',
 g:'Devlet her işi merkezden yapmaya kalksa yerel ihtiyaçlar aksar. Anayasa, idarenin merkezden yönetim ve yerinden yönetim esaslarına dayanmasını öngörür.',
 c:['Anayasa m.123: idare, kuruluş ve görevleriyle bir bütündür ve kanunla düzenlenir; idarenin kuruluş ve görevleri merkezden yönetim ve yerinden yönetim esaslarına dayanır.',
  'Merkezden yönetim: kararların merkezde toplandığı yapı (bakanlıklar, taşra teşkilatı olarak valilikler).',
  'Yerinden yönetim: yer yönünden (il özel idaresi, belediye, köy) ve hizmet yönünden (üniversiteler gibi kamu tüzel kişileri) ayrı tüzel kişiliğe sahip idareler.',
  'Mahalli idareler (Anayasa m.127): il, belediye ve köy halkının ortak yerel ihtiyaçlarını karşılayan, karar organları seçmenlerce seçilen kamu tüzel kişileridir.',
  'Merkezî idare, mahalli idareler üzerinde kanunla belirlenen ölçüde idari vesayet yetkisine sahiptir.'],
 o:'Belediye, kendi bütçesi, organları ve tüzel kişiliğiyle çöp toplama ve imar hizmetini yürütür; bakanlık ise belediyenin işlemlerini hiyerarşik olarak değil, yalnızca kanunun izin verdiği vesayet yetkisiyle denetleyebilir.',
 h:['Yerinden yönetimi hiyerarşi sanmak: yerel idareler bağımsız tüzel kişidir, denetim vesayetle olur.','Mahalli idarelerin organlarının atanarak geldiğini sanmak: karar organları seçimle belirlenir.','Yerinden yönetimi bağımsızlık saymak: idarenin bütünlüğü ilkesi geçerlidir.'],
 ip:'Merkez: hiyerarşi. Yerel idare: tüzel kişilik + vesayet.',
 s:'Anayasa m.123 gereği idare merkezden yönetim ve yerinden yönetim esaslarına dayanır; mahalli idareler karar organları seçmenlerce seçilen kamu tüzel kişileridir ve merkezî idarenin idari vesayetine tabidir (m.127).',
 m:['Anayasa’ya göre mahalli idarelerin karar organları nasıl oluşur?',['sec'],'Seçmenlerce seçilir (Anayasa m.127).']},
{id:'gis',a:'ceko',k:/genel islem sart|\bgis\b|onceden hazirlanmis sozlesme/,b:'Genel İşlem Şartları',ara:'genel işlem şartları',
 g:'Banka, sigorta ya da abonelik sözleşmelerinde metni sen yazmazsın, yalnızca imzalarsın. Genel işlem şartları, bu önceden hazırlanmış hükümlerin zayıf tarafı ezmesini önlemek için özel kurallara bağlanmıştır.',
 c:['Genel işlem şartları: bir sözleşme tarafının (düzenleyenin) çok sayıda benzer sözleşmede kullanmak üzere önceden, tek taraflı hazırlayıp karşı tarafa sunduğu hükümlerdir (TBK m.20 vd.).',
  'Bilgi ve dikkat: düzenleyen, karşı tarafın bu şartları öğrenmesini sağlamalıdır. Karşı tarafın dikkatine getirilmemiş hükümler sözleşmenin parçası sayılmaz.',
  'Yorum: belirsiz hükümler, hükmü düzenleyen aleyhine yorumlanır.',
  'İçerik denetimi: karşı tarafı dürüstlük kuralına aykırı biçimde zarara uğratan hükümler geçersizdir.',
  'Tarafların ayrıca pazarlık yaparak kararlaştırdığı hüküm, önceden hazırlanmış metinden önceliklidir.'],
 o:'Örnek olay (kurgu): Bir abonelik sözleşmesinin ekindeki matbu şartlarda, aboneliği iptal eden müşterinin yüksek bir ceza ödeyeceği yazılıdır. Müşteri bu hükümden haberdar edilmemişse ya da hüküm dürüstlük kuralına aykırı biçimde zarar yaratıyorsa hüküm bağlayıcı olmayabilir.',
 h:['İmzalanan her hükmün geçerli olduğunu sanmak: dikkatine sunulmayan ya da dürüstlük kuralına aykırı hükümler denetlenir.','Belirsizliğin tüketici aleyhine yorumlanacağını sanmak: düzenleyen aleyhine yorumlanır.','Tüketici sözleşmelerini bu kurallara tek başına bağlamak: tüketici hukukunda ayrıca özel hükümler vardır.'],
 ip:'Önceden hazırlanmış metin: Sun, Bildir, Denetle. Şüphede düzenleyen aleyhine.',
 s:'Genel işlem şartları, bir tarafın çok sayıda sözleşmede kullanmak için önceden hazırladığı hükümlerdir; karşı tarafın dikkatine sunulmaması, belirsizlik (düzenleyen aleyhine yorum) ve içerik denetimi gibi kurallara tabidir (TBK m.20 vd.).',
 m:['Genel işlem şartlarında belirsiz bir hüküm kimin aleyhine yorumlanır?',['duzenle|hazirla|sunan'],'Hükmü düzenleyen (hazırlayan) tarafın aleyhine.']},
{id:'mukellef',a:'maliye',k:/vergi sorumlusu|mukellef nedir|mukellef ve|mukellef ile|mukellef farki/,b:'Mükellef ve Vergi Sorumlusu',ara:'mükellef vergi sorumlusu',
 g:'Verginin yükünü taşıyan kişi ile verginin ödenmesinden idareye karşı sorumlu olan kişi her zaman aynı kişi değildir. Bu ayrım, stopaj gibi uygulamaları anlamanın anahtarıdır.',
 c:['Mükellef (VUK m.8): vergi kanunlarına göre kendisine vergi borcu düşen gerçek veya tüzel kişidir.',
  'Vergi sorumlusu (VUK m.9): verginin ödenmesi bakımından idareye karşı muhatap olan kişidir. Vergiyi mükellef adına keser ve öder, ancak vergi yükü mükellefte kalır.',
  'En tipik örnek stopaj (tevkifat): işveren, ücretten gelir vergisini keser ve idareye öder.',
  'Vergi sorumlusunun yükümlülüklerini yerine getirmemesi hâlinde idare, sorumludan hesap sorabilir.'],
 o:'İşveren, çalışanın ücretinden gelir vergisini keser ve idareye yatırır. Burada çalışan mükellef, işveren ise vergi sorumlusudur.',
 h:['Vergi sorumlusunu vergiyi kendi cebinden ödeyen kişi sanmak: yük mükellefindir.','Mükellef ile vergi taşıyıcısını (yükü ekonomik olarak taşıyan) karıştırmak.','Sorumluyu tamamen sorumsuz saymak: ödevlerini yerine getirmezse sorumlu tutulur.'],
 ip:'Mükellef borçludur; vergi sorumlusu “muhatap”tır.',
 s:'Mükellef, vergi borcu kendisine düşen kişidir; vergi sorumlusu ise verginin ödenmesi bakımından idareye karşı muhatap olan kişidir (VUK m.8–9).',
 m:['Çalışanın ücretinden gelir vergisi stopajı yapıp idareye ödeyen işveren hangi sıfatı taşır?',['sorumlu'],'Vergi sorumlusu.']},
{id:'vestfalya',a:'uluslararasi',k:/vestfalya|westphalia|egemenlik/,b:'Vestfalya Düzeni ve Egemenlik',ara:'vestfalya egemenlik',
 g:'Devletlerin kendi topraklarında en yüksek otorite olduğu ve birbirinin iç işlerine karışmadığı düşüncesi nereden geliyor? Modern devletler sisteminin sembolik başlangıcı Vestfalya Barışı’dır.',
 c:['Vestfalya Barışı (1648): Otuz Yıl Savaşları’nı sona erdiren Münster ve Osnabrück antlaşmalarıdır. Modern egemen devletler sisteminin başlangıcı sayılır.',
  'Egemenlik: devletin kendi toprağında nihai otorite olmasıdır (iç egemenlik) ve dışarıda diğer devletlerle hukuken eşit, bağımsız olmasıdır (dış egemenlik).',
  'Vestfalya ilkeleri: toprak bütünlüğü, devletlerin hukuki eşitliği ve iç işlerine karışmama.',
  'Eleştiri: bazı yazarlar bu düzenin 1648’de bir anda doğduğunu savunmanın abartılı olduğunu söyler (“Vestfalya miti”). Küreselleşme ve insan hakları da egemenliği sınırlayan faktörler olarak tartışılır.'],
 o:'Bir devlet, başka bir devletin yargı kararlarını ya da seçimlerini kendi iç işi saymayıp müdahale ederse, Vestfalya ilkelerinin gerektirdiği iç işlerine karışmama kuralı tartışma konusu olur.',
 h:['Egemenliği sınırsız güç sanmak: uluslararası hukuk ve anlaşmalar egemenliği sınırlar.','Vestfalya’yı yalnızca 1648’de doğmuş tek bir olay saymak: süreç daha uzundur ve tartışmalıdır.','Egemenliği yalnızca iç yönüyle düşünmek: dış egemenlik eşitlik ve bağımsızlıktır.'],
 ip:'1648 → egemen devletler: İç otorite + dışta eşitlik.',
 s:'Vestfalya Barışı (1648), egemen devletler sisteminin başlangıcı sayılır; egemenlik, devletin kendi toprağında en yüksek otorite olması ve dışarıda diğer devletlerle eşit olmasıdır.',
 m:['Modern devletler sisteminin başlangıcı sayılan Vestfalya Barışı hangi yıldır?',[N('1648')],'1648.']},
{id:'sogukavas',a:'uluslararasi',k:/soguk savas|iki kutup|kutupluluk/,b:'Soğuk Savaş ve İki Kutuplu Sistem',ara:'soğuk savaş',
 g:'İkinci Dünya Savaşı’ndan sonra dünya, iki süper gücün rekabeti etrafında şekillendi. Bu rekabet doğrudan büyük savaşa dönüşmedi ama uluslararası sistemin yapısını belirledi.',
 c:['Soğuk Savaş (kabaca 1947–1991): ABD ile SSCB arasındaki ideolojik, siyasi ve askerî rekabettir; iki süper gücün doğrudan sıcak savaşına dönüşmemiştir.',
  'İki kutuplu sistem: gücün iki merkezde (ABD ve SSCB) toplandığı sistemdir; devletler iki blok etrafında toplandı.',
  'Önemli adımlar: Truman Doktrini ve Marshall Planı (1947), NATO (1949), Varşova Paktı (1955), Küba Füze Krizi (1962), Berlin Duvarı (1961–1989).',
  'Détente (yumuşama), 1970’lerde gerilimin azaltılması çabasıdır. Soğuk Savaş, 1991’de SSCB’nin dağılmasıyla sona ermiştir.',
  'Kutupluluk: tek kutuplu, iki kutuplu ve çok kutuplu sistemler gücün dağılımına göre ayrılır; Soğuk Savaş sonrası dönem tek kutuplu mu çok kutuplu mu diye tartışılır.'],
 o:'Küba Füze Krizi (1962), iki süper gücün nükleer silah tehdidiyle karşı karşıya geldiği, ama sonunda diplomasi yoluyla çözdüğü bir olaydır; Soğuk Savaş’ın kriz yönetimi örneğidir.',
 h:['Soğuk Savaş’ı doğrudan ABD–SSCB savaşı sanmak: vekil savaşlar ve rekabet vardı, ikisi arasında doğrudan savaş olmadı.','Kutupluluğu yalnızca askerî güçle ölçmek: ekonomik ve ideolojik güç de önemlidir.','NATO ile Varşova Paktı’nı karıştırmak: NATO ABD önderliğinde Batı bloğunun, Varşova Paktı SSCB önderliğinde Doğu bloğunun örgütüdür.'],
 ip:'Soğuk Savaş = ABD vs SSCB, iki blok, 1947–1991.',
 s:'Soğuk Savaş, ABD ile SSCB arasındaki ideolojik ve stratejik rekabettir; sistemi iki kutuplu hâle getirmiş, 1991’de SSCB’nin dağılmasıyla sona ermiştir.',
 m:['Soğuk Savaş’ta iki kutuplu sistemin kutuplarından birini yaz.',['abd|amerika|sscb|sovyet'],'ABD ve SSCB.']},
/* ---------------- 5. PARTİ (son 4 kart): KAMU · ÇEKO · MALİYE · EKONOMETRİ ---------------- */
{id:'idariyargi',a:'kamu',k:/idari yargi|idare mahkemesi|danistay|bolge idare|uyusmazlik mahkemesi/,b:'İdari Yargı Teşkilatı: Görev ve Yetki',ara:'idari yargı idare mahkemesi danıştay',
 g:'İdarenin işlemlerine karşı hangi mahkemeye, hangi sırayla başvurulur? İdari yargı, adli yargıdan ayrı bir teşkilat olarak bu soruya cevap verir.',
 c:['Anayasa m.125: idarenin her türlü eylem ve işlemine karşı yargı yolu açıktır. İdari uyuşmazlıklara bakan mahkemeler idari yargıyı oluşturur.',
  'İdare mahkemeleri: idari işlemlere karşı iptal ve tam yargı davalarına bakan genel görevli ilk derece mahkemeleridir. Vergi mahkemeleri ise vergi, resim, harç gibi mali uyuşmazlıklara bakar.',
  'Bölge idare mahkemeleri istinaf mercii olarak ilk derece kararlarını inceler. Danıştay, temyiz mercii olmanın yanında kanunda sayılan bazı davalara ilk derece olarak da bakar.',
  'Yetki: kural olarak işlemi yapan idarenin bulunduğu yerdeki mahkeme yetkilidir; taşınmaz davaları gibi bazı ayrık hâllerde kanunda farklı yetki kuralları vardır.',
  'Uyuşmazlık Mahkemesi: adli yargı ile idari yargı arasındaki görev uyuşmazlıklarını çözer.',
  'Yargılama usulü ağırlıklı olarak yazılıdır ve hâkim, dosyayı kendiliğinden araştırır (re’sen araştırma ilkesi).'],
 i:['Uyuşmazlığın idari mi, adli mi olduğunu belirle.','Vergi, resim, harç ise vergi mahkemesi; diğer idari uyuşmazlıklarda idare mahkemesi görevlidir.','Yetkili mahkemeyi (işlemi yapan idarenin yeri vb.) bul ve süre içinde dava aç.','İlk derece kararına karşı bölge idare mahkemesine istinaf, sonrasında gerekirse Danıştay’a temyiz yolunu değerlendir.'],
 o:'Örnek olay (kurgu): Belediyenin verdiği bir işyeri kapatma kararına karşı işyeri sahibi, belediyenin bulunduğu yerdeki idare mahkemesinde iptal davası açar. İdare mahkemesi kararına karşı taraflar bölge idare mahkemesine istinaf başvurusunda bulunabilir.',
 h:['Vergi uyuşmazlığını idare mahkemesine götürmek: vergi mahkemesi görevlidir.','İdare mahkemesi kararına karşı doğrudan Danıştay’a gitmek: önce istinaf yolu vardır (kanunda ayrık hâller hariç).','İdari yargıyı adli yargının alt kolu sanmak: ayrı bir yargı koludur.'],
 ip:'İlk derece: idare ya da vergi mahkemesi → istinaf: bölge idare mahkemesi → temyiz: Danıştay.',
 s:'İdari yargı; idare ve vergi mahkemeleri (ilk derece), bölge idare mahkemeleri (istinaf) ve Danıştay’dan oluşur; adli ve idari yargı arasındaki görev uyuşmazlıklarını Uyuşmazlık Mahkemesi çözer.',
 m:['İdare mahkemesi kararlarına karşı istinaf başvurusu hangi mahkemeye yapılır?',['bolge'],'Bölge idare mahkemesine.']},
{id:'kira',a:'ceko',k:/\bkira|kiraci|kiraya veren/,b:'Kira Sözleşmesi (Konut Kirası)',ara:'kira sözleşmesi',
 g:'Kira, ev ve iş yeri gibi günlük hayatın en yaygın sözleşmesidir. Kanun, özellikle konut kiralarında kiracıyı koruyan emredici kurallar getirmiştir.',
 c:['Kira sözleşmesi (TBK m.299): kiraya veren, bir şeyin kullanılmasını ya da kullanılmasıyla birlikte ondan yararlanılmasını kiracıya bırakmayı, kiracı da karşılığında kira bedeli ödemeyi üstlenir.',
  'Kiracının başlıca borçları: kira bedelini ödemek, kiralananı özenle kullanmak ve komşulara saygı göstermek. Kiraya veren ise kiralananı kullanıma elverişli teslim etmek ve sözleşme boyunca bu durumda tutmakla yükümlüdür.',
  'Güvence (depozito, TBK m.342): konut ve çatılı işyeri kirasında en fazla 3 aylık kira bedeli kadar olabilir.',
  'Kira artışı (TBK m.344): yenilenen kira döneminde artış, bir önceki kira yılındaki TÜFE’nin 12 aylık ortalamasını geçemez. Geçici %25 sınırı 1 Temmuz 2024’te sona ermiştir; güncel oranı TÜİK’ten kontrol et.',
  'Konutta uzama (TBK m.347): belirli süreli sözleşme süre bitiminde aynı şartlarla bir yıl uzar. Kiracı süre bitiminden en az 15 gün önce bildirerek sona erdirebilir; kiraya veren ise kural olarak yalnızca kanundaki sınırlı nedenlerle ya da 10 yıllık uzama süresi sonunda sona erdirebilir.'],
 o:'Örnek olay (kurgu): Ayşe, aylık 20.000 TL’ye bir daire kiralar ve 3 aylık kira kadar (60.000 TL) güvence verir. Bir yıl sonra ev sahibi kirayı TÜFE’nin 12 aylık ortalama sınırının üzerinde artırmak isterse, üst sınırı aşan kısım geçerli olmaz.',
 h:['Güvenceyi sınırsız sanmak: konutta en fazla 3 aylık kira bedeli kadardır.','Kira artışını yıllık enflasyona bağlamak: esas alınan TÜFE’nin 12 aylık ortalamasıdır.','Konutta kiraya verenin dilediği zaman sözleşmeyi bitirebileceğini sanmak: uzama kuralları kiracıyı korur.'],
 ip:'Depozito ≤ 3 aylık kira; artış ≤ TÜFE 12 aylık ortalama; uzama: kiracı 15 gün önce bildirir.',
 s:'Kira sözleşmesinde kiraya veren kullanımı bırakır, kiracı kira bedelini öder (TBK m.299). Konutta güvence en fazla 3 aylık kira bedeli kadardır ve kira artışı TÜFE’nin 12 aylık ortalamasını aşamaz.',
 m:['Konut kirasında kiracının verebileceği güvence (depozito) en fazla kaç aylık kira bedeli kadardır?',[N('3')+'|\\buc\\b'],'3 aylık kira bedeli (TBK m.342).']},
{id:'gelirvergisi',a:'maliye',k:/gelir vergisi|gelir unsur|\bgvk\b/,b:'Gelir Vergisi: Gelir Unsurları ve Tarife',ara:'gelir vergisi',
 g:'Gelir vergisi, gerçek kişilerin bir takvim yılında elde ettikleri kazançlar üzerinden alınan ve vergi sisteminin merkezindeki doğrudan vergidir.',
 c:['Kapsam: gelir vergisi gerçek kişilerin gelirlerini vergilendirir (şirketlerin kazancı kurumlar vergisine tabidir).',
  'Gelir unsurları (GVK m.2): ticari kazançlar, zirai kazançlar, ücretler, serbest meslek kazançları, gayrimenkul sermaye iratları, menkul sermaye iratları ve diğer kazanç ve iratlar olmak üzere yedi unsur vardır.',
  'Mükellefiyet (GVK m.3): Türkiye’de yerleşmiş kişiler tam mükellef (dünya geliri), yerleşik olmayanlar dar mükellef (yalnızca Türkiye’de elde ettiği gelir) sayılır.',
  'Tarife (GVK m.103): artan oranlıdır; gelir yükseldikçe üst dilimlere daha yüksek oran uygulanır. Dilim tutarları ve istisnalar her yıl güncellenir, güncel hâli Gelir İdaresi’nden kontrol edilmelidir.',
  'Beyan: gelir, kural olarak ertesi yılın mart ayı içinde beyanname ile bildirilir; ücretlerde çoğu zaman işveren stopaj yoluyla vergiyi keser.'],
 o:'Bir kişi hem maaş (ücret) hem de kiraya verdiği daireden kira geliri (gayrimenkul sermaye iradı) elde ediyorsa iki ayrı gelir unsuru vardır. Gelirlerin toplamı, kanundaki şartlara göre beyan edilir ve artan oranlı tarifeden vergilendirilir.',
 h:['Şirket kazancını gelir vergisine tabi sanmak: sermaye şirketlerinde kurumlar vergisi söz konusudur.','Artan oranlıyı bütün gelire en yüksek oranın uygulanması sanmak: dilim dilim uygulanır.','Gelir unsurlarını yalnızca ücret saymak: yedi unsur vardır.'],
 ip:'Gelir vergisi = 7 unsur + artan oranlı tarife (dilim dilim).',
 s:'Gelir vergisi, gerçek kişilerin gelirlerini yedi gelir unsuru üzerinden artan oranlı tarifeyle vergilendirir (GVK m.2, m.103); tam mükellefler dünya gelirinden, dar mükellefler Türkiye’de elde ettikleri gelirden sorumludur.',
 m:['Gelir Vergisi Kanunu’na göre kaç gelir unsuru vardır?',[N('7')+'|\\byedi\\b'],'7 gelir unsuru (GVK m.2).']},
{id:'modelbelirleme',a:'ekonometri',k:/eksik degisken|model belirleme|\breset\b|ilgisiz degisken|gereksiz degisken|yanlis model|fonksiyonel bicim/,b:'Model Belirleme Hataları (Eksik ve Gereksiz Değişken)',ara:'model belirleme hatası eksik değişken',
 g:'Regresyon modelini kurarken yanlış değişkenleri koymak ya da önemli birini unutmak, katsayıları ciddi biçimde bozabilir. Bunlar model belirleme hatalarıdır.',
 c:['Eksik değişken yanlılığı: Y’yi etkileyen ve modeldeki X ile ilişkili bir değişken modele konmazsa X’in katsayı tahmini yanlı ve tutarsız olur.',
  'Yanlılığın yönü: eksik değişkenin Y üzerindeki etkisi ile X’le ilişkisinin işaretine bağlıdır (iki işaret aynıysa pozitif yanlılık).',
  'Gereksiz (ilgisiz) değişken: modele fazladan değişken eklemek katsayıları yanlı yapmaz ama varyansı artırır (etkinlik kaybı). R² her zaman artar, bu yüzden düzeltilmiş R² kullanılır.',
  'Yanlış fonksiyonel biçim: ilişki doğrusal değilse (log, kare terim gerekiyorsa) doğrusal model hatalıdır. Ramsey RESET testi bunu sınar (H₀: model doğru belirlenmiştir).',
  'Önlem: iktisat kuramına dayanarak modeli kurmak, önemli değişkenleri dahil etmek, gerekirse yaklaşık (proxy) değişken kullanmak.'],
 o:'Ücret = f(eğitim) modelinde yetenek modele konmazsa, yetenek hem ücreti hem eğitimi artırdığı için eğitimin katsayısı olduğundan büyük çıkar (pozitif yanlılık).',
 h:['İlgisiz değişken eklemenin katsayıları yanlı yaptığını sanmak: sapma yoktur, varyans artar.','Yüksek R²’yi modelin doğru olduğunun kanıtı saymak.','Eksik değişken yanlılığını yalnızca örneklem küçüklüğüne bağlamak: örneklem büyüse de yanlılık sürer.'],
 ip:'Eksik değişken → yanlılık. Fazla değişken → varyans artışı.',
 s:'Y’yi etkileyen ve X ile ilişkili bir değişkenin modelden çıkarılması X’in katsayı tahminini yanlı yapar; gereksiz değişken eklemek ise yanlılık yaratmaz ama varyansı artırır.',
 m:['Y’yi etkileyen ve X ile ilişkili bir değişken modelden çıkarılırsa X’in katsayı tahmini nasıl olur?',['yanli(lik)?\\b|sapmali'],'Yanlı (ve tutarsız) olur.']}
];

/* ---------------- KARŞILAŞTIRMA KARTLARI ---------------- */
const FARK=[
{k:[/realizm|realist/,/liberal/],b:'Realizm ile Liberalizm',an:['Realizm','Liberalizm'],a:'uluslararasi',
 s:[['Temel varsayım','Sistem anarşiktir; devletler hayatta kalmayı hedefler.','Kurallar ve kurumlar anarşinin sertliğini yumuşatır.'],
  ['İş birliği','Kırılgan; devletler göreli kazanca bakar.','Mümkün; mutlak ve ortak kazançlar önemlidir.'],
  ['Kurumlar','Güçlü devletlerin aracıdır.','Davranışı bağlayan, bağımsız etkisi olan yapılardır.'],
  ['Ekonomik bağımlılık','Zafiyet ve koz demektir.','Çatışmanın maliyetini yükselterek barışı destekler.'],
  ['Başlıca isimler','Morgenthau, Waltz, Mearsheimer','Keohane, Nye, Kant geleneği'],
  ['Başlıca eleştiri','İş birliğini (ör. AB) açıklamakta zorlanır.','Güç siyasetini hafife alır.']],
 ip:'Realist “kim güçlü?” diye sorar; liberal “kurallar ne diyor, birlikte kim kazanıyor?” diye sorar.',
 m:['Realizmde temel aktör nedir ve sistem nasıl nitelendirilir?',['devlet','anars'],'Temel aktör devlettir; sistem anarşiktir (üstün bir otorite yoktur).']},
{k:[/tam yargi/,/iptal/],b:'İptal Davası ile Tam Yargı Davası',an:['İptal davası','Tam yargı davası'],a:'kamu',
 s:[['Amaç','İdari işlemi hukuka aykırılık nedeniyle ortadan kaldırmak.','Kişisel hakkın ihlalinden doğan zararı gidermek ya da hakkı tanıtmak.'],
  ['Konu','İdari işlem','İdari işlem veya idari eylem'],
  ['Dava açma şartı','Menfaat ihlali','Hakkın (kişisel hakkın) ihlali'],
  ['Süre','İşlemin tebliğinden itibaren 60 gün (İYUK m.7).','İşlemden doğan zararda 60 gün; eylemden doğan zararda önce idareye başvuru (zararı öğrenmeden 1 yıl, her hâlde eylemden 5 yıl) sonra 60 gün (İYUK m.13).'],
  ['Karar etkisi','Objektif; iptal herkes için sonuç doğurur.','Subjektif; taraflar arasında hak ve zarar belirler.']],
 ip:'İptal: “bu işlem hukuka uygun mu?” Tam yargı: “bana ne ödenecek, hakkım ne olacak?”',
 m:['Zararın tazmini hangi davanın konusudur: iptal mi, tam yargı mı?',['tam yarg'],'Tam yargı davasının.']},
{k:[/zamanasim/,/hak dusurucu/],b:'Zamanaşımı ile Hak Düşürücü Süre',an:['Zamanaşımı','Hak düşürücü süre'],a:'ceko',
 s:[['Hâkim kendiliğinden gözetir mi?','Hayır; borçlunun def’i ileri sürmesi gerekir.','Evet; hâkim re’sen dikkate alır.'],
  ['Durma ve kesilme','Olur.','Olmaz.'],
  ['Süre dolunca','Alacak ortadan kalkmaz, dava yoluyla zorlanamaz (eksik borç).','Hakkın kendisi sona erer.'],
  ['Örnek','Genel alacaklarda 10 yıl (TBK m.146).','İptal davası açma süresi (60 gün), irade sakatlığında bildirim süresi (1 yıl).']],
 ip:'Zamanaşımında hak yaşar ama zorlanamaz; hak düşürücü sürede hakkın kendisi biter.',
 m:['Durma ve kesilmeye hangisinde izin verilir: zamanaşımında mı, hak düşürücü sürede mi?',['zamanas'],'Zamanaşımında; hak düşürücü sürede durma ve kesilme olmaz.']},
{k:[/(hareket|kayma|kayis)/,/(talep|arz)/],b:'Eğri Üzerinde Hareket ile Eğrinin Kayması',an:['Hareket','Kayma'],a:'iktisat',
 s:[['Neden','Malın kendi fiyatı değişir.','Fiyat dışı bir belirleyici değişir (gelir, zevk, ilgili mal fiyatı, beklenti, nüfus).'],
  ['Grafikte','Aynı eğri üzerinde bir noktadan diğerine geçiş.','Eğrinin tamamı sağa ya da sola gider.'],
  ['Adlandırma','Talep edilen (arz edilen) miktarda değişme','Talepte (arzda) değişme']],
 ip:'Fiyat kendi eğrisini gezdirir; fiyat dışındaki her şey eğriyi taşır.',
 m:['Bir malın kendi fiyatı düşerse talep eğrisi kayar mı?',['hay[ir]|uzerinde|hareket|miktar'],'Hayır; eğri üzerinde aşağı doğru hareket olur, talep edilen miktar artar.']}
];

KART.forEach(c=>{FZ.ekleRe(c.k);FZ.ekle(c.b)});FARK.forEach(f=>{(f.k||[]).forEach(r=>FZ.ekleRe(r));FZ.ekle(f.b)});
/* ---------------- yardımcılar ---------------- */
const DSTOP=new Set('anlat anlatir misin misiniz acikla aciklar ornekle ornek ornekli bastan sona ders dersi konu konuyu konusunu bana bize detayli ayrintili kisaca sade nedir ne demek nasil kavrami kavramini hakkinda ver lutfen ogret ogretir'.split(' '));
const konu=q=>nt(q).split(' ').filter(w=>w&&!DSTOP.has(w)).join(' ');
const cum=x=>String(x||'').replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s=>s.length>25);
let SON=null,SONID='',SONK=null;
const dipnot=hk=>'\n\n📚 Eko-Log yerel ders kartı · yapay zekâ kullanılmadı. Bilgilendirme amaçlıdır'+(hk?'; resmî metin için mevzuat.gov.tr’ye bakınız.':'.');
const miniSor=m=>'\n\n**❓ Mini soru**\n'+m[0]+'\n(Cevabını yaz; bilmiyorsan “pas” yaz.)';

function kartMetin(c){
  const L=['📚 **'+c.b+'**','\n**🎯 Büyük resim**\n'+c.g,'\n**🧩 Temel kavramlar**',...c.c.map(x=>'• '+x)];
  if(c.i)L.push('\n**🪜 Adım adım**',...c.i.map((x,j)=>(j+1)+'. '+x));
  if(c.o)L.push('\n**🧪 Örnek**\n'+c.o);
  if(c.h)L.push('\n**⚠️ Sık yapılan hatalar**',...c.h.map(x=>'• '+x));
  if(c.ip)L.push('\n**🧠 Hafıza ipucu**\n'+c.ip);
  if(c.s)L.push('\n**✍️ Sınavda nasıl yazılır?**\n'+c.s);
  if(c.l)L.push('\n**🎛 Laboratuvarda dene**\n'+c.l);
  return L.join('\n')+dipnot(HUK.includes(c.a))+miniSor(c.m)}
function farkMetin(f){
  const L=['⚖️ **'+f.b+'**','\n**Ayırt et**',...f.s.map(r=>'• **'+r[0]+'**\n   '+f.an[0]+': '+r[1]+'\n   '+f.an[1]+': '+r[2]),'\n**🧠 Hafıza ipucu**\n'+f.ip];
  return L.join('\n')+dipnot(HUK.includes(f.a))+miniSor(f.m)}

/* Boşluk doldurma sorusu: tanım cümlesinden en uzun içerik sözcüğünü saklar */
function bosluk(x,baslik){
  const bt=new Set(tok(baslik));
  for(const s of cum(x)){if(s.length<40||s.length>220)continue;
    const ws=(s.match(/[\p{L}]{7,}/gu)||[]).filter(w=>!bt.has(tl(w).slice(0,5))&&![...bt].some(b=>tl(w).startsWith(b.slice(0,5))));
    if(!ws.length)continue;const w=ws.sort((a,b)=>b.length-a.length)[0],nw=tl(w),stem=nw.slice(0,Math.min(nw.length-1,Math.max(4,Math.floor(nw.length*0.6))));
    return{b:baslik,s:'Boşluğu doldur: '+s.replace(w,'_____'),g:[stem],c:'Cevap: “'+w+'”. Cümle: '+s}}
  return null}

/* Hazır kart yoksa: sitedeki içerikten özet ders derle */
function genel(q){
  const t=konu(q);if(t.length<3||!DB)return null;
  const cs=ara(t,8).filter(c=>c._s>=3);if(!cs.length)return{yok:1};
  const ana=cs.find(c=>['sozluk','hukuk','dusunur','aktor'].includes(c.k))||cs[0],x=String(ana.x||''),ss=cum(x),nx=nt(x);
  const L=['📚 **'+ana.t+'**'+(ana.c?' ('+ana.c+')':'')];
  if(ss[0])L.push('\n**🎯 Büyük resim**\n'+ss[0]);
  L.push('\n**📌 Tanım ve açıklama**\n'+(x.length>900?x.slice(0,900).replace(/\s\S*$/,'')+'…':x));
  const ilg=[...new Map(DB.filter(c=>c.t!==ana.t&&c.k==='sozluk'&&nt(c.t).length>=5&&nx.includes(nt(c.t))).concat(cs.filter(c=>c.t!==ana.t&&c.k==='sozluk')).map(c=>[c.t,c])).values()].slice(0,5);
  if(ilg.length)L.push('\n**🔗 Bağlantılı kavramlar**\n'+ilg.map(c=>c.t).join(', ')+'. Bunların tanımlarını sözlükte yan yana okuyup farkı kendi cümlenle yazmayı dene.');
  const du=cs.filter(c=>c.k==='dusunur').slice(0,2);if(du.length)L.push('\n**👤 İlgili düşünür**\n'+du.map(c=>c.t).join(', '));
  const pr=cs.filter(c=>c.k==='lab'||c.k==='quiz').slice(0,3);if(pr.length)L.push('\n**🧪 Pratik yap**\n'+pr.map(c=>c.t).join(' · ')+' (aşağıdaki bağlantılar)');
  L.push('\n**✍️ Sınavda nasıl yazılır?**\nÖnce tek cümleyle tanımı yaz, sonra en önemli özelliğini ya da unsurunu say, son olarak kısa bir örnek ver.');
  const mini=bosluk(x,ana.t);
  L.push('\nℹ️ Bu konu için hazır ders kartı yok; sitedeki içerikten derlenmiş özet ders. Yapay zekâ kullanılmadı.'+(mini?'\n\n**❓ Mini soru**\n'+mini.s+'\n(Cevabını yaz; bilmiyorsan “pas” yaz.)':''));
  SON={s:'Önce tek cümleyle tanımı yaz, sonra en önemli özelliğini ya da unsurunu say, son olarak kısa bir örnek ver.'};
  return{t:L.join('\n'),ara:[ana,...ilg,...du,...pr],mini}}

/* "X ile Y'yi karşılaştır" (hazır fark kartı yoksa): iki kavramın sözlük tanımını yan yana koy */
function kars(q){
  const p=nt(q).replace(/\b(karsilastir|farki|arasindaki|fark|nedir|ayirt et|ayir|anlat)\b/g,' ').split(/\s+(?:ile|ve|ya da|mi|yoksa)\s+/).map(s=>konu(s)).filter(s=>s.length>2);
  if(p.length<2)return null;
  const r=p.slice(0,2).map(s=>ara(s,3).filter(c=>c._s>=3)[0]);if(r.some(c=>!c))return null;
  const L=['⚖️ **'+r[0].t+' ile '+r[1].t+'**','\nSitedeki tanımlara göre:'];
  r.forEach(c=>{const s=cum(c.x);L.push('\n**'+c.t+'**\n'+(s.slice(0,2).join(' ')||c.x.slice(0,300)))});
  L.push('\n**🧠 Ayırt etme yolu**\nİki tanımda ortak olanı ve yalnızca birinde geçeni ayrı ayrı yaz; sınavda “X şudur, Y şu yüzden farklıdır” kalıbıyla bitir.\n\nℹ️ Hazır fark kartı yok; sitedeki içerikten derlendi. Yapay zekâ kullanılmadı.');
  return{t:L.join('\n'),ara:r}}

/* Ek toleransı: “esnekliği, temerrüdü, bağımlılığı” gibi çekimli yazımlar için kelime varyantları (yalnızca ilk eşleşme başarısızsa denenir) */
const EKLER=['lari','leri','larin','lerin','ndan','nden','dan','den','tan','ten','yla','yle','nin','nun','si','su','yi','yu','ni','nu','in','un','i','u','e','a','ye','ya','de','da','te','ta','le','la'].sort((x,y)=>y.length-x.length);
const YUM={g:'k',d:'t',b:'p'};
function kelimeVar(w){const v=new Set([w]);let k=w;
  for(let tur=0;tur<2;tur++){let kes=false;
    for(const ek of EKLER){if(k.length>5&&k.endsWith(ek)&&k.length-ek.length>=4){k=k.slice(0,-ek.length);v.add(k);const son=k.slice(-1);if(YUM[son])v.add(k.slice(0,-1)+YUM[son]);kes=true;break}}
    if(!kes)break}
  return [...v]}
function varyant(n){const ws=n.split(' ').filter(Boolean);if(ws.length>6)return[];
  let acc=[''];for(const w of ws){const nxt=[];for(const a of acc)for(const x of kelimeVar(w))nxt.push(a?a+' '+x:x);acc=nxt}
  return acc.filter(x=>x!==n)}
const esles=n=>{
  for(const f of FARK)if(f.k.every(r=>r.test(n))){SON={s:f.ip};SONID=f.b;SONK=null;return{kart:1,t:farkMetin(f),mini:{b:f.b,g:f.m[1],c:f.m[2]},ara:[]}}
  for(const c of KART)if(c.k.test(n)){SON=c;SONID=c.id;SONK=c;
    const ar=DB?ara(c.ara||c.b,5).filter(x=>x._s>=3):[];
    return{kart:1,t:kartMetin(c),mini:{b:c.b,g:c.m[1],c:c.m[2]},ara:ar}}
  return null};

/* Takip soruları: son ders kartına bağlı kısa sorular (“örnek ver”, “sık hatalar”, “hafıza ipucu”…) */
const TAKIP=[[/ornek/,'o','🧪 Örnek'],[/hata|yanlis/,'h','⚠️ Sık yapılan hatalar'],[/ipucu|hafiza|ezber|aklda/,'ip','🧠 Hafıza ipucu'],[/adim/,'i','🪜 Adım adım'],[/kavram|temel/,'c','🧩 Temel kavramlar'],[/buyuk resim|ozet|kisaca/,'g','🎯 Büyük resim'],[/lab|dene|simulasyon/,'l','🎛 Laboratuvarda dene']];
const TKS=new Set('sik yapilan hatalar hata yanlis ipucu hafiza ezber adim adim kavramlar kavram temel daha baska peki ya bu konuda konunun icin de da ki var mi goster bir ornek ornekler ozet kisaca lab dene buyuk resim'.split(' '));
function takip(n){
  if(!SONK)return null;
  const w=nt(n).split(' ').filter(Boolean);
  if(!w.length||w.length>6||w.some(x=>!TKS.has(x)&&!DSTOP.has(x)))return null;
  const m=TAKIP.find(t=>t[0].test(nt(n)));if(!m)return null;
  const v=SONK[m[1]];
  if(!v||(Array.isArray(v)&&!v.length))return{t:'Bu konu kartında “'+m[2].replace(/^\S+\s/,'')+'” bölümü yok. Konunun tamamını yeniden anlatabilirim.',chips:[SONK.b+' konusunu anlat','Beni bir soruyla sına','Başka bir konu']};
  const L=['**'+m[2]+'** — '+SONK.b,Array.isArray(v)?v.map((x,j)=>(m[1]==='i'?(j+1)+'. ':'• ')+x).join('\n'):v];
  return{t:L.join('\n\n'),chips:['Sınavda nasıl yazılır?','Beni bir soruyla sına','Başka bir konu']}}
return{
  cevap(q){
    const n=tl(q);
    {const tk=takip(q);if(tk)return tk}
    if(SON&&SON.s&&/sinavda|sinav.*yaz|nasil yaz/.test(n))return{t:'✍️ **Sınavda nasıl yazılır?**\n'+SON.s,chips:['Beni bir soruyla sına','Başka bir konu']};
    if(/^baska (bir )?konu|^konu sec/.test(n))return{t:'Hangi konuyu çalışalım? Aşağıdan seç ya da konuyu yaz (ör. “net bugünkü değeri anlat”).',konu:1};
    let e=esles(n);if(e)return e;
    for(const v of varyant(n)){e=esles(v);if(e)return e}
    {const fz=FZ.duzelt(n);if(fz.degisti){e=esles(fz.t);if(e)return e;for(const v of varyant(fz.t)){e=esles(v);if(e)return e}}}   /* yazım hatası: “enflasyn”, “esnekk” */
    if(/karsilastir|farki|ayirt|arasindaki/.test(n)){const k=kars(q);if(k)return k}
    return genel(q)},
  /* Rastgele bir kartın mini sorusu (alana göre) */
  mini(alan,w,onek){
    let l=KART.filter(c=>c.a===alan);if(!l.length)l=KART;
    const l2=l.filter(c=>c.id!==SONID),hv=l2.length?l2:l;const c=w?agSec(hv.some(x=>(w(x.b)||0)>0)?hv:l,w):rnd(hv);SONID=c.id;
    return{t:(onek||'')+'❓ **'+c.b+'** konusundan soru:\n'+c.m[0]+'\n(Cevabını yaz; bilmiyorsan “pas” yaz.)',mini:{b:c.b,g:c.m[1],c:c.m[2],a:c.a}}},
  /* Bir alanın ders kartı konuları (çalışma planı ve tekrar modu için) */
  konular(alan){return KART.filter(c=>c.a===alan).map(c=>c.b)},
  /* Mini soru cevabını değerlendir (kural tabanlı: anahtar kalıplar) */
  deger(s,q){
    const n=tl(q);
    if(/^(pas|gec|bilmiyorum|bilmem|goster|cevabi goster|cevap)\b/.test(n))return{sonuc:'p',t:'Cevap: '+s.c,chips:[s.b+' konusunu anlat','Beni bir soruyla sına','Başka bir konu']};
    if(/\b(anlat|acikla|nedir|karsilastir|ornekle|ozetle)\b/.test(n)||/\bsina\b|baska (bir )?(konu|soru)|sinavda|nasil yaz|soru daha|\?\s*$/.test(n)||n.length>400)return{yeni:1};
    const h=s.g.filter(r=>{try{return new RegExp(r).test(n)}catch(e){return false}}).length,T=s.g.length;
    const t=h===T?'✅ Doğru! '+s.c:(h>0&&h>=Math.ceil(T/2)?'🟡 Kısmen doğru ('+h+'/'+T+'). Tam cevap: '+s.c:'❌ Bu sefer olmadı. Cevap: '+s.c+'\nİstersen konuyu yeniden anlatayım.');
    return{sonuc:h===T?'d':(h>0&&h>=Math.ceil(T/2)?'k':'y'),t,chips:h===T?['Beni bir soruyla sına','Başka bir konu']:[s.b+' konusunu anlat','Beni bir soruyla sına','Başka bir konu']}},
  liste(alan){
    const a=KART.filter(c=>c.a===alan).map(c=>c.b).concat(FARK.filter(f=>f.a===alan).map(f=>f.b));
    return 'Bu konu sitede yok.'},
  /* test için */_KART:KART,_FARK:FARK
}})();
/*DERS-BITIS*/

function ara(q,k=6){
  const qs=tok(q).filter(w=>!STOP.has(w)).map(w=>(w.length<5||IDX.df[w])?w:(FZ.yakin(w,IDX.keys)||w)),N=DB.length,r=[],qc=qs.join(' ');
  const tc=(TERCIH[MOD]||[]).concat(PROFIL.bolum&&LABAD[PROFIL.bolum]?[LABAD[PROFIL.bolum]]:[]);
  if(!qs.length)return[];
  DB.forEach((c,i)=>{const d=IDX[i];let s=0;
    qs.forEach(w=>{const f=d.f[w];if(f)s+=Math.log(1+N/(IDX.df[w]||1))*f/(f+1.2)});
    if(d.tt===qc)s+=20;else if(qs.every(w=>d.tt.includes(w)))s+=10;else if(qs.some(w=>d.tt.includes(w)))s+=1.5;
    if(s>0)r.push([s*(tc.includes(c.c)?1.6:1),c])});
  return r.sort((a,b)=>b[0]-a[0]).slice(0,k).map(x=>Object.assign({_s:x[0]},x[1]));
}


/* ---------- LAB İZCİSİ: lab iframe'lerine enjekte edilir; öğrencinin ne yaptığını ana sayfaya bildirir ---------- */
function izci(){
  if(window.__ekoIzci)return;window.__ekoIzci=1;
  const say=(t)=>String(t||'').replace(/\s+/g,' ').trim().slice(0,160);
  const mod=()=>{const a=document.querySelector('.xmodule:not([hidden])')||document.querySelector('section:not([hidden]) h2');
    const h=a&&(a.querySelector('h2')||a);return say(h&&h.textContent)||say(document.title)};
  const yolla=o=>{try{parent.postMessage(Object.assign({eko:'bot-olay',modul:mod(),t:Date.now()},o),'*')}catch(e){}};
  /* quiz: şık işaretlenince .correct/.wrong sınıfı gelir; soru + seçilen + geri bildirimi yakala */
  new MutationObserver(ms=>{ms.forEach(m=>{const e=m.target;
    if(m.type==='attributes'&&e.classList&&/(^|\s)(correct|wrong)(\s|$)/.test(e.className)&&e.classList.contains('wrong')){
      const kutu=e.closest('.xquiz,.ek,.box,section')||document.body;
      const soru=say((kutu.querySelector('.xquiz-q,.q,.ek-q,h3,h4,p')||{}).textContent);
      const dogru=say((kutu.querySelector('.correct')||{}).textContent);
      const fb=say((kutu.querySelector('.ek-fb,.xquiz-feedback,.hint')||{}).textContent);
      yolla({tur:'yanlis',soru,secilen:say(e.textContent),dogru,aciklama:fb})}
    if(m.type==='attributes'&&e.classList&&e.classList.contains('correct')&&e.closest('.xquiz-options,.opts,.opts2')&&!m.oldValue?.includes('correct')){
      const kutu=e.closest('.xquiz,.ek,.box,section')||document.body;
      yolla({tur:'dogru',soru:say((kutu.querySelector('.xquiz-q,.q,.ek-q,h3,h4,p')||{}).textContent)})}
  })}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
  /* kaydırıcı/giriş: bırakıldığında son değeri bildir (sürüklerken spam yok) */
  let zt;document.addEventListener('input',e=>{const el=e.target;if(!el.matches('input,select'))return;clearTimeout(zt);
    zt=setTimeout(()=>{const lab=el.closest('label,.row,.sl')||el.parentElement;
      yolla({tur:'ayar',ad:say(lab&&lab.textContent).slice(0,60),deger:el.value})},700)},true);
  /* ipucu / çözümü göster / sıfırla düğmeleri: öğrencinin takıldığının işareti */
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=say(b.textContent);
    if(/ipucu|çözümü göster|doğru çözüm|cevabı göster/i.test(t))yolla({tur:'yardim',dugme:t});
    else if(/sıfırla|yeniden/i.test(t))yolla({tur:'sifirla'});
    else if(/kontrol|denetle|gönder/i.test(t))yolla({tur:'kontrol',dugme:t})},true);
  yolla({tur:'acildi'});
}
function izciTak(){
  document.querySelectorAll('iframe').forEach(f=>{try{
    const d=f.contentDocument;if(!d||!d.body||d.__izci)return;d.__izci=1;
    const s=d.createElement('script');s.textContent='('+izci.toString()+')()';d.body.appendChild(s)}catch(e){}});
}
if(/eko-plus\/iibf-/.test(location.pathname))izci();   /* quiz/lab doğrudan bu sayfadaysa olaylar kendi sayfasına da bildirilir */
new MutationObserver(izciTak).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('load',izciTak,true);setInterval(izciTak,2500);

/* ---------- OTURUM: olayları biriktirir, yerelde analiz eder (ham kayıt cihazdan çıkmaz) ---------- */
const OK='eko_bot_oturum',IZIN='eko_bot_izin';
let OL=[];try{OL=JSON.parse(localStorage.getItem(OK)||'[]')}catch(e){}
const kaydet=()=>{try{localStorage.setItem(OK,JSON.stringify(OL.slice(-120)))}catch(e){}};
let rozet=null;
addEventListener('message',e=>{const d=e.data;if(!d||d.eko!=='bot-olay')return;delete d.eko;
  const son=OL[OL.length-1];if(son&&son.tur===d.tur&&son.soru===d.soru&&d.t-son.t<2000)return;
  OL.push(d);kaydet();
  if(d.tur==='yanlis'||d.tur==='yardim'){const n=OL.slice(-8).filter(x=>x.modul===d.modul&&(x.tur==='yanlis'||x.tur==='yardim')).length;
    if(n>=2&&!box.classList.contains('on'))fab.dataset.n='!'}});
const ls=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
function analiz(){
  const mod={};OL.forEach(o=>{const m=mod[o.modul]=mod[o.modul]||{ad:o.modul,yanlis:[],dogru:0,yardim:0,sifirla:0,ayar:[],ilk:o.t,son:o.t};
    m.son=o.t;if(o.tur==='yanlis')m.yanlis.push({soru:o.soru,secilen:o.secilen,dogru:o.dogru,aciklama:o.aciklama});
    if(o.tur==='dogru')m.dogru++;if(o.tur==='yardim')m.yardim++;if(o.tur==='sifirla')m.sifirla++;
    if(o.tur==='ayar')m.ayar.push(o.ad+'='+o.deger)});
  const moduller=Object.values(mod).map(m=>({modul:m.ad,dakika:Math.round((m.son-m.ilk)/60000),dogru:m.dogru,yanlis:m.yanlis.slice(-5),
    yardim_istedi:m.yardim,sifirlama:m.sifirla,son_ayarlar:m.ayar.slice(-6)})).slice(-6);
  const kal=ls('eko_lab_modern_v2')||{},quiz=ls('eko_lab_ex_v1')||{};
  return{deneme_sonuclari:OL.filter(o=>o.tur==='deneme').slice(-6).map(o=>({konu:o.modul,puan:o.puan})),moduller,tamamlanan_modul_sayisi:(kal.done||[]).length,son_modul_no:kal.last,quiz_en_iyi_skorlar:quiz};
}

/* ---------- Sohbetin sayfalar arasında korunması (yalnızca bu sekme, sessionStorage) ---------- */
const SK='eko_bot_sohbet';
function sohbetKaydet(){try{const L=[];log.querySelectorAll(':scope > .eb-m').forEach(m=>{const t=gm(m);if(t&&t!=='…'&&!/^(Cevabın değerlendiriliyor|Sorular hazırlanıyor|Güncel kaynaklara bakıyorum)/.test(t))L.push({u:m.classList.contains('eb-u'),t})});
  sessionStorage.setItem(SK,JSON.stringify({L:L.slice(-30),hist:hist.slice(-6),mod:MOD,on:box.classList.contains('on')}))}catch(e){}}
function sohbetYukle(){try{const S=JSON.parse(sessionStorage.getItem(SK)||'null');if(!S||!S.L||!S.L.length)return false;
  if(S.mod&&MODLAR[S.mod])modSec(S.mod,true);
  S.L.forEach(x=>mesaj(x.t,x.u?'eb-u':'eb-b'));hist=Array.isArray(S.hist)?S.hist:[];if(S.on){box.classList.add('on');yukle()}return true}catch(e){return false}}
addEventListener('pagehide',sohbetKaydet);document.addEventListener('visibilitychange',()=>{if(document.hidden)sohbetKaydet()});
/* ---------- Sözlükte birebir eşleşen terim/düşünür: API'ye gitmeden sitedeki tanımı göster ---------- */
const nt=s=>tl(s).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
function sozlukCevap(q){
  const k=nt(q).replace(/\b(nedir|ne demek|demek|kimdir|nasil bir|anlami|tanimi|tanimla|aciklar misin|aciklayabilir misin|acikla|hakkinda|bilgi ver|bana|soyler misin|soyle|bir|ne)\b/g,' ').replace(/\s+/g,' ').trim();
  if(k.length<3||!DB)return[];
  const seen=new Set();
  return DB.filter(c=>(c.k==='sozluk'||c.k==='dusunur')&&nt(c.t)===k&&!seen.has(c.k+c.t+c.c)&&seen.add(c.k+c.t+c.c)).slice(0,2)}
/* ---------- 👍/👎 ---------- */
function geri(m,q,c){if(!CFG.proxy)return;const w=$('span','eb-fb');w.style.cssText='display:inline-flex;gap:6px;margin-left:8px';
  ['👍','👎'].forEach((e,i)=>{const b=$('button','eb-say',e);b.setAttribute('aria-label',i?'Yardımcı olmadı':'Yardımcı oldu');
    b.onclick=()=>{w.textContent='Teşekkürler!';w.style.opacity='.7';fetch(CFG.proxy,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gorev:'geri',puan:i?-1:1,soru:q,cevap:c,baglam:ctx()})}).catch(()=>{})};w.appendChild(b)});m.appendChild(w)}
/* ---------- Turnstile (isteğe bağlı) ---------- */
let TW=null,TWcb=null;
if(CFG.turnstile){const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;document.head.appendChild(s)}
function ttAl(){return new Promise(res=>{if(!CFG.turnstile||!window.turnstile)return res('');
  try{if(TW===null)TW=turnstile.render(box.appendChild($('div')),{sitekey:CFG.turnstile,size:'invisible',execution:'execute',callback:t=>TWcb&&TWcb(t),'error-callback':()=>TWcb&&TWcb('')});
    TWcb=res;turnstile.reset(TW);turnstile.execute(TW);setTimeout(()=>res(''),8000)}catch(e){res('')}})}
/* ---------- Arayüz ---------- */
/* Hafif biçimlendirme (innerHTML kullanmadan): **kalın**, "# başlık" ve "- madde" */
function bi(m,t){m.textContent='';String(t).split('\n').forEach((ln,i,a)=>{
    ln=ln.replace(/^\s{0,3}#{1,4}\s+(.*)$/,'**$1**').replace(/^\s*[-*]\s+/,'• ');
    ln.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^\s)]+\))/).forEach(p=>{if(!p)return;let lk;if(/^\*\*[^*]+\*\*$/.test(p)){const s=document.createElement('strong');s.textContent=p.slice(2,-2);m.appendChild(s)}else if(lk=p.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/)){const a=document.createElement('a');a.textContent=lk[1];a.href=lk[2];a.target='_blank';a.rel='noopener noreferrer';a.style.cssText='text-decoration:underline;font-weight:700;color:inherit';m.appendChild(a)}else m.appendChild(document.createTextNode(p))});
    if(i<a.length-1)m.appendChild(document.createTextNode('\n'))})}
const gm=m=>Array.from(m.childNodes).filter(n=>n.nodeType===3||n.nodeName==='STRONG'||n.nodeName==='A').map(n=>n.nodeName==='A'?'['+n.textContent+']('+n.href+')':n.textContent).join('');
function mesaj(t,c){const m=$('div','eb-m '+c);if(c.indexOf('eb-u')>=0)m.textContent=t;else bi(m,t);log.appendChild(m);log.scrollTop=log.scrollHeight;return m}
const hrefOf=u=>{if(/^https?:/.test(u))return u;for(const k in YOL)if(u.startsWith(k))return ROOT+(k.endsWith('/')||k.endsWith('-')?YOL[k]+u:YOL[k]);return ROOT+u};
const IKON={sozluk:'📖 ',dusunur:'🧠 ',quiz:'📝 ',lab:'🧪 ',hukuk:'⚖️ ',aktor:'🏛 ',kaynak:'📰 '};
function kaynaklar(m,cs){const w=$('div','eb-src');const seen=new Set();
  cs.forEach(c=>{if(seen.has(c.u+c.t))return;seen.add(c.u+c.t);const a=$('a');a.href=hrefOf(c.u);a.textContent=(IKON[c.k]||'')+c.t.slice(0,36);w.appendChild(a)});
  if(w.children.length)m.appendChild(w)}
/* Kanun tespiti: metinde İYUK/TBK/VUK… ya da "2577 sayılı" geçerse Eko-Log Mevzuat + resmî mevzuat.gov.tr bağlantısı üretir */
function kanunKur(){KRX=KANUN.map(k=>({k,re:new RegExp('(?:\\b('+k.a.concat([String(k.no)+' sayili']).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b)(?:[^a-z0-9]{0,6}(?:\\(?'+k.no+'\\)?)?[^a-z0-9]{0,4}(?:m\\.|md\\.|madde)\\s*(\\d{1,3}))?','g')}))}
function kanunlar(metin){const t=tl(metin),out=[];
  KRX.forEach(({k,re})=>{re.lastIndex=0;const m=re.exec(t);if(m)out.push({k,madde:m[2]||''})});return out.slice(0,2)}
function yonlendir(m,metin,cs){
  const w=$('div','eb-src eb-go');
  const ekle=(ad,h,dis)=>{const a=$('a');a.href=h;a.textContent=ad;if(dis){a.target='_blank';a.rel='noopener noreferrer'}w.appendChild(a)};
  const soz=cs.find(c=>c.k==='sozluk'&&tl(metin).includes(tl(c.t))),dus=cs.find(c=>c.k==='dusunur'&&tl(metin).includes(tl(c.t.split(' ').pop())));
  if(soz)ekle('📖 Sözlükte gör: '+soz.t.slice(0,24),hrefOf(soz.u));
  if(dus)ekle('🧠 Düşünür: '+dus.t.slice(0,24),hrefOf(dus.u));
  const ks=kanunlar(metin);
  ks.forEach(({k,madde})=>{
    ekle('📜 Eko-Log Mevzuat: '+k.ad+(madde?' m.'+madde:''),hrefOf('mevzuat/#/'+k.no+(madde?'/m'+madde:'')));
    ekle('🏛 Resmî metin: '+k.ad,'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo='+k.no+'&MevzuatTur=1&MevzuatTertip='+k.tertip,true)});
  if(!ks.length&&MOD==='ders'&&HK){ekle('📜 Mevzuat sayfamız',hrefOf('mevzuat/'));ekle('🏛 mevzuat.gov.tr','https://www.mevzuat.gov.tr/',true)}
  if(w.children.length)m.appendChild(w)}
/* Sözlük sayfasında #/sozluk/<terim> bağlantısı gelirse arama kutusunu doldurur */
function sozlukDoldur(){const x=location.hash.match(/^#\/sozluk\/(.+)/);if(!x)return;let t='';try{t=decodeURIComponent(x[1])}catch(e){return}
  let n=0;const iv=setInterval(()=>{const q=document.getElementById('szq');if(q){q.value=t;q.dispatchEvent(new Event('input',{bubbles:true}));clearInterval(iv)}else if(++n>24)clearInterval(iv)},250)}
addEventListener('hashchange',sozlukDoldur);sozlukDoldur();
function webKaynak(m,l){if(!l||!l.length)return;const w=$('div','eb-src eb-w');
  l.slice(0,5).forEach(x=>{const a=$('a');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='🔗 '+String(x.baslik||x.url).slice(0,34);w.appendChild(a)});m.appendChild(w)}
function oku(m){if(!('speechSynthesis' in window))return;const b=$('button','eb-say','🔊 Dinle');
  b.onclick=()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(gm(m));u.lang='tr-TR';speechSynthesis.speak(u)};m.appendChild(b)}
function modSec(k,sessiz){MOD=k;box.querySelectorAll('#eb-mod button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
  if(sessiz)return;hist=[];mesaj(k==='ders'?(HK?'Hukuk dersi modundayım. Bir konuyu "anlat" de; kavram → kanun → örnek → sık hata → mini sınama sırasıyla işleriz.':'Ders modundayım. Bir konuyu "anlat" de; sezgi → kavram → örnek → sık hata → mini sınama sırasıyla işleriz.')+' "Beni sına" dersen kısa bir soruyla yoklarım. (Bu mod tamamen yerelde çalışır, yapay zekâ kullanmaz.)':'Genel moddayım. Sitedeki kavramları, laboratuvarları ve sayfaları sorabilir, "Çalışmamı değerlendir" diyerek laboratuvar/quiz hatalarının analizini isteyebilirsin.','eb-b');
  if(MODCHIP[k])chips(MODCHIP[k])}
function chips(liste){const w=$('div','eb-chips');
  (liste||MODCHIP.genel).filter(q=>DENEME_ACIK||!q.startsWith('📝')).forEach(q=>{const b=$('button','',q);b.onclick=()=>{w.remove();if(q.startsWith('📝')){denemeBaslat();return}if(q.startsWith('📊')){sor('Bu oturumdaki çalışmamı değerlendir: nerede hata yapıyorum, neyi anlamamış olabilirim, ne çalışmalıyım?')}else sor(q)};w.appendChild(b)});log.appendChild(w)}

const izinli=()=>localStorage.getItem(IZIN)==='1';
function izinIste(){if(izinli())return true;
  if(confirm('Çalışma özetin (hangi modülde hangi soruyu yanlış yaptığın, ayarların) yapay zekâya gönderilsin mi? Ad, e-posta gibi kişisel bilgi gönderilmez. Sonradan sohbetteki "Analiz" düğmesinden kapatabilirsin.')){localStorage.setItem(IZIN,'1');return true}return false}
/* ---------- HUKUK DENEMESİ: 3 zor soru → tek tek puanla → genel değerlendirme ---------- */
let DEN=null;
const post=async o=>{const r=await fetch(CFG.proxy,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({mod:'ders',alan:LABK,baglam:ctx()},o))});if(!r.ok)throw 0;return r.json()};
function denemeBaslat(){if(!CFG.proxy){mesaj('Deneme için sunucu bağlantısı (proxy) gerekli; bu sürümde tanımlı değil.','eb-b');return}
  DEN={faz:'konu'};mesaj('3 soruluk zor deneme başlıyor. Hangi konudan? (örn. '+(HK?'"iptal davası", "irade sakatlığı", "vergi zamanaşımı"':LABK==='ekonometri'?'"OLS", "hipotez testi"':LABK==='uluslararasi'?'"realizm", "güvenlik ikilemi"':'"arz-talep", "net bugünkü değer"')+'). Çıkmak için "iptal" yaz.','eb-b');inp.focus()}
function soruGoster(){const S=DEN.sorular[DEN.i],ad={olay:'Olay sorusu',uygulama:'Uygulama sorusu',ayirt:'Ayırt etme sorusu',gerekce:'Gerekçelendirme sorusu'}[S.tur]||'Soru';
  mesaj(`📝 Soru ${DEN.i+1}/3 · ${ad}\n\n${S.soru}\n\nCevabını gerekçesiyle yaz (kısa bir paragraf yeterli).`,'eb-b')}
async function denemeAdim(q){
  busy=true;mesaj(q,'eb-u');
  try{
    if(DEN.faz==='konu'){
      await yukle();const m=mesaj('Sorular hazırlanıyor, kaynaklara bakıyorum…','eb-b');
      DEN.ks=ara(q,8).map(c=>({t:c.t,x:c.x,u:c.u,c:c.c}));
      const j=await post({gorev:'deneme_uret',soru:q,kaynak:DEN.ks});if(!j.sorular)throw 0;
      Object.assign(DEN,{konu:q,sorular:j.sorular,i:0,sk:[],oz:[],faz:'cevap'});m.remove();soruGoster();
    }else{
      const m=mesaj('Cevabın değerlendiriliyor…','eb-b'),S=DEN.sorular[DEN.i];
      const r=(await post({gorev:'deneme_degerlendir',soru:q,deneme:{soru:S.soru,anahtar:S.anahtar},kaynak:DEN.ks})).sonuc;if(!r)throw 0;
      const p=Math.max(0,Math.min(100,+r.puan||0));DEN.sk.push(p);DEN.oz.push({tur:S.tur,puan:p,yanlis_anlama:r.yanlis_anlama||''});
      OL.push({tur:'deneme',modul:'Hukuk denemesi: '+DEN.konu,soru:S.soru.slice(0,120),puan:p,t:Date.now()});kaydet();
      m.textContent=`Soru ${DEN.i+1} puanı: ${p}/100\n\n✅ Doğru: ${(r.dogru||[]).join('; ')||'—'}\n⚠️ Eksik: ${(r.eksik||[]).join('; ')||'—'}${r.yanlis_anlama?'\n❓ Muhtemel yanlış anlama: '+r.yanlis_anlama:''}\n\n📖 Örnek cevap: ${r.model_cevap||''}`;
      DEN.i++;
      if(DEN.i<3)soruGoster();else{
        const ort=Math.round(DEN.sk.reduce((a,b)=>a+b,0)/3),k=mesaj('Genel değerlendirme hazırlanıyor…','eb-b');
        const o=await post({gorev:'deneme_ozet',deneme:{konu:DEN.konu,ortalama:ort,sorular:DEN.oz}});
        k.textContent=`🏁 Deneme bitti. Ortalama: ${ort}/100 (${DEN.sk.join(' · ')})\n\n${o.cevap}`;DEN=null;
        chips(['📝 Yeni 3 soruluk deneme','Eksik kaldığım konuyu baştan anlat'])}
    }
  }catch(e){mesaj('Deneme şu an çalışmadı, biraz sonra tekrar dene.','eb-b');DEN=null}
  busy=false;log.scrollTop=log.scrollHeight;
}

/* ---------- SOHBET: selam / hal hatır / teşekkür / "kimsin" gibi mesajlara doğal karşılık (API gerekmez) ---------- */
const SELAM=/^(merhaba+lar|merhaba|selam+lar|selam|slm|mrb|gunaydin|iyi gunler|iyi aksamlar|iyi geceler|hey|hi|hello)\b[\s,!.]*/;
const SITE_TUR=[
 ['🎮 Simülasyon Merkezi','Merkez bankası başkanı, bakanlık, girişimci, kamu bürokratı, müzakere masası, kamu ihalesi gibi 12 simülasyonda karar verip sonucunu görürsün.','simulasyon-merkezi.html'],
 ['📖 İktisadi Ansiklopedi / Sözlük','1500\'den fazla terim ve 80 düşünür; terimi arayıp örnekle öğrenirsin.','ansiklopedi.html#/sozluk'],
 ['🧪 İİBF Laboratuvarı (Üye Alanı)','İktisat, Ekonometri, İşletme & Finans, ÇEKO, Kamu Yönetimi, Maliye & Vergi ve Uluslararası İlişkiler için laboratuvarlar ve quizler.','eko-plus/iibf-laboratuvar.html'],
 ['📜 Mevzuat','Kanun metinleri ve maddelere hızlı erişim.','mevzuat/'],
 ['🗺 Kalkınma (81 il)','İl il ekonomi göstergeleri, sektörler ve simülatörler.','kalkinma/'],
 ['📈 Borsa Oyunu · ⚖️ Hâkimlik Simülasyonu','Üye alanında oynayarak öğrenebileceğin oyunlar.','eko-plus/borsa-oyunu.html'],
 ['📰 Veri ve Pariteler, Gazete ve Dergi, Etkinlikler, Mülakat, Quiz, Fikir, Girişimcilik ilanları, Katıl','Ana sayfanın menüsünden ulaşılır.','']];
const SITE_NOT='Eko-Log, İnönü Üniversitesi Ekonomi ve Diyalog Topluluğu\'nun öğrenme ve simülasyon sitesi. Burada şunları yapabilirsin:\n\n'
 +SITE_TUR.map(x=>x[0]+' — '+x[1]).join('\n\n')
 +'\n\nBen de bir kavramı açıklayabilir, seni doğru sayfaya götürebilir, laboratuvar/quizlerdeki cevaplarını değerlendirebilir (📊 Çalışmamı değerlendir)'+'.';
const DEGER=/(degerlendir|analiz).*(calisma|cevap|hata|yanlis|performans|quiz|lab|sonuc)|(calisma|cevap|hata|yanlis|performans|sonuc)\w*.*(degerlendir|analiz)/;
const YETENEK={
 ders:HK?'Hukuk derslerini hazır ders kartlarıyla anlatabilir, mini sorularla seni yoklayabilir, kanun maddelerine bağlantı verebilirim.':'Bu laboratuvardaki konuları anlatabilir, mini sorularla seni yoklayabilir, hatalarını analiz edebilirim.',
 genel:'Sitedeki kavramları, düşünürleri, simülasyonları, laboratuvarları ve mevzuatı sorabilirsin; seni ilgili sayfaya götürür, quiz/lab cevaplarını değerlendirebilirim.'};

/* ---------- Yapay zekâ bağlıysa mesajı MODEL anlar; yerel kalıplar yalnızca güvenlik için çalışır ---------- */
const AIVAR=()=>!!(CFG.proxy&&CFG.ai);
function guvenlik(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>200)return null;
  if(/\b(nedir|anlat|acikla|tanimi|quiz|lab)\b/.test(t))return null;
  if(/(olmek istiyorum|intihar etmek|intihar edecegim|intihari dusunuyorum|yasamak istemiyorum|kendime zarar|kendimi oldur)/.test(t))
    return{t:'Bunu ciddiye alıyorum. 💛 Şu an yalnız kalma; güvendiğin birine yaz ya da yanına git. Kendini tehlikede hissediyorsan 112\'yi ara. İstersen burada da dinlerim, ne oldu?'};
  if(/\b(beni|bana|bizi)\b.*(vuruyor|dovuyor|dovdu|tehdit ediyor|zorluyor|zorla)|telefonumu kontrol ediyor|ondan korkuyorum/.test(t))
    return{t:'Bunu duyduğuma üzüldüm, ve bu şaka konusu değil. 💛 Şiddet, tehdit, zorlama ya da seni korkutan davranışlar sağlıklı değildir, suç da olabilir. Güvendiğin birine anlat. Acil tehlikede 112\'yi ara; ALO 183 ve KADES uygulaması da var. İstersen buradan devam edelim, şu an güvende misin?'};
  return null}

/* ---------- EKO CAN: karakter, selam/hal hatır ve futbol goygoyu (API gerekmez, kısa tutulur) ----------
   Yeni espri eklemek için ilgili diziye bir satır ekle; cevap rastgele seçilir. */
let SON_FB='';
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function futbol(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>140)return null;
  const son=SON_FB;SON_FB='';
  if(son==='havlu'&&/^(yok |hayir |hic )?(havlu )?(atmadik|atmadim|atmadi|atmayiz)\b/.test(t))return{t:'Bilemem 🤷'};
  if(/\b(nedir|anlat|acikla|hesapla|formul|tanimi|ornek|quiz|lab)\b/.test(t))return null;   // ders sorusunu kaçırma
  const takim=/(hangi takim|takimin ne|takimin hangisi|tuttugun takim|kimi tutuyorsun|takimlisin|kimlisin|kimin takimi)/.test(t);
  if(takim)return{t:rnd(['Efsane Yeni Malatyasporluyum! ⚽ Şimdi tozuna yetişmeye çalışan Yeşilyurtspor\'u destekliyorum.','Ben mi? Efsane Yeni Malatyaspor! Şimdi onun tozuna yetişmeye çalışan Yeşilyurtspor\'u tutuyorum 😄'])};
  const bjk=/\b(besiktas|bjk|kartal|kara kartal)\b/.test(t);
  const gs=/\b(galatasaray|gs|cimbom)\b/.test(t);
  const fb=/\b(fenerbahce|fb|fener|kanarya)\b/.test(t);
  const kaybet=/(kaybetti|kaybettik|kaybetmis|yenildi|yenildik|maglup|maglubiyet|dagildi|puan birakti|firca yedi)/.test(t);
  const kazan=/(kazandi|kazandik|yendi|yendik|galip|galibiyet|3 puan|uc puan|farkli)/.test(t);
  const bera=/(berabere|beraberlik|1 puan|bir puan)/.test(t);
  if(bjk){
    if(kaybet){SON_FB='havlu';return{t:'Havlu attınız ha? 😏'}}
    if(kazan)return{t:rnd(['Eveeet! 🦅 Kartal uçtu, çok sevindim hocam!','Kazandık mı?! Kartal\'a helal olsun, bu akşam bayram! 🎉','Şampiyon gibi! 🦅 Sevindik, sevindik!'])};
    if(bera)return{t:'Puan puandır ama biraz buruk kaldı 😅'};
    return{t:rnd(['Kartal diyorsun, kulak kabarttım 🦅','Beşiktaş mı? Anlat bakalım, maç nasıldı?'])};
  }
  if(gs)return{t:rnd(['Galatasaray mı? Cimbom deyince ortalık hep şenlenir 😄','GS\'yle ilgili konuşmaya hazırım, hangi maçı konuşuyoruz? 🟡🔴','Aslan kükredi mi bu hafta? Anlat bakalım 🦁'])};
  if(fb)return{t:rnd(['Fenerbahçe mi? Sarı-lacivert heyecanı hiç eksik olmaz 💛💙','Kanarya konuşuluyor, kulak kesildim! 🐤 Maç nasıldı?','Fener taraftarı hep iddialıdır 😄 Anlat bakalım.'])};
  return null}

/* ---------- EKO CAN: sınav korkusu goygoyu ---------- */
function sinav(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>100)return null;
  if(/(panik|nefes|aglıyorum|aglıyorum|aglayacagim|dayanamiyorum|olmek|intihar|yapamiyorum artik|titriyorum)/.test(t))return null;   // gerçek sıkıntıda şakayı kes
  if(/(sinav(dan|a)? (cok )?(korkuyorum|korkuyom|korkuyoruz)|(vize|final|butunleme)(den|e)? (cok )?korkuyorum|sinav(dan)? (cok )?(korku|stres)|sinavdan korktum)/.test(t))
    return{t:rnd(['Çalışmadın nane yersin 😄 Şaka şaka… hangi dersten, ne zaman? Birlikte bakalım.','Çalışmadın ki nane yersin, kolay mı? 😏 Neyse hadi, hangi ders? Toparlarız.'])};
  return null}

/* ---------- EKO CAN: ilişki koçu (genel, sağlıklı iletişim önerileri; terapi/hüküm değil) ---------- */
function koc(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>200)return null;
  if(/\b(nedir|anlat|acikla|hesapla|formul|tanimi|quiz|lab)\b/.test(t))return null;
  if(/(vuruyor|dovuyor|dovdu|telefonumu kontrol|istemedigim sey)/.test(t)||(/(siddet|tehdit|kontrol ediyor|izin vermiyor|korkuyorum|zorluyor|zorla)/.test(t)&&/(sevgil|esim|erkek arkadas|kiz arkadas|flort|ilisk|biri|\bo\b|\bona\b|\bondan\b)/.test(t)))
    return{t:'Bunu duyduğuma üzüldüm, ve bu şaka konusu değil. 💛 Şiddet, tehdit, sürekli kontrol ya da seni korkutan davranışlar sağlıklı bir ilişki değil, suç da olabilir. Güvendiğin birine anlat. Acil tehlikede 112\'yi ara; ALO 183 ve KADES uygulaması da var. İstersen buradan devam edelim, şu an güvende misin?'};
  if(/(kiskan)/.test(t))return{t:'Kıskançlık çoğu zaman güvensizlikten gelir. 🤔 Suçlamadan konuş: "Şu olunca ben böyle hissettim" de, "sen hep…" deme. Kontrol etmek, telefon karıştırmak işi büyütür. Seni ne tetikledi?'};
  if(/(guvenemiyorum|guven sorunu|yalan soyledi|yalan soyluyor|aldatiyor|aldatti|aldatiyormus)/.test(t))return{t:'Güven sarsıldıysa bu çok yıpratıcı. 💔 Elinde somut bir şey mi var, yoksa içine mi doğdu? Önce sakin kafayla, suçlamadan açık konuş; cevabı ve davranışı görmek lazım. Karar acele verilmez.'};
  if(/(tartistik|kavga ettik|kavga ettim|kustuk|konusmuyor|konusmuyoruz)/.test(t))return{t:'Tartışma normal, önemli olan nasıl toparladığın. Sakinleşmeden konuşma; bir mola ver. Sonra "kim haklı" değil "ne yaşadık" diye yaklaş, ilk adımı atmak yenilmek değil. Ne oldu?'};
  if(/(barismak|barisalim|barissak|eski sevgil|eski askim|geri donsem|geri donmek|geri donmeli)/.test(t))return{t:'Barışmadan önce şuna bak: ayrılma sebebi çözüldü mü, yoksa özlem mi konuşuyor? İkisi farklı. Ayrılığın nedenini açık konuşmadan dönmek aynı döngüyü getirir. Neden ayrıldınız?'};
  if(/(acilmak|acilsam|acilayim|itiraf|hislerimi soyle|cikma teklif)/.test(t)&&/(ona|ondan|sevgil|hoslan|\bask|kiz|erkek|hislerim)/.test(t))return{t:'Cesur olmak güzel şey. 💪 Sade ve samimi ol: "Seninle vakit geçirmek hoşuma gidiyor, kahve içelim mi?" gibi. Büyük itiraf yerine küçük bir adım at. Cevap hayır olursa da dostça kal, bu senin değerini düşürmez. Kimden bahsediyoruz? 😄'};
  if(/(ayrilmali miyim|birakmali miyim|bitirmeli miyim|bitirsem mi|devam etmeli miyim)/.test(t))return{t:'Senin yerine karar veremem ama sorular verebilirim: bu ilişkide kendin gibi misin, saygı görüyor musun, mutlu olduğun anlar mutsuz olduklarından çok mu? Bir de yakın biri ne derdi? Ne hissediyorsun?'};
  if(/(ilisk|sevgili).*(tavsiye|ne yapmaliyim|ne yapayim|nasil olmali|ipucu|sir)|(tavsiye|ne yapmaliyim|ne yapayim).*(ilisk|sevgili|flort)/.test(t))return{t:'Sağlıklı ilişkinin üç temeli: dürüstlük, saygı, açık iletişim. 💬 Beklentini söyle, karşındakini dinle, sınırlarını koru. Durumunu anlat, ona göre konuşalım.'};
  return null}

/* ---------- EKO CAN: gönül ve güzellik sohbeti (makyaj, cilt bakımı, kombin, aşk meşk) ----------
   Cinsiyet tahmin etmez; konu açılınca arkadaş gibi dinler, şakalaşır, küçük öneri verir. Kullanıcıya romantik yaklaşmaz. */
function gonul(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>140)return null;
  if(/(olmek istiyorum|intihar|yasamak istemiyorum|kendime zarar|kendimi oldur)/.test(t))
    return{t:'Bunu ciddiye alıyorum. 💛 Şu an yalnız kalma; güvendiğin birine yaz ya da yanına git. Kendini tehlikede hissediyorsan 112\'yi ara. İstersen burada da dinlerim, ne oldu?'};
  if(/\b(nedir|anlat|acikla|hesapla|formul|tanimi|quiz|lab)\b/.test(t))return null;
  if(/(sevgilin var mi|beni sever misin|bana ask misin|benimle evlenir misin|bana ask|seni seviyorum|benimle cikar misin)/.test(t))
    return{t:rnd(['Ben bir botum 😄 sevgilim yok ama dert ortaklığına varım. Anlat, ne var?','Ay kıyma bana, ben bir botum 😅 Ama dinlemeye hazırım, kalp mi bozuldu?'])};
  if(/(ayrildik|ayrildim|terk etti|terk edildim|aldatildim|kalbim kirik)/.test(t))
    return{t:rnd(['Üzüldüm… 💛 Anlatmak istersen buradayım. Yanında konuşabileceğin biri var mı?','Çok zor, biliyorum. Biraz zaman ister; acele etme. İstersen anlat, dinliyorum.'])};
  if(/(\bask\b|\basik oldum|hoslaniyorum|hoslandigim|\bcrush\b|platonik|birini seviyorum|kalbim carpiyor)/.test(t))
    return{t:rnd(['Ooo kim o? 😏 Anlat bakalım, tanışıyor musunuz?','Vay vay, kalp çarpıntısı mı var? 😄 Ne kadar zamandır, o da seni biliyor mu?','Platonik mi, karşılıklı mı? Detay istiyorum 😄'])};
  if(/(mesaj atti|mesaj yazdi|goruldu|cevap vermedi|cevap yazmadi|\bghost|\bseen\b)/.test(t))
    return{t:rnd(['Bu en sinir bozucusu 😩 Ama derin nefes: bir gün bekle, sen kendi hayatına bak. Ne yazmıştın?','Görüldü atıp gitti mi? 😤 Hemen peşinden yazma, rahat ol. Ne dediğini anlat bakalım.'])};
  if(/(sevgilim|erkek arkadasim|kiz arkadasim|flort|buluşma|bulusma|bulusacagiz|randevu)/.test(t))
    return{t:rnd(['Sevgili işleri mi? 😄 Nasıl gidiyor, mutlu musun?','Randevu mu var? Heyecanlı mısın? Ne giyeceğini de konuşuruz 😄'])};
  if(/\b(ruj|rujum)\b/.test(t))return{t:'Ruj mu? 💄 Mat mı parlak mı seversin? Kırmızı iddialı, nude her zaman kurtarır. Ton olarak ne düşünüyorsun?'};
  if(/\b(fondoten|kapatici|pudra|allik|aydinlatici)\b/.test(t))return{t:'Fondötenin tonunu çenede ya da boyunda dene, yüzde değil; ışıkta bak. Cildin yağlı mı kuru mu? 😊'};
  if(/\b(maskara|far|eyeliner|kirpik|kas)\b/.test(t)&&/(makyaj|surmek|surdum|nasil|oneri)/.test(t))return{t:'Göz makyajında az çoktur: ince eyeliner + maskara çoğu zaman yetiyor. Günlük mü, özel gün mü?'};
  if(/(cilt bakimi|serum|nemlendirici|sivilce|guneş kremi|gunes kremi|temizleyici|akne)/.test(t))return{t:'Temel üçlü: temizleyici, nemlendirici, güneş kremi ☀️ Güneş kremi hiç atlanmasın. Cildin nasıl, sivilce var mı? (Ciddiyse dermatoloğa görün 🙂)'};
  if(/(kombin|ne giyeyim|ne giysem|nasil giyinsem|elbise|ayakkabi|canta)/.test(t))return{t:'Kombin mi? 😄 Nereye giyeceksin: okul mu, çıkış mı, özel bir gün mü? Rahat edeceğin bir şey seç, gerisi gelir.'};
  if(/(makyaj|\boje\b|\bparfum|sac boyasi|sac bakimi|sac modeli|manikur|\bguzellik)/.test(t))return{t:'Makyaj konusu mu açıldı? 💄 Ben bir botum ama çok iyi dinlerim; günlük mü, özel gün mü? Neyi merak ediyorsun?'};
  return null}

/* ---------- SERBEST SORULAR (SSS): kampüs · çalışma/kariyer · ekonomi · bot hakkında · sohbet ----------
   Yapay zekâsız, kural tabanlı. Yeni soru eklemek için KURALLAR dizisine [/regex/, 'cevap' ya da ['cevap1','cevap2']] satırı ekle.
   Regex, aksan ve büyük harf silinmiş metne uygulanır (ş→s, ı→i, ö→o, ü→u, ç→c, ğ→g). */
/* Kampüs bilgileri (takvim, vize, yatay geçiş…) kampus.json dosyasındadır; yüklenince buraya dolar. Buraya elle yazma. */
const KAMPUS=Object.assign({},CFG.kampus||{});
const kf=(k,ad)=>KAMPUS[k]||('“'+ad+'” bilgisi dönem ve bölüme göre değişiyor, tahmin yürütüp seni yanlış yönlendirmek istemem. 📌 En doğru kaynak: fakülte/bölüm duyuruları, öğrenci işleri ya da bölüm sekreterliği.');
const MESLEK={
  iktisat:'İktisat: bankacılık ve finans, araştırma/analiz, kamu kurumları (Hazine, Kalkınma/Strateji birimleri), danışmanlık, yüksek lisans ve akademi.',
  ekonometri:'Ekonometri: veri analisti, risk ve aktüerya, bankalarda modelleme, araştırma birimleri, istatistik/ML işleri, akademi.',
  isletme:'İşletme & Finans: finans/muhasebe, pazarlama, insan kaynakları, operasyon ve tedarik zinciri, girişimcilik, bankacılık.',
  ceko:'ÇEKO: çalışma hayatı ve işletme birimleri, insan kaynakları, iş müfettişliği/uzmanlığı, sendika ve kamu kurumları, danışmanlık.',
  kamu:'Kamu Yönetimi: kamu kurumları (KPSS ile), belediyeler, yerel yönetimler, uzmanlık sınavları, politika analizi, akademi.',
  maliye:'Maliye & Vergi: Gelir İdaresi, Hazine ve Maliye, denetim (vergi/hesap uzmanlığı), SMMM/YMM yolu, bankacılık ve muhasebe.',
  uluslararasi:'Uluslararası İlişkiler: dışişleri ve kamu sınavları, uluslararası kuruluşlar, düşünce kuruluşları, medya/diplomasi, akademi.',
  genel:'İktisat, işletme, kamu, maliye ve uluslararası ilişkiler mezunları; bankacılık, kamu, danışmanlık, analiz ve akademide çalışabiliyor. Bölümünü söylersen daha net yazarım.'
};
const SIRA=(a,n)=>a.map((x,i)=>(i+1)+'. '+x).join('\n');
/* Yol tarifi: konum adını Google Haritalar bağlantısına çevirir (başlangıç = kullanıcının konumu; rota ve süreyi harita uygulaması hesaplar) */
let YER=[];   /* konumlar kampus.json → "yer" bölümünde */

const SH=u=>u.replace(/[()']/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
function yolTarifi(q,t){
  const tetik=/(nasil (gid|ulas)|yol tarif|konum|adres|nerede|yolu nasil|nasil giderim|nereden gid)/.test(t);
  if(!tetik)return null;
  const gen=/(nasil (gid|ulas)|yol tarif|nasil giderim|nereden gid)/.test(t);
  /* kaynak/hedef ayıklama: tetik ifadesinden önceki metin */
  let i=t.search(/\s*(nasil (gid|ulas)|yol tarif|konum|adres|nerede|yolu nasil|nasil giderim|nereden gid)/);
  let raw=(i>0?q.slice(0,i):q).trim().replace(/^(ben|bana|bize)\s+/i,'');
  let from='',to=raw;
  const m=raw.match(/^(.+?)['’](?:dan|den|tan|ten)\s+(.+)$/i);
  if(m){from=m[1].trim();to=m[2].trim()}
  to=to.replace(/['’]\w{1,3}$/,'').trim();
  const nt0=tl(to||t);
  const y=YER.find(r=>r[0].test(nt0));
  if(!y&&(!gen||!to||to.length<2||to.length>60))return null;
  const ad=y?y[1]:to,sorgu=y?y[2]:to;
  const base='https://www.google.com/maps/dir/?api=1&destination='+SH(encodeURIComponent(sorgu))+(from?'&origin='+SH(encodeURIComponent(from)):'');
  return '📍 **'+ad+'** için yol tarifi'+(from?' ('+from+' çıkışlı)':'')+':\n[🚗 Araçla]('+base+'&travelmode=driving)\n[🚌 Toplu taşımayla]('+base+'&travelmode=transit)\n[🚶 Yürüyerek]('+base+'&travelmode=walking)'+(y&&y[3]?'\n\nℹ️ '+y[3]:'')+(from?'':'\n\nBaşlangıç noktası olarak telefonunun konumu kullanılır (konum izni gerekir). Rota ve süreyi harita uygulaması hesaplar.')}
const KURALLAR=[
 [/nasil (gid|ulas)|yol tarif|konum|adres|nerede|yolu nasil|nasil giderim|nereden gid/,yolTarifi],
 /* ----- İnönü Üniversitesi · Malatya: MOTAŞ hatları, takvim ve kampüs kuralları artık kampus.json → "kurallar" bölümünde (JS'e dokunmadan düzenlenir) ----- */
 /* ----- Kampüs ----- */
 [/(butunleme).*(ne zaman|tarih|takvim|ne vakit)|(ne zaman).*butunleme/,()=>kf('butunleme','Bütünleme tarihi')],
 [/(vize|final|ara sinav|sinav).*(ne zaman|tarih|takvim|ne vakit|basliyor|kacinda)|(ne zaman).*(vize|final|sinav)/,()=>kf('vize','Sınav tarihi')],
 [/akademik takvim|donem (ne zaman|basliyor|bitiyor)|ders kaydi.*(ne zaman|tarih)|kayit yenileme/,()=>kf('takvim','Akademik takvim')],
 [/devamsizlik|devam zorunlu|yoklama/,()=>kf('devamsizlik','Devamsızlık sınırı')],
 [/yatay gecis|dikey gecis|kurum ici gecis|kurumlar arasi gecis/,()=>kf('yatay','Yatay geçiş şartları')],
 [/cift anadal|\bcap\b|yandal|cift dal/,()=>kf('cift','Çift anadal/yandal')],
 [/erasmus|degisim programi|\bfarabi\b|mevlana/,()=>kf('erasmus','Erasmus/değişim başvurusu')],
 [/\bstaj/,()=>kf('staj','Staj şartları ve tarihleri')+'\n\nİpucu: staj yerini erken ara, kabul yazısını ve sigorta işlemlerini son haftaya bırakma.'],
 [/mezuniyet.*(ne zaman|tarih|toren)|toren.*ne zaman/,()=>kf('mezuniyet','Mezuniyet töreni tarihi')],
 [/mezun.*(akts|kredi|sart|gerek)|kac akts|kac kredi|mezun olmak icin/,()=>kf('aktsSart','Mezuniyet şartları (AKTS/kredi)')],
 [/(dekan|bolum baskani|rektor).*(kim|adi)|kim.*(dekan|bolum baskani|rektor)/,()=>kf('dekan','Yönetici bilgisi')],
 [/yemekhane|yemek (saat|ucret|menu)/,()=>kf('yemekhane','Yemekhane bilgisi')],
 [/kutuphane/,()=>kf('kutuphane','Kütüphane saatleri')],
 [/(ulasim|servis|otobus|minibus).*(saat|nasil|nereden)|okula nasil gid/,()=>kf('ulasim','Ulaşım bilgisi')],
 [/hoca(ya|m|mi|mizi)?.*(mail|eposta|e posta|yaz)|(mail|eposta).*(hoca|ogretim|danisman)/,'Hocaya mail için kısa bir kalıp:\n\nKonu: [Ders adı] – [Net konu]\n\nSayın Hocam,\nAdım Soyadım, [Ders], [Şube], [Öğrenci no]. [Tek cümlelik sorun/talep.] Uygun olduğunuz bir zamanda görüşebilir miyiz?\nİlginiz için teşekkür ederim.\nSaygılarımla,\n[Ad Soyad]\n\nİpucu: konu satırını boş bırakma, ders ve numaranı yaz, tek mailde tek istek ol.'],
 /* ----- Çalışma ve kariyer ----- */
 [/ders programi.*(yap|hazirla|olustur|cikar)|calisma (plani|programi).*(yap|hazirla|olustur|cikar)|plan yap/,'Plan için şunları yaz: kaç gün kaldı, hangi dersler, günde kaç saat ayırabilirsin. Genel iskelet:\n1. Zor/ağır dersi sabah ve ilk sıraya koy\n2. Her ders için konu listesi çıkar, her gün 1–2 konu bitir\n3. Son 3 günü yalnızca tekrar ve soru çözümüne ayır\n4. Haftada 1 yarım gün boş bırak (telafi)'],
 [/ezber|nasil (calis|ogren)|calisma (teknigi|yontemi|taktigi)|verimli calis|ders calisma|calisamiyorum|odaklanamiyorum/,'İşe yarayan üç şey 📚\n1. Aktif hatırlama: konuyu kapatıp boş kâğıda kendin anlat\n2. Aralıklı tekrar: aynı konuya 1., 3., 7. günde dön\n3. Soru çöz: okumak öğrenmek değil, çözerek öğrenirsin\nPomodoro (25 dk çalış, 5 dk mola) odaklanmaya yardım eder. İstersen “Beni bir soruyla sına” de.'],
 [/mezun (olunca|olunca|olduktan sonra|olursam|olsam).*(is|ne yap|kariyer)|(is|kariyer) (imkan|firsat|alan)|hangi alanlarda calis|ne is yapabilir/,()=>MESLEK[LABK!=='genel'?LABK:(MESLEK[PROFIL.bolum]?PROFIL.bolum:'genel')]+SN()],
 [/\b(kpss|yuksek lisans|master|akademisyen|akademik kariyer)\b/,'Karar verirken şu sorular işe yarar:\n• Kamu güvencesi mi, araştırma/akademi mi, özel sektör mü seni çeker?\n• KPSS’ye çalışmak için net bir takvimin var mı?\n• Yüksek lisans seni hangi işe/ünvana götürecek, kaç yıl ve hangi maliyetle?\nİkisini birlikte de götürebilirsin; hangisi kafana daha yatıyor?',/\b(mi|mu|nasil|yapmali|hazirlan\w*|oner\w*|tavsiye|karar\w*|sence)\b/],
 [/\bcv\b|ozgecmis/,'İyi bir CV: 1 sayfa, güncel iletişim, eğitim (not ortalaması 3.0+ ise yaz), staj/proje/gönüllülük (sonuç odaklı: “X yaptım, Y sağladı”), beceriler (Excel, SQL/Python, dil), tek sade şablon. Yazım hatası eleyici; bir arkadaşına okut.'],
 [/mulakat|is gorusmesi/,'Mülakata hazırlık 🎯\n1. Şirketi/kurumu araştır, 1–2 güncel haberini bil\n2. “Kendini tanıt” cevabını 1 dakikaya sığdır\n3. “Güçlü/zayıf yönün” için gerçek örnek hazırla\n4. En az 2 soruyu sen sor\nSorunun cevabını bilmiyorsan uydurma; nasıl düşüneceğini anlat.'],
 [/sertifika|\bspk\b|lisanslama|\bcfa\b|\bsmmm\b|\bymm\b/,'Alana göre sık görülenler:\n• Finans/bankacılık: SPK lisansları (Düzey 1-2-3), CFA\n• Muhasebe/vergi: SMMM, YMM, vergi müfettişliği sınavları\n• Veri/ekonometri: Excel, SQL, Python/R kursları\n• Genel: İngilizce (YDS/TOEFL/IELTS)\nSınav şartlarını ilgili kurumun (SPK, TÜRMOB, CFA Institute) sitesinden doğrula.'],
 /* ----- Ekonomi ve güncel (yalnız Genel modda; ders modunda ders motoru cevaplar) ----- */
 [/(dolar|euro|altin|hisse|bitcoin|kripto|borsa).*(alayim|alsam|almali|satayim|satsam|yatirim|tutayim)/,'Yatırım tavsiyesi veremem; kararı vadene, risk toleransına ve borsa/döviz dalgalanmasına göre sen (gerekirse lisanslı bir danışmanla) vermelisin. Ama kavramları, getiri-risk dengesini ve portföy mantığını anlatabilirim.',null,1],
 [/(dolar|euro|\bkur\b|doviz).*(neden|niye|nicin|yukseliyor|artiyor|cikiyor|ne olacak)|(neden|niye).*(dolar|\bkur\b|doviz)/,'Kuru tek şey belirlemez. Etkileyenler: faiz ve enflasyon farkı, cari açık/dış finansman, rezervler, risk algısı ve beklentiler. Hangisinin ağır bastığı dönemden döneme değişir. Güncel rakamlar için TCMB sitesine bak; “kur nasıl belirlenir” diye ders olarak da anlatabilirim.',null,1],
 [/enflasyon.*(neden|niye|nicin|sebep|artiyor|yukseliyor)|(neden|niye).*enflasyon/,'Enflasyonun tek sebebi yok: talep fazlası, maliyet artışları (enerji, kur, ücret), beklentiler ve para/maliye politikası birlikte etkiler. Güncel oranlar için TÜİK ve TCMB’ye bak. “Enflasyonu anlat” yazarsan konuyu ders olarak işleyelim.',null,1],
 [/faiz.*(dus|art|indir|yuksel|ne olur|etki|neden)/,'Kısaca: faiz düşünce kredi ucuzlar, yatırım ve tüketim canlanabilir; ama kur ve enflasyon üzerinde baskı oluşabilir. Faiz artınca tersi olur: enflasyon baskısı azalabilir, büyüme yavaşlayabilir. Sonuç, beklentilere ve ekonominin durumuna bağlı. Güncel karar için TCMB duyurusuna bak.',null,1],
 [/asgari ucret/,'Asgari ücret, Asgari Ücret Tespit Komisyonu’nda (işçi, işveren ve hükümet temsilcileri) belirlenir. Güncel tutar ve zam için Çalışma ve Sosyal Güvenlik Bakanlığı’nın duyurusuna bak; ekonomik etkilerini (maliyet, istihdam, gelir dağılımı) ders olarak anlatabilirim.',null,1],
 [/\beyt\b|emeklilikte yasa takilanlar|emekli(lik)?.*(sart|kac yas|ne zaman)/,'EYT, 1999’dan önce sigortalı olanlara yaş şartı aranmadan, prim gün ve sigortalılık süresiyle emeklilik hakkı veren 2023 düzenlemesidir. Kişisel durumun için e-Devlet’teki SGK hizmet dökümünü ve SGK’yı baz al.',null,1],
 [/vergi dilim|gelir vergisi (orani|dilim|tarife)/,'Gelir vergisi artan oranlı tarifeyle alınır: gelir yükseldikçe üst dilimdeki kısma daha yüksek oran uygulanır. Dilim tutarları her yıl güncellenir; güncel tarife için Gelir İdaresi (GİB) sitesine bak. Maliye derslerinde “artan oranlılık” konusunu anlatabilirim.',null,1],
 [/ekonomi.*(ne olacak|kriz|duzelir|batiyor|nereye gidiyor)|kriz (var|olacak|gelecek)/,'Tahmin yürütmem; ama nasıl takip edeceğini söyleyebilirim: enflasyon (TÜİK), faiz ve rezerv (TCMB), büyüme ve işsizlik (TÜİK), cari denge. Bunlar birlikte okunur. Hangisini ders olarak anlatayım?',null,1],
 /* ----- Bot hakkında ----- */
 [/yapay zeka misin|chatgpt misin|gpt misin|claude misin|insan misin|bot musun|gercek misin/,()=>'Ben Eko Can, Eko-Log’un asistanıyım. '+(AIVAR()?'Yapay zekâ destekliyim ve hata yapabilirim.':'Yapay zekâ kullanmıyorum: sitedeki içeriklerde arama yapıyor, hazır ders kartlarıyla anlatıyorum.')],
 [/(sen kimsin|kimsin sen|adin ne|ismin ne|sen nesin|kendini tanit)/,'Ben Eko Can 👋 Eko-Log’un asistanıyım: kavram anlatır, mini sınav yapar, çalışma ve kariyer sorularında yol gösteririm. Süper Lig sonuçlarını da takip ederim.'],
 [/(seni kim yapti|kim yazdi|kim tasarladi|yapimcin|kurucun|kim gelistirdi)/,'Beni Eko-Log ekibi geliştirdi; ben sitenin asistanıyım. Resmî görüş değil, öğrenme amaçlı bir yardımcıyım.'],
 [/odev(imi|ini|i)?.*(yap|yaz|hazirla)|(yap|yaz|hazirla)\w*.*odev/,'Ödevini senin yerine yazmam; ama konuyu anlatabilir, taslak planı çıkarabilir, yazdığını değerlendirebilirim. Hangi konu?'],
 [/kopya/,'Kopya yok 😄 Ama sınavdan önce seni sorularla sınayabilirim, bu çok daha kalıcı. “Beni bir soruyla sına” yaz.'],
 [/(neleri bilmiyorsun|neler bilmiyorsun|sinirlarin|ne yapamazsin|eksiklerin)/,'Bilmediklerim: sitede olmayan konular, kişiye özel kararlar (hukuk, yatırım, sağlık) ve güncel gelişmeler. Emin olmadığımda söylerim; resmî bilgi için kaynağa yönlendiririm.'],
 [/ne (yapabilirsin|biliyorsun|bilirsin)/,()=>SITE_NOT],
 /* ----- Sohbet ----- */
 [/\b(saka|fikra|espri)\b/,['Neden iktisatçılar hava durumunu tahmin etmeye çalışmaz? Zaten kendi tahminlerinde yeterince yanılıyorlar 😄','İktisatçı yola çıkmış, bir yüz lira görmüş: “Gerçek olsa biri alırdı” diyip geçmiş 😅','Bir iktisatçı kapıyı çalmış, içerden “Kim o?” demişler: “Ceteris paribus, bir komşu.” 🚪','Maliyeci ile iktisatçı arasındaki fark: biri “bu neden oldu” der, diğeri “bu nereye yazılır” 😄']],
 [/(film|dizi|kitap|belgesel|podcast).*(oner|tavsiye|var mi)|(oner|tavsiye).*(film|dizi|kitap|belgesel)/,'Ekonomi sevenlere 🍿\n• Film/belgesel: The Big Short, Margin Call, Inside Job\n• Kitap: Neden Bazı Ülkeler Zengin, Bazıları Fakirdir? (Acemoğlu & Robinson), Freakonomics, Hızlı ve Yavaş Düşünme (Kahneman)\nBaşka türde mi istersin?'],
 [/motivasyon|moral ver|beni motive et|gunun sozu|bana (bir )?soz/,['Büyük sınavlar küçük günlerin toplamıdır. Bugün yalnızca bir konu bitir. 💪','Mükemmel olmak zorunda değilsin; devam etmen yeter. Bugün 25 dakikayla başla. ⏱️','Bilmediğin konu seni durdurmaz; bilmediğini bilip çalışmayan durdurur. Hadi bir konuyla başlayalım!']],
 [/\bsikildim\b|canim sikiliyor|cok sikici/,'Sıkıldıysan kısa bir oyun: “Beni bir soruyla sına” yaz, ya da bana bir konu söyle, 1 dakikada anlatayım. İstersen şaka da yaparım 😄'],
 [/\bburc\b|burcum|horoskop|\bfal\b/,'Burçlar bende yok 😄 Ama sınav haftan nasıl geçecek, onu planla konuşabiliriz.'],
 [/^(tesekkur|tesekkurler|sag ol|saol|eyvallah|eline saglik)\b/,['Rica ederim! 😊 Başka bir şey olursa buradayım.','Ne demek! İyi çalışmalar 💪']]
];
KURALLAR.forEach(k=>FZ.ekleRe(k[0]));
let LASTK=null;
function oneriBul(q){
  const w=nt(q).split(' ').filter(x=>x.length>=4);if(!w.length)return[];
  const sk=[];for(const k of JKURAL){const b=k[5];if(!b)continue;const tt=nt(b);const p=w.filter(x=>tt.split(' ').some(y=>y.startsWith(x.slice(0,4)))).length;if(p>0)sk.push([p,b])}
  sk.sort((a,b)=>b[0]-a[0]);const o=[];sk.forEach(x=>{if(o.length<3&&!o.includes(x[1]))o.push(x[1])});return o}
function sss(q){
  const t=tl(q).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if(!t||t.length>130)return null;
  if(/(olmek|intihar|yasamak istemiyorum|kendime zarar|dayanamiyorum|titriyorum)/.test(t))return null;
  if(/\b(nedir|ne demek|tanimi|hesapla|formul|quiz|lab)\b/.test(t))return null;   // ders sorusunu kaçırma
  const lk=LASTK;LASTK=null;                          // takip sorusu: “peki lisansüstünde?”, “nereye başvuracağım?” → ana kurallar eşleşmezse önceki kuralın devam cevapları
  const devam=tt=>{if(lk&&lk.length&&tt.split(' ').length<=8){for(const d of lk){if(d[0].test(tt)){LASTK=lk;return{t:d[1]}}}}return null};
  const R=[KURALLAR[0],...JKURAL,...KURALLAR.slice(1)];   // yol tarifi → kampus.json kuralları → diğerleri
  const dene=tt=>{for(const k of R){
    if(k[3]&&MOD!=='genel')continue;                // ekonomi/güncel cevapları yalnız Genel modda
    if(!k[0].test(tt))continue;
    if(k[2]&&!k[2].test(tt))continue;
    const v=typeof k[1]==='function'?k[1](q,tt):Array.isArray(k[1])?rnd(k[1]):k[1];
    if(v){LASTK=k[4]&&k[4].length?k[4]:null;return{t:v}}}
    return null};
  let c=dene(t);if(c)return c;
  c=devam(t);if(c)return c;
  const fz=FZ.duzelt(t);                            // “vzie ne zman”, “trambuz” gibi bozuk yazımlar
  if(fz.degisti){c=dene(fz.t);if(c)return c}
  return null}
function hal(t,selam){
  const k=t.replace(SELAM,' ').replace(/\b(canim|hocam|arkadas|abi|kanka|bot|asistan)\b/g,' ').replace(/[?\s]+/g,' ').trim();
  if(!/^(nasilsin|naber|ne haber|nasil gidiyor|nasilsin bakalim|iyi misin)$/.test(k))return null;
  return (selam?rnd(['Selam! ','Selam, hoş geldin! ','Selaaam! ']):'')+rnd(['İyiyim, senden? Derslerin nasıl gidiyor? 😄','İyilik sağlık! Sen nasılsın bakalım?','Bomba gibiyim! Sen naber?'])}

function sohbet(q){const gv=guvenlik(q);if(gv)return gv;if(!AIVAR()){const fbr=sss(q)||futbol(q)||sinav(q)||koc(q)||gonul(q);if(fbr)return fbr}const t=tl(q).replace(/[^a-z0-9\s?]/g,' ').replace(/\s+/g,' ').trim();if(!t||t.length>60)return null;
  const siteSor=/(ne yapabilirim|neler yapabilirim|ne yapilir|neler var|ne var|nelere bakabilirim|siteyi (anlat|tanit|gezdir)|site(de|nin)? .*(ne|neler|nedir|anlat|tanit)|burada .*(ne|neler)|(bu|bu site) .*(ne ise yarar|ne sitesi))/.test(t)&&/(site|burada|yapabilirim|neler var|ne var)/.test(t)&&!/(sozluk|ansiklopedi|simulasyon|lab|mevzuat) .*(nerede|nasil)/.test(t);
  if(siteSor&&t.length<=60)return{t:(SELAM.test(t)?'Merhaba! 👋 ':'')+SITE_NOT,tur:1,chips:1};
  const hh=hal(t,SELAM.test(t));if(hh)return{t:hh};
  if(!AIVAR()&&/^(iyiyim|iyi ben|iyilik|fena degil|harikayim|super|cok iyi)\b/.test(t))return{t:/\bsen\b/.test(t)?'Ben de iyiyim, sağ ol! Hadi, bugün ne yapıyoruz?':'Sevindim! 😄 Hadi bakalım, bugün neye bakıyoruz?'};
  if(!AIVAR()&&/^(yorgunum|kotuyum|moralim bozuk|idare eder)\b/.test(t))return{t:'Hadi ya, ne oldu? Dert etme; biraz kafa dağıtırız, istersen çalışmaya da bakarız.'};
  const rest=t.replace(SELAM,'').replace(/\b(nasilsin|naber|ne haber|nasil gidiyor|canim|hocam|arkadas|bot|asistan)\b/g,'').replace(/[?\s]+/g,' ').trim();
  const selam=SELAM.test(t);
  if(selam&&rest.length<3)return{t:rnd(['Selam! 👋 Ben Eko Can. Nasılsın, ne var ne yok?','Selaaam! 👋 Hoş geldin, nasılsın?','Merhaba! 👋 Ben Eko Can; hayırdır, ne yapıyoruz bugün?']),chips:1};
  if(/^(nasilsin|naber|ne haber|nasil gidiyor)( ?\??)$/.test(t))return{t:'İyiyim, teşekkürler! Sen nasılsın? Çalışmak ya da öğrenmek istediğin bir konu var mı?'};
  if(/^(tesekkur|tesekkurler|tesekkur ederim|sagol|sag ol|eyvallah|saol|cok sagol|eline saglik)( .*)?$/.test(t))return{t:'Rica ederim! 🙂 Başka bir şey sorarsan buradayım.'};
  if(/^(kimsin|sen kimsin|nesin|ne yapiyorsun|ne yaparsin|neler yapabilirsin|ne ise yararsin|yardim|yardim et|yardim eder misin|nasil kullanilir|bu ne)( ?\??)$/.test(t))return{t:'Ben Eko Can, Eko-Log asistanıyım. Derse de bakarım, futbol goygoyuna da 😄 '+YETENEK[MOD],chips:1};
  if(/^(gorusuruz|hoscakal|hosca kal|bye|iyi calismalar|kolay gelsin|iyi gunler|iyi aksamlar|iyi geceler)( ?\??)$/.test(t))return{t:'Görüşürüz, kolay gelsin! 👋'};
  return null}
/* ================= KİŞİSELLEŞTİRME · SINAV TEKRARI · ÇALIŞMA PLANI · CEVAPSIZ SORU KAYDI =================
   Hepsi tarayıcıda (localStorage) çalışır; yapay zekâ ve sunucu gerekmez. Tek istisna: CFG.kayit.url tanımlıysa yalnızca
   “bilmiyorum” denen soru metni (kişisel bilgisi maskelenmiş, isimsiz) o adrese gönderilir. */
const PK='eko_bot_profil',PATLA='eko_bot_profil_atla',SKK='eko_bot_sinav',SZK='eko_bot_sinav_tarih',KAYIT_K='eko_bot_cevapsiz';
let PROFIL=ls(PK)||{},PSOR=null,PLANSONRA=false;
const sakla=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const alanBul=()=>LABK!=='genel'?LABK:((PROFIL.bolum&&PROFIL.bolum!=='genel')?PROFIL.bolum:null);
const SINIFAD={1:'1. sınıf',2:'2. sınıf',3:'3. sınıf',4:'4. sınıf',hz:'hazırlık',yl:'yüksek lisans'};
const SINIFNOT={
  1:'1. sınıftasın: temel derslerde (mikro, muhasebe, hukuk giriş…) oturmuş bir alt yapı en değerli yatırım. Excel ve İngilizceye şimdiden başla; kulüp ve etkinlikler ağ kurmanın en kolay yolu.',
  2:'2. sınıftasın: alanını netleştirme zamanı. Yaz için gönüllülük ya da kısa staj ara; istatistik/Excel seviyeni yükselt.',
  3:'3. sınıftasın: kritik yıl. Staj, sertifika (SPK, Excel/SQL…) ve “kamu mu, özel sektör mü, yüksek lisans mı?” kararı için ilk adımları şimdi at.',
  4:'4. sınıftasın: CV, mülakat hazırlığı, KPSS/yüksek lisans başvuru takvimi ve mezuniyet şartlarını (AKTS, staj) bir kez daha kontrol et.',
  hz:'Hazırlıktasın: önce dil hedefini bitir; bölüm derslerinde merak ettiğin konuları şimdiden okuyabilirsin.',
  yl:'Yüksek lisanstasın: tez konusu, danışman ve kaynak planı öncelik; ders notlarını tez diliyle tekrar yaz.'};
const SN=()=>SINIFNOT[PROFIL.sinif]?'\n\n🎓 '+SINIFNOT[PROFIL.sinif]:'';
const BOLUM=[['ceko',/\bceko\b|calisma ekonomisi|calisma iliskileri|endustri iliskileri/],['ekonometri',/ekonometri/],['isletme',/isletme|finans|bankacilik/],['maliye',/maliye|vergi/],['kamu',/\bkamu\b|siyaset bilimi/],['uluslararasi',/uluslararasi|uluslar arasi|\bui\b|diplomasi/],['iktisat',/\b(iktisat|ekonomi)\b/]];
const BCHIP=['İktisat','Ekonometri','İşletme & Finans','ÇEKO','Kamu Yönetimi','Maliye & Vergi','Uluslararası İlişkiler','Başka bölüm','Şimdilik geç'];
const SCHIP=['1. sınıf','2. sınıf','3. sınıf','4. sınıf','Hazırlık','Yüksek lisans'];
function profilSor(){PSOR='bolum';mesaj('Cevaplarımı sana göre ayarlayabilmem için kısaca tanışalım: hangi bölümdesin? (İstersen geç. Bilgi yalnızca bu cihazda saklanır.)','eb-b');chips(BCHIP)}
function profilCoz(t){const o={};let m;
  if(/^(simdilik gec|gec|atla|bos ver|istemiyorum)$/.test(t))o.gec=1;
  for(const [k,re] of BOLUM)if(re.test(t)){o.bolum=k;break}
  if(!o.bolum&&/\b(baska|diger)\b/.test(t))o.bolum='genel';
  if(m=t.match(/\b([1-4])\s*(?:nci|inci|uncu|ncu)?\s*(?:sinif|snf)/))o.sinif=+m[1];
  else if(m=t.match(/\b(birinci|ikinci|ucuncu|dorduncu)\s*sinif/))o.sinif={birinci:1,ikinci:2,ucuncu:3,dorduncu:4}[m[1]];
  else if(/\bhazirlik\b/.test(t))o.sinif='hz';
  else if(/yuksek lisans|\bmaster\b|doktora|lisansustu/.test(t))o.sinif='yl';
  else if(PSOR==='sinif'&&(m=t.match(/^([1-4])$/)))o.sinif=+m[1];
  return o}
const profilOzet=()=>[PROFIL.bolum==='genel'?'başka bölüm':LABAD[PROFIL.bolum],SINIFAD[PROFIL.sinif]].filter(Boolean).join(' · ');
const profilChip=()=>{const a=['Beni bir soruyla sına','Sınav planı yap'];if(alanBul())a.push('Mezun olunca ne iş yapılır?');return a};
const profilBitti=()=>({t:'Tamam, not aldım: '+profilOzet()+'. Kariyer, sınav sorusu ve çalışma planı cevaplarını buna göre ayarlarım. Değiştirmek için “bölümüm maliye” ya da “2. sınıfım” yazman yeter.',chips:profilChip()});

/* ---------- Sınav tekrar modu: sonuçları tutar, yanlış yapılan konulara geri döner ---------- */
const ST=(()=>{
  let d=ls(SKK)||{};d.n=d.n||0;d.d=d.d||0;d.k=d.k||0;d.y=d.y||0;d.p=d.p||0;d.konu=d.konu||{};
  const GUN=864e5,kay=()=>sakla(SKK,d);
  const agirlik=b=>{const k=d.konu[b];if(!k)return 2;                        // hiç sorulmamış: orta öncelik
    if(k.s==='y'||k.s==='p')return 6;if(k.s==='k')return 3;                 // son cevap yanlış/pas/kısmi: yüksek
    const eski=Date.now()-k.son>3*GUN;return k.seri>=2?(eski?1.2:0.3):(eski?2.4:1.2)}; // oturmuşsa seyrek, eskidiyse yeniden
  const zayifListe=()=>Object.keys(d.konu).filter(b=>{const k=d.konu[b];return k.s==='y'||k.s==='p'||k.s==='k'}).sort((a,b)=>agirlik(b)-agirlik(a));
  const oran=()=>Math.round((d.d+0.5*d.k)/Math.max(1,d.n)*100);
  return{
    kaydet(b,s){if(!b||!s)return;const k=d.konu[b]||(d.konu[b]={d:0,k:0,y:0,p:0,seri:0,son:0,s:''});
      d.n++;if(s==='d'){d.d++;k.d++;k.seri++}else{if(s==='k'){d.k++;k.k++}else if(s==='y'){d.y++;k.y++}else{d.p++;k.p++}k.seri=0}
      k.son=Date.now();k.s=s;kay()},
    agirlik,zayifListe,
    satir(){return d.n?'\n\n📈 Skor: '+d.d+'/'+d.n+' tam doğru'+(d.n>=3?' (≈ %'+oran()+')':''):''},
    ozet(){
      if(!d.n)return{t:'Henüz seni sınamadım, skor yok. “Beni bir soruyla sına” yaz; cevapların burada birikir, zayıf konularına geri dönerim.',chips:['Beni bir soruyla sına']};
      const zl=zayifListe().slice(0,4),iyi=Object.keys(d.konu).filter(b=>d.konu[b].seri>=2).slice(0,4);
      const L=['📈 **Sınav skorun**','Toplam '+d.n+' soru · ✅ '+d.d+' · 🟡 '+d.k+' · ❌ '+(d.y+d.p)+' → başarı ≈ %'+oran()];
      if(zl.length)L.push('\n**🔁 Tekrar edilmesi gerekenler**\n'+zl.map(b=>'• '+b+' (❌ '+(d.konu[b].y+d.konu[b].p)+(d.konu[b].d?' · ✅ '+d.konu[b].d:'')+')').join('\n'));
      if(iyi.length)L.push('\n**💪 Oturmuş konular**\n'+iyi.join(', '));
      L.push('\n“Tekrar modu” yazarsan yalnızca zayıf konularından soru sorarım.');
      return{t:L.join('\n'),chips:zl.length?['Tekrar modu','Beni bir soruyla sına','Sınav planı yap']:['Beni bir soruyla sına','Sınav planı yap']}},
    sifirla(){d={n:0,d:0,k:0,y:0,p:0,konu:{}};try{localStorage.removeItem(SKK)}catch(e){}},
    _d:()=>d}})();
function tekrarBaslat(){
  const tum=DERS._KART.map(c=>c.b),zl=ST.zayifListe().filter(b=>tum.includes(b));
  if(!zl.length)return{t:'Tekrar edilecek bir konun görünmüyor 🎉 Yanlış ya da “pas” kaydın yok. İstersen normal bir soruyla yoklayayım.',chips:['Beni bir soruyla sına']};
  const al=alanBul(),kn=al?DERS.konular(al):[];
  const ms=DERS.mini(kn.some(b=>zl.includes(b))?al:null,b=>zl.includes(b)?ST.agirlik(b):0,'🔁 **Tekrar modu** — daha önce zorlandığın bir konudan:\n\n');
  SINA=ms.mini;return{t:ms.t}}

/* ---------- Sınav tarihi → günlük/haftalık çalışma planı ---------- */
const AYLAR=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
const gunBasi=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const isoGun=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function tarihBul(t,q,simdi){
  const bg=gunBasi(simdi||new Date());let m;
  const kur=(y,a,g)=>{const d=new Date(y,a,g);return d.getMonth()===a&&d.getDate()===g?d:null};
  if(m=t.match(/\b(\d{1,2})\s*(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\w*(?:\s+(20\d\d))?/)){
    const a=AYLAR.indexOf(m[2]);let d=kur(m[3]?+m[3]:bg.getFullYear(),a,+m[1]);if(d&&!m[3]&&d<bg)d=kur(bg.getFullYear()+1,a,+m[1]);return d}
  if(m=String(q||'').match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/)){
    const y=m[3]?(+m[3]<100?2000+(+m[3]):+m[3]):bg.getFullYear();let d=kur(y,+m[2]-1,+m[1]);if(d&&!m[3]&&d<bg)d=kur(y+1,+m[2]-1,+m[1]);return d}
  if(m=t.match(/\b(\d{1,3})\s*gun\s*(sonra|var|kaldi|icinde)/))return new Date(bg.getFullYear(),bg.getMonth(),bg.getDate()+ +m[1]);
  if(/\byarin\b/.test(t))return new Date(bg.getFullYear(),bg.getMonth(),bg.getDate()+1);
  return null}
const sinavAd=t=>/butunleme|\bbut\b/.test(t)?'bütünleme':/\bfinal/.test(t)?'final':/\bvize|ara sinav/.test(t)?'vize':/kpss/.test(t)?'KPSS':/\bquiz/.test(t)?'quiz':'sınav';
function planKur(al,s,simdi){
  const bg=gunBasi(simdi||new Date()),h=new Date(s.t+'T00:00:00'),D=Math.round((h-bg)/864e5);
  const ad=s.ad||'sınav',AD=ad.charAt(0).toLocaleUpperCase('tr')+ad.slice(1);
  const tf=d=>d.toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
  const bas='📅 **'+AD+'** · '+h.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric',weekday:'long'});
  if(D<0)return{t:bas+'\nBu tarih geçmiş görünüyor. Yeni tarihi yaz (örn. “finalim 14 Ocak”).'};
  if(D===0)return{t:bas+'\nSınav bugün! Yeni konu açma; zayıf konuların hafıza ipuçlarına göz at, su iç, erken çık. Başarılar 💪',chips:['Beni bir soruyla sına']};
  const K=al?DERS.konular(al):[],zl=ST.zayifListe().filter(b=>K.includes(b)),sira=[...zl,...K.filter(b=>!zl.includes(b))];
  const E=[];
  if(D===1)E.push({tip:'son'});
  else if(D===2)E.push({tip:'karma'},{tip:'son'});
  else{const R=D-2,L=Math.max(1,Math.min(Math.round(R*0.6),sira.length?sira.length*2:R)),per=sira.length/L;   // her konu ≈ 2 gün: 1 öğrenme + 1 tekrar
    for(let i=0;i<L;i++){const k=sira.slice(Math.floor(i*per),Math.floor((i+1)*per));E.push(k.length?{tip:'ogren',k}:{tip:sira.length?'tekrar':'genel'})}
    for(let j=0;j<R-L;j++){const k=sira.length?[0,1].map(x=>sira[(j*2+x)%sira.length]).filter((v,i,a)=>a.indexOf(v)===i):[];E.push(k.length?{tip:'pek',k}:{tip:'karma'})}
    E.push({tip:'karma'},{tip:'son'})}
  const top=(l,n)=>l.slice(0,n).join(', ')+(l.length>n?' +'+(l.length-n):'');
  const adim=Math.max(1,D<=10?1:Math.max(7,Math.ceil(D/10)));
  const L=[bas+' — **'+D+' gün** kaldı'];
  if(K.length)L.push('Konu havuzu: '+K.length+' konu'+(zl.length?' · önce zayıflar: '+top(zl,3):''));
  L.push('');
  const tx=e=>e.tip==='genel'?'Yeni konu: ders notlarından 1–2 konu bitir':e.tip==='ogren'?'Öğren → '+top(e.k,adim===1?3:5):e.tip==='tekrar'?'Tekrar günü: önceki konuları kendi cümlenle özetle':e.tip==='pek'?'Pekiştir (5’er soru) → '+top(e.k,adim===1?3:5):e.tip==='karma'?'Karışık mini sınav (10 soru)':'Hafif tekrar, hafıza ipuçları, erken yat';
  for(let i=0;i<E.length;i+=adim){
    const g=E.slice(i,i+adim),a=new Date(bg.getFullYear(),bg.getMonth(),bg.getDate()+i),b=new Date(bg.getFullYear(),bg.getMonth(),bg.getDate()+Math.min(i+adim,E.length)-1);
    const et=adim===1?tf(a)+' ('+a.toLocaleDateString('tr-TR',{weekday:'short'})+')':tf(a)+'–'+tf(b);
    if(adim===1){L.push('• '+et+': '+tx(g[0]));continue}
    const og=[...new Set(g.filter(e=>e.tip==='ogren').flatMap(e=>e.k))],pk=[...new Set(g.filter(e=>e.tip==='pek').flatMap(e=>e.k))],p=[];
    if(og.length)p.push('Öğren → '+top(og,5));if(pk.length)p.push('Pekiştir → '+top(pk,5));
    if(g.some(e=>e.tip==='tekrar'))p.push('tekrar günleri');if(g.some(e=>e.tip==='genel'))p.push('ders notlarından yeni konular');if(g.some(e=>e.tip==='karma'))p.push('karışık mini sınav');if(g.some(e=>e.tip==='son'))p.push('son gün hafif tekrar');
    L.push('• '+et+': '+p.join(' · '))}
  L.push('\nHer akşam 5 dakika “Beni bir soruyla sına”; zayıf konular için “Tekrar modu”, ilerlemen için “Skorum”. '+(K.length?'Plan, botun ders kartlarındaki konulara göre kuruldu; kendi ders programına göre kaydır.':'Konu adlarıyla doldurmam için bölümünü söylersen (“bölümüm iktisat”) planı yenilerim.'));
  return{t:L.join('\n'),chips:['Beni bir soruyla sına','Tekrar modu','Skorum']}}
function planYanit(s){const al=alanBul();
  if(!al&&PROFIL.bolum!=='genel'){PSOR='bolum';PLANSONRA=true;return{t:'Tarihi not aldım. Planı bölümüne göre konu konu kurayım: hangi bölümdesin?',chips:BCHIP.slice(0,8)}}
  return planKur(al,s)}
const PLAN_SOR={t:'Sınav tarihini yaz, planını çıkarayım. Örn: “finalim 14 Ocak”, “vizem 12 Nisan” ya da “sınava 20 gün var”.'};
function planKomut(q,t){
  const ex=/\b(sinav\w*|final\w*|vize\w*|butunleme\w*|kpss\w*|quiz\w*)\b/.test(t);
  const kisi=/\b(sinavim\w*|finalim\w*|vizem\w*|butunlemem\w*|kpssim\w*|sinava|finale|vizeye|butunlemeye|kpssye)\b/.test(t);
  const planW=/\b(plan\w*|program\w*|hazirlan\w*|calisma\w*|calisayim|calismaliyim)\b/.test(t),planS=/\b(plan\w*|program\w*)\b/.test(t);
  const dt=tarihBul(t,q),kay=ls(SZK);
  if(/(kac gun kaldi|ne kadar kaldi|sinava kac gun|finale kac gun|vizeye kac gun)/.test(t)&&!dt){
    if(!kay)return PLAN_SOR;const D=Math.round((new Date(kay.t+'T00:00:00')-gunBasi(new Date()))/864e5);
    return{t:D>0?'⏳ '+kay.ad+' sınavına **'+D+' gün** kaldı ('+new Date(kay.t+'T00:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'long'})+').':D===0?'Sınav bugün! 💪':'Kayıtlı sınav tarihi geçmiş; yeni tarihi yaz.',chips:D>0?['Sınav planı yap','Beni bir soruyla sına']:undefined}}
  if(dt&&ex&&(kisi||planW)){const s={t:isoGun(dt),ad:sinavAd(t)};sakla(SZK,s);return planYanit(s)}
  if(/\bplanim\b|plani goster|calisma planimi (goster|ver)/.test(t)&&kay)return planYanit(kay);
  if(ex&&planS&&!dt)return kay?planYanit(kay):PLAN_SOR;
  return null}

/* ---------- Not girişi → YNO/AGNO değerlendirmesi ----------
   İnönü Üniversitesi Önlisans ve Lisans Eğitim ve Öğretim Yönetmeliği: md.17 (AKTS sınırı), md.20 (harf/katsayı), md.21 (AGNO).
   Notlar yalnızca o mesajda işlenir; saklanmaz ve sunucuya gönderilmez. */
const NOTKAT={a1:4,a2:3.75,a3:3.5,b1:3.25,b2:3,b3:2.75,c1:2.5,c2:2.25,c3:2,d1:1.75,d2:1.5,d3:1,f1:.5,f2:0,f3:0,gr:0};
const PUANHARF=p=>p>=95?'a1':p>=90?'a2':p>=85?'a3':p>=80?'b1':p>=75?'b2':p>=70?'b3':p>=65?'c1':p>=60?'c2':p>=55?'c3':p>=50?'d1':p>=45?'d2':p>=40?'d3':p>=35?'f1':'f2';
const NOTKATLAR=Object.keys(NOTKAT);
let NOTBEK=false;
const nk2=x=>(Math.round((x+1e-9)*100)/100).toFixed(2).replace('.',',');
const NOT_ISTEK='📊 Notlarını yaz, YNO/AGNO’nu hesaplayıp durumunu değerlendireyim.\nHer dersi virgülle ayır: **ders adı, AKTS, harf notu** (ya da 100’lük not). Örnek:\n“Mikro 6 A2, Makro 5 B1, İstatistik 4 70”\nÖnceki ortalaman varsa ekle: “mevcut agno 2,85 90 akts”.\nAKTS yazmadığın dersi hesaba katamam. Notların yalnızca bu mesajda işlenir, kaydedilmez.';
function notAyikla(q){
  let norm=String(q).replace(/(\d),(\d)/g,'$1.$2');
  const ik=norm.indexOf(':');if(ik>0&&/(agno|gno|yno|hesapla|degerlendir|değerlendir|ortalam|notlar)/i.test(norm.slice(0,ik)))norm=norm.slice(ik+1);   /* “agno hesapla: …” → komut kısmını at */
  const parcalar=norm.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
  const out={ders:[],base:null,atlanan:[]};
  for(const p of parcalar){
    const t=tl(p);
    /* önceki ortalama: “mevcut agno 2.85 90 akts” */
    if(/(mevcut|onceki|simdiye kadar|su an|simdiki)/.test(t)&&/(agno|gno|ortalam)/.test(t)){
      const g=t.match(/(?:agno|gno|ortalama\w*)\D{0,12}?([0-4](?:\.\d{1,2})?)(?!\d)/);
      const a=t.match(/(\d{1,3})\s*(?:akts|kredi)/)||t.match(/(?:^|\s)(\d{2,3})(?:\s|$)/);
      if(g&&a&&+g[1]<=4&&+a[1]>0){out.base={agno:+g[1],akts:+a[1]};continue}
      out.atlanan.push(p);continue}
    const hm=t.match(/(?:^|[^a-z0-9])([a-d][123]|f[123]|gr)(?![a-z0-9])/);
    const h=hm?hm[1]:null;
    const t2=h?t.replace(hm[0],hm[0].replace(h,' ')):t;
    const ak=t2.match(/(\d+(?:\.\d+)?)\s*(?:akts|kredi)/);
    const sayilar=[...t2.replace(/(\d+(?:\.\d+)?)\s*(?:akts|kredi)/,' ').matchAll(/\d+(?:\.\d+)?/g)].map(m=>+m[0]);
    let akts=null,harf=h,puan=null;
    if(h){akts=ak?+ak[1]:(sayilar.length?sayilar[sayilar.length-1]:null)}
    else{
      if(ak&&sayilar.length){akts=+ak[1];puan=sayilar[sayilar.length-1]}
      else if(sayilar.length>=2){const n1=sayilar[sayilar.length-2],n2=sayilar[sayilar.length-1];
        if(n2>30&&n1<=30){akts=n1;puan=n2}else if(n1>30&&n2<=30){akts=n2;puan=n1}else{akts=n1;puan=n2}}
    }
    if(!harf&&puan!=null){if(puan<0||puan>100){out.atlanan.push(p);continue}harf=PUANHARF(puan)}
    if(!harf||akts==null||!(akts>0&&akts<=30)){if(/\d|[a-d][123]|f[123]/.test(t))out.atlanan.push(p);continue}
    const ad=p.replace(/(^|[^A-Za-z0-9])([A-Da-dFf][123]|GR|gr)(?![A-Za-z0-9])/g,'$1 ').replace(/\d+(?:[.,]\d+)?\s*(akts|AKTS|kredi)?/g,' ').replace(/[:=\-–()]/g,' ').replace(/\s+/g,' ').trim();
    out.ders.push({ad:ad||'Ders '+(out.ders.length+1),akts,h:harf,k:NOTKAT[harf],puan});
  }
  return out}
function notDegerlendir(P){
  const D=P.ders;let top=0,aks=0;D.forEach(x=>{top+=x.akts*x.k;aks+=x.akts});
  const yno=top/aks,B=P.base;
  const ag=B?(B.agno*B.akts+top)/(B.akts+aks):yno,tak=B?B.akts+aks:aks;
  const bas=D.filter(x=>/^f|^gr$/.test(x.h)),sart=D.filter(x=>/^d/.test(x.h));
  const HH=h=>h.toUpperCase();
  const L=[];
  L.push('📊 **Not değerlendirmen**');
  L.push(D.map(x=>x.ad+' · '+x.akts+' AKTS · '+HH(x.h)+(x.puan!=null?' ('+x.puan+')':'')).join('\n'));
  L.push('• YNO (bu dönem): **'+nk2(yno)+'** · '+aks+' AKTS');
  if(B)L.push('• Birleşik AGNO: **'+nk2(ag)+'** · '+tak+' AKTS (mevcut '+nk2(B.agno)+' ile)');
  let durum,limit,not2=[];
  if(ag<2){durum='AGNO 2,00’nin altında: **başarısız durumdasın**.';limit='en çok 30 AKTS; alttan dersler zorunlu, üstten ders alamazsın';
    not2.push('Başarısız durumdayken topluluk/kulüp yöneticisi olamaz, yurt dışı değişim programlarına ve burslara başvuramazsın.');
    if(sart.length)not2.push('D’li derslerin “şartlı geçti” sayılması için AGNO’nun en az 2,00 olması gerekir.')}
  else if(ag<3){durum='AGNO '+nk2(ag)+': başarılı durum.';limit='en çok 40 AKTS; alttan dersler öncelikli'}
  else if(ag<3.5){durum=bas.length?'AGNO '+nk2(ag)+' (onur aralığı), ama başarısız dersin olduğu için onur/üstten ders hakkın yok.':'🎖️ AGNO '+nk2(ag)+': **onur öğrencisi** aralığı.';limit='en çok 40 AKTS'+(bas.length?'':'; üstten ders alabilirsin (ikinci yarıyıldan itibaren)')}
  else{durum=bas.length?'AGNO '+nk2(ag)+' (yüksek onur aralığı), ama başarısız dersin olduğu için onur/üstten ders hakkın yok.':'🏅 AGNO '+nk2(ag)+': **yüksek onur öğrencisi** aralığı.';limit='en çok 45 AKTS'+(bas.length?'':'; üstten ders alabilirsin (ikinci yarıyıldan itibaren)')}
  L.push('• '+durum);
  if(bas.length)L.push('• ⚠️ Başarısız: '+bas.map(x=>x.ad+' ('+HH(x.h)+')').join(', ')+'. Bu dersleri tekrar almalısın; mezuniyette hiçbir derste F1/F2/F3/GR kalmamalı.');
  if(sart.length&&ag>=2)L.push('• D’li dersler ('+sart.map(x=>x.ad+' '+HH(x.h)).join(', ')+') AGNO 2,00 ve üstü olduğu için başarılı sayılır; not yükseltmek istersen tekrar alabilirsin (son not geçer).');
  const but=D.filter(x=>/^(d[123]|f[12])$/.test(x.h));
  if(but.length)L.push('• Bütünleme hakkın olan dersler: '+but.map(x=>x.ad).join(', ')+' (bütünleme notu final yerine geçer).');
  L.push('• Gelecek dönem: '+limit+'.');
  const hd=ag<2?2:ag<3?3:ag<3.5?3.5:null;
  if(hd){const gerek=(hd*(tak+30)-ag*tak)/30;
    L.push(gerek<=4?'• Hedef: 30 AKTS’lik bir sonraki dönemde ortalaman en az **'+nk2(gerek)+'** olursa AGNO’n '+nk2(hd)+' olur.':'• Hedef '+nk2(hd)+' AGNO tek dönemde ulaşılamayacak kadar uzak; birkaç dönemde ve F’li/D’li dersleri tekrar ederek yükselir.')}
  if(P.atlanan.length)L.push('ℹ️ Anlayamadığım satırlar: '+P.atlanan.join(' | ')+' (AKTS ve not birlikte yaz).');
  L.push('Bu bir tahmindir: resmî sonuç öğrenci otomasyonundaki AGNO’dur. Tekrar edilen derslerde eski notu mevcut ortalamandan çıkarman gerekir. Kurallar: İnönü Önlisans/Lisans Eğitim-Öğretim Yönetmeliği (Tıp ve Diş Hekimliği hariç).');
  return L.join('\n')}
const NOTTET=/\b(agno|gno|yno)\b|not ortalam\w*|ortalamam\w*|notlarim\w*|karnem/;
const NOTFIL=/hesapla\w*|degerlendir\w*|yorumla\w*|kac (olur|yapar|eder)|ne olur|durumum|bakar misin/;
function notKomut(q){
  const t=nt(q);if(!t)return null;
  if(NOTBEK&&/^(iptal|vazgec|vazgectim|bos ver)$/.test(t)){NOTBEK=false;return{t:'Tamam, not hesaplamayı iptal ettim.'}}
  const P=notAyikla(q);
  const tetik=NOTTET.test(t)&&NOTFIL.test(t)&&!/\b(nasil|formul|nedir|ne demek|hangi)\b/.test(t);
  if(P.ders.length&&(tetik||NOTBEK||P.ders.length>=2)){NOTBEK=false;return{t:notDegerlendir(P)}}
  if(tetik){NOTBEK=true;return{t:NOT_ISTEK}}
  if(NOTBEK){NOTBEK=false;if(P.atlanan.length)return{t:'Satırları anlayamadım. Şöyle yaz: “Mikro 6 A2, Makro 5 B1” (ders adı, AKTS, harf notu). Tekrar denemek için “agno hesapla” yaz.'}}
  return null}

function kisiselKomut(q){
  if(guvenlik(q))return null;
  if(!PSOR&&!DEN){const nk=notKomut(q);if(nk)return nk}
  const t=nt(q);if(!t||t.length>160)return null;
  /* 1) profil sorusuna cevap */
  if(PSOR){const c=profilCoz(t);
    if(c.gec){PSOR=null;PLANSONRA=false;sakla(PATLA,1);return{t:'Tamam! İstediğin zaman “bölümüm iktisat” ya da “3. sınıfım” yazarak söyleyebilirsin.',chips:MODCHIP[MOD]||MODCHIP.genel}}
    if(PSOR==='bolum'&&c.bolum){PROFIL.bolum=c.bolum;if(c.sinif)PROFIL.sinif=c.sinif;sakla(PK,PROFIL);
      if(PLANSONRA){PLANSONRA=false;PSOR=null;const sz=ls(SZK);if(sz)return planYanit(sz)}
      if(PROFIL.sinif){PSOR=null;return profilBitti()}
      PSOR='sinif';return{t:(c.bolum==='genel'?'Tamam.':'Güzel, '+LABAD[c.bolum]+'.')+' Kaçıncı sınıfsın?',chips:SCHIP}}
    if(PSOR==='sinif'&&c.sinif){PROFIL.sinif=c.sinif;sakla(PK,PROFIL);PSOR=null;return profilBitti()}
    PSOR=null;PLANSONRA=false;sakla(PATLA,1)}                       /* yanıt vermedi: bir daha rahatsız etme */
  /* 2) serbest cümleyle profil: “bölümüm iktisat”, “3. sınıfım”, “maliye okuyorum” */
  if(/\b(bolumum|sinifim|ogrencisiyim|ogrenciyim|okuyorum|sinifa gidiyorum|sinifta)\b/.test(t)||/^ben\b.*\b(sinif|bolum)/.test(t)){
    const c=profilCoz(t);
    if(c.bolum||c.sinif){if(c.bolum)PROFIL.bolum=c.bolum;if(c.sinif)PROFIL.sinif=c.sinif;sakla(PK,PROFIL);
      if(t.length<=50)return{t:'Not aldım: '+profilOzet()+'.',chips:profilChip()}}}
  if(/^(profilim|profilimi goster|bolumum ne|sinifim kac|beni taniyor musun)$/.test(t))
    return{t:profilOzet()?'👤 '+profilOzet()+'. Değiştirmek için “bölümüm maliye” ya da “2. sınıfım” yaz; silmek için “profilimi sil”. Bilgi yalnızca bu cihazda saklanır.':'Henüz bölüm/sınıf bilgin yok. “Bölümüm iktisat, 3. sınıfım” gibi yazabilirsin.'};
  if(/profili(mi)? (sil|sifirla|unut)|bolumumu unut/.test(t)){PROFIL={};try{localStorage.removeItem(PK)}catch(e){}sakla(PATLA,1);return{t:'Profilini sildim; bu cihazda bölüm/sınıf bilgin kalmadı.'}}
  /* 3) skor · tekrar modu */
  if(/\b(skor\w*|puan\w*|istatistik\w*|sinav gecmis\w*|sinav sonuc\w*) (sifirla|sil|temizle)/.test(t)){ST.sifirla();return{t:'Sınav skorlarını sildim.'}}
  if(/^(skorum|puanim|ilerlemem|istatistiklerim|sinav skorum|sonuclarim|basari oranim|ne kadar bildim|nasil gidiyorum)$|(skorumu|ilerlememi|sonuclarimi|puanimi|istatistiklerimi) (goster|ver|soyle)/.test(t))return ST.ozet();
  if(/tekrar modu|yanlis\w* .*(tekrar|calis|coz|sor)|(tekrar|calis|coz) .*yanlis|eksik\w* .*(calis|tekrar|coz|sor)|zayif (konu|yan)\w* .*(calis|tekrar|coz|sor)/.test(t))return tekrarBaslat();
  /* 4) sınav tarihi / plan */
  return planKomut(q,t)}

/* ---------- Cevapsız soru kaydı: bot “bilmiyorum” derse soru (isimsiz) listeye yazılır ---------- */
const KAYITLI=new Set(),kayitVar=()=>!!(CFG.kayit&&CFG.kayit.url);
const pii=s=>s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g,'[e-posta]').replace(/\bTR\d{2}[\d ]{10,}/gi,'[iban]').replace(/(\+?90)?[\s-]?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,'[tel]').replace(/\d{7,}/g,'[no]');
function gonder(rec){const K=CFG.kayit||{};if(!K.url)return;try{
  if(K.alan){const p=new URLSearchParams();p.set(K.alan,JSON.stringify(rec));fetch(K.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:p.toString(),keepalive:true}).catch(()=>{});return}   /* Google Form: K.alan = 'entry.123456' */
  const j=JSON.stringify(rec);if(navigator.sendBeacon&&navigator.sendBeacon(K.url,new Blob([j],{type:'text/plain'})))return;
  fetch(K.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:j,keepalive:true}).catch(()=>{})}catch(e){}}
function cevapsiz(q,neden){try{
  if(guvenlik(q))return false;
  const s=pii(String(q).replace(/\s+/g,' ').trim()).slice(0,200),k=tl(s);
  if(s.length<4||KAYITLI.has(k))return false;
  KAYITLI.add(k);
  const rec={s,n:neden,m:MOD,l:LABK,p:(location.pathname.split('/').pop()||'index'),z:new Date().toISOString().slice(0,16)};
  const Q=ls(KAYIT_K)||[];Q.push(rec);sakla(KAYIT_K,Q.slice(-60));
  if(kayitVar()){gonder(rec);return true}
  return false}catch(e){return false}}
function kayitNot(m){try{const n=$('small','','📝 Bu soruyu, eksikleri tamamlamak için isimsiz olarak not ettim.');n.style.cssText='display:block;padding:8px 0 0;opacity:.8';m.appendChild(n)}catch(e){}}
window.ekoBotCevapsiz=()=>ls(KAYIT_K)||[];   /* konsolda: ekoBotCevapsiz() → bu cihazda biriken cevapsız sorular */

async function sor(q){
  if(busy||!q.trim())return;
  if(SINA&&!guvenlik(q)){const sd=DERS.deger(SINA,q),sk=SINA;SINA=null;
    if(!sd.yeni){if(sd.sonuc)ST.kaydet(sk.b,sd.sonuc);mesaj(q,'eb-u');mesaj(sd.t+(sd.sonuc?ST.satir():''),'eb-b');if(sd.chips)chips(sd.chips);log.scrollTop=log.scrollHeight;sohbetKaydet();return}}
  {const ks=kisiselKomut(q);if(ks){mesaj(q,'eb-u');mesaj(ks.t,'eb-b');if(ks.chips)chips(ks.chips);log.scrollTop=log.scrollHeight;sohbetKaydet();return}}
  await yukleHafif();
  {const lc0=ligCevap(q);if(lc0){mesaj(q,'eb-u');mesaj(lc0,'eb-b');log.scrollTop=log.scrollHeight;sohbetKaydet();return}}
  const sh=sohbet(q);
  if(sh){mesaj(q,'eb-u');const mm=mesaj(sh.t+(DEN?' (Denemede konu/cevabını bekliyorum; çıkmak için "iptal" yaz.)':''),'eb-b');
    if(sh.tur){const w=$('div','eb-src');SITE_TUR.filter(x=>x[2]).forEach(x=>{const a=$('a');a.href=hrefOf(x[2]);a.textContent=x[0].split(' · ')[0].slice(0,32);w.appendChild(a)});mm.appendChild(w)}
    if(sh.chips&&!DEN)chips(MODCHIP[MOD]);log.scrollTop=log.scrollHeight;return}
  if(DEN){if(/^(çık|iptal|bitir)$/i.test(q.trim())){mesaj(q,'eb-u');DEN=null;mesaj('Deneme sonlandırıldı.','eb-b');return}return denemeAdim(q)}
  if((MOD==='ders'||alanBul())&&/(beni\s+(bir\s+)?(soruyla\s+)?sına|bana\s+(soru|deneme)|3\s*soru|deneme\s*(sınav|yap|başlat|çöz)|sınav\s*yap|test\s*et|bir\s*soru\s*daha|başka\s*soru)/i.test(q)){mesaj(q,'eb-u');
    if(DENEME_ACIK&&/deneme|3\s*soru/i.test(q))return denemeBaslat();
    const ms=DERS.mini(alanBul()||LABK,ST.agirlik);SINA=ms.mini;mesaj(ms.t,'eb-b');log.scrollTop=log.scrollHeight;sohbetKaydet();return}
  if(DEGER.test(tl(q))){
    const aktif=OL.filter(o=>['yanlis','dogru','yardim','sifirla','ayar','kontrol'].includes(o.tur));
    if(!aktif.length){mesaj(q,'eb-u');const m0=mesaj('Bu oturumda henüz değerlendirebileceğim bir çalışma görmedim. İİBF Laboratuvarı\'nda bir quiz çöz ya da laboratuvarı kullan; ardından "Çalışmamı değerlendir" de, hata örüntülerini birlikte inceleyelim.','eb-b');
      const w=$('div','eb-src'),a=$('a');a.href=hrefOf('eko-plus/iibf-laboratuvar.html');a.textContent='🧪 İİBF Laboratuvarı';w.appendChild(a);m0.appendChild(w);return}
    if(!izinIste())return}
  busy=true;mesaj(q,'eb-u');await yukle();
  if(MOD==='genel'){const lc=ligCevap(q);if(lc){mesaj(lc,'eb-b');log.scrollTop=log.scrollHeight;busy=false;sohbetKaydet();return}}
  if(MOD==='genel'&&DERS_ACIK){try{const dr=DERS.cevap(q);if(dr&&dr.t&&(dr.kart||(dr.ara&&dr.ara.length&&/\b(anlat|ogret|ders)\w*/.test(tl(q)))))modSec('ders',true)}catch(e){}}
  if(MOD==='ders'){                                   /* YEREL DERS MOTORU: sunucu/yapay zekâ yok */
    const r=DERS.cevap(q);
    if(r&&r.t){const m=mesaj(r.t,'eb-b');
      if(r.ara&&r.ara.length)kaynaklar(m,r.ara.slice(0,4));
      if(!r.konu)yonlendir(m,r.t,r.ara||[]);
      if(r.mini)SINA=r.mini;
      hist.push({role:'user',content:q},{role:'assistant',content:r.t.slice(0,600)});
      chips(r.konu?MODCHIP.ders:(r.chips||['Sınavda nasıl yazılır?','Beni bir soruyla sına','Başka bir konu']))}
    else{const mm=mesaj(DERS.liste(LABK),'eb-b');if(cevapsiz(q,'ders'))kayitNot(mm)}
    log.scrollTop=log.scrollHeight;busy=false;sohbetKaydet();return}
  {const sz=sozlukCevap(q);if(sz.length){
    const tx=sz.map(c=>`📖 ${c.t}${c.c?' ('+c.c+')':''}\n${c.x.slice(0,700)}${c.x.length>700?'…':''}`).join('\n\n');
    const m=mesaj(tx+'\n\n(Sitedeki sözlükten.)','eb-b');kaynaklar(m,sz);hist.push({role:'user',content:q},{role:'assistant',content:tx});
    chips(['"'+sz[0].t+'" kavramını bir örnekle açıkla']);sohbetKaydet();busy=false;return}}
  const cs=ara(q),m=mesaj('…','eb-b');
  try{
    if(!CFG.proxy||!CFG.ai)throw 0;
    const tt=await ttAl();
    const r=await fetch(CFG.proxy,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({tt,soru:q,gecmis:hist.slice(-6),baglam:ctx(),mod:MOD,alan:LABK,ogrenci:izinli()?analiz():null,
        kaynak:cs.map(c=>({t:c.t,x:c.x,u:c.u,c:c.c}))})});
    if(!r.ok)throw new Error(r.status);
    const j=await r.json();bi(m,j.cevap);oku(m);if(!j.hata)geri(m,q,j.cevap);webKaynak(m,j.web);
    if(!j.hata)hist.push({role:'user',content:q},{role:'assistant',content:j.cevap});
    if(j.hata){busy=false;return}
  }catch(e){
    /* API yoksa/hatalıysa: yalnızca GÜÇLÜ eşleşmeleri göster, zayıf (alakasız) sonuç dayatma */
    const gl=cs.filter(c=>c._s>=3);
    if((CFG.proxy&&CFG.ai)&&!gl.length){m.textContent='Şu an sunucuya ulaşamadım, biraz sonra tekrar dener misin?';busy=false;return}
    m.textContent=gl.length?((CFG.proxy&&CFG.ai)?'Sunucuya ulaşamadım; sitedeki en yakın içerikler:':'Sitedeki en yakın içerikler:')+'\n\n'+gl.slice(0,3).map(c=>`• ${c.t}: ${c.x.slice(0,180)}${c.x.length>180?'…':''}`).join('\n\n')
      :'Bu konuda sitede bilgi yok.';
    if(!gl.length){const on=oneriBul(q);if(on.length)m.textContent+='\n\nŞunu mu demek istedin?\n'+on.map(x=>'• '+x).join('\n')}
    if(!gl.length&&cevapsiz(q,'arama'))kayitNot(m);
  }
  const gc=cs.filter(c=>c._s>=3);kaynaklar(m,gc.slice(0,4));if(gc.length||kanunlar(q+' '+m.textContent).length)yonlendir(m,q+' '+m.textContent,gc);log.scrollTop=log.scrollHeight;busy=false;sohbetKaydet();
}
sohbetYukle();
const ilkAcilis=()=>{yukleHafif();setTimeout(yukleDB,60);if(!log.children.length){mesaj('Merhaba! Eko-Log\'u birlikte gezelim. Kavramları, laboratuvarları, hukuk ve aktör bilgilerini, sayfaları sorabilirsin.','eb-b');if(!PROFIL.bolum&&!ls(PATLA))profilSor();else chips()}};
/* Balona dokunulur dokunulmaz (tıklamadan önce) küçük dosyaları ısıt; büyük bilgi dosyası da arka planda başlasın */
['pointerenter','touchstart'].forEach(ev=>fab.addEventListener(ev,()=>{yukleHafif();setTimeout(yukleDB,300)},{once:true,passive:true}));
fab.onclick=()=>{delete fab.dataset.n;box.classList.toggle('on');if(box.classList.contains('on')){ilkAcilis();inp.focus()}};
if(CFG.tam){box.classList.add('on','tam');ilkAcilis()}   /* tam sayfa: hep açık, klavye kendiliğinden açılmasın diye odaklanmaz */
box.querySelector('#eb-an').onclick=()=>{const a=izinli();localStorage.setItem(IZIN,a?'0':'1');mesaj(a?'Çalışma analizi kapatıldı; artık özet gönderilmeyecek.':'Çalışma analizi açıldı.','eb-b')};
box.querySelector('header button:last-child').onclick=()=>box.classList.remove('on');
box.querySelector('form').onsubmit=e=>{e.preventDefault();const q=inp.value;inp.value='';sor(q)};
if(window.__EKO_TEST)window.__EKO_TEST={tl,nt,FZ,sss,sohbet,guvenlik,DERS,ara,yukle,yukleHafif,yukleDB,kisiselKomut,oneriBul,tarihBul,planKur,planYanit,tekrarBaslat,profilSor,profilCoz,ST,cevapsiz,kayitKuyruk:()=>ls(KAYIT_K)||[],get PROFIL(){return PROFIL},sor,get busy(){return busy},get DB(){return DB},get SINA(){return SINA},get PSOR(){return PSOR},LABAD,KAMPUS,alanBul,setMOD:m=>{MOD=m}};
})();
