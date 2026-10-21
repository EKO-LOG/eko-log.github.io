// TCMB EVDS verisini çekip veri.json dosyasına yazar. GitHub Actions içinde çalışır.
// EVDS anahtarı kodda durmaz: GitHub > Settings > Secrets > EVDS_KEY
import fs from 'node:fs';

const KEY = process.env.EVDS_KEY;
if (!KEY) { console.error('EVDS_KEY tanımlı değil'); process.exit(1); }

const BASE = 'https://evds2.tcmb.gov.tr/service/evds/'; // EVDS adresi değişirse sadece burayı güncelle

// id: admin'deki "json:veri.json#id" ile eşleşir.
// formul: 0 = düzey, 3 = yıllık yüzde değişim (EVDS "formulas" parametresi)
// SERI_KODUNU_YAZ olan satır atlanır. Kodu evds2.tcmb.gov.tr > Seri Listesi'nden bulup yaz.
const SERILER = [
  { id: 'politika_faizi', seri: 'SERI_KODUNU_YAZ', formul: 0, kaynak: 'TCMB' },
  { id: 'yillik_tufe',    seri: 'TP.FG.J0',        formul: 3, kaynak: 'TCMB EVDS' }, // kodu EVDS'de doğrula
];

const gg = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
const bitis = new Date(), baslangic = new Date(bitis.getTime() - 400 * 864e5);

let out = {};
try { out = JSON.parse(fs.readFileSync('veri.json', 'utf8')); } catch {} // hata olursa eski değer kalsın
out.guncelleme = bitis.toISOString();

for (const s of SERILER) {
  if (s.seri.startsWith('SERI_')) { console.log('atlandı (kod yok):', s.id); continue; }
  try {
    const u = `${BASE}series=${s.seri}&startDate=${gg(baslangic)}&endDate=${gg(bitis)}&type=json&aggregationTypes=last&formulas=${s.formul}`;
    const r = await fetch(u, { headers: { key: KEY } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const items = j.items || [];
    const kol = Object.keys(items[0] || {}).find((k) => k !== 'Tarih' && k !== 'UNIXTIME');
    const son = [...items].reverse().find((x) => kol && x[kol] != null && x[kol] !== '');
    if (!son) throw new Error('veri yok');
    out[s.id] = {
      deger: '%' + Number(son[kol]).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tarih: son.Tarih,
      kaynak: s.kaynak,
    };
    console.log('tamam:', s.id, out[s.id].deger);
  } catch (e) { console.error('HATA', s.id, e.message); }
}
fs.writeFileSync('veri.json', JSON.stringify(out, null, 1));
