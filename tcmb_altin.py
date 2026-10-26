"""
TCMB EVDS'den altın fiyatı verisi çeker ve CSV olarak kaydeder.

Kullanım:
    1) EVDS'den API anahtarınızı alın (evds2.tcmb.gov.tr -> Profil -> API Anahtarı)
    2) Anahtarı ortam değişkeni olarak tanımlayın:
         Windows (PowerShell):  $env:EVDS_API_KEY="anahtariniz"
         Mac/Linux:             export EVDS_API_KEY="anahtariniz"
       veya aşağıdaki API_KEY satırına doğrudan yazın.
    3) python tcmb_altin.py

Gerekli paketler:
    pip install requests pandas
"""

import os
import sys
from datetime import date

import pandas as pd
import requests

# --- Ayarlar -----------------------------------------------------------
API_KEY = os.getenv("EVDS_API_KEY", "ANAHTARINIZ")

# Altın serisi kodu. EVDS'de seri sayfasından doğrulayın;
# farklı bir seri kullanacaksanız sadece burayı değiştirmeniz yeterli.
SERI_KODU = "TP.MK.KUL.YTL"

BASLANGIC = "01-01-2025"                      # GG-AA-YYYY
BITIS = date.today().strftime("%d-%m-%Y")     # bugün
CIKTI_DOSYASI = "tcmb_altin.csv"
# -----------------------------------------------------------------------

BASE_URL = "https://evds2.tcmb.gov.tr/service/evds/"


def altin_verisi_cek() -> pd.DataFrame:
    if API_KEY == "ANAHTARINIZ":
        sys.exit("Lütfen EVDS API anahtarınızı girin (EVDS_API_KEY).")

    url = (
        f"{BASE_URL}series={SERI_KODU}"
        f"&startDate={BASLANGIC}&endDate={BITIS}&type=json"
    )
    r = requests.get(url, headers={"key": API_KEY}, timeout=30)
    r.raise_for_status()

    items = r.json().get("items", [])
    if not items:
        sys.exit("Veri dönmedi. Seri kodunu ve tarih aralığını kontrol edin.")

    df = pd.DataFrame(items)
    df["Tarih"] = pd.to_datetime(df["Tarih"], format="%d-%m-%Y")

    # EVDS seri kodundaki noktaları alt çizgiye çevirerek sütun adı verir
    kolon = SERI_KODU.replace(".", "_")
    df = df[["Tarih", kolon]].rename(columns={kolon: "Altin_TL"})
    df["Altin_TL"] = pd.to_numeric(df["Altin_TL"], errors="coerce")
    return df.dropna().sort_values("Tarih").reset_index(drop=True)


if __name__ == "__main__":
    veri = altin_verisi_cek()
    veri.to_csv(CIKTI_DOSYASI, index=False, encoding="utf-8-sig")
    print(veri.tail())
    print(f"\n{len(veri)} satır '{CIKTI_DOSYASI}' dosyasına kaydedildi.")
