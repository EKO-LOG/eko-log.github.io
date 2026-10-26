"""
EIA (ABD) enerji + TCMB EVDS altın -> analiz ve grafik
Google Colab'da çalışır. Önce:  !pip install requests pandas matplotlib
"""
import requests
import pandas as pd
import matplotlib.pyplot as plt

# ====== SADECE BU İKİ SATIRI DEĞİŞTİR ======
EIA_KEY = "mK8CmLrkN8JgQgckd8HpnF8h8tKkDNTB69hmBkJf"
EVDS_KEY = "19M1lnP3Mq"
# ===========================================

BASLANGIC = "2024-01-01"
BITIS = pd.Timestamp.today().strftime("%Y-%m-%d")

# Altın için sırayla denenecek EVDS seri kodları (ilk çalışan kullanılır)
ALTIN_ADAYLAR = ["TP.MK.KUL.YTL", "TP.MK.CUM.YTL"]
USD_SERI = "TP.DK.USD.A.YTL"


def eia_cek(route, seriler, ad_map):
    url = f"https://api.eia.gov/v2/{route}/data/"
    params = {
        "api_key": EIA_KEY.strip(),
        "frequency": "daily",
        "data[0]": "value",
        "start": BASLANGIC,
        "end": BITIS,
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "length": 5000,
    }
    for i, s in enumerate(seriler):
        params[f"facets[series][{i}]"] = s
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    veri = r.json()["response"]["data"]
    if not veri:
        raise ValueError("EIA boş veri döndü")
    df = pd.DataFrame(veri)
    df["period"] = pd.to_datetime(df["period"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.pivot_table(index="period", columns="series", values="value")
    return df.rename(columns=ad_map)


def evds_cek(seri, ad):
    d1 = pd.Timestamp(BASLANGIC).strftime("%d-%m-%Y")
    d2 = pd.Timestamp(BITIS).strftime("%d-%m-%Y")
    # Eski evds2 adresi kapandi; yeni adres evds3
    url = (
        "https://evds3.tcmb.gov.tr/igmevdsms-dis/"
        f"series={seri}&startDate={d1}&endDate={d2}&type=json"
    )
    r = requests.get(url, headers={"key": EVDS_KEY.strip()}, timeout=30)
    r.raise_for_status()
    try:
        veri = r.json()
    except ValueError:
        raise ValueError("EVDS JSON yerine HTML dondurdu (anahtar/adres sorunu)")
    items = veri.get("items", [])
    if not items:
        raise ValueError(f"{seri} icin veri yok")
    df = pd.DataFrame(items)
    kolonlar = [c for c in df.columns if c not in ("Tarih", "UNIXTIME")]
    if not kolonlar:
        raise ValueError(f"{seri} veri kolonu bulunamadi")
    kolon = kolonlar[0]
    df["Tarih"] = pd.to_datetime(df["Tarih"], format="%d-%m-%Y")
    df[kolon] = pd.to_numeric(df[kolon], errors="coerce")
    return df.set_index("Tarih")[[kolon]].rename(columns={kolon: ad})


def dene(ad, fonksiyon):
    """Bir kaynak hata verirse diğerlerini durdurma."""
    try:
        df = fonksiyon()
        print(f"[OK] {ad}: {len(df)} satır")
        return df
    except Exception as e:
        print(f"[HATA] {ad}: {e}")
        return None


# --- Veri çekme ---
parcalar = []

p = dene("Petrol (WTI, Brent)", lambda: eia_cek(
    "petroleum/pri/spt", ["RWTC", "RBRTE"], {"RWTC": "WTI", "RBRTE": "Brent"}))
if p is not None:
    parcalar.append(p)

g = dene("Henry Hub doğalgaz", lambda: eia_cek(
    "natural-gas/pri/fut", ["RNGWHHD"], {"RNGWHHD": "HenryHub"}))
if g is not None:
    parcalar.append(g)

altin = None
for kod in ALTIN_ADAYLAR:
    altin = dene(f"Altın ({kod})", lambda k=kod: evds_cek(k, "Altin_TL_gr"))
    if altin is not None:
        parcalar.append(altin)
        break

usd = dene("USD/TRY", lambda: evds_cek(USD_SERI, "USDTRY"))
if usd is not None:
    parcalar.append(usd)

if not parcalar:
    raise SystemExit("Hiç veri çekilemedi. Yukarıdaki [HATA] satırlarına bak.")

df = pd.concat(parcalar, axis=1).sort_index().ffill()

# Altını dolar cinsine çevir (gram başına USD)
if "Altin_TL_gr" in df and "USDTRY" in df:
    df["Altin_USD_gr"] = df["Altin_TL_gr"] / df["USDTRY"]

df.to_csv("piyasa_verisi.csv")

# --- Analiz ---
print("\nSon değerler:\n", df.tail().round(2))
getiri = df.pct_change().dropna(how="all")
print("\nKorelasyon (günlük getiri):\n", getiri.corr().round(2))
print("\nDönem getirisi (%):\n",
      ((df.ffill().iloc[-1] / df.bfill().iloc[0] - 1) * 100).round(1))

# --- Grafik (olan veriye göre) ---
paneller = []
if {"WTI", "Brent"} & set(df.columns):
    paneller.append((["WTI", "Brent"], "Petrol (USD/varil) - EIA"))
if "HenryHub" in df:
    paneller.append((["HenryHub"], "Henry Hub Doğalgaz (USD/MMBtu) - EIA"))
if "Altin_TL_gr" in df:
    paneller.append((["Altin_TL_gr"], "Altın (TL/gr) - TCMB"))
if "Altin_USD_gr" in df:
    paneller.append((["Altin_USD_gr"], "Altın (USD/gr) - TCMB altın / USDTRY"))

fig, axes = plt.subplots(len(paneller), 1, figsize=(10, 3.2 * len(paneller)),
                         sharex=True, squeeze=False)
for ax, (kolonlar, baslik) in zip(axes[:, 0], paneller):
    mevcut = [k for k in kolonlar if k in df.columns]
    df[mevcut].plot(ax=ax, title=baslik)
    ax.grid(alpha=0.3)
plt.tight_layout()
plt.savefig("piyasa_grafik.png", dpi=150)
plt.show()
