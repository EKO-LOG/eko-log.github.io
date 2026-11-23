/* Eko-Log Asistanı · tek dosya, her sayfaya <script src="eko-bot.js" defer></script> ile eklenir.
   Ayar: sayfada window.EKO_BOT={proxy:'https://...workers.dev', bilgi:'eko-bot-bilgi.json'} tanımlanabilir.
   proxy boşsa bot "arama modu"nda çalışır (sözlük/lab içinde arar, API gerekmez). */
(()=>{
const ROOT=(()=>{try{return new URL('.',document.currentScript.src).href}catch(e){return ''}})();
if(window.__ekoBot)return;window.__ekoBot=1;
/* ===== TEK AYAR YERİ =====
   PROXY: Cloudflare Worker adresini buraya yaz (boşsa bot "arama modu"nda çalışır).
   YOL: bilgi tabanındaki sayfa adı → sitedeki gerçek yol. Bir bağlantı 404 verirse yalnızca burayı düzelt. */
const PROXY='';   /* Cloudflare kullanılmıyor: bot yalnızca sitedeki içeriklerde arama modunda çalışır */
const TURNSTILE='';   /* Cloudflare Turnstile site anahtarı (isteğe bağlı; worker'da TURNSTILE_SECRET ile eşleşmeli) */
const YOL={'iibf-':'eko-plus/','bvchiindex.html':'kalkinma/'};
/* ai:false → sohbet soruları hiçbir yapay zekâya gönderilmez; yalnızca sitedeki içerik eşleşmeleri gösterilir. Açmak için sayfada window.EKO_BOT={ai:true} ya da buradaki değeri true yap (Worker'daki YAPAY_ZEKA da true olmalı). */
const CFG=Object.assign({proxy:PROXY,turnstile:TURNSTILE,bilgi:'eko-bot-bilgi.json',ad:'Eko Asistan',ai:false},window.EKO_BOT||{});
const tl=s=>String(s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const tok=s=>tl(s).split(/[^a-z0-9]+/).filter(w=>w.length>2);
let DB=null,IDX=null,hist=[],busy=false,KANUN=[],KRX=[];
const UI_SAYFA=/iibf-uluslararasi/;
const LABK=(location.pathname.match(/iibf-(iktisat|ekonometri|isletme|ceko|kamu|maliye|uluslararasi)/)||[])[1]||'genel';
const HUKUKLU=['kamu','ceko','maliye'];
const LABAD={iktisat:'İktisat',ekonometri:'Ekonometri',isletme:'İşletme & Finans',ceko:'ÇEKO',kamu:'Kamu Yönetimi',maliye:'Maliye & Vergi',uluslararasi:'Uluslararası İlişkiler'};
const DERS_ACIK=false;   /* Ders anlatımı + 3 soruluk deneme: şimdilik KAPALI. Açmak için true yap (worker.js'deki DERS_ACIK'ı da). */
let MOD=DERS_ACIK&&LABK!=='genel'?'ders':'genel';
const HK=HUKUKLU.includes(LABK);
const MODLAR=Object.assign({genel:['💬','Genel']},DERS_ACIK?{ders:HK?['⚖️','Hukuk Dersi']:['🎓','Ders Anlat']}:{},{gundem:['🌍','Gündem (Uİ)']});
const TERCIH={genel:LABK!=='genel'?[LABAD[LABK]]:[],ders:HK?['Kamu Yönetimi','ÇEKO','Maliye & Vergi']:LABK==='genel'?[]:[LABAD[LABK]],gundem:['Uluslararası İlişkiler']};
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
 genel:['🧭 Bu sitede neler yapabilirim?','📊 Çalışmamı değerlendir',...SAYFA_CHIP],
 ders:DERSCHIP[LABK]||DERSCHIP.genel,
 gundem:['Son gelişmede kim ne dedi?','Neden oldu, kime yarar?','Kim etkilendi, kimi etkilemez?','Taraflar ne düşünüyor?','Bu nasıl biter, ne olabilir?','Değerlendirmen ne?']};

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
#eb-fab[data-n]::after{content:attr(data-n);position:absolute;top:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:#fff;color:var(--g1,#c4202e);font:800 14px/22px sans-serif}#eb-fab{position:fixed}#eb-mod{display:flex;gap:6px;padding:6px 12px 0;overflow-x:auto}#eb-mod button{font:inherit;font-size:12.5px;white-space:nowrap;padding:5px 11px;border-radius:999px;cursor:pointer;border:1px solid var(--line,#eee3e6);background:var(--surf,#fff);color:inherit}#eb-mod button.on{color:#fff;border-color:transparent;background:linear-gradient(120deg,var(--g1,#c4202e),var(--g2,#ff7a45))}.eb-w a{border-color:var(--g2,#ff7a45)!important}.eb-say{background:none;border:0;cursor:pointer;font-size:14px;opacity:.7;padding:4px 0}#eb small{padding:0 14px 8px;color:var(--mut,#6a5f76);font-size:11.5px}`;
document.head.appendChild(css);

const $=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const fab=$('button','',null);fab.id='eb-fab';fab.textContent='💬';fab.setAttribute('aria-label',CFG.ad+'ı aç');
const box=$('div');box.id='eb';box.setAttribute('role','dialog');box.setAttribute('aria-label',CFG.ad);
box.innerHTML=`<header><b>${CFG.ad}</b><button id="eb-an" style="font-size:12px;border:1px solid #fff8;border-radius:999px;padding:3px 10px" aria-label="Analiz izni">Analiz</button><button aria-label="Kapat">✕</button></header><div id="eb-log" aria-live="polite"></div><div id="eb-mod" role="tablist"></div><small>Yapay zekâ hata yapabilir. Hukuki konularda bilgilendirme amaçlıdır; resmî metin için kaynağa bakın. Sorular ve geri bildirimler iyileştirme için kaydedilebilir.</small><form><input placeholder="Bir kavram, simülasyon ya da sayfa sor…" autocomplete="off"><button>Gönder</button></form>`;
document.body.append(fab,box);
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

/* ---------- Yerel arama (BM25 benzeri, Türkçe normalizasyonlu) ---------- */
async function yukle(){
  if(DB)return;
  try{const J=await (await fetch(/^https?:/.test(CFG.bilgi)?CFG.bilgi:ROOT+CFG.bilgi)).json();DB=J.chunks;KANUN=J.kanunlar||[];kanunKur()}catch(e){DB=[]}
  const df={};IDX=DB.map(c=>{const t=tok(c.t+' '+c.t+' '+c.x),f={};t.forEach(w=>f[w]=(f[w]||0)+1);Object.keys(f).forEach(w=>df[w]=(df[w]||0)+1);return{f,n:t.length,tt:tl(c.t)}});
  IDX.df=df;
}
const STOP=new Set('nedir nelerdir kimdir midir mudur nasil neden niye hangi kac kim kimin nerede anlat anlatir misin misiniz acikla aciklar ver bana bize icin ile olan olarak bir var yok hakkinda konusunda ilgili gibi daha cok icinde simdi lutfen soyle goster ogret'.split(' '));
/*GUNDEM-BASLA: kural tabanlı gündem analizi (yapay zekâ yok). Haberler bilgi havuzunda k:'haber' kaydı olarak durur.*/
const GUNDEM=(()=>{
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tl=s=>String(s).toLocaleLowerCase('tr');
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const TUR={ajans:'ajans',resmi:'resmî açıklama',kurum:'kurum/düşünce kuruluşu',basin:'basın'};

/* Aktör sözlüğü: [haber metnindeki kök, gösterilecek ad]. Büyük harfle başlayan kökler ek almış hâlleriyle de eşleşir. */
const AKT=[...'Türkiye,Rusya,Ukrayna,Çin,İsrail,Filistin,Gazze,İran,Suriye,Irak,Yunanistan,Kıbrıs,Ermenistan,Azerbaycan,Almanya,Fransa,İngiltere,Japonya,Hindistan,Pakistan,Suudi Arabistan,Mısır,Tayvan,Kuzey Kore,Güney Kore,Venezuela,Brezilya,Kanada,Meksika,Afganistan,Libya,Yemen,Sudan,Etiyopya,Lübnan,Ürdün,Katar,Hamas,Hizbullah,Taliban'.split(',').map(x=>[x,x]),
 ['Amerika Birleşik Devletleri','ABD'],['Beyaz Saray','ABD'],['Washington','ABD'],['Moskova','Rusya'],['Kremlin','Rusya'],['Pekin','Çin'],['Avrupa Birliği','AB'],['Brüksel','AB'],['Birleşmiş Milletler','BM'],['Uluslararası Para Fonu','IMF'],['Dünya Bankası','Dünya Bankası'],['Birleşik Arap Emirlikleri','BAE']];
const KISA=['ABD','AB','BM','NATO','IMF','DTÖ','OPEC','G20','BRICS','OECD','AGİT'];
const AKTRX=[...AKT.map(([k,ad])=>({re:new RegExp('(?<![\\p{L}])'+esc(k),'gu'),ad})),...KISA.map(k=>({re:new RegExp('(?<![\\p{L}])'+k+'(?![\\p{L}])','gu'),ad:k}))];
const aktorlar=s=>{const m=new Map();AKTRX.forEach(({re,ad})=>{const n=(s.match(re)||[]).length;if(n)m.set(ad,(m.get(ad)||0)+n)});return m};

/* Tema sözlüğü (küçük harf kökler) */
const TEMA={
 g:['Güvenlik ve çatışma','saldırı,çatışma,ateşkes,füze,asker,savaş,işgal,operasyon,silah,bombardıman,drone,insansız hava,tatbikat,caydırıcı'],
 d:['Diplomasi ve müzakere','görüşme,müzakere,zirve,anlaşma,mutabakat,diplomat,arabulucu,toplantı,ziyaret,bildiri,barış'],
 e:['Ekonomi ve ticaret','gümrük,tarife,ticaret,ihracat,ithalat,faiz,enflasyon,büyüme,piyasa,yatırım,borç,bütçe'],
 y:['Yaptırımlar','yaptırım,ambargo,dondur,kara liste'],
 n:['Enerji','petrol,doğal gaz,enerji,boru hattı,lng,nükleer,elektrik'],
 i:['İnsani durum ve hukuk','sivil,insani,mülteci,göç,mahkeme,soykırım,savaş suçu,insan hakları,açlık,yerinden']};
const TEMARX=Object.fromEntries(Object.entries(TEMA).map(([k,[ad,s]])=>[k,new RegExp('(?<![\\p{L}])(?:'+s.split(',').map(esc).join('|')+')','gu')]));

/* Kuram × tema bankası: her kuramın genel merceği + temaya özgü soru */
const KURAM={
 realizm:{ad:'Realizm',gen:'Realist okuma devletleri güç ve güvenlik hesabı yapan temel aktörler sayar.',t:{
  g:'Güç dengesi ve güvenlik ikilemi: bir tarafın önlemi diğerinin tehdit algısını artırıyor mu?',
  d:'Müzakere masası da güç ilişkisini yansıtır: pazarlık gücü kimde, masaya oturmak kimin göreli kazancına hizmet ediyor?',
  e:'Ticaret ve gümrük bir güç aracı olarak okunur: ekonomik bağımlılık kimin elinde stratejik koz?',
  y:'Yaptırım zorlayıcı bir güç aracıdır: hedefin maliyet hesabını değiştirebiliyor mu, delme yolları var mı?',
  n:'Enerji arzı ve geçiş yolları stratejik güçtür: tedarik üzerinde kaldıraç kimde?',
  i:'İnsani ve hukuki gerekçeler devlet çıkarlarıyla birlikte nasıl kullanılıyor; uygulama gücü kimde?'}},
 liberalizm:{ad:'Liberalizm',gen:'Liberal okuma karşılıklı bağımlılığa, kurumlara ve iş birliğinin ortak kazancına bakar.',t:{
  g:'Kurumsal kanallar (BM, ittifaklar) ve güven artırıcı önlemler tırmanmayı sınırlayabilir mi?',
  d:'Kurallar ve tekrarlanan görüşmeler iş birliğinin maliyetini düşürüyor mu?',
  e:'Karşılıklı ekonomik bağımlılık çatışmanın maliyetini yükselterek tırmanmayı frenler mi?',
  y:'Yaptırımlar çok taraflı kurum ve normlarla mı uygulanıyor; ticaret ağlarına yan etkisi ne?',
  n:'Enerjide karşılıklı bağımlılık ve ortak kurallar iş birliği imkânı doğuruyor mu?',
  i:'Mahkemeler ve BM organları gibi kurumlar davranışı kuralla bağlayabiliyor mu?'}},
 insacilik:{ad:'İnşacılık',gen:'İnşacı okuma çıkarları kimlik, norm ve söylemle birlikte ele alır.',t:{
  g:'Tehdit nesnel mi, yoksa "düşman" ve "güvenlik" söylemiyle mi inşa ediliyor?',
  d:'Taraflar birbirini nasıl tanımlıyor (ortak, rakip, düşman) ve bu söylem müzakere imkânını nasıl şekillendiriyor?',
  e:'Ekonomik ilişkiler hangi kimlik ve adalet söylemleriyle çerçeveleniyor?',
  y:'Yaptırım hangi normatif söylemle meşrulaştırılıyor, hedef taraf bunu nasıl karşılıyor?',
  n:'Enerji "güvenlik" meselesi olarak nasıl çerçeveleniyor, bu çerçeve seçenekleri nasıl daraltıyor?',
  i:'Hangi normlar (sivillerin korunması vb.) hatırlatılıyor, aktörler bağlılıklarını söylemle nasıl gösteriyor?'}},
 'eleştirel':{ad:'Eleştirel/yapısal',gen:'Yapısal okuma merkez–çevre ilişkilerini ve eşitsiz yapıları sorgular.',t:{
  g:'Bu güvenlik gerilimden hangi güçlü aktörler yarar sağlıyor, maliyeti kim taşıyor?',
  d:'Masada temsil eşit mi; kimin sesi dışarıda kalıyor?',
  e:'Ticaret düzeni merkez ile çevre arasındaki eşitsizliği nasıl yeniden üretiyor?',
  y:'Yaptırımın maliyetini hedef devlet mi, sivil toplum mu daha çok taşıyor?',
  n:'Kaynak ve geçiş yolları üzerindeki kontrol hangi yapısal avantajı sürdürüyor?',
  i:'Mağduriyet ve sorumluluk dağılımı yapısal eşitsizliklerle nasıl bağlantılı?'}}};
const SENARYO={
 g:['Gerilimin düşmesi: taraflar bir arabulucu kanalı kabul ederse','Gerilimin sürmesi: karşılıklı caydırıcılık adımları artarsa','Kapsamın genişlemesi: üçüncü aktörler doğrudan devreye girerse'],
 d:['Takvimli müzakere: taraflar somut görüşme tarihi açıklarsa','Sonuçsuz görüşme: temel talepler uzlaşmazsa','Üst düzey zirve: hazırlık görüşmeleri ilerlerse'],
 e:['Pazarlıkla gevşeme: taraflar tarife veya kota için görüşürse','Karşılıklı önlemler: karşı taraf eşdeğer adım atarsa','Kurumsal başvuru: ikili çözüm tıkanırsa uluslararası ticaret kurallarına gidilebilir'],
 y:['Yaptırımın sürmesi: hedef taraf politikasını değiştirmezse','Gevşetme: taraflar bir uzlaşıya varırsa','Delme yolları: üçüncü ülkeler üzerinden ticaret yeniden yönlenirse'],
 n:['Tedarik çeşitlendirmesi: alıcılar kaynaklarını çeşitlendirirse','Fiyat dalgalanması: arz yolları kesintiye uğrarsa','Enerji anlaşması: taraflar uzun vadeli sözleşme yaparsa'],
 i:['Hukuki süreç: ilgili mahkeme veya kurum süreci ilerletirse','İnsani erişim: yardım koridorları açılırsa','Normatif baskı: kurumlar ve kamuoyu açıklama yaparsa']};
const DUZEYK={birey:['Birey düzeyi: karar vericilerin algı ve tercihleri','başkan,cumhurbaşkanı,lider,bakan,başbakan,kral,prens'],
 devlet:['Devlet düzeyi: iç politika, kurumlar ve ulusal çıkar','hükümet,parlamento,meclis,seçim,iç politika,ordu,bakanlığı'],
 sistem:['Sistem düzeyi: güç dağılımı ve uluslararası yapı','nato,bm ,ab ,ittifak,küresel,uluslararası,çok kutuplu,dünya']};

/* Cümle sınıflandırma */
const IDDIA=/iddia|öne sür|ileri sür|kulis|doğrulanma|teyit edilme|sözde|söylenti|ismi açıklanmayan|adı verilmeyen/;
const YORUM=/muhtemel|bekleniyor|tahmin|öngör|olabilir|olacağı düşünül|analist|yorumcu|değerlendiriliyor|gerekir|gerektiğ/;
const BEYAN=/açıkla|dedi|belirt|bildir|ifade et|vurgula|duyur|kaydet|savun|reddet|uyar|çağrı yap|['’][a-zçğıöşü]*\s+göre|[“"«]/;
const HUKUKI=/soykırım|savaş suçu|insanlığa karşı suç|adalet divanı|ceza mahkemesi|güvenlik konseyi/;
const HASSAS=/filistin|gazze|israil|hamas|batı şeria|doğu türkistan|uygur|sincan|xinjiang/;
const NUMRX=/\d[\d.,]*\s?(?:milyar|milyon|bin|yüzde|%|dolar|avro|lira|tl|kişi|asker|sivil|ölü|yaralı|gün|saat|kilometre|ton|varil)?/giu;
const cumleler=m=>String(m).replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+(?=[A-ZÇĞİÖŞÜ0-9"“‘'])/u).map(s=>s.trim()).filter(s=>s.length>25);
const kisalt=(s,n=260)=>s.length>n?s.slice(0,n).replace(/\s\S*$/,'')+'…':s;

const UZLASI=/görüşme|müzakere|uzlaş|anlaşma|mutabakat|barış|diyalog|iş birliği|işbirliği|arabulucu|ateşkes|kabul etti|olumlu|destekle|inceled/;
const SERT=/saldır|tehdit|uyar|reddet|yaptırım|tırman|karşılık ver|misilleme|hedef al|ültimatom|çatışma|işgal|engelle|kınad/;
const SY={g:'uss',d:'usu',e:'usn',y:'sun',n:'nsu',i:'nun'};   // senaryoların yönü: u=uzlaşı, s=gerilim, n=nötr
const IZLE={g:['Ateşkes ya da arabulucu kanalına dair açıklama','Yeni askeri hareket veya bölge dışı bir aktörün açıklaması'],d:['Somut görüşme tarihi ve gündemi','Heyet düzeyinin yükselmesi'],e:['Karşı tarife/kota açıklaması','İkili görüşme ya da kurumsal başvuru'],y:['Yaptırım listesinin genişlemesi veya gevşemesi','Üçüncü ülkelerin tutumu'],n:['Tedarik rotası ve fiyat açıklamaları','Yeni sözleşme duyurusu'],i:['Mahkeme/kurum kararı veya raporu','Yardım erişimi ve koridor açıklamaları']};
const NEDENRX=/nedeniyle|nedenle|dolayı|yüzünden|çünkü|yanıt olarak|karşılık olarak|bunun üzerine|gerekçesiyle|amacıyla|hedefiyle|sebebiyle|kaynaklan|tepki olarak|nedeni|yol açtı/;
const YARARRX=/kazandı|kazanç|yarar|fayda|kâr|avantaj|lehine|destek aldı|güçlendi|memnun|olumlu|başarı|artış sağla|pay(ını)? artır/;
const NOETKI=/etkilemeyeceğ|etkilenmeyeceğ|etkilemez|etkilenmez|etkilenmedi|etkilemiyor|etkisi olmayacağ|sorun yaşamayacağ/;
const ETKIRX=/etkilen|zarar|mağdur|kayıp|kaybetti|yerinden|tahliye|düştü|geriledi|arttı|yükseldi|maliyet|olumsuz|yaralı|açlık|kıtlık|mülteci|işsiz|pahalı|fiyat/;
const GRUP=['sivil','mülteci','çiftçi','işçi','tüketici','ihracatçı','ithalatçı','üretici','yatırımcı','öğrenci','kadın','çocuk','esnaf','şirket','banka','halk','hane','piyasa','sanayi','tedarikçi'];
const NEDEN={g:['tehdit algısı ve caydırıcılık hesabı','iç siyasi baskı ve liderlik hesapları','önceki bir olaya karşılık zinciri'],d:['ortak bir sorunun maliyetinin artması','dış baskı veya arabulucu girişimi','tarafların sürmekte olan gerilimden kaçınma isteği'],e:['yerli üreticiyi koruma ve ticaret dengesi hedefi','iç siyasi talep (sektör, seçmen)','karşı tarafın önceki bir ticaret adımı'],y:['davranışı değiştirmeye zorlama amacı','müttefiklere ve iç kamuoyuna mesaj verme','önceki bir ihlal ya da hukuki gerekçe'],n:['arz güvenliği ve fiyat kaygısı','tedarik bağımlılığını azaltma isteği','jeopolitik gerilimin enerji rotalarına yansıması'],i:['sivillerin korunması ve hukuki yükümlülükler','kitlesel yerinden edilme veya kıtlık','kurum ve kamuoyu baskısı']};
const YARAR={g:'caydırıcılığı veya pazarlık gücü artan taraf ile savunma sanayii kazanabilir.',d:'gerilimi ve belirsizliği azaltan taraflar ile piyasalar kazanabilir.',e:'korunan yerli üretici ve gelir elde eden devlet kazanabilir.',y:'zorlama gücünü gösteren taraf kazanabilir.',n:'tedarikçiler ve alternatif kaynak sunanlar kazanabilir.',i:'süreç ilerlerse mağdurlar ve hukuki mekanizmaların meşruiyeti kazanabilir.'};
const ZARAR={g:'çatışma bölgesindeki siviller, bölge ekonomisi ve ticaret yolları etkilenir.',d:'görüşmeler sonuçsuz kalırsa güveni zedelenen taraflar ve masada temsil edilmeyenler etkilenir.',e:'ithal girdi kullanan sanayi, tüketici (fiyat) ve karşılık riski taşıyan ihracatçı etkilenebilir.',y:'hedef ekonomi, sivil nüfus ve yaptırımı delen üçüncü ülke şirketleri etkilenebilir.',n:'ithalatçı ülkeler, sanayi ve hane halkı (fiyat) etkilenebilir.',i:'süreç tıkanırsa sivil nüfus ve insani erişim etkilenir.'};
function metin(hb,sec,odak){
  odak=odak||[];const F=k=>!odak.length||odak.includes(k);
  const S=[],gor=new Set();
  hb.forEach((h,i)=>cumleler(h.metin).forEach(s=>{const key=tl(s).replace(/[^\p{L}\d]/gu,'');if(gor.has(key))return;gor.add(key);S.push({s,t:tl(s),k:i+1,ak:aktorlar(s)})}));
  if(!S.length)return'Haber metni analiz için çok kısa.';
  const b={olgu:[],beyan:[],iddia:[],yorum:[]};
  S.forEach(c=>{if(IDDIA.test(c.t))b.iddia.push(c);else if(YORUM.test(c.t))b.yorum.push(c);else if(BEYAN.test(c.t))b.beyan.push(c);else if(c.ak.size||/\d/.test(c.s))b.olgu.push(c)});
  const tt=tl(hb.map(h=>h.metin).join(' ')),tem=Object.keys(TEMA).map(k=>[k,(tt.match(TEMARX[k])||[]).length]).filter(x=>x[1]>0).sort((x,y)=>y[1]-x[1]).slice(0,3).map(x=>x[0]);
  const say=new Map();S.forEach(c=>c.ak.forEach((n,ad)=>{const o=say.get(ad)||{n:0,k:new Set()};o.n+=n;o.k.add(c.k);say.set(ad,o)}));
  const top=[...say.entries()].sort((x,y)=>y[1].n-x[1].n).slice(0,4),adlar=top.map(x=>x[0]);
  const uz=S.filter(c=>UZLASI.test(c.t)),se=S.filter(c=>SERT.test(c.t)),yon=uz.length>se.length?'u':se.length>uz.length?'s':'';
  const L=[`📰 ${hb.length} haber, ${S.length} cümle işlendi.`];
  const liste=(bas,a,n)=>{if(a.length)L.push('\n**'+bas+'**',...a.slice(0,n).map(c=>'• '+kisalt(c.s,210)+' ['+c.k+']'))};
  if(!odak.length)L.push('🏷 '+(tem.length?tem.map(k=>TEMA[k][0]).join(', '):'belirgin tema bulunamadı (genel çerçeve kullanıldı)'));
  if(b.olgu.length)liste('Ne oldu?',b.olgu,odak.length?2:4);else liste('Ne oldu? (haberin ilk cümleleri)',S.slice(0,2),2);
  const nd=S.filter(c=>NEDENRX.test(c.t)),yr=S.filter(c=>YARARRX.test(c.t)),et=S.filter(c=>ETKIRX.test(c.t)&&!NOETKI.test(c.t)),no=S.filter(c=>NOETKI.test(c.t)),t0=tem[0];
  const al=c=>'• '+kisalt(c.s,210)+' ['+c.k+']';
  if(F('neden')){L.push('\n**Neden oldu?**');
    L.push(...(nd.length?nd.slice(0,3).map(al):['• Haber nedeni açıkça belirtmiyor; nedeni tahmin etmem.']));
    if(t0)L.push('Bakılacak olası nedenler (soru olarak; haberde yazmıyorsa iddia sayılmaz): '+NEDEN[t0].join('; ')+'.')}
  if(F('yarar')){L.push('\n**Kime yarar?**');
    L.push(...(yr.length?yr.slice(0,3).map(al):['• Haber kimin kazandığını açıkça yazmıyor.']));
    if(t0)L.push('Genel mekanizma ('+TEMA[t0][0]+' teması; bu habere özgü kanıt değil): '+YARAR[t0])}
  if(F('etki')){L.push('\n**Kim etkilendi, kimi etkilemez?**');
    L.push(...(et.length?et.slice(0,3).map(al):['• Haber etkilenenleri açıkça yazmıyor.']));
    const gr=[...new Set(et.flatMap(c=>GRUP.filter(g=>c.t.includes(g))))];if(gr.length)L.push('Metinde etkisi anılan gruplar: '+gr.join(', ')+'.');
    if(t0)L.push('Genel mekanizma (bu habere özgü kanıt değil): '+ZARAR[t0]);
    if(no.length)L.push('Haberde "etkilenmeyeceği" söylenenler:',...no.slice(0,2).map(al));
    const nt=adlar.filter(a=>![...yr,...et].some(c=>c.ak.has(a)));
    if(nt.length)L.push('Metinde etkisi veya kazancı belirtilmeyen aktörler: '+nt.join(', ')+'. (Etkilenmediklerini değil, haberin bunu söylemediğini gösterir.)')}
  if(F('dedi')&&b.beyan.length)L.push('\n**Kim ne dedi?**',...b.beyan.slice(0,5).map(c=>'• '+(c.ak.size?[...c.ak.keys()].slice(0,2).join('/')+': ':'')+kisalt(c.s,200)+' ['+c.k+']'));
  if(F('dusunuyor')&&top.length){
    L.push('\n**Kim ne düşünüyor?** (metindeki dilden çıkarım; aktörün kendi beyanı değildir)');
    top.forEach(([ad])=>{const m=S.filter(c=>c.ak.has(ad)),u=m.filter(c=>UZLASI.test(c.t)),z=m.filter(c=>SERT.test(c.t));
      const et=u.length>z.length?'uzlaşmaya açık işaretler veriyor':z.length>u.length?'baskı/gerilim yönünde işaret veriyor':(u.length?'karışık sinyal veriyor':'metinde tutum işareti yok');
      const ks=(u.length>z.length?u:z.length>u.length?z:[])[0];L.push('• '+ad+': '+et+(ks?' — "'+kisalt(ks.s,110)+'" ['+ks.k+']':''))})}
  if(F('iddia')&&!odak.length){liste('Henüz doğrulanmamış iddialar',b.iddia,2);liste('Beklenti ve yorumlar (olgu sayılmaz)',b.yorum,2)}
  if(!odak.length){const rk=[];S.forEach(c=>{for(const m of c.s.matchAll(NUMRX)){const v=m[0].trim();if(/^(19|20)\d\d$/.test(v)||!/\d/.test(v))continue;rk.push(v)}});
    if(rk.length)L.push('\n**Rakamlar** (haberde geçtiği hâliyle, teyit edilmedi): '+[...new Set(rk)].slice(0,5).join(', '));
    const hk=S.filter(c=>HUKUKI.test(c.t));if(hk.length)L.push('\n**Hukuki nitelendirme içeren cümleler**',...hk.slice(0,2).map(c=>'• '+kisalt(c.s,210)+' ['+c.k+']'),'Nitelendirmeyi yapan organı, tarihi ve kesinlik düzeyini kaynaktan kontrol et.')}
  if(HASSAS.test(tt))L.push('\n⚠️ Hassas konu: sorumluluğu devlet/yönetim ve eylemiyle ilişkilendir, halkı veya dini hedef alan genelleme yapma; kaynağı belirsiz görüntü ve sayıları işaretle.');
  if(F('kuram')){const tm=tem.slice(0,2);L.push('\n**Kuramsal okuma**',...sec.map(k=>{const K=KURAM[k];return '• '+K.ad+': '+K.gen+(adlar.length?' ('+adlar.join(', ')+' için) ':' ')+tm.map(t=>K.t[t]).join(' ')}))}
  if(F('olabilir')&&tem[0]){
    const t0=tem[0],sc=SENARYO[t0].map((x,i)=>({x,y:SY[t0][i],i}));
    if(yon)sc.sort((p,q)=>(q.y===yon)-(p.y===yon)||p.i-q.i);
    L.push('\n**Ne olabilir, nasıl biter?** (kesin tahmin değil; olasılık atanmadı)',...sc.map((p,i)=>'• '+p.x+(yon&&i===0&&p.y===yon?'  ← metindeki işaretlere en yakını':'')),'İzlenecek göstergeler: '+IZLE[t0].join('; ')+'.')}
  if(F('degerlendirme')){
    const lead=yon==='u'?uz:yon==='s'?se:[];
    L.push('\n**Değerlendirme (haberler okunduktan sonra)**');
    L.push(!uz.length&&!se.length?'• Metinde yön gösteren belirgin bir işaret yok; sonuç için daha fazla haber gerekir.':'• Metinde '+uz.length+' cümle uzlaşı/diplomasi, '+se.length+' cümle gerilim/baskı işareti taşıyor; '+(yon==='u'?'ağırlık diplomasiden yana.':yon==='s'?'ağırlık gerilimden yana.':'denge belirsiz.'));
    if(lead[0])L.push('• En belirgin işaret: "'+kisalt(lead[0].s,140)+'" ['+lead[0].k+']');
    L.push('• Belirsizlik: '+b.iddia.length+' iddia ve '+b.yorum.length+' yorum cümlesi olgu sayılmadı. '+(hb.length>1?'':'Tek haber olduğundan sonuç temkinli okunmalı. ')+'Bu, siyasi bir tercih değil, metindeki dilin okumasıdır.')}
  const A=KURAM[sec[0]].ad,B=KURAM[sec[1]||sec[0]].ad;
  if(!odak.length)L.push('\n**Tartışma sorusu:** '+A+' ve '+B+' okumaları bu gelişmede hangi noktada ayrışıyor'+(adlar.length>1?' ('+adlar.slice(0,2).join(' ve ')+' bakımından)':'')+' ve haberdeki hangi olgu bu ayrışmayı gösteriyor?');
  const tur=new Set(hb.map(h=>h.tur));
  L.push('\n**Doğrulama notu:** '+hb.length+' haber, '+tur.size+' kaynak türü. '+(hb.length>1&&tur.size>1?'Farklı türde kaynaklar var.':'Tek haber ya da tek tür kaynak: çapraz teyit önerilir.')+' Olgular yalnızca havuzdaki metne dayanır, bağımsız teyit edilmemiştir.');
  L.push('**Kaynaklar:** '+hb.map((h,i)=>'['+(i+1)+'] '+h.ad+(h.tarih?' ('+h.tarih+')':'')).join('; '));
  return L.join('\n');
}
return{metin};
})();

function gundemCevap(q){
  const H=DB.filter(c=>c.k==='haber').sort((a,b)=>String(b.d||'').localeCompare(String(a.d||'')));
  if(!H.length)return'Bilgi havuzunda henüz haber yok. Haberler bilgi dosyasına eklenince burada analiz ederim.';
  const GEN='kimi kime neden niye sebep nicin yarar fayda kazanc etkile zarar kayip magdur kim nasil olabilir biter olur dedi dusun tutum sonuc senaryo gelecek yaklasim beyan taraflar sence hafta bugun son gelisme ozet gundem guncel onemli haber analiz yorumla degerlendir realist realizm liberal liberalizm insaci insacilik elestirel yapisal gozle kuram karsilastir kriz'.split(' ');
  const terms=tok(q).filter(w=>!STOP.has(w)&&!GEN.some(g=>g.length>=4?w.startsWith(g):w===g)),qq=tl(q),sec=[];
  [['realizm',/realist|realizm/],['liberalizm',/liberal/],['insacilik',/insaci/],['eleştirel',/elestirel|yapisal/]].forEach(([k,r])=>{if(r.test(qq))sec.push(k)});
  const od=[];
  if(/sence|ne dusunuyorsun|degerlendirmen|degerlendirme|sonuc|sen ne/.test(qq))od.push('degerlendirme');
  if(/ne olur|ne olabilir|ne biter|nasil biter|nasil sonuc|senaryo|gelecek|sonra ne|ne olacak/.test(qq))od.push('olabilir');
  if(/neden|niye|sebep|nicin|neyden/.test(qq))od.push('neden');
  if(/kime yar|kim kazan|kazanc|fayda|kime yariyor/.test(qq))od.push('yarar');
  if(/etkilen|etkilemez|etkilemiyor|zarar|kaybed|magdur|kime yansi/.test(qq))od.push('etki');
  if(/ne dedi|kim ne|beyan|aciklama(lar)? yapti/.test(qq))od.push('dedi');
  if(/ne dusunuyor|tutum|yaklasim|pozisyon|tavir|taraflar/.test(qq))od.push('dusunuyor');
  if(/kuram|realist|realizm|liberal|insaci|elestirel|yapisal/.test(qq)&&!od.length)od.push('kuram');
  let secim=H.slice(0,3);
  if(terms.length){const sk=H.map(c=>{const W=tok(c.t+' '+c.x);return[terms.filter(w=>W.some(x=>x.startsWith(w))).length,c]}).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);
    if(!sk.length)return'Havuzdaki haberlerde "'+terms.join(' ')+'" ile ilgili bir şey bulamadım. En son eklenen haber: '+H[0].t+(H[0].d?' ('+H[0].d+')':'')+'. Onu analiz etmemi istersen "son haberi analiz et" yaz.';
    secim=sk.slice(0,3).map(x=>x[1])}
  if(secim.some(c=>!c.c))return'Bazı haberlerin kaynak adı eksik; kaynaksız haber analiz edilmez. Bilgi dosyasında kaynak adını tamamla.';
  const hb=secim.map(c=>({metin:c.x,ad:c.c,tur:c.s||'basin',url:/^https?:/.test(c.u)?c.u:'',tarih:c.d||'',baslik:c.t}));
  return{t:GUNDEM.metin(hb,sec.length?sec:['realizm','liberalizm'],od)+((()=>{const d=hb.map(x=>Date.parse(x.tarih)).filter(Boolean);if(!d.length)return'';const g=Math.floor((Date.now()-Math.max(...d))/864e5);return g>30?'\n\n⏳ Dikkat: en yeni ilgili haber '+g+' gün önceye ait; durum bu sürede değişmiş olabilir, güncel kaynaktan doğrula.':''})())+'\n\n🗓 '+new Date().toLocaleDateString('tr-TR')+' · Öğrenme amaçlı analizdir; Eko-Log Topluluğu\'nun veya üniversitenin resmî görüşünü yansıtmaz.',web:hb.filter(x=>x.url).map(x=>({baslik:x.ad,url:x.url}))};
}
/*GUNDEM-BITIS*/
function ara(q,k=6){
  const qs=tok(q).filter(w=>!STOP.has(w)),N=DB.length,r=[],qc=qs.join(' ');
  if(!qs.length)return[];
  DB.forEach((c,i)=>{if(c.k==='haber')return;const d=IDX[i];let s=0;
    qs.forEach(w=>{const f=d.f[w];if(f)s+=Math.log(1+N/(IDX.df[w]||1))*f/(f+1.2)});
    if(d.tt===qc)s+=20;else if(qs.every(w=>d.tt.includes(w)))s+=10;else if(qs.some(w=>d.tt.includes(w)))s+=1.5;
    if(s>0)r.push([s*((TERCIH[MOD]||[]).includes(c.c)?1.6:1),c])});
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
    ln.split(/(\*\*[^*]+\*\*)/).forEach(p=>{if(!p)return;if(/^\*\*[^*]+\*\*$/.test(p)){const s=document.createElement('strong');s.textContent=p.slice(2,-2);m.appendChild(s)}else m.appendChild(document.createTextNode(p))});
    if(i<a.length-1)m.appendChild(document.createTextNode('\n'))})}
const gm=m=>Array.from(m.childNodes).filter(n=>n.nodeType===3||n.nodeName==='STRONG').map(n=>n.textContent).join('');
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
  if(sessiz)return;hist=[];mesaj(k==='ders'?(HK?'Hukuk dersi modundayım. Bir konuyu "anlat" de; kavram → kanun → örnek → sık hata → mini sınama sırasıyla işleriz.':'Ders modundayım. Bir konuyu "anlat" de; sezgi → kavram → örnek → sık hata → mini sınama sırasıyla işleriz.')+' "Beni sına" dersen 3 soruluk zor deneme yaparız.':k==='gundem'?'Gündem modundayım. Bilgi havuzuna eklenen haberleri okuyup olgu, beyan ve iddiaları ayırır, kuramlarla (realizm, liberalizm, inşacılık…) değerlendiririm. Örnek: "son gelişmeleri realist ve liberal gözle yorumla" ya da bir ülkeyi/konuyu yaz. Havuzda olmayan bir gelişmeyi bilemem.':'Genel moddayım. Sitedeki kavramları, laboratuvarları ve sayfaları sorabilir, "Çalışmamı değerlendir" diyerek laboratuvar/quiz hatalarının analizini isteyebilirsin.','eb-b');
  if(MODCHIP[k])chips(MODCHIP[k])}
function chips(liste){const w=$('div','eb-chips');
  (liste||MODCHIP.genel).forEach(q=>{const b=$('button','',q);b.onclick=()=>{w.remove();if(q.startsWith('📝')){denemeBaslat();return}if(q.startsWith('📊')){sor('Bu oturumdaki çalışmamı değerlendir: nerede hata yapıyorum, neyi anlamamış olabilirim, ne çalışmalıyım?')}else sor(q)};w.appendChild(b)});log.appendChild(w)}

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
 +'\n\nBen de bir kavramı açıklayabilir, seni doğru sayfaya götürebilir, laboratuvar/quizlerdeki cevaplarını değerlendirebilir (📊 Çalışmamı değerlendir) ve Gündem sekmesinde güncel uluslararası gelişmeleri kuramlarla yorumlayabilirim.';
const DEGER=/(degerlendir|analiz).*(calisma|cevap|hata|yanlis|performans|quiz|lab|sonuc)|(calisma|cevap|hata|yanlis|performans|sonuc)\w*.*(degerlendir|analiz)/;
const YETENEK={
 ders:HK?'Hukuk derslerini konu konu anlatabilir, "3 soruluk zor deneme" ile seni sınayabilir, kanun maddelerine bağlantı verebilirim.':'Bu laboratuvardaki konuları anlatabilir, "3 soruluk zor deneme" ile seni sınayabilir, hatalarını analiz edebilirim.',
 gundem:'Bilgi havuzundaki haberleri kuramsal çerçevelerle değerlendirebilirim.',
 genel:'Sitedeki kavramları, düşünürleri, simülasyonları, laboratuvarları ve mevzuatı sorabilirsin; seni ilgili sayfaya götürür, quiz/lab cevaplarını değerlendirebilirim.'};
function sohbet(q){const t=tl(q).replace(/[^a-z0-9\s?]/g,' ').replace(/\s+/g,' ').trim();if(!t||t.length>60)return null;
  const siteSor=/(ne yapabilirim|neler yapabilirim|ne yapilir|neler var|ne var|nelere bakabilirim|siteyi (anlat|tanit|gezdir)|site(de|nin)? .*(ne|neler|nedir|anlat|tanit)|burada .*(ne|neler)|(bu|bu site) .*(ne ise yarar|ne sitesi))/.test(t)&&/(site|burada|yapabilirim|neler var|ne var)/.test(t)&&!/(sozluk|ansiklopedi|simulasyon|lab|mevzuat) .*(nerede|nasil)/.test(t);
  if(siteSor&&t.length<=60)return{t:(SELAM.test(t)?'Merhaba! 👋 ':'')+SITE_NOT,tur:1,chips:1};
  const rest=t.replace(SELAM,'').replace(/\b(nasilsin|naber|ne haber|nasil gidiyor|canim|hocam|arkadas|bot|asistan)\b/g,'').replace(/[?\s]+/g,' ').trim();
  const selam=SELAM.test(t);
  if(selam&&rest.length<3)return{t:'Merhaba! 👋 Ben Eko-Log asistanıyım. '+YETENEK[MOD]+'\n\nSiteyi kısaca anlatmamı istersen "Bu sitede neler yapabilirim?" diye sor; ya da aklındaki soruyu doğrudan yazabilirsin.',chips:1};
  if(/^(nasilsin|naber|ne haber|nasil gidiyor)( ?\??)$/.test(t))return{t:'İyiyim, teşekkürler! Sen nasılsın? Çalışmak ya da öğrenmek istediğin bir konu var mı?'};
  if(/^(tesekkur|tesekkurler|tesekkur ederim|sagol|sag ol|eyvallah|saol|cok sagol|eline saglik)( .*)?$/.test(t))return{t:'Rica ederim! 🙂 Başka bir şey sorarsan buradayım.'};
  if(/^(kimsin|sen kimsin|nesin|ne yapiyorsun|ne yaparsin|neler yapabilirsin|ne ise yararsin|yardim|yardim et|yardim eder misin|nasil kullanilir|bu ne)( ?\??)$/.test(t))return{t:'Ben Eko-Log asistanıyım, yapay zekâ ile çalışıyorum. '+YETENEK[MOD]+' Alttaki sekmelerden Genel ve Gündem modları arasında geçebilirsin.',chips:1};
  if(/^(gorusuruz|hoscakal|hosca kal|bye|iyi calismalar|kolay gelsin|iyi gunler|iyi aksamlar|iyi geceler)( ?\??)$/.test(t))return{t:'Görüşürüz, kolay gelsin! 👋'};
  return null}
async function sor(q){
  if(busy||!q.trim())return;
  const sh=sohbet(q);
  if(sh){mesaj(q,'eb-u');const mm=mesaj(sh.t+(DEN?' (Denemede konu/cevabını bekliyorum; çıkmak için "iptal" yaz.)':''),'eb-b');
    if(sh.tur){const w=$('div','eb-src');SITE_TUR.filter(x=>x[2]).forEach(x=>{const a=$('a');a.href=hrefOf(x[2]);a.textContent=x[0].split(' · ')[0].slice(0,32);w.appendChild(a)});mm.appendChild(w)}
    if(sh.chips&&!DEN)chips(MODCHIP[MOD]);log.scrollTop=log.scrollHeight;return}
  if(DEN){if(/^(çık|iptal|bitir)$/i.test(q.trim())){mesaj(q,'eb-u');DEN=null;mesaj('Deneme sonlandırıldı.','eb-b');return}return denemeAdim(q)}
  if(MOD==='ders'&&/(beni\s+sına|bana\s+(soru|deneme)|3\s*soru|deneme\s*(sınav|yap|başlat|çöz)|sınav\s*yap|test\s*et)/i.test(q)){mesaj(q,'eb-u');return denemeBaslat()}
  if(DEGER.test(tl(q))){
    const aktif=OL.filter(o=>['yanlis','dogru','yardim','sifirla','ayar','kontrol'].includes(o.tur));
    if(!aktif.length){mesaj(q,'eb-u');const m0=mesaj('Bu oturumda henüz değerlendirebileceğim bir çalışma görmedim. İİBF Laboratuvarı\'nda bir quiz çöz ya da laboratuvarı kullan; ardından "Çalışmamı değerlendir" de, hata örüntülerini birlikte inceleyelim.','eb-b');
      const w=$('div','eb-src'),a=$('a');a.href=hrefOf('eko-plus/iibf-laboratuvar.html');a.textContent='🧪 İİBF Laboratuvarı';w.appendChild(a);m0.appendChild(w);return}
    if(!izinIste())return}
  busy=true;mesaj(q,'eb-u');await yukle();
  if(MOD!=='gundem'){const sz=sozlukCevap(q);if(sz.length){
    const tx=sz.map(c=>`📖 ${c.t}${c.c?' ('+c.c+')':''}\n${c.x.slice(0,700)}${c.x.length>700?'…':''}`).join('\n\n');
    const m=mesaj(tx+'\n\n(Sitedeki sözlükten.)','eb-b');kaynaklar(m,sz);hist.push({role:'user',content:q},{role:'assistant',content:tx});
    chips(['"'+sz[0].t+'" kavramını bir örnekle açıkla']);sohbetKaydet();busy=false;return}}
  if(/gündem|son gelişme|bugün|güncel|haber/i.test(q)&&UI_SAYFA.test(location.pathname)&&MOD!=='gundem')modSec('gundem',true);
  if(MOD==='gundem'){const r=gundemCevap(q),tx=typeof r==='string'?r:r.t,m=mesaj(tx,'eb-b');if(r.web)webKaynak(m,r.web);hist.push({role:'user',content:q},{role:'assistant',content:tx});log.scrollTop=log.scrollHeight;busy=false;sohbetKaydet();return}
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
    if(MOD==='gundem'&&!j.hata){const n=$('small','',`🗓 ${new Date().toLocaleDateString('tr-TR')} · Öğrenme amaçlı analizdir; Eko-Log Topluluğu'nun veya üniversitenin resmî görüşünü yansıtmaz. Olguları bağlantılardaki kaynaklardan doğrula.`);n.style.cssText='display:block;padding:8px 0 0;opacity:.8';m.appendChild(n)}
    if(j.hata){busy=false;return}
  }catch(e){
    /* API yoksa/hatalıysa: yalnızca GÜÇLÜ eşleşmeleri göster, zayıf (alakasız) sonuç dayatma */
    const gl=cs.filter(c=>c._s>=3);
    if(MOD==='gundem'){m.textContent=(CFG.proxy&&CFG.ai)?'Şu an güvenilir bir gündem analizi üretemiyorum, biraz sonra tekrar dener misin?':'Gündem analizi için yapay zekâ bağlantısı gerekiyor; bu bağlantı henüz kurulu değil.';busy=false;return}
    if((CFG.proxy&&CFG.ai)&&!gl.length){m.textContent='Şu an sunucuya ulaşamadım, biraz sonra tekrar dener misin?';busy=false;return}
    m.textContent=gl.length?((CFG.proxy&&CFG.ai)?'Sunucuya ulaşamadım; sitedeki en yakın içerikler:':'Sitedeki en yakın içerikler:')+'\n\n'+gl.slice(0,3).map(c=>`• ${c.t}: ${c.x.slice(0,180)}${c.x.length>180?'…':''}`).join('\n\n')
      :'Bunu sitedeki içeriklerde bulamadım.'+((CFG.proxy&&CFG.ai)?'':' Sitede olmayan konulara cevap veremiyorum; sözlük, laboratuvar, düşünür ve mevzuat içeriğinde arayabilirim.');
  }
  const gc=cs.filter(c=>c._s>=3);kaynaklar(m,gc.slice(0,4));yonlendir(m,q+' '+m.textContent,gc);log.scrollTop=log.scrollHeight;busy=false;sohbetKaydet();
}
sohbetYukle();
fab.onclick=()=>{delete fab.dataset.n;box.classList.toggle('on');if(box.classList.contains('on')){yukle();if(!log.children.length){if(!CFG.proxy)mesaj('⚠️ Yapay zekâ bağlantısı henüz kurulu değil; şimdilik sadece sitedeki içeriklerde arama yapabiliyorum.','eb-b');mesaj('Merhaba! Eko-Log\'u birlikte gezelim. Kavramları, laboratuvarları ve sayfaları sorabilirsin.','eb-b');chips()}inp.focus()}};
box.querySelector('#eb-an').onclick=()=>{const a=izinli();localStorage.setItem(IZIN,a?'0':'1');mesaj(a?'Çalışma analizi kapatıldı; artık özet gönderilmeyecek.':'Çalışma analizi açıldı.','eb-b')};
box.querySelector('header button:last-child').onclick=()=>box.classList.remove('on');
box.querySelector('form').onsubmit=e=>{e.preventDefault();const q=inp.value;inp.value='';sor(q)};
})();
