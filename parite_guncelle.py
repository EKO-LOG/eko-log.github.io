#!/usr/bin/env python3
"""data/parite-veri.json üretir. Site şu şemayı okur:
{"updated": ISO-zaman, "series": {"XAU": [["2026-10-30", 4012.3], ...], "GRAMTL": [...]}}
Değerler ham olmalı (sitedeki 'k' çarpanı tarayıcıda uygulanır)."""
import json, os, sys, time, datetime as dt, urllib.request, urllib.parse

try:
    from curl_cffi import requests as cr
except Exception:
    cr = None

OUT = "data/parite-veri.json"
YIL = 6                       # 5 yıllık grafik için ~6 yıl geriye
BUGUN = dt.datetime.now(dt.timezone.utc)
T0 = int((BUGUN - dt.timedelta(days=365 * YIL)).timestamp())
T1 = int(BUGUN.timestamp()) + 86400

YAHOO = {
 "XAU":"GC=F","XAG":"SI=F","XPT":"PL=F","XPD":"PA=F","BIST100":"XU100.IS",
 "BRENT":"BZ=F","WTI":"CL=F","NG":"NG=F","TTF":"TTF=F","HO":"HO=F","RB":"RB=F",
 "XCU":"HG=F","ALU":"ALI=F","REMX":"REMX","LIT":"LIT","URA":"URA",
 "WHEAT":"ZW=F","CORN":"ZC=F","SOY":"ZS=F","COFFEE":"KC=F","SUGAR":"SB=F",
 "COTTON":"CT=F","COCOA":"CC=F",
 "BTC":"BTC-USD","ETH":"ETH-USD","BNB":"BNB-USD","SOL":"SOL-USD",
 "XRP":"XRP-USD","ADA":"ADA-USD","DOGE":"DOGE-USD",
}
BINANCE = {k: k + "USDT" for k in ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE"]}
EIA = {"BRENT":("petroleum/pri/spt","RBRTE"),"WTI":("petroleum/pri/spt","RWTC"),
       "NG":("natural-gas/pri/fut","RNGWHHD")}

def log(*a): print(*a, flush=True)

def get(url, headers=None, timeout=25):
    h = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
         "Accept": "application/json,text/plain,*/*"}
    h.update(headers or {})
    if cr is not None:
        r = cr.get(url, headers=h, timeout=timeout, impersonate="chrome")
        if r.status_code != 200:
            raise RuntimeError(f"http{r.status_code}")
        return r.text
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def tarih(ts): return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d")

def yahoo(sym):
    son = None
    for host in ("query1", "query2"):
        for deneme in range(3):
            try:
                u = (f"https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}"
                     f"?period1={T0}&period2={T1}&interval=1d&includePrePost=false")
                r = json.loads(get(u))["chart"]["result"][0]
                kapanis = r["indicators"]["quote"][0]["close"]
                s = {}
                for t, c in zip(r["timestamp"], kapanis):
                    if c and c > 0: s[tarih(t)] = round(float(c), 6)
                if len(s) > 10: return sorted(s.items())
                raise RuntimeError("bos")
            except Exception as e:
                son = e; time.sleep(2 + deneme * 3)
    raise son

