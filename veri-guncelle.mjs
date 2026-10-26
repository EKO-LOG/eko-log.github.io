// TCMB EVDS verisini çekip veri.json dosyasına yazar. GitHub Actions içinde çalışır.
// EVDS anahtarı kodda durmaz: GitHub > Settings > Secrets > EVDS_KEY
import fs from 'node:fs';

const KEY = (process.env.EVDS_KEY || '').trim(); // secret'a yapıştırırken kalan boşluk/satır sonu 401 verdirir
if (!KEY) { console.error('EVDS_KEY tanımlı değil: GitHub > Settings > Secrets and variables > Actions'); process.exit(1); }

const BASE = 'https://evds3.tcmb.gov.tr/igmevdsms-dis/';

// id: admin'deki "json:veri.json#id" ile eşleşir.
// formul: 0 = düzey, 3 = yıllık yüzde değişim
// seri kodu SERI_ ile başlayan satır atlanır; "ara" varsa log'a aday seriler yazılır (otomatik seçilmez).
const SERILER = [
  { id: 'politika_faizi', seri: 'SERI_KODUNU_YAZ', formul: 0, kaynak: 'TCMB', ara: /politika faizi|(bir|1) hafta vadeli repo/ },
  { id: 'yillik_tufe',    seri: 'TP.FG.J0',        formul: 3, kaynak: 'TCMB EVDS' },
];

const gg = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tr = (s) => String(s || '').toLocaleLowerCase('tr-TR');
const bitis = new Date(), baslangic = new Date(bitis.getTime() - 400 * 864e5);

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

// Seri kodu bilinmeyen satırlar için: EVDS'in seri listesinde aday arar, yalnızca log'a yazar.
async function adaylar(re) {
  try {
    const gruplar = (await evds('datagroups/mode=0&type=json')).filter((g) => /faiz|repo|para politikası/.test(tr(g.DATAGROUP_NAME))).slice(0, 15);
    for (const g of gruplar) {
      for (const s of await evds(`serieList/type=json&code=${g.DATAGROUP_CODE}`)) {
        if (re.test(tr(s.SERIE_NAME))) console.log(`  aday: ${s.SERIE_CODE} | ${s.SERIE_NAME} | ${g.DATAGROUP_NAME}`);
      }
      await sleep(300);
    }
  } catch (e) { console.log('  aday araması yapılamadı:', e.message); }
}

let out = {};
try { out = JSON.parse(fs.readFileSync('veri.json', 'utf8')); } catch {}
out.guncelleme = bitis.toISOString();

let tamam = 0, denenen = 0, yetki = false;
for (const s of SERILER) {
  if (s.seri.startsWith('SERI_')) {
    console.log('atlandı (kod yok):', s.id);
    if (s.ara) { console.log('  EVDS’te bulunan aday seriler (doğru olanın kodunu SERILER içine yaz):'); await adaylar(s.ara); }
    continue;
  }
  denenen++;
  try {
    const j = await evds(`series=${s.seri}&startDate=${gg(baslangic)}&endDate=${gg(bitis)}&type=json&aggregationTypes=last&formulas=${s.formul}`);
    const items = j.items || [];
    const kol = Object.keys(items[0] || {}).find((k) => k !== 'Tarih' && k !== 'UNIXTIME');
    const son = [...items].reverse().find((x) => kol && x[kol] != null && x[kol] !== '');
    if (!son) throw new Error('veri yok');
    out[s.id] = {
      deger: '%' + Number(son[kol]).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tarih: son.Tarih,
      kaynak: s.kaynak,
    };
    tamam++;
    console.log('tamam:', s.id, out[s.id].deger);
  } catch (e) {
    console.error('HATA', s.id, e.message);
    if (e.kod === 401 || e.kod === 403) yetki = true;
  }
}
fs.writeFileSync('veri.json', JSON.stringify(out, null, 1));
if (denenen && !tamam) { console.error(yetki ? 'Hiçbir seri alınamadı: anahtar sorunu.' : 'Hiçbir seri alınamadı.'); process.exitCode = 1; }
