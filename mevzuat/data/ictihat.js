/* İçtihat verisi — yeni karar eklemek için diziye bir nesne ekleyin.
   Şablon:
   {
     kanun: "2577",                 // kanun numarası (mevzuat sayfasındaki ile aynı olmalı)
     kanunAdi: "İdari Yargılama Usulü Kanunu",
     madde: "7",                    // ilgili madde numarası (isteğe bağlı)
     mahkeme: "Danıştay",           // Danıştay, Yargıtay, Anayasa Mahkemesi, İdare Mahkemesi...
     daire: "10. Daire",
     esas: "2020/1234",
     karar: "2021/5678",
     tarih: "2021-03-15",           // YYYY-AA-GG
     ozet: "Kararın kısa özeti, kendi cümlelerinizle.",
     link: "https://..."            // resmî kaynak bağlantısı (isteğe bağlı)
   }
*/
window.ICTIHAT = [
  {
    ornek: true,
    kanun: "2577",
    kanunAdi: "İdari Yargılama Usulü Kanunu",
    madde: "7",
    mahkeme: "Örnek Mahkeme",
    daire: "0. Daire",
    esas: "0000/000",
    karar: "0000/000",
    tarih: "2026-01-01",
    ozet: "Bu bir örnek kayıttır. Gerçek kararları eklediğinizde silin.",
    link: ""
  }
];