def binance(sym):
    son = None
    # api.binance.com ABD (GitHub) IP'lerini 451 ile reddeder; data-api.binance.vision çalışır
    for host in ("https://data-api.binance.vision", "https://api.binance.com"):
        try:
            out, bas = {}, T0 * 1000
            while True:
                j = json.loads(get(f"{host}/api/v3/klines?symbol={sym}&interval=1d&startTime={bas}&limit=1000"))
                if not j: break
                for k in j:
                    if float(k[4]) > 0: out[tarih(k[0] // 1000)] = float(k[4])
                bas = j[-1][0] + 86400000
                if len(j) < 1000: break
            if len(out) > 10: return sorted(out.items())
        except Exception as e:
            son = e
    raise son or RuntimeError("bos")

def eia(kod):
    key = os.environ.get("EIA_KEY", "").strip()
    if not key: raise RuntimeError("EIA_KEY yok")
    yol, seri = EIA[kod]
    q = urllib.parse.urlencode({"api_key": key, "frequency": "daily", "data[0]": "value",
        "start": tarih(T0), "end": tarih(T1), "facets[series][0]": seri,
        "sort[0][column]": "period", "sort[0][direction]": "asc", "length": "5000"})
    d = json.loads(get(f"https://api.eia.gov/v2/{yol}/data/?{q}"))["response"]["data"]
    s = [(r["period"], float(r["value"])) for r in d if r.get("value") not in (None, "") and float(r["value"]) > 0]
    if len(s) < 10: raise RuntimeError("bos")
    return s

def gram_tl():
    key = os.environ.get("EVDS_KEY", "").strip()
    if not key: raise RuntimeError("EVDS_KEY yok")
    bas = dt.datetime.fromtimestamp(T0, dt.timezone.utc).strftime("%d-%m-%Y")
    bit = BUGUN.strftime("%d-%m-%Y")
    # TP.MK.KUL.YTL = TCMB gram altın (TL/gr)
    for ana in ("https://evds2.tcmb.gov.tr/service/evds/", "https://evds3.tcmb.gov.tr/igmevdsms-dis/"):
        try:
            u = (f"{ana}series=TP.MK.KUL.YTL&startDate={bas}&endDate={bit}&type=json")
            d = json.loads(get(u, headers={"key": key}))["items"]
            s = []
            for r in d:
                v = r.get("TP_MK_KUL_YTL")
                if v in (None, ""): continue
                g, a, y = r["Tarih"].split("-")
                s.append((f"{y}-{a}-{g}", float(v)))
            if len(s) > 10: return sorted(s)
        except Exception as e:
            log("  EVDS", ana, "->", e)
    raise RuntimeError("EVDS basarisiz")

def mevcut():
    try:
        with open(OUT, encoding="utf-8") as f: return json.load(f).get("series", {})
    except Exception: return {}

def birlestir(eski, yeni):
    d = {p[0]: p[1] for p in (eski or [])}
    d.update({p[0]: p[1] for p in yeni})
    return [[k, d[k]] for k in sorted(d)]

def main():
    os.makedirs("data", exist_ok=True)
    seri = mevcut()
    basarili, hata = [], []
    kodlar = list(YAHOO)
    for i, kod in enumerate(kodlar):
        kaynaklar = []
        if kod in BINANCE: kaynaklar.append(("binance", lambda k=kod: binance(BINANCE[k])))
        if kod in EIA:     kaynaklar.append(("eia", lambda k=kod: eia(k)))
        kaynaklar.append(("yahoo", lambda k=kod: yahoo(YAHOO[k])))
        ok = False
        for ad, fn in kaynaklar:
            try:
                s = fn()
                seri[kod] = birlestir(seri.get(kod), s)
                basarili.append(kod); ok = True
                log(f"OK   {kod:7s} {ad:8s} {len(s)} nokta, son={s[-1]}")
                break
            except Exception as e:
                log(f"HATA {kod:7s} {ad:8s} {e}")
        if not ok: hata.append(kod)
        time.sleep(0.7)   # Yahoo hız sınırına takılmamak için
    try:
        s = gram_tl(); seri["GRAMTL"] = birlestir(seri.get("GRAMTL"), s)
        basarili.append("GRAMTL"); log("OK   GRAMTL", s[-1])
    except Exception as e:
        log("UYARI GRAMTL:", e)

    # Dosyayı sadece en az yarı seri yenilendiyse 'güncel' işaretle
    if len(basarili) < max(5, len(kodlar) // 2):
        log(f"::error::Yeterli seri alınamadı ({len(basarili)}/{len(kodlar)}). Hatalılar: {hata}")
        sys.exit(1)
    # çok eski noktaları buda (dosya şişmesin)
    kes = tarih(T0)
    seri = {k: [p for p in v if p[0] >= kes] for k, v in seri.items()}
    paket = {"updated": BUGUN.strftime("%Y-%m-%dT%H:%M:%SZ"), "series": seri}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(paket, f, ensure_ascii=False, separators=(",", ":"))
    log(f"Yazıldı: {OUT} | başarılı {len(basarili)} | hatalı: {hata}")
    if hata: log("::warning::Şu seriler yenilenemedi, eski veri korundu:", ",".join(hata))

if __name__ == "__main__":
    main()
