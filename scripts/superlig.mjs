// Süper Lig verisi → superlig.json
// Yalnızca iki anda veri kaydeder: DEVRE ARASI ve MAÇ SONU. Başka zaman dosyaya dokunmaz.
// Kaynak: ESPN'in resmî olmayan herkese açık JSON uç noktaları (anahtar gerekmez).
// Node 20+ (yerleşik fetch). Bağımlılık yok.
import { readFile, writeFile } from 'node:fs/promises';

const LIG = 'tur.1';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + LIG;
const V2 = 'https://site.api.espn.com/apis/v2/sports/soccer/' + LIG;
const OUT = process.env.OUT || 'superlig.json';
const KEEP = 150; // dosyada tutulacak son maç sayısı

const bekle = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Eko-Log veri aktarımı)' } });
      if (r.ok) return await r.json();
      console.warn('HTTP', r.status, url);
    } catch (e) { console.warn('Hata:', e.message, url); }
    await bekle(1500 * (i + 1));
  }
  return null;
}
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const sayi = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

function durumu(ev) {
  const t = (ev.status && ev.status.type) || {};
  const ad = String(t.name || '');
  if (/POSTPONED|CANCEL|SUSPEND|ABANDON|DELAY/.test(ad)) return 'once';
  if (/HALFTIME/.test(ad)) return 'devre';
  if (t.state === 'post' || t.completed === true || /FULL_TIME|FINAL/.test(ad)) return 'bitti';
  if (t.state === 'in') return 'canli';
  return 'once';
}

function olaylar(detaylar, takimAdi) {
  return (detaylar || []).map(d => {
    const tur = d.scoringPlay ? (d.ownGoal ? 'kk' : d.penaltyKick ? 'pen' : 'gol')
      : d.redCard ? 'kirmizi' : d.yellowCard ? 'sari' : null;
    if (!tur) return null;
    const a = (d.athletesInvolved || [])[0] || {};
    return { dk: (d.clock && d.clock.displayValue) || '', tur, takim: takimAdi[String(d.team && d.team.id)] || '', oyuncu: a.displayName || '' };
  }).filter(Boolean);
}

const ISTAT = {
  possessionPct: 'Topla oynama %', totalShots: 'Şut', shotsOnTarget: 'İsabetli şut',
  wonCorners: 'Korner', foulsCommitted: 'Faul', offsides: 'Ofsayt', saves: 'Kurtarış',
  yellowCards: 'Sarı kart', redCards: 'Kırmızı kart'
};
async function istatistik(id, evId, evAd) {
  const j = await get(SITE + '/summary?event=' + id);
  const sonuc = { ist: {}, olay: [] };
  if (!j) return sonuc;
  const takimlar = (j.boxscore && j.boxscore.teams) || [];
  const harita = {};
  takimlar.forEach(t => {
    const ev = String(t.team && t.team.id) === String(evId);
    (t.statistics || []).forEach(s => {
      const ad = ISTAT[s.name]; if (!ad) return;
      harita[ad] = harita[ad] || ['', ''];
      harita[ad][ev ? 0 : 1] = String(s.displayValue != null ? s.displayValue : s.value);
    });
  });
  sonuc.ist = harita;
  // Yedek: scoreboard'da olay yoksa özetteki anahtar olaylar
  sonuc.olay = (j.keyEvents || []).map(k => {
    const t = String((k.type && k.type.text) || '').toLowerCase();
    const tur = k.scoringPlay ? (/own/.test(t) ? 'kk' : /penalty/.test(t) ? 'pen' : 'gol')
      : /red card/.test(t) ? 'kirmizi' : /yellow card/.test(t) ? 'sari' : null;
    if (!tur) return null;
    const p = (k.participants || [])[0];
    return { dk: (k.clock && k.clock.displayValue) || '', tur, takim: (k.team && k.team.displayName) || '', oyuncu: (p && p.athlete && p.athlete.displayName) || '' };
  }).filter(Boolean);
  return sonuc;
}

function anlik(ev) {
  const c = (ev.competitions || [])[0] || {};
  const k = c.competitors || [];
  const ev1 = k.find(x => x.homeAway === 'home') || k[0] || {};
  const dep = k.find(x => x.homeAway === 'away') || k[1] || {};
  const adlar = {};
  k.forEach(x => { if (x.team) adlar[String(x.team.id)] = x.team.displayName; });
  const ilk = x => (x.linescores && x.linescores.length >= 2) ? sayi(x.linescores[0].value) : null;
  return {
    id: String(ev.id), tarih: ev.date,
    ev: ev1.team && ev1.team.displayName, dep: dep.team && dep.team.displayName,
    evId: ev1.team && ev1.team.id,
    evSkor: sayi(ev1.score), depSkor: sayi(dep.score),
    devreSkor: (ilk(ev1) != null && ilk(dep) != null) ? [ilk(ev1), ilk(dep)] : null,
    olaylar: olaylar(c.details, adlar)
  };
}

