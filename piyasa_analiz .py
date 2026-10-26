#!/usr/bin/env python3
"""Pariteler için veriyi sunucu tarafında çeker ve data/parite-veri.json dosyasına yazar.
Site bu dosyayı bulursa internete hiç çıkmadan grafikleri anında gösterir.

Kaynaklar:
  - EIA (ABD Enerji Bilgi İdaresi): Brent, WTI, Henry Hub doğalgaz, mazot, benzin
  - TCMB EVDS: gram altın (TL)  -> GRAMTL
  - Yahoo Finance: geri kalan her şey (maden, sanayi, tarım, BIST 100) ve EIA/EVDS çalışmazsa yedek

Anahtarlar koda YAZILMAZ; ortam değişkeninden okunur (GitHub: Settings > Secrets > Actions):
  EIA_KEY, EVDS_KEY
Anahtar yoksa o kaynak atlanır, Yahoo'ya düşülür. Yalnızca Python standart kütüphanesi kullanılır.

Dayanıklılık:
  - Geçici hatalarda (429, 5xx, zaman aşımı, JSON olmayan yanıt) artan bekleme ile yeniden dener.
  - Veri alınamayan seri için eski dosyadaki veri korunur; hiç verisi olmayan seriler
    sıranın başına alınır ki sınırlı süre bütçesinde önce onlar denensin.
  - Bitişte alınamayan serileri GitHub Actions uyarısı olarak yazar.
"""
import json, os, sys, time, random, datetime
import http.cookiejar
import urllib.request, urllib.parse, urllib.error

EIA_KEY = os.environ.get("EIA_KEY", "").strip()
EVDS_KEY = os.environ.get("EVDS_KEY", "").strip()

YILLAR = 5
BITIS = datetime.date.today()
BASLANGIC = BITIS - datetime.timedelta(days=365 * YILLAR + 2)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "application/json,text/plain,*/*", "Accept-Language": "en-US,en;q=0.9"}

# Tüm çalışma için süre bütçesi (sn). Aşılınca yeni istek denenmez, eski veri korunur.
BUTCE_SN = int(os.environ.get("PARITE_BUTCE_SN", "1200"))
T0 = time.time()

# kod -> Yahoo sembolü (index.html içindeki ASSETS ile aynı)
YAHOO = {
    "XAU": "GC=F", "XAG": "SI=F", "XPT": "PL=F", "XPD": "PA=F",
    "BRENT": "BZ=F", "WTI": "CL=F", "NG": "NG=F", "TTF": "TTF=F", "HO": "HO=F", "RB": "RB=F",
    "XCU": "HG=F", "ALU": "ALI=F", "REMX": "REMX", "LIT": "LIT", "URA": "URA",
    "WHEAT": "ZW=F", "CORN": "ZC=F", "SOY": "ZS=F", "COFFEE": "KC=F", "SUGAR": "SB=F",
    "COTTON": "CT=F", "COCOA": "CC=F",
    "BIST100": "XU100.IS",
}
# kod -> (EIA rotası, seri kodu)
EIA = {
    "BRENT": ("petroleum/pri/spt", "RBRTE"),
    "WTI": ("petroleum/pri/spt", "RWTC"),
    "NG": ("natural-gas/pri/fut", "RNGWHHD"),
    "HO": ("petroleum/pri/spt", "EER_EPD2F_PF4_Y35NY_DPG"),
    "RB": ("petroleum/pri/spt", "EER_EPMRU_PF4_Y35NY_DPG"),
}
# EVDS: gram altın (TL). İlk çalışan kod kullanılır.
EVDS_ALTIN = ["TP.MK.KUL.YTL"]

# Çerez tutan oturum: Yahoo, çerezsiz ve art arda gelen istekleri daha çabuk 429 ile reddeder.
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


class Hata(Exception):
    pass


def butce_bitti():
    return time.time() - T0 > BUTCE_SN


def istek(url, headers=None, deneme=3, timeout=25):
    """JSON döndürür. Geçici hatalarda artan beklemeyle yeniden dener, kalıcı hatada Hata fırlatır."""
    son = "bilinmiyor"
    for i in range(deneme):
        if butce_bitti():
            raise Hata("süre bütçesi bitti")
        bekle = min(45, 4 * 2 ** i) + random.random() * 2
        try:
            req = urllib.request.Request(url, headers=headers or UA)
            with OPENER.open(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            son = "HTTP %d" % e.code
            if e.code in (400, 401, 403, 404):  # yeniden denemek işe yaramaz
                raise Hata(son)
            ra = e.headers.get("Retry-After") if e.headers else None
            if ra and ra.isdigit():
                bekle = min(60, int(ra)) + random.random()
        except Exception as e:  # zaman aşımı, bağlantı kopması, JSON olmayan ("Too Many Requests") yanıt
            son = "%s %s" % (type(e).__name__, str(e)[:80])
        if i < deneme - 1:
            time.sleep(bekle)
    raise Hata(son)


def yahoo_isin():
    """Yahoo çerezi alır (404 döner ama çerez yerleşir). Başarısız olsa da devam edilir."""
    try:
        OPENER.open(urllib.request.Request("https://fc.yahoo.com", headers=UA), timeout=15).read()
    except urllib.error.HTTPError:
        pass
    except Exception as e:
        print("  Yahoo çerez alınamadı:", e, file=sys.stderr)


def yahoo(sym):
    son = "bilinmiyor"
    for host in ("query1", "query2"):
        url = "https://%s.finance.yahoo.com/v8/finance/chart/%s?range=%dy&interval=1d" % (
            host, urllib.parse.quote(sym), YILLAR)
        try:
            res = istek(url, deneme=3)["chart"]["result"][0]
            out = []
            for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]):
                if c and c > 0:
                    d = datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%d")
                    out.append([d, round(c, 4)])
            if len(out) > 1:
                return out
            son = "%s boş veri" % host
        except Hata as e:
            son = "%s %s" % (host, e)
        except (KeyError, IndexError, TypeError) as e:
            son = "%s beklenmeyen yanıt (%s)" % (host, type(e).__name__)
    print("  Yahoo başarısız %s: %s" % (sym, son), file=sys.stderr)
    return None


