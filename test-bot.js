#!/usr/bin/env node
/* Eko Can (eko-bot.js) · regresyon testi
   Çalıştır:   node test-bot.js              (eko-bot.js, kampus.json ve varsa eko-bot-bilgi.json bu klasörde olmalı)
               node test-bot.js ../baska/eko-bot.js
   Yeni kural eklediğinde aşağıdaki tablolara BİR SATIR ekle: [soru, cevapta geçmesi gereken kalıp].
   Hepsi geçerse çıkış kodu 0, biri bozulursa 1 olur. Tarayıcı gerekmez: sahte (boş) bir DOM ile botun gerçek kodu çalıştırılır. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const DIR=__dirname,BOT=path.resolve(process.argv[2]||path.join(DIR,'eko-bot.js'));
if(!fs.existsSync(BOT)){console.error('eko-bot.js bulunamadı: '+BOT);process.exit(2)}

/* ---------- sahte tarayıcı ---------- */
function fake(){const st={};return new Proxy(function(){},{
  get(t,k){if(k===Symbol.toPrimitive)return()=>'';if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;if(k==='length')return 0;
    if(k in st)return st[k];if(k==='style'||k==='dataset'||k==='classList')return st[k]=fake();return fake()},
  set(t,k,v){st[k]=v;return true},apply(){return fake()}})}
const mem=()=>{const m={};return{getItem:k=>(k in m?m[k]:null),setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]}}};
function yeniBot(cfg,yol){
  const localStorage=mem(),sessionStorage=mem(),istek=[],beacon=[];
  const win={EKO_BOT:Object.assign({},cfg||{}),__EKO_TEST:1,addEventListener(){},localStorage,sessionStorage};
  const doc={documentElement:fake(),createElement:()=>fake(),createTextNode:()=>fake(),getElementById:()=>null,querySelector:()=>fake(),querySelectorAll:()=>[],body:fake(),head:fake(),title:'test',currentScript:{src:'http://test.local/eko-bot.js'},addEventListener(){}};
  const ctx=vm.createContext({window:win,document:doc,location:{pathname:yol||'/index.html',hash:''},localStorage,sessionStorage,
    navigator:{sendBeacon(u,b){beacon.push(b);return true}},Blob:class{constructor(p){this.p=p}},innerHeight:800,getComputedStyle:()=>({display:'none'}),
    setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},Date,Math,JSON,Promise,URL,URLSearchParams,console,addEventListener(){},confirm:()=>false,
    MutationObserver:class{observe(){}},IntersectionObserver:class{observe(){}},requestAnimationFrame:()=>0,requestIdleCallback:()=>0,
    fetch:async u=>{const ad=String(u).split('?')[0].split('/').pop();istek.push(ad);const p=path.join(DIR,ad);
      if(!fs.existsSync(p))return{ok:false,status:404,json:async()=>{throw new Error('404')}};
      return{ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}}});
  ctx.window.window=ctx.window;
  vm.runInContext(fs.readFileSync(BOT,'utf8'),ctx,{filename:BOT});
  const T=ctx.window.__EKO_TEST;
  if(!T)throw new Error('Test kancası yok: eko-bot.js sonunda window.__EKO_TEST satırı olmalı.');
  return{T,beacon,istek}}

/* ---------- küçük test çerçevesi ---------- */
let gecen=0,kalan=[],atlanan=0;
const ok=(ad,kosul,not)=>{if(kosul)gecen++;else{kalan.push(ad+(not?'  → '+not:''))}};
const kisa=s=>String(s==null?'∅':s).replace(/\n/g,' ').slice(0,90);
const mesaj=r=>r&&(typeof r==='string'?r:r.t);

