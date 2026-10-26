"""
EIA (ABD) enerji verileri + TCMB EVDS altın verisi -> analiz ve grafik

Kurulum:  pip install requests pandas matplotlib
API anahtarları:
  EIA  : https://www.eia.gov/opendata/  (ücretsiz)
  EVDS : https://evds2.tcmb.gov.tr/     (Profil -> API Anahtarı)
"""
import os
import requests
import pandas as pd
import matplotlib.pyplot as plt

EIA_KEY = os.getenv("EIA_API_KEY", "mK8CmLrkN8JgQgckd8HpnF8h8tKkDNTB69hmBkJf")
EVDS_KEY = os.getenv("EVDS_API_KEY", "19M1lnP3Mq")

BASLANGIC = "2024-01-01"
BITIS = pd.Timestamp.today().strftime("%Y-%m-%d")

# EVDS altın seri kodu: EVDS'de "Külçe Altın" araması yapıp kodu doğrula
ALTIN_SERI = "TP.MK.KUL.YTL"


def eia_cek(route, seriler, ad_map):
    """EIA API v2 günlük seri çeker."""
    url = f"https://api.eia.gov/v2/{route}/data/"
    params = {
        "api_key": EIA_KEY,
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
    df = pd.DataFrame(r.json()["response"]["data"])
    df["period"] = pd.to_datetime(df["period"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.pivot_table(index="period", columns="series", values="value")
    return df.rename(columns=ad_map)


def evds_cek(seri, bas, bit):
    """TCMB EVDS günlük seri çeker (anahtar header ile gönderilir)."""
    d1 = pd.Timestamp(bas).strftime("%d-%m-%Y")
    d2 = pd.Timestamp(bit).strftime("%d-%m-%Y")
    url = (
        "https://evds2.tcmb.gov.tr/service/evds/"
        f"series={seri}&startDate={d1}&endDate={d2}&type=json"
    )
    r = requests.get(url, headers={"key": EVDS_KEY}, timeout=30)
    r.raise_for_status()
    df = pd.DataFrame(r.json()["items"])
    df["Tarih"] = pd.to_datetime(df["Tarih"], format="%d-%m-%Y")
    kolon = seri.replace(".", "_")
    df[kolon] = pd.to_numeric(df[kolon], errors="coerce")
    return df.set_index("Tarih")[[kolon]].rename(columns={kolon: "Altin_TL_gr"})


# --- Veri çekme ---
petrol = eia_cek(
    "petroleum/pri/spt", ["RWTC", "RBRTE"],
    {"RWTC": "WTI", "RBRTE": "Brent"},
)
gaz = eia_cek(
    "natural-gas/pri/fut", ["RNGWHHD"],
    {"RNGWHHD": "HenryHub"},
)
altin = evds_cek(ALTIN_SERI, BASLANGIC, BITIS)

df = petrol.join(gaz, how="outer").join(altin, how="outer").sort_index().ffill()
df.to_csv("piyasa_verisi.csv")

# --- Analiz ---
getiri = df.pct_change().dropna(how="all")
print("Son değerler:\n", df.tail(), "\n")
print("Korelasyon (günlük getiri):\n", getiri.corr().round(2), "\n")
print("Dönem getirisi (%):\n", ((df.iloc[-1] / df.iloc[0] - 1) * 100).round(1))

# --- Grafikler ---
fig, ax = plt.subplots(3, 1, figsize=(10, 11), sharex=True)

df[["WTI", "Brent"]].plot(ax=ax[0], title="Petrol (USD/varil) - EIA")
df["HenryHub"].plot(ax=ax[1], color="tab:green", title="Henry Hub Doğalgaz (USD/MMBtu) - EIA")
df["Altin_TL_gr"].plot(ax=ax[2], color="goldenrod", title="Altın (TL/gr) - TCMB")

for a in ax:
    a.grid(alpha=0.3)
plt.tight_layout()
plt.savefig("piyasa_grafik.png", dpi=150)
plt.show()