def eia(route, seri):
    if not EIA_KEY:
        return None
    q = {
        "api_key": EIA_KEY, "frequency": "daily", "data[0]": "value",
        "start": BASLANGIC.isoformat(), "end": BITIS.isoformat(),
        "facets[series][0]": seri,
        "sort[0][column]": "period", "sort[0][direction]": "asc", "length": "5000",
    }
    try:
        veri = istek("https://api.eia.gov/v2/%s/data/?%s" % (route, urllib.parse.urlencode(q)))["response"]["data"]
        out = []
        for r in veri:
            try:
                v = float(r["value"])
            except (TypeError, ValueError):
                continue
            if v > 0:
                out.append([r["period"], round(v, 4)])
        return out if len(out) > 1 else None
    except (Hata, KeyError, TypeError) as e:
        print("  EIA hata %s: %s" % (seri, e), file=sys.stderr)
        return None


def evds(seri):
    if not EVDS_KEY:
        return None
    d1 = BASLANGIC.strftime("%d-%m-%Y")
    d2 = BITIS.strftime("%d-%m-%Y")
    url = "https://evds3.tcmb.gov.tr/igmevdsms-dis/series=%s&startDate=%s&endDate=%s&type=json" % (seri, d1, d2)
    try:
        items = istek(url, headers={"key": EVDS_KEY, **UA}).get("items", [])
        out = []
        for it in items:
            kol = [k for k in it if k not in ("Tarih", "UNIXTIME")]
            if not kol:
                continue
            try:
                v = float(it[kol[0]])
            except (TypeError, ValueError):
                continue
            d = datetime.datetime.strptime(it["Tarih"], "%d-%m-%Y").strftime("%Y-%m-%d")
            if v > 0:
                out.append([d, round(v, 4)])
        return out if len(out) > 1 else None
    except (Hata, AttributeError, KeyError, ValueError) as e:
        print("  EVDS hata %s: %s" % (seri, e), file=sys.stderr)
        return None


def main():
    path = os.path.join("data", "parite-veri.json")
    eski = {}
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                eski = json.load(f).get("series", {})
        except Exception:
            eski = {}

    if not EIA_KEY:
        print("EIA_KEY yok: enerji serileri Yahoo'dan alınacak")
    if not EVDS_KEY:
        print("EVDS_KEY yok: GRAMTL atlanacak, site gram altını ons x kurdan hesaplayacak")

    yahoo_isin()

    seri = {}
    # Eski dosyada hiç verisi olmayan seriler önce denensin (sıra korunur, sadece öne alınır)
    kodlar = sorted(YAHOO.keys(), key=lambda k: k in eski)
    for kod in kodlar:
        s, kaynak = None, ""
        if kod in EIA:
            s = eia(*EIA[kod]); kaynak = "EIA"
        if not s:
            s = yahoo(YAHOO[kod]); kaynak = "Yahoo"
        if s:
            seri[kod] = s
            print("tamam", kod, kaynak, len(s))
        elif kod in eski:
            seri[kod] = eski[kod]
            print("eski veri korundu", kod)
        time.sleep(1.0 + random.random())

    # TCMB gram altın (TL)
    g = None
    for kod in EVDS_ALTIN:
        g = evds(kod)
        if g:
            print("tamam GRAMTL EVDS", kod, len(g))
            break
    if g:
        seri["GRAMTL"] = g
    elif "GRAMTL" in eski:
        seri["GRAMTL"] = eski["GRAMTL"]
        print("eski veri korundu GRAMTL")

    if not seri:
        sys.exit("hiç veri alınamadı")

    eksik = [k for k in YAHOO if k not in seri]
    if eksik:
        print("::warning::Veri alınamayan seriler (sitede 'veri alınamadı' görünür): " + ", ".join(eksik))
    print("özet: %d seri yazıldı, %d eksik, %d sn" % (len(seri), len(eksik), time.time() - T0))

    os.makedirs("data", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "series": seri},
                  f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
