/* Cevapsız soru kaydı için Cloudflare Worker örneği — mevcut worker.js'ine EKLE (yeni dosya şart değil).
   1) KV oluştur:   npx wrangler kv namespace create CEVAPSIZ     → çıkan id'yi wrangler.jsonc'e bağla:
        "kv_namespaces": [{ "binding": "CEVAPSIZ", "id": "BURAYA_ID" }]
   2) Yönetici anahtarı:   npx wrangler secret put YONETICI_ANAHTAR
   3) Sayfada:   window.EKO_BOT = { kayit: { url: 'https://SENIN-WORKER.workers.dev/kayit' } }
   Listeyi görmek için:   https://SENIN-WORKER.workers.dev/kayit?anahtar=YONETICI_ANAHTAR
   Kayıtlar 90 gün sonra kendiliğinden silinir. Bot zaten kişisel bilgiyi maskeler ve kriz cümlelerini göndermez. */
export async function cevapsizKayit(request, env) {
  const url = new URL(request.url);
  if (request.method === 'POST') {
    let g; try { g = JSON.parse(await request.text()); } catch { return new Response('', { status: 204 }); }
    const s = String(g.s || '').slice(0, 200).trim();
    if (s.length < 4) return new Response('', { status: 204 });
    const anahtar = 'q:' + new Date().toISOString() + ':' + Math.random().toString(36).slice(2, 7);
    await env.CEVAPSIZ.put(anahtar, JSON.stringify({ s, n: g.n, m: g.m, l: g.l, p: g.p, z: g.z }), { expirationTtl: 60 * 60 * 24 * 90 });
    return new Response('', { status: 204 });
  }
  if (request.method === 'GET' && url.searchParams.get('anahtar') === env.YONETICI_ANAHTAR) {
    const { keys } = await env.CEVAPSIZ.list({ prefix: 'q:', limit: 500 });
    const satirlar = await Promise.all(keys.map(k => env.CEVAPSIZ.get(k.name)));
    return new Response(satirlar.filter(Boolean).join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return new Response('Yok', { status: 404 });
}
/* worker.js içindeki fetch'e şu satırı ekle:
     if (new URL(request.url).pathname === '/kayit') return cevapsizKayit(request, env);
   (CORS gerekmez: bot sendBeacon ile düz metin gönderir; yanıtı okumaz.) */