async function puanDurumu() {
  const j = await get(V2 + '/standings');
  if (!j) return null;
  const g = (j.children && j.children[0] && j.children[0].standings) || j.standings;
  const girisler = (g && g.entries) || [];
  const t = girisler.map(e => {
    const s = {}; (e.stats || []).forEach(x => { s[x.name] = x.value; });
    return { sira: sayi(s.rank), takim: e.team && e.team.displayName, o: sayi(s.gamesPlayed), g: sayi(s.wins), b: sayi(s.ties), m: sayi(s.losses), a: sayi(s.pointsFor), y: sayi(s.pointsAgainst), av: sayi(s.pointDifferential), puan: sayi(s.points) };
  }).filter(x => x.takim);
  t.sort((a, b) => (a.sira || 99) - (b.sira || 99) || b.puan - a.puan);
  return t.length ? t : null;
}

async function main() {
  let dosya = { maclar: [], puan: [] };
  try { dosya = JSON.parse(await readFile(OUT, 'utf8')); } catch (e) {}
  dosya.maclar = Array.isArray(dosya.maclar) ? dosya.maclar : [];
  const eski = JSON.stringify({ m: dosya.maclar, p: dosya.puan });

  const bugun = new Date(), dun = new Date(bugun - 864e5), yarin = new Date(+bugun + 864e5);
  const sb = await get(SITE + '/scoreboard?limit=100&dates=' + ymd(dun) + '-' + ymd(yarin));
  if (!sb || !Array.isArray(sb.events)) { console.log('Skor tablosu alınamadı; dosya değişmedi.'); return; }

  const kayit = new Map(dosya.maclar.map(m => [m.id, m]));
  let yeniBitenVar = false;

  for (const ev of sb.events) {
    const d = durumu(ev);
    if (d === 'once') continue;
    const a = anlik(ev);
    let k = kayit.get(a.id);

    if (d === 'devre' && !(k && k.devre)) {
      const o = await istatistik(a.id, a.evId, a.ev);
      k = Object.assign(k || {}, { id: a.id, tarih: a.tarih, ev: a.ev, dep: a.dep, durum: 'devre',
        evSkor: a.evSkor, depSkor: a.depSkor,
        devre: { skor: [a.evSkor, a.depSkor], olaylar: a.olaylar.length ? a.olaylar : o.olay, ist: o.ist, an: new Date().toISOString() } });
      kayit.set(a.id, k);
      console.log('Devre arası kaydedildi:', a.ev, a.evSkor + '-' + a.depSkor, a.dep);
    } else if (d === 'canli' && k && k.durum === 'devre') {
      k.durum = 'canli'; // ikinci yarı başladı; devre arası verisi saklı kalır
    } else if (d === 'bitti' && !(k && k.durum === 'bitti')) {
      const o = await istatistik(a.id, a.evId, a.ev);
      k = Object.assign(k || {}, { id: a.id, tarih: a.tarih, ev: a.ev, dep: a.dep, durum: 'bitti',
        evSkor: a.evSkor, depSkor: a.depSkor, olaylar: a.olaylar.length ? a.olaylar : o.olay, ist: o.ist });
      if (a.devreSkor && !(k.devre)) k.devre = { skor: a.devreSkor, olaylar: [], ist: {}, an: null };
      kayit.set(a.id, k);
      yeniBitenVar = true;
      console.log('Maç sonu kaydedildi:', a.ev, a.evSkor + '-' + a.depSkor, a.dep);
    }
  }

  dosya.maclar = [...kayit.values()].sort((x, y) => String(y.tarih).localeCompare(String(x.tarih))).slice(0, KEEP);
  if (yeniBitenVar || !dosya.puan || !dosya.puan.length) {
    const p = await puanDurumu();
    if (p) dosya.puan = p;
  }
  dosya.puan = dosya.puan || [];

  if (JSON.stringify({ m: dosya.maclar, p: dosya.puan }) === eski) { console.log('Yeni veri yok.'); return; }
  dosya.guncelleme = new Date().toISOString();
  dosya.kaynak = 'ESPN (resmî olmayan herkese açık uç noktalar)';
  await writeFile(OUT, JSON.stringify(dosya, null, 1) + '\n');
  console.log('superlig.json güncellendi:', dosya.maclar.length, 'maç,', dosya.puan.length, 'takım.');
}
main().catch(e => { console.error(e); process.exit(0); }); // hata iş akışını kırmasın, dosya bozulmasın
