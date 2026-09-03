/**
 * market-hours.ts — ABD borsası seans takvimi.
 *
 * ⚠️ BU DOSYA NEDEN VAR — PROJENİN İLK "KAPALI" VARLIK SINIFI.
 *
 * Bugüne kadarki bütün varlıklar sürekli fiyatlanıyordu: kripto 7/24,
 * döviz ve maden ise günde bir kez ama forward-fill ile her an bir
 * fiyatı var. Hiçbiri "şu an işlem göremezsin" demiyordu.
 *
 * ABD hisseleri diyor. Seans günde 6,5 saat, haftada 5 gün:
 *
 *   251 işlem günü × 6,5 saat = 1.631 saat / yıl
 *   yılın toplamı            = 8.760 saat
 *   -> AÇIK OLDUĞU ORAN      = %18,6
 *
 * Yani hisseler yılın **%81,4'ünde kapalı.** Bu kural olmasaydı emirler
 * `MAX_PRICE_AGE_MS` (120 sn) yüzünden "fiyat bayat" diye reddedilirdi —
 * teknik olarak doğru, ama kullanıcıya yanlış şeyi söyleyen bir mesaj.
 *
 *   kripto -> "fiyat bayat" = CRON BOZULDU     -> bizim hatamız
 *   hisse  -> "fiyat bayat" = PİYASA KAPALI    -> normal, beklenen durum
 *
 * ⚠️ AĞ İSTEĞİ YOK — VE OLAMAZ. Bu fonksiyonlar emir transaction'ının
 * içinden çağrılıyor. `orders/repository.ts` şunu yazıyor: "Transaction
 * içinde AĞ İSTEĞİ YAPMA — satır kilidini tutarken beklersen o kullanıcının
 * bütün emirleri donar." Yahoo yanıtında seans bilgisi (`currentTradingPeriod`)
 * var ama onu kullanmak tam da bu yasağı çiğnemek olurdu. Takvim yerel.
 */

/** New York borsa saatinin resmi zaman dilimi. */
const NEW_YORK = 'America/New_York';

/**
 * Normal seans: 09:30 – 16:00 (New York yerel saati).
 *
 * ⚠️ ÖNCESİ/SONRASI SEANS (pre/post market) KAPSAM DIŞI. Yahoo bize
 * 08:00–13:30 ve 20:00–00:00 UTC pencerelerini de veriyor ama oralarda
 * işlem hacmi düşük, fiyat sıçramalı ve gerçek aracı kurumlar da çoğu
 * müşteriye kapatıyor. Dahil etseydik lig adaleti açısından ince bir
 * kapı açılırdı: az hacimli bir pencerede fiyat oynatmak kolaydır.
 */
const SESSION_OPEN_MINUTES = 9 * 60 + 30; // 09:30
const SESSION_CLOSE_MINUTES = 16 * 60; // 16:00

/**
 * ⚠️ SAAT DİLİMİ ELLE HESAPLANMIYOR — `Intl` KULLANILIYOR.
 *
 * "New York UTC-5'tir" diye sabit yazmak yaz saati (DST) yüzünden yılın
 * yarısında bir saat kaydırırdı. Ölçtüm: 26 Ağustos 2026 için Yahoo
 * `gmtoffset: -14400` (yani -4 saat, EDT) döndürüyor; kışın -18000 olacak.
 *
 * `Intl.DateTimeFormat` DST'yi işletim sisteminin zaman dilimi
 * veritabanından okuyor. Kendi tablomuzu tutsaydık ABD yaz saati
 * kurallarını değiştirdiğinde (tartışılıyor) sessizce yanlışa düşerdik.
 *
 * Biçimlendirici MODÜL DÜZEYİNDE bir kez kuruluyor: `formatToParts`
 * ucuz ama `new Intl.DateTimeFormat` pahalı. Her çağrıda kursaydık
 * `nextSessionOpen`'ın tarama döngüsü gözle görülür yavaşlardı.
 */
const nyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEW_YORK,
  // ⚠️ `hourCycle: 'h23'` ŞART. `hour12: false` bazı ICU sürümlerinde
  // gece yarısını "24" olarak veriyor — 24*60 = 1440 dakika, yani
  // "gece yarısı seans açık" gibi görünürdü.
  hourCycle: 'h23',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Haftanın günü sırası — `weekday: 'short'` bu kısaltmaları veriyor. */
const WEEKEND = new Set(['Sat', 'Sun']);

type NyClock = { weekday: string; minutes: number };

/** Verilen anın New York'taki gün adı ve gün içi dakikası. */
function nyClock(at: Date): NyClock {
  const parts = nyFormatter.formatToParts(at);

  let weekday = '';
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value;
    else if (part.type === 'hour') hour = Number(part.value);
    else if (part.type === 'minute') minute = Number(part.value);
  }

  return { weekday, minutes: hour * 60 + minute };
}

/**
 * Verilen anda ABD borsası normal seansta mı?
 *
 * ⚠️ RESMİ TATİLLERİ BİLMİYOR — VE BU BİLİNÇLİ BİR EKSİK.
 *
 * Yılda ~10 tatil var (Şükran Günü, 4 Temmuz, Memorial Day...) ve
 * bazılarının tarihi her yıl kayıyor. Elle liste tutmak her yıl
 * güncellenmesi gereken bir borç yaratırdı; güncellenmediği yıl kod
 * sessizce yanlış cevap verirdi.
 *
 * Tatilde ne oluyor: takvim "açık" der, ama yeni fiyat gelmediği için
 * emir bir üst katmanda bayatlık kuralına takılır ve yine reddedilir.
 * Yani KULLANICI YİNE İŞLEM YAPAMAZ — sadece gördüğü mesaj "piyasa
 * kapalı" yerine "fiyat eski" olur.
 *
 * Yanlış mesaj, yanlış davranıştan iyidir. Tatil takvimi eklenirse
 * (Faz 3) tek yapılacak şey bu fonksiyona bir tarih kümesi eklemek.
 */
