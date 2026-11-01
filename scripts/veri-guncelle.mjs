// TCMB EVDS verisini çekip veri.json dosyasına yazar. GitHub Actions içinde çalışır.
// EVDS anahtarı kodda durmaz: GitHub > Settings > Secrets > EVDS_KEY
import fs from 'node:fs';

const KEY = (process.env.EVDS_KEY || '').trim(); // secret'a yapıştırırken kalan boşluk/satır sonu 401 verdirir
if (!KEY) { console.error('EVDS_KEY tanımlı değil: GitHub > Settings > Secrets and variables > Actions'); process.exit(1); }

const BASE = 'https://evds3.tcmb.gov.tr/igmevdsms-dis/';
const gg = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tr = (s) => String(s || '').toLocaleLowerCase('tr-TR');
const bitis = new Date(), baslangic = new Date(bitis.getTime() - 400 * 864e5);
const BAYAT_GUN = 120; // son veri bundan eskiyse seri güncel sayılmaz

class HataKod extends Error { constructor(msg, kod) { super(msg); this.kod = kod; } }

async function evds(yol, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + yol, { headers: { key: KEY, 'User-Agent': 'veri-bot' }, signal: AbortSignal.timeout(30000) });
      if (r.status === 401 || r.status === 403) throw new HataKod(`HTTP ${r.status}: EVDS anahtarı reddedildi. evds3.tcmb.gov.tr > Profilim > API Key Kopyala ile yeni anahtar alıp EVDS_KEY secret'ını güncelle`, r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!(r.headers.get('content-type') || '').includes('json')) throw new HataKod('JSON yerine web sayfası geldi (adres ya da anahtar sorunu)', 0);
      return await r.json();
    } catch (e) {
      err = e;
      if (e.kod === 401 || e.kod === 403) throw e; // tekrar denemenin anlamı yok
      await sleep(1500 * (i + 1));
    }
  }
  throw err;
}

// EVDS tarihini ("2026-9" ya da "30-10-2026") Date'e çevirir; tanınmazsa null.
function tarihDate(t) {
  const a = String(t).match(/^(\d{4})-(\d{1,2})$/);
  if (a) return new Date(+a[1], +a[2], 0); // ayın son günü
  const b = String(t).match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  return b ? new Date(+b[3], +b[2] - 1, +b[1]) : null;
}
const taze = (t) => { const d = tarihDate(t); return !d || (bitis - d) / 864e5 <= BAYAT_GUN; };

// Serinin dolu kayıtlarını ve sonuncusunu döndürür. formul: 0 = düzey, 3 = yıllık % değişim
async function seriOku(kod, formul) {
  const j = await evds(`series=${kod}&startDate=${gg(baslangic)}&endDate=${gg(bitis)}&type=json&aggregationTypes=last&formulas=${formul}`);
  const items = j.items || [];
  const kol = Object.keys(items[0] || {}).find((k) => k !== 'Tarih' && k !== 'UNIXTIME');
  const dolu = items.filter((x) => kol && x[kol] != null && x[kol] !== '' && !isNaN(Number(x[kol])));
  if (!dolu.length) throw new Error('veri yok');
  return { dolu, kol, son: dolu[dolu.length - 1] };
}
// Eski TÜFE kodu bayatlayınca güncel seriyi EVDS'te kendisi bulur.
// TÜİK baz yılını değiştirirken oranların değişmediğini açıkladığı için, eski serinin son değeri
// doğrulama ölçüsüdür: yeni seri aynı ayda aynı yıllık değişimi vermeli, yoksa seçilmez.
async function tufeBul(ankaTarih, ankaDeger) {
  const sec = (strict) => (g) => {
    const a = tr(g.DATAGROUP_NAME);
    return /tüketici fiyat|tüfe/.test(a) && (!strict || /2025/.test(a)) && !/mevsim|arındırılmış|[iı]mf|oecd|eurostat|ülke|sabit vergi/.test(a);
  };
  const tum = await evds('datagroups/mode=0&type=json');
  let gruplar = tum.filter(sec(true));
  if (!gruplar.length) gruplar = tum.filter(sec(false));
  console.log('  TÜFE grupları:', gruplar.map((g) => `${g.DATAGROUP_CODE} (${g.DATAGROUP_NAME})`).join(' ; ') || '(yok)');
  const adaylar = [];
  for (const g of gruplar.slice(0, 6)) {
    for (const s of await evds(`serieList/type=json&code=${g.DATAGROUP_CODE}`)) {
      const a = tr(s.SERIE_NAME);
      if (/mevsim|arındırılmış|sabit vergi|hariç|çekirdek|ağırlık/.test(a)) continue;
      adaylar.push({ kod: s.SERIE_CODE, ad: s.SERIE_NAME, puan: /genel/.test(a) ? 0 : 1 });
    }
    await sleep(300);
  }
  adaylar.sort((x, y) => x.puan - y.puan);
  console.log(`  ${adaylar.length} aday seri var, ilk 40'ı denenecek (ölçü: ${ankaTarih} ayında ${ankaDeger})`);
  for (const a of adaylar.slice(0, 40)) {
    for (const formul of [3, 0]) {
      try {
        const o = await seriOku(a.kod, formul);
        const x = o.dolu.find((r) => r.Tarih === ankaTarih);
        if (x && Math.abs(Number(x[o.kol]) - ankaDeger) < 0.06 && taze(o.son.Tarih)) {
          console.log(`  BULUNDU: ${a.kod} | ${a.ad} | formül ${formul}`);
          return o;
        }
      } catch {}
      await sleep(200);
    }
  }
  return null;
}

let out = {};
try { out = JSON.parse(fs.readFileSync('veri.json', 'utf8')); } catch {}
let tamam = 0, yetki = false;
const uyari = [];
const yaz = (id, o, kaynak) => {
  out[id] = { deger: '%' + Number(o.son[o.kol]).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), tarih: o.son.Tarih, kaynak };
  tamam++;
  console.log('tamam:', id, out[id].deger, o.son.Tarih);
};

try { // Yıllık TÜFE
  const eski = await seriOku('TP.FG.J0', 3);
  console.log('  TP.FG.J0 son kayıtlar:', eski.dolu.slice(-3).map((x) => `${x.Tarih}=${x[eski.kol]}`).join(' | '));
  if (taze(eski.son.Tarih)) yaz('yillik_tufe', eski, 'TCMB EVDS');
  else {
    console.log(`TP.FG.J0 güncel değil (son kayıt ${eski.son.Tarih}), güncel seri aranıyor...`);
    const yeni = await tufeBul(eski.son.Tarih, Number(eski.son[eski.kol]));
    if (yeni) yaz('yillik_tufe', yeni, 'TCMB EVDS');
    else uyari.push('TÜFE için güncel seri bulunamadı, veri.json eski kaldı');
  }
} catch (e) {
  console.error('HATA yillik_tufe', e.message);
  if (e.kod === 401 || e.kod === 403) yetki = true; else uyari.push('TÜFE alınamadı: ' + e.message);
  if (e.kod === 401 || e.kod === 403) yetki = true; else uyari.push('TÜFE alınamadı: ' + e.message);
}

if (tamam) out.guncelleme = bitis.toISOString(); // hiçbir seri yenilenmediyse tarih de eski kalsın
fs.writeFileSync('veri.json', JSON.stringify(out, null, 1));
uyari.forEach((m) => console.log(`::warning::${m}`));
if (yetki) { console.error('EVDS anahtarı reddedildi: EVDS_KEY secret’ını yenile.'); process.exitCode = 1; }
