import './lib/env.js';
import { app } from './app.js';
import { startLeagueClosingCron } from './leagues/cron.js';
import { catchUpPrices, startCatchUpCron } from './market/catch-up.js';
import { startPriceCron } from './market/scheduler.js';
import { startTufeCron } from './market/tufe-cron.js';
import { startPortfolioCron } from './portfolio/cron.js';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Fiyat çekme robotu (dakikada bir)
  startPriceCron();

  /*
    ⚠️ AÇILIŞTAKİ YAKALAMA İLE PERİYODİK OLAN AYRI İŞLER.

    Aşağıdaki `catchUpPrices()` çağrısı 30 gün geriye bakıyor: sunucu
    ne kadar kapalı kaldı bilmiyoruz. Bu ise saatte bir, yalnızca 6
    saat geriye bakıyor — geçmiş zaten dolduruldu, sorulan tek soru
    "son bir saatte delik açıldı mı?".

    Ölçüldü: geniş pencere 322 ms, dar pencere 2,3 ms. Saatlik çağrıda
    geniş pencereyi kullanmak, hiç değişmeyecek bir geçmiş için her
    saat 322 ms ödemek olurdu.
  */
  startCatchUpCron();

  /*
    AÇILIŞTA BİR KEZ: sunucu kapalıyken oluşan fiyat deliklerini doldur.

    ⚠️ `await` YOK — VE BU BİLEREK. Yakalama on kripto için Binance'e
    istek atıyor, saniyeler sürüyor. Beklesek sunucu o süre boyunca
    isteklere cevap veremezdi. Delikler geçmişte; birkaç saniye sonra
    dolmaları kimseyi etkilemiyor.

    ⚠️ Hata yutuluyor: Binance düşse bile sunucu açılmalı. Boşluk
    doldurulamazsa veri eksik kalır — kötü ama çalışmayan bir API'den iyi.
  */
  void catchUpPrices()
    .then((r) => {
      if (r.written > 0) {
        console.log(`[catch-up] ${r.written} satır dolduruldu`);
      }
      if (r.failed.length > 0) {
        console.warn(`[catch-up] ${r.failed.length} varlık başarısız`);
      }
    })
    .catch((e) => console.warn('[catch-up] çalışamadı:', e));
  // Aylık TÜFE çekme robotu (her ayın 3'ünde saat 10:05)
  startTufeCron();
  // Haftalık lig kapanış robotu (her Pazar 23:59:59)
  startLeagueClosingCron();
  // Günlük portföy özetleme robotu (her gün 23:55)
  startPortfolioCron();
});