export function isRegularSessionOpen(at: Date = new Date()): boolean {
  const { weekday, minutes } = nyClock(at);

  if (WEEKEND.has(weekday)) return false;

  // Alt sınır DAHİL, üst sınır HARİÇ: 16:00'da kapanış zilinin çaldığı
  // an artık işlem yok. `<=` yazsaydık kapanışta bir dakikalık bir
  // pencere açık kalırdı.
  return minutes >= SESSION_OPEN_MINUTES && minutes < SESSION_CLOSE_MINUTES;
}

/**
 * Bir sonraki seans açılışı.
 *
 * ⚠️ NEDEN TARAMA, NEDEN HESAP DEĞİL.
 *
 * "Bir sonraki iş günü 09:30 New York" ifadesini UTC'ye çevirmek, o
 * günün DST durumunu bilmeyi gerektiriyor — ve DST geçişi tam da hafta
 * sonuna denk geliyor. Yani "cuma 16:00'dan sonraki açılış" sorusunun
 * cevabı, geçiş haftasında elle hesapla bir saat kayardı.
 *
 * Tarama bu sorunu tamamen ortadan kaldırıyor: her adımda `Intl`'e
 * soruyoruz, DST kendiliğinden doğru çıkıyor.
 *
 * İki aşamalı: önce 5 dakikalık adımlarla kaba bul, sonra 1 dakikalık
 * adımlarla geri gelip tam açılış dakikasını yakala. Tek başına 1
 * dakikalık tarama en kötü durumda (cuma akşamı) 4.000+ adım demekti.
 *
 * ⚠️ SADECE HATA YOLUNDA ÇAĞRILIYOR — emir reddedilirken kullanıcıya
 * "ne zaman açılıyor" demek için. Sıcak yolda değil, maliyeti önemsiz.
 */
export function nextSessionOpen(at: Date = new Date()): Date | null {
  const COARSE_MS = 5 * 60 * 1000;
  // 8 gün pay: uzun tatil zinciri (Noel + yılbaşı) bile bu aralığa sığar.
  const limit = at.getTime() + 8 * 24 * 60 * 60 * 1000;

  let cursor = at.getTime();

  // Şu an açıksa "bir sonraki açılış" sorusu anlamsız — çağıran taraf
  // zaten kapalıyken soruyor. Yine de savunmacı davranıp bir sonraki
  // seansı arıyoruz: önce kapanışı geçelim.
  while (cursor < limit && isRegularSessionOpen(new Date(cursor))) {
    cursor += COARSE_MS;
  }

  while (cursor < limit) {
    cursor += COARSE_MS;

    if (isRegularSessionOpen(new Date(cursor))) {
      // Kaba adım açılışı 5 dakikaya kadar geç yakalamış olabilir.
      // Kapalı olana kadar geri gel, sonra bir dakika ileri: tam açılış.
      let fine = cursor;

      while (fine > at.getTime() && isRegularSessionOpen(new Date(fine - 60_000))) {
        fine -= 60_000;
      }

      return new Date(fine);
    }
  }

  return null;
}

/**
 * Kullanıcıya gösterilecek "ne zaman açılıyor" metni — TÜRKİYE saatiyle.
 *
 * ⚠️ NEW YORK SAATİ DEĞİL TÜRKİYE SAATİ YAZILIYOR. Kullanıcı Türkiye'de
 * ve saatini oraya göre ayarlayacak. "09:30 ET" demek ona bir çevrim
 * ödevi vermek olurdu — ve o çevrim DST yüzünden yılın içinde değişiyor,
 * yani kullanıcı yanlış hesaplardı.
 */
export function describeNextSessionOpen(at: Date = new Date()): string {
  const next = nextSessionOpen(at);

  if (next === null) return 'Piyasa kapalı.';

  const formatted = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(next);

  return `Piyasa kapalı. Açılış: ${formatted}`;
}

/**
 * Bu varlık ŞU AN işlem görebilir mi?
 *
 * ⚠️ KURAL ÜÇÜNCÜ KEZ YAZILMASIN DİYE BURAYA ALINDI.
 *
 * `market/router.ts` şunu yazıyordu:
 *
 *     tradable: asset.kind === "stock" ? isRegularSessionOpen() : true
 *
 * Aynı satırı portföy ucuna da yazmak gerekiyordu. İki kopya, bir gün
 * ayrışır: BIST eklendiğinde ya da kripto bakım moduna alındığında
 * biri güncellenir, öteki kalır — ve fark hiçbir yerde hata vermez,
 * yalnızca bir ekran "piyasa kapalı" derken öteki "15 sa" der.
 *
 * ⚠️ KRİPTO/DÖVİZ/MADEN NEDEN HEP `true`: kripto 7/24 açık; döviz ve
 * madende fiyat hafta sonu yayımlanmasa da son kur geçerli sayılıyor
 * (forward-fill, bkz. CLAUDE.md). Yalnızca borsanın SEANSI var.
 */
export function isTradableNow(kind: string, at: Date = new Date()): boolean {
  return kind === 'stock' ? isRegularSessionOpen(at) : true;
}
