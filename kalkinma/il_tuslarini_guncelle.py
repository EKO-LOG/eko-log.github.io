#!/usr/bin/env python3
"""kalkinma/ klasöründeki tüm il-*.html dosyalarında Fikir Muharebesi tuşunu
ilin kendi Kalkınma sekmesine yönlendirir:
  ../index.html#/fikir   ->   ../index.html#/fikir-kalkinma/<il>
Kullanım: python3 il_tuslarini_guncelle.py [klasör]   (klasör verilmezse bulunduğun klasör)
Tekrar çalıştırmak güvenlidir; yedek olarak *.bak kopyası bırakır."""
import re, sys, glob, os, shutil
klasor = sys.argv[1] if len(sys.argv) > 1 else '.'
n = 0
for yol in sorted(glob.glob(os.path.join(klasor, 'il-*.html'))):
    ad = os.path.basename(yol)
    slug = re.sub(r'^il-|\.html$', '', ad)
    s = open(yol, encoding='utf-8').read()
    yeni = s.replace('href="../index.html#/fikir"', 'href="../index.html#/fikir-kalkinma/%s"' % slug)
    if yeni != s:
        shutil.copyfile(yol, yol + '.bak')
        open(yol, 'w', encoding='utf-8').write(yeni)
        n += 1
        print('güncellendi:', ad)
print('Toplam güncellenen dosya:', n)