(async()=>{
const {T}=yeniBot();
await T.yukleHafif();

/* ===== 1) KAMPÜS · MOTAŞ · TAKVİM (kampus.json) — sss katmanı ===== */
const KAMPUS=[
 ['vize ne zaman',/ara sınavlar/],['final ne zaman',/ara sınavlar|vize/],['bütünleme ne zaman',/Temmuz/],
 ['trambüs nereye gider',/Trambüs/],['80 nolu hat nereden geçer',/Trambüs|80/],['17b nereden geçer',/17B/],
 ['okula hangi otobüs gidiyor',/80/],['kampüse hangi otobüs gidiyor',/17A/],['hastaneye hangi otobüs gidiyor',/Hastane ulaşımı/],
 ['maşti hangi hat gidiyor',/Maşti/],['toplu taşıma nasıl',/MOTAŞ/],
 ['akademik takvim',/akademik takvim/],['ders ekleme silme ne zaman',/1–2 Mart/],['tek ders ne zaman',/Tek ders/],
 ['5i dersleri ne zaman',/12 Nisan|ortak zorunlu/i],['yatay geçiş şartları',/yatay geçiş/],['çift anadal başvurusu',/anadal/],
 ['devamsızlık sınırı kaç',/yönetmelik/],['kyk yurt başvurusu',/KYK/],['yaz okulu var mı',/Yaz okulu/],['ydyo muafiyet',/YDYO/],
 ['öğrenci belgesi nasıl alınır',/e-Devlet/],['malatya nasıl gelinir',/Erhaç/],['hocaya mail nasıl yazarım',/Konu:/],
 ['kampüse nasıl giderim',/yol tarifi/],['iibf duyuruları',/inonu\.edu\.tr\/iibf/],
 /* kampus.json'da boş bırakılan başlıklar: bot uydurmamalı, “resmî kaynağa bak” demeli */
 ['yemekhane saatleri',/tahmin yürütüp/],['kütüphane saatleri',/tahmin yürütüp/],['erasmus başvurusu ne zaman',/tahmin yürütüp/],
];
for(const [q,re] of KAMPUS){const r=T.sss(q);ok('kampüs: '+q,r&&re.test(r.t),kisa(mesaj(r)))}

/* ===== 2) YAZIM HATASI TOLERANSI ===== */
const YAZIM=[
 ['vzie ne zman',/ara sınavlar/],['butunlme ne zaman',/Temmuz/],['trambuz nereye gider',/Trambüs/],['trambüz nrelere gider',/Trambüs/],
 ['akademk takvm',/akademik takvim/],['yemekhne saatleri',/tahmin yürütüp/],['kutuphne saatleri',/tahmin yürütüp/],
 ['devamsizlk sinirı',/yönetmelik/],['hocaya meil nasil yazarim',/Konu:/],['yatay gecis sartlri',/yatay geçiş/],
 ['erasmus basvurusu ne zman',/tahmin yürütüp/],['stj ne zaman',null]
];
for(const [q,re] of YAZIM){if(!re)continue;const r=T.sss(q);ok('yazım: '+q,r&&re.test(r.t),kisa(mesaj(r)))}
/* ders kartları: bozuk yazım */
const DYAZIM=[['enflasyn nedir anlat','Enflasyon'],['esneklk nedir','Esneklik'],['temerut nedir anlat','Temerrüt'],['otokorelasyn nedir','Otokorelasyon'],['amortizman nedir anlat','Amortisman']];
for(const [q,b] of DYAZIM){const r=T.DERS.cevap(q);ok('ders yazım: '+q,r&&r.kart&&new RegExp(b,'i').test(r.t),kisa(mesaj(r)))}

/* ===== 3) OLUMSUZ TESTLER: ders/ekonomi/sohbet soruları kampüs kurallarına KAÇMAMALI ===== */
const OLUMSUZ=['enflasyon nedir','iptal davasını baştan sona anlat','arz talep dengesini anlat','esneklik nedir örnekle anlat','OLS varsayımlarını anlat','net bugünkü değeri anlat',
 'vergi zamanaşımını örnekle anlat','güvenlik ikilemini anlat','merhaba','nasılsın','teşekkürler'];
for(const q of OLUMSUZ){const r=T.sss(q);ok('olumsuz (sss boş kalmalı): '+q,!r||!/MOTAŞ|Trambüs|akademik takvim|ara sınavlar/.test(r.t),kisa(mesaj(r)))}

/* ===== 4) GÜVENLİK: kriz cümlesi kural/ayrık katmanlara düşmemeli ===== */
ok('güvenlik: kriz cümlesi yakalanır',!!T.guvenlik('yaşamak istemiyorum artık'));
ok('güvenlik: sss kriz cümlesine cevap vermez',T.sss('yaşamak istemiyorum')===null);
ok('güvenlik: komut katmanı kriz cümlesine karışmaz',T.kisiselKomut('yaşamak istemiyorum bölümüm iktisat')===null);

/* ===== 5) TÜM DERS KARTLARI (otomatik): her kart kendi adıyla açılmalı ve sss'ye kaçmamalı ===== */
for(const c of T.DERS._KART){const q=c.b+' konusunu anlat',r=T.DERS.cevap(q);
  ok('kart: '+c.id,r&&r.kart&&r.t.includes(c.b),kisa(mesaj(r)));
  ok('kart sss\'ye kaçmıyor: '+c.id,T.sss(q)===null,kisa(mesaj(T.sss(q))))}
const FARKQ=['Realizm ile Liberalizm karşılaştır','tam yargı davası ile iptal davasını karşılaştır','zamanaşımı ile hak düşürücü süreyi karşılaştır','talep eğrisinde hareket ile kayma farkı'];
for(const q of FARKQ){const r=T.DERS.cevap(q);ok('fark kartı: '+q,r&&r.kart,kisa(mesaj(r)))}

/* ===== 6) KİŞİSELLEŞTİRME ===== */
{const {T}=yeniBot();await T.yukleHafif();
 let r=T.kisiselKomut('bölümüm iktisat');ok('profil: bölüm cümlesi',r&&/Not aldım/.test(r.t)&&T.PROFIL.bolum==='iktisat',kisa(mesaj(r)));
 r=T.kisiselKomut('3. sınıfım');ok('profil: sınıf cümlesi',T.PROFIL.sinif===3,JSON.stringify(T.PROFIL));
 r=T.sss('mezun olunca ne iş yapılır');ok('profil: kariyer cevabı bölüme+sınıfa göre',r&&/İktisat:/.test(r.t)&&/3\. sınıftasın/.test(r.t),kisa(mesaj(r)));
 r=T.kisiselKomut('profilim');ok('profil: “profilim”',r&&/İktisat/.test(r.t)&&/3\. sınıf/.test(r.t),kisa(mesaj(r)));
 r=T.kisiselKomut('profilimi sil');ok('profil: silme',r&&!T.PROFIL.bolum,kisa(mesaj(r)));
 T.profilSor();ok('profil: ilk açılış sorusu',T.PSOR==='bolum');
 r=T.kisiselKomut('Kamu Yönetimi');ok('profil: bölüm cevabı → sınıf sorusu',T.PSOR==='sinif'&&/Kaçıncı sınıf/.test(r.t),kisa(mesaj(r)));
 r=T.kisiselKomut('2. sınıf');ok('profil: sınıf cevabı → bitti',T.PSOR===null&&T.PROFIL.bolum==='kamu'&&T.PROFIL.sinif===2,JSON.stringify(T.PROFIL));
 T.profilSor();r=T.kisiselKomut('Şimdilik geç');ok('profil: “şimdilik geç” zorlamaz',T.PSOR===null&&r&&/Tamam/.test(r.t));
 T.profilSor();r=T.kisiselKomut('enflasyon nedir');ok('profil: soruyu yok sayıp başka şey yazarsa sorulmaz, soru kaybolmaz',r===null&&T.PSOR===null);
 ok('profil: “yüksek lisans” ve “hazırlık” ayrıştırılır',T.profilCoz('iktisat yuksek lisans').sinif==='yl'&&T.profilCoz('hazirlik okuyorum').sinif==='hz');
 ok('profil: ÇEKO “çalışma ekonomisi” iktisata karışmaz',T.profilCoz('calisma ekonomisi').bolum==='ceko'&&T.profilCoz('ekonometri').bolum==='ekonometri');
}

/* ===== 7) SINAV TEKRAR MODU ve SKOR ===== */
{const {T}=yeniBot();await T.yukleHafif();
 T.kisiselKomut('bölümüm iktisat');
 const kn=T.DERS.konular('iktisat');ok('tekrar: iktisat konuları var',kn.length>=3,'konu sayısı '+kn.length);
 let ms=T.DERS.mini('iktisat',T.ST.agirlik);const b=ms.mini.b;
 const pas=T.DERS.deger(ms.mini,'pas');ok('skor: “pas” sonucu işaretlenir',pas.sonuc==='p');
 const dogru=T.DERS.deger({b:'X',g:['esnek'],c:'esneklik'},'esneklik');ok('skor: doğru cevap işaretlenir',dogru.sonuc==='d');
 const yanlis=T.DERS.deger({b:'X',g:['esnek'],c:'esneklik'},'bilmiyorum ama sanirim faiz');ok('skor: yanlış cevap işaretlenir',yanlis.sonuc==='y'||yanlis.sonuc==='p');
 T.ST.kaydet(b,'y');kn.filter(x=>x!==b).forEach(x=>{T.ST.kaydet(x,'d');T.ST.kaydet(x,'d');T.ST.kaydet(x,'d')});
 ok('tekrar: yanlış yapılan konu zayıf listede',T.ST.zayifListe().includes(b));
 let isabet=0;for(let i=0;i<300;i++){const m=T.DERS.mini('iktisat',T.ST.agirlik);if(m.mini.b===b)isabet++;}
 ok('tekrar: zayıf konu belirgin sıklıkla sorulur (%'+Math.round(isabet/3)+')',isabet>=300*0.30,'isabet '+isabet+'/300');
 const tk=T.kisiselKomut('tekrar modu');ok('tekrar: komut zayıf konudan soru açar',tk&&/Tekrar modu/.test(tk.t)&&T.SINA&&T.SINA.b===b,kisa(mesaj(tk)));
 const sk=T.kisiselKomut('skorum');ok('skor: özet toplam ve zayıf konuyu gösterir',sk&&/Toplam/.test(sk.t)&&sk.t.includes(b),kisa(mesaj(sk)));
 T.kisiselKomut('skorlarımı sıfırla');ok('skor: sıfırlama',T.ST.zayifListe().length===0&&/skor yok/.test(T.kisiselKomut('skorum').t));
 ok('tekrar: yanlış yoksa nazikçe söyler',/görünmüyor/.test(T.kisiselKomut('tekrar modu').t));
}

/* ===== 8) SINAV TARİHİ → ÇALIŞMA PLANI ===== */
{const bg=new Date(2026,10,24),iso=d=>d&&d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),nt=T.nt;
 ok('tarih: “14 Ocak” sonraki yıla düşer',iso(T.tarihBul(nt('finalim 14 Ocak'),'finalim 14 Ocak',bg))==='2027-1-14');
 ok('tarih: “14 Ocak 2027”',iso(T.tarihBul(nt('14 Ocak 2027'),'14 Ocak 2027',bg))==='2027-1-14');
 ok('tarih: “Ocak’ta” ek almış yazım',iso(T.tarihBul(nt('14 Ocak’ta final'),'14 Ocak’ta final',bg))==='2027-1-14');
 ok('tarih: 12.04.2027',iso(T.tarihBul(nt('vizem 12.04.2027'),'vizem 12.04.2027',bg))==='2027-4-12');
 ok('tarih: “20 gün var”',iso(T.tarihBul(nt('sınava 20 gün var'),'sınava 20 gün var',bg))==='2026-12-14');
 ok('tarih: “yarın”',iso(T.tarihBul(nt('sınav yarın'),'sınav yarın',bg))==='2026-11-25');
 ok('tarih: geçersiz gün (31 Şubat) reddedilir',T.tarihBul(nt('31 Şubat'),'31 Şubat',bg)===null);
 const P=g=>T.planKur('iktisat',{t:g,ad:'final'},bg).t,satir=t=>t.split('\n').filter(l=>l.startsWith('•')).length;
 let t=P('2027-01-14');ok('plan: 51 gün, uzun vade haftalık gruplanır',/51 gün/.test(t)&&satir(t)>=5&&satir(t)<=14&&/Öğren →/.test(t)&&/karışık mini sınav/i.test(t),kisa(t));
 t=P('2026-12-04');ok('plan: 10 gün günlük satırlar',/10 gün/.test(t)&&satir(t)===10,satir(t)+' satır');
 t=P('2026-11-27');ok('plan: 3 gün',/3 gün/.test(t)&&satir(t)===3);
 t=P('2026-11-25');ok('plan: 1 gün',/1 gün/.test(t)&&satir(t)===1);
 t=P('2026-11-24');ok('plan: sınav bugün',/Sınav bugün/.test(t));
 t=P('2026-11-20');ok('plan: geçmiş tarih nazikçe uyarılır',/geçmiş/.test(t));
 ok('plan: konu yoksa (bölüm bilinmiyor) da çökmez',/gün/.test(T.planKur(null,{t:'2027-01-14',ad:'vize'},bg).t));
}
{const {T}=yeniBot();await T.yukleHafif();
 let r=T.kisiselKomut('bütünleme 5 Temmuz’da mı');ok('plan: kampüs sorusunu sınav tarihi sanmaz',r===null,kisa(mesaj(r)));
 r=T.kisiselKomut('sınav planı yap');ok('plan: tarih yoksa tarih sorar',r&&/tarihini yaz/.test(r.t),kisa(mesaj(r)));
 r=T.kisiselKomut('finalim 14 ocak 2099');ok('plan: bölüm yoksa önce bölüm sorar',r&&/hangi bölümdesin/.test(r.t)&&T.PSOR==='bolum',kisa(mesaj(r)));
 r=T.kisiselKomut('iktisat');ok('plan: bölüm gelince planı verir',r&&/📅/.test(r.t)&&T.PROFIL.bolum==='iktisat',kisa(mesaj(r)));
 r=T.kisiselKomut('kaç gün kaldı');ok('plan: geri sayım',r&&/gün\*\* kaldı|gün kaldı/.test(r.t),kisa(mesaj(r)));
 r=T.kisiselKomut('planım');ok('plan: kayıtlı planı yeniden gösterir',r&&/📅/.test(r.t),kisa(mesaj(r)));
}

/* ===== 9) CEVAPSIZ SORU KAYDI ===== */
{const {T,beacon}=yeniBot();
 ok('kayıt: adres yoksa uzağa göndermez',T.cevapsiz('bu bot bilmeyen ilginç bir soru','arama')===false&&beacon.length===0);
 ok('kayıt: yine de bu cihazda biriktirir',T.kayitKuyruk().length===1);}
{const {T,beacon}=yeniBot({kayit:{url:'https://ornek.workers.dev/kayit'}});
 ok('kayıt: adres varsa gönderir',T.cevapsiz('bana test@ornek.com adresinden ulaş, tel 0532 111 22 33, bu soruyu bilmiyor musun','arama')===true&&beacon.length===1);
 const g=JSON.stringify(beacon[0]&&beacon[0].p||'');
 ok('kayıt: e-posta ve telefon maskelenir',/\[e-posta\]/.test(g)&&/\[tel\]/.test(g)&&!/test@ornek/.test(g),g.slice(0,120));
 ok('kayıt: aynı soru iki kez gönderilmez',T.cevapsiz('bana test@ornek.com adresinden ulaş, tel 0532 111 22 33, bu soruyu bilmiyor musun','arama')===false&&beacon.length===1);
 ok('kayıt: kriz cümlesi asla kaydedilmez',T.cevapsiz('yaşamak istemiyorum','arama')===false&&beacon.length===1);
 ok('kayıt: çok kısa metin kaydedilmez',T.cevapsiz('ab','arama')===false);}

/* ===== 10) HIZLI YENİLEME: büyük bilgi dosyası kampüs cevabını geciktirmemeli ===== */
{const {T,istek}=yeniBot();await T.yukleHafif();
 ok('hız: hafif yükleme bilgi dosyasını (eko-bot-bilgi.json) indirmez',!istek.includes('eko-bot-bilgi.json'),istek.join(','));
 ok('hız: kampus.json yüklendi',istek.includes('kampus.json'));
 await T.yukleDB();ok('hız: ağır yükleme bilgi dosyasını arka planda indirir',istek.includes('eko-bot-bilgi.json'));
 if(fs.existsSync(path.join(DIR,'eko-bot-bilgi.json'))){const n=istek.filter(x=>x==='eko-bot-bilgi.json').length;await T.yukleDB();await T.yukle();
  ok('hız: bilgi dosyası tekrar tekrar indirilmez',istek.filter(x=>x==='eko-bot-bilgi.json').length===n)}}
/* bilgi dosyası bu klasörde varsa: bozuk yazımla arama */
if(fs.existsSync(path.join(DIR,'eko-bot-bilgi.json'))){
 const {T}=yeniBot();await T.yukle();
 const aday=T.DB.find(c=>c.k==='sozluk'&&/^[a-zçğıöşü]{9,14}$/i.test(c.t));
 if(aday){const w=aday.t.toLocaleLowerCase('tr'),bozuk=w.slice(0,4)+w.slice(5);
  const r=T.ara(bozuk,5);ok('arama: bozuk yazım “'+bozuk+'” → “'+w+'”',r.some(c=>c.t===aday.t),r.map(c=>c.t).join(' | '))}
 ok('arama: bilgi tabanı yüklendi ('+T.DB.length+' kayıt)',T.DB.length>0);
}else{atlanan++}


/* ===== 11) DUMAN TESTİ: gerçek sor() akışı (arayüz dahil) hata fırlatmadan çalışmalı ===== */
{const {T,beacon}=yeniBot({kayit:{url:'https://ornek.workers.dev/kayit'}});
 const sorular=['vize ne zaman','bölümüm iktisat','3. sınıfım','beni bir soruyla sına','skorum','tekrar modu','enflasyn nedir anlat','finalim 14 ocak 2099','kaç gün kaldı','mezun olunca ne iş yapılır','trambuz nereye gider','merhaba','xqzvw plmk bilinmeyen garip soru','yaşamak istemiyorum'];
 let hata=null;
 for(const q of sorular){try{await T.sor(q)}catch(e){hata=q+' → '+e.message;break}}
 ok('duman: '+sorular.length+' farklı mesaj hatasız işlendi',!hata,hata);
 ok('duman: işlem bitince meşgul bayrağı kapanır',T.busy===false);
 ok('duman: bilinmeyen soru cevapsız listesine düştü, kriz cümlesi düşmedi',T.kayitKuyruk().some(k=>/xqzvw/.test(k.s))&&!T.kayitKuyruk().some(k=>/yaşamak/.test(k.s)),JSON.stringify(T.kayitKuyruk().map(k=>k.s)));
 ok('duman: bilinmeyen soru uzak adrese gönderildi',beacon.length===1,'gönderim '+beacon.length);}

/* ===== 12) ADRESLER · AKADEMİK/KARİYER KURALLARI · NOT HESAPLAMA (kampus.json "yer" ve "kurallar" + eko-bot.js not motoru) ===== */
{const {T}=yeniBot();await T.yukleHafif();
 const YERQ=[
  ['Battalgazi Devlet Hastanesi nasıl giderim',/Battalgazi Devlet Hastanesi[\s\S]*401A/],['Eğitim ve Araştırma Hastanesi nasıl gidilir',/Eğitim ve Araştırma[\s\S]*80/],
  ['Turgut Özal Tıp Merkezi nasıl gidilir',/Tıp Merkezi[\s\S]*16C/],['Beylerderesi Millet Bahçesi nasıl giderim',/Beylerderesi Millet Bahçesi/],
  ['Beydağı Millet Bahçesi nasıl gidilir',/Beydağı Millet Bahçesi/],['Battalgazi Millet Bahçesi nerede',/Battalgazi Millet Bahçesi/],
  ['Yüzüncü Yıl Parkı nasıl gidilir',/Yüzüncü Yıl Parkı/],['Kırkgöz Sahil Parkı nasıl giderim',/Kırkgöz Sahil Parkı/],
  ['Malatya Millet Bahçesi nasıl gidilir',/Malatya Millet Bahçesi[\s\S]*12V/],['MalatyaPark AVM nasıl giderim',/MalatyaPark AVM[\s\S]*10Z/],
  ['Maliye nerede',/Maliye durağı/],['Maşti nerede',/Otogar[\s\S]*80/],['yurt nerede',/yurt/i],['kütüphane nerede',/Kütüphane/],
  ['Teknokent nasıl gidilir',/Teknokent/],['Kernek Şelalesi nasıl gidilir',/Kernek/],['Turgut Özal Tabiat Parkı nasıl gidilir',/Orduzu/],
  ['Somuncu Baba Külliyesi nasıl gidilir',/Darende/],['Yeşilyurt nasıl gidilir',/Yeşilyurt/],['ATM nerede',/ATM/],['kargo nerede',/PTT/],
  ['yurt dışına nasıl gidilir',/yurt dışına/]];
 for(const [q,re] of YERQ){const r=T.sss(q);ok('adres: '+q,r&&re.test(r.t),kisa(mesaj(r)))}
 const KURQ=[
  ['notuma itiraz etmek istiyorum',/5 iş günü/],['kayıt dondurma nasıl yapılır',/1 yıl/],['akademik danışmanım kim',/danışman/i],['wifi şifresi nasıl alırım',/pbs\.inonu/],
  ['eduroam bağlanamıyorum',/eduroam/],['burs başvurusu nasıl yapılır',/KYK/],['öğrenci kartı nasıl çıkarılır',/vize/],['kulüplere nasıl üye olunur',/Topluluk/i],
  ['psikolog randevusu',/112/],['engelli öğrenci birimi',/Engelli/],['spor salonu saatleri',/Spor/],['fakülte telefon numarası',/tahmin/],['acil numaralar',/112/],
  ['yemek menüsü',/sksdb/],['harf notu karşılıkları',/A1 4,00/],['agno nasıl hesaplanır',/AKTS/],['kaç akts alabilirim',/40 AKTS/],
  ['bütünlemeye kimler girer',/D1, D2, D3/],['mazeret sınavı',/5 iş günü/],['ders muafiyeti',/iki hafta/],['katkı payı',/Cumhurbaşkanı/],['ders kaydını kaçırdım',/dördüncü hafta/],
  ['kariyer merkezi',/kariyermerkezi/],['ulusal staj programı',/14 Aralık 2026/],['kısmi zamanlı çalışmak istiyorum',/Kısmi zamanlı/i],['sosyal transkript',/sksdb/],
  ['devamsızlık sınırı kaç',/%70/],['mezuniyet için kaç akts gerekir',/240/],['staj nasıl yapılır',/staj/i],['çift anadal şartları',/70/],['yatay geçiş şartları',/60/],
  ['yemekhane saatleri',/tahmin yürütüp/],['kütüphane saatleri',/tahmin yürütüp/]];
 for(const [q,re] of KURQ){const r=T.sss(q);ok('kural: '+q,r&&re.test(r.t),kisa(mesaj(r)))}}
{/* not hesaplama: her senaryo taze botla (durum karışmasın) */
 const k=q=>{const {T}=yeniBot();return T.kisiselKomut(q)};
 let r=k('agno hesapla');ok('not: komut örnek istiyor',r&&/Notlarını yaz/.test(r.t),kisa(mesaj(r)));
 r=k('Mikro 6 A2, Makro 5 B1, İstatistik 4 70');ok('not: YNO 3,32 + onur',r&&/\*\*3,32\*\*/.test(r.t)&&/onur/.test(r.t),kisa(mesaj(r)));
 r=k('agno hesapla: Mikro 6 A2, Makro 5 B1, İstatistik 4 70, mevcut agno 2,85 90 akts');ok('not: mevcut ortalamayla birleşik 2,92',r&&/Birleşik AGNO: \*\*2,92\*\*/.test(r.t)&&!/agno hesapla Mikro/.test(r.t),kisa(mesaj(r)));
 r=k('notlarımı değerlendir: Muhasebe 5 F2, Hukuk 4 D2, İktisat 6 B3');ok('not: AGNO<2 → başarısız durum + 30 AKTS',r&&/1,50/.test(r.t)&&/başarısız durumdasın/.test(r.t)&&/30 AKTS/.test(r.t)&&/Bütünleme/.test(r.t),kisa(mesaj(r)));
 r=k('agno nasıl hesaplanır');ok('not: “nasıl hesaplanır” hesaplayıcıyı tetiklemez (bilgi kuralına gider)',r===null,kisa(mesaj(r)));
 r=k('Mikro 6, Makro B1');ok('not: eksik bilgide uydurmaz',r===null||/anlayamadım|AKTS/.test(r.t),kisa(mesaj(r)));
 r=k('yaşamak istemiyorum, Mikro 6 A1');ok('not: kriz cümlesi hesaplayıcıya karışmaz',r===null,kisa(mesaj(r)));
 r=k('vize ne zaman');ok('not: alakasız soru etkilenmez',r===null,kisa(mesaj(r)));
 {const {T}=yeniBot();const a=T.kisiselKomut('ortalamam hesapla'),b=T.kisiselKomut('Mikro 6 B2, Makro 4 C1');
  ok('not: iki adımlı akış (önce komut, sonra notlar)',a&&/Notlarını yaz/.test(a.t)&&b&&/\*\*2,80\*\*/.test(b.t),kisa(mesaj(b)))}
 r=k('bölümüm iktisat');ok('not: profil komutları bozulmadı',r&&/Not aldım/.test(r.t),kisa(mesaj(r)))}

/* ---------- sonuç ---------- */
console.log('\nEko Can testi: '+gecen+' geçti, '+kalan.length+' kaldı'+(atlanan?' (bilgi dosyası bulunamadığı için arama testi atlandı)':''));
if(kalan.length){console.log('\nKalanlar:');kalan.forEach(k=>console.log(' ✗ '+k));process.exit(1)}
console.log('Hepsi tamam ✅');process.exit(0);
})().catch(e=>{console.error('Test çalışırken hata:',e);process.exit(2)});
