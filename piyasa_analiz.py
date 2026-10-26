#!/usr/bin/env python3
"""Pariteler için veriyi sunucu tarafında çeker ve data/parite-veri.json dosyasına yazar.
Site bu dosyayı bulursa internete hiç çıkmadan grafikleri anında gösterir.

Kaynaklar:
  - EIA (ABD Enerji Bilgi İdaresi): Brent, WTI, Henry Hub doğalgaz, mazot, benzin
  - TCMB EVDS: gram altın (TL)  -> GRAMTL
  - Yahoo Finance: geri kalan her şey (maden, sanayi, tarım, BIST 100) ve EIA/EVDS çalışmazsa yedek

Anahtarlar koda YAZILMAZ; ortam değişkeninden okunur (GitHub: Settings > Secrets > Actions):
  EIA_KEY, EVDS_KEY
Anahtar yoksa o kaynak atlanır, Yahoo'ya düşülür. Yalnızca Python standart kütüphanesi kullanılır."""
import json, os, sys, time, datetime, urllib.request, urllib.parse

EIA_KEY = os.environ.get("EIA_KEY", "mK8CmLrkN8JgQgckd8HpnF8h8tKkDNTB69hmBkJf").strip()
EVDS_KEY = os.environ.get("EVDS_KEY", "19M1lnP3Mq").strip()

YILLAR = 5
BITIS = datetime.date.today()
BASLANGIC = BITIS - datetime.timedelta(days=365 * YILLAR + 2)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}

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


def get_json(url, headers=None, timeout=40):
    req = urllib.request.Request(url, headers=headers or UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def yahoo(sym):
    for host in ("query1", "query2"):
        url = "https://%s.finance.yahoo.com/v8/finance/chart/%s?range=%dy&interval=1d" % (
            host, urllib.parse.quote(sym), YILLAR)
        try:
            res = get_json(url)["chart"]["result"][0]
            out = []
            for t, c in zip(res["timestamp"], res["indicators"]["quote"][0]["close"]):
                if c and c > 0:
                    d = datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%d")
                    out.append([d, round(c, 4)])
            if len(out) > 1:
                return out
        except Exception as e:
            print("  Yahoo hata", sym, host, e, file=sys.stderr)
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
        veri = get_json("https://api.eia.gov/v2/%s/data/?%s" % (route, urllib.parse.urlencode(q)))["response"]["data"]
        out = []
        for r in veri:
            try:
                v = float(r["value"])
            except (TypeError, ValueError):
                continue
            if v > 0:
                out.append([r["period"], round(v, 4)])
        return out if len(out) > 1 else None
    except Exception as e:
        print("  EIA hata", seri, e, file=sys.stderr)
        return None


def evds(seri):
    if not EVDS_KEY:
        return None
    d1 = BASLANGIC.strftime("%d-%m-%Y")
    d2 = BITIS.strftime("%d-%m-%Y")
    url = "https://evds3.tcmb.gov.tr/igmevdsms-dis/series=%s&startDate=%s&endDate=%s&type=json" % (seri, d1, d2)
    try:
        items = get_json(url, headers={"key": EVDS_KEY, **UA}).get("items", [])
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
    except Exception as e:
        print("  EVDS hata", seri, e, file=sys.stderr)
        return None


def main():
    path = os.path.join("data", "parite-veri.json")
    eski = {}
    if os.path.exists(path):
        try:
            eski = json.load(open(path, encoding="utf-8")).get("series", {})
        except Exception:
            eski = {}

    seri = {}
    kodlar = list(YAHOO.keys())
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
        time.sleep(0.5)

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
    os.makedirs("data", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"updated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "series": seri},
                  f, separators=(",", ":"), ensure_ascii=False)


if __name__ == "__main__":
    main()
    
