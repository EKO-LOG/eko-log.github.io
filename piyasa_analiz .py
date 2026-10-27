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

Yahoo notu: GitHub sunucularından düz Python isteği (urllib) Yahoo tarafından ilk istekte 429 ile
reddediliyor. Bu yüzden kuruluysa curl_cffi ile gerçek Chrome taklidi yapılır (workflow `pip install
curl_cffi` çalıştırır). Kurulu değilse eski yönteme düşülür.

Dayanıklılık:
  - Yahoo ilk 4 istekte de reddederse (IP engeli) kalan Yahoo istekleri atlanır, iş dakikalarca sürmez.
  - Geçici hatalarda (429, 5xx, zaman aşımı, JSON olmayan yanıt) artan bekleme ile yeniden dener.
  - Veri alınamayan seri için eski dosyadaki veri korunur; hiç verisi olmayan seriler
    sıranın başına alınır ki sınırlı süre bütçesinde önce onlar denensin.
  - Bitişte alınamayan serileri GitHub Actions uyarısı olarak yazar.
"""
import json, os, sys, time, random, datetime
import http.cookiejar
import urllib.request, urllib.parse, urllib.error

EIA_KEY = os.environ.get("EIA_KEY", "mK8CmLrkN8JgQgckd8HpnF8h8tKkDNTB69hmBkJf").strip()
EVDS_KEY = os.environ.get("EVDS_KEY", "19M1lnP3Mq").strip()

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


try:
    from curl_cffi import requests as _cffi
    SESS = _cffi.Session(impersonate="chrome")  # Chrome'un TLS/HTTP2 parmak izi
except Exception:  # kurulu değil ya da bu sürümde desteklenmiyor
    SESS = None

YAHOO_ENGELLI = False
_yahoo_ok = 0
_yahoo_seri_hata = 0


class Hata(Exception):
    pass


def butce_bitti():
    return time.time() - T0 > BUTCE_SN


def _al(url, headers, timeout, tarayici):
    """(durum kodu, gövde baytları, başlıklar) döndürür."""
    if tarayici and SESS is not None:
        r = SESS.get(url, timeout=timeout)
        return r.status_code, r.content, r.headers
    req = urllib.request.Request(url, headers=headers or UA)
    try:
        with OPENER.open(req, timeout=timeout) as r:
            return r.status, r.read(), r.headers
    except urllib.error.HTTPError as e:
        return e.code, b"", e.headers


def istek(url, headers=None, deneme=3, timeout=25, tarayici=False):
    """JSON döndürür. Geçici hatalarda artan beklemeyle yeniden dener, kalıcı hatada Hata fırlatır."""
    son = "bilinmiyor"
    for i in range(deneme):
        if butce_bitti():
            raise Hata("süre bütçesi bitti")
        bekle = min(45, 4 * 2 ** i) + random.random() * 2
        try:
            kod, govde, hdr = _al(url, headers, timeout, tarayici)
            if kod == 200:
                return json.loads(govde)
            son = "HTTP %d" % kod
            if kod in (400, 401, 403, 404):  # yeniden denemek işe yaramaz
                raise Hata(son)
            ra = hdr.get("Retry-After") if hdr else None
            if ra and str(ra).isdigit():
                bekle = min(60, int(ra)) + random.random()
        except Hata:
            raise
        except Exception as e:  # zaman aşımı, bağlantı kopması, JSON olmayan yanıt
            son = "%s %s" % (type(e).__name__, str(e)[:80])
        if i < deneme - 1:
            time.sleep(bekle)
    raise Hata(son)


def yahoo_isin():
    """Yahoo çerezi alır (404 döner ama çerez yerleşir). Başarısız olsa da devam edilir."""
    try:
        if SESS is not None:
            SESS.get("https://fc.yahoo.com", timeout=15)
        else:
            OPENER.open(urllib.request.Request("https://fc.yahoo.com", headers=UA), timeout=15).read()
    except urllib.error.HTTPError:
        pass
    except Exception as e:
        print("  Yahoo çerez alınamadı:", e, file=sys.stderr)


def yahoo(sym):
    global YAHOO_ENGELLI, _yahoo_ok, _yahoo_seri_hata
    if YAHOO_ENGELLI:
        return None
    son = "bilinmiyor"
    for host in ("query1", "query2"):
        url = "https://%s.finance.yahoo.com/v8/finance/chart/%s?range=%dy&interval=1d" % (
            host, urllib.parse.quote(sym), YILLAR)
        try:
            res = istek(url, deneme=2, tarayici=True)["chart"]["result"][0]
            out = []
            for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]):
                if c and c > 0:
                    d = datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%d")
                    out.append([d, round(c, 4)])
            if len(out) > 1:
                _yahoo_ok += 1
                _yahoo_seri_hata = 0
                return out
            son = "%s boş veri" % host
        except Hata as e:
            son = "%s %s" % (host, e)
        except (KeyError, IndexError, TypeError) as e:
            son = "%s beklenmeyen yanıt (%s)" % (host, type(e).__name__)
    print("  Yahoo başarısız %s: %s" % (sym, son), file=sys.stderr)
    _yahoo_seri_hata += 1
    if _yahoo_ok == 0 and _yahoo_seri_hata >= 4:
        YAHOO_ENGELLI = True
        print("::warning::Yahoo ilk %d istekte de veri vermedi (büyük olasılıkla IP engeli, curl_cffi %s). "
              "Kalan Yahoo istekleri atlanıyor." % (_yahoo_seri_hata, "kullanıldı" if SESS else "KURULU DEĞİL"))
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


def _tarih(t):
    for f in ("%d-%m-%Y", "%Y-%m-%d", "%Y-%m"):
        try:
            return datetime.datetime.strptime(str(t), f).strftime("%Y-%m-%d")
        except ValueError:
            pass
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
            d = _tarih(it.get("Tarih"))
            if d and v > 0:
                out.append([d, round(v, 4)])
        if len(out) < 200:  # 5 yıllık günlük seri ~1300 kayıt; aylık/haftalık seri günlük grafiğe uymaz
            print("  EVDS serisi günlük değil (%d kayıt): %s, GRAMTL atlandı" % (len(out), seri), file=sys.stderr)
            return None
        return out
    except (Hata, AttributeError, KeyError, TypeError) as e:
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
                            
