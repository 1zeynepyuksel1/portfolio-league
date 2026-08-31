import { describe, expect, it } from 'vitest';
import {
  detectConcentration,
  detectDispositionEffect,
  detectAveragingDown,
  detectFomoBuying,
  detectOvertrading,
  detectPanicSelling,
  detectWashTrades,
  WASH_WINDOW_MINUTES,
  type BehaviorPricedOrder,
  type BehaviorOrder,
} from './indicators.js';
import type { Amount, Penny } from '../lib/money.js';

/**
 * Ham kuruş değerini `Penny`'ye markalar.
 *
 * ⚠️ ÜRETİM KODUNDA BÖYLE BİR DÖNÜŞÜM YOK — ve olmamalı. `Penny` markalı
 * bir tip: parayı miktarla (`Amount`) ya da fiyatla (`Price`) karıştırmayı
 * DERLEME ANINDA engelliyor. Üretimde değerler `toPenny()` ya da
 * veritabanı sınırında markalanıyor.
 *
 * Testte doğrudan sayı yazmak istiyoruz (okunurluk için `feeCents: kurus(7_000n)`
 * demek `toPenny('70.00')` demekten çok daha açık), o yüzden markalama
 * burada elle yapılıyor. Bu dosya dışına çıkmamalı.
 */
const kurus = (n: bigint): Penny => n as unknown as Penny;

/** `kurus`'un miktar karşılığı — aynı gerekçe, aynı sınır. */
const adet = (n: bigint): Amount => n as unknown as Amount;

/**
 * Emir üretici — testler okunur kalsın diye.
 *
 * Varsayılanlar önemsiz alanları dolduruyor; her test yalnızca ilgilendiği
 * alanı yazıyor. Böylece testin NEYE baktığı bir bakışta görünüyor.
 */
function order(over: Partial<BehaviorOrder> & { id: string }): BehaviorOrder {
  return {
    symbol: 'BTC',
    side: 'buy',
    executedAt: new Date('2026-08-27T12:00:00Z'),
    priceTry: 100_00000000n,
    netCents: kurus(100_000n),
    feeCents: kurus(100n),
    quantity: adet(1_0000000000n),
    ...over,
  };
}

/** Dakika cinsinden kaydırılmış zaman — okunurluk için. */
function at(minutes: number): Date {
  return new Date(Date.parse('2026-08-27T12:00:00Z') + minutes * 60_000);
}

// ---------------------------------------------------------------------------
// 1. YIKAMA İŞLEMİ
// ---------------------------------------------------------------------------

describe('detectWashTrades', () => {
  it('sat → 3 dakika sonra geri al yakalanır', () => {
    /*
      Gerçek olay (27 Ağu 2026, tunajr): BNB 12:19'da satılmış,
      12:21'de geri alınmış. Test o senaryoyu birebir kuruyor.
    */
    const result = detectWashTrades([
      order({ id: 's1', symbol: 'BNB', side: 'sell', executedAt: at(0), feeCents: kurus(7_000n) }),
      order({ id: 'b1', symbol: 'BNB', side: 'buy', executedAt: at(3), feeCents: kurus(7_677n) }),
    ]);

    expect(result).not.toBeNull();
    expect(result!.facts.count).toBe(1);
    // İki emrin komisyonu toplanıyor: 7.000 + 7.677 = 14.677 kuruş = 146,77 ₺
    expect(result!.facts.feeCents).toBe('14677');
    expect(result!.orderIds).toEqual(['s1', 'b1']);
  });

  it('pencere dışında kalan geri alım yakalanmaz', () => {
    const result = detectWashTrades([
      order({ id: 's1', side: 'sell', executedAt: at(0) }),
      order({ id: 'b1', side: 'buy', executedAt: at(WASH_WINDOW_MINUTES + 1) }),
    ]);

    // Bir saat sonra fikir değiştirmek tereddüt değil, yeni bir karar.
    expect(result).toBeNull();
  });

  it('FARKLI varlık eşleşmez', () => {
    // BTC satıp ETH almak portföy değiştirmek; yıkama değil.
    const result = detectWashTrades([
      order({ id: 's1', symbol: 'BTC', side: 'sell', executedAt: at(0) }),
      order({ id: 'b1', symbol: 'ETH', side: 'buy', executedAt: at(2) }),
    ]);

    expect(result).toBeNull();
  });

  it('ters sıra (önce al, sonra sat) yıkama DEĞİLDİR', () => {
    /*
      ⚠️ YÖN ÖNEMLİ. Alıp kısa sürede satmak "zarar kes" ya da "kâr al" —
      meşru işlemler. Zararlı olan SATIP GERİ ALMAK: pozisyondan çıkıp
      hemen geri girmek, yani hiçbir şey değişmemiş olması.
    */
    const result = detectWashTrades([
      order({ id: 'b1', side: 'buy', executedAt: at(0) }),
      order({ id: 's1', side: 'sell', executedAt: at(2) }),
    ]);

    expect(result).toBeNull();
  });

  it('bir satış BİR alımla eşleşir, ikisiyle değil', () => {
    /*
      ⚠️ Bu olmasaydı tek bir tereddüt iki bulgu üretir ve komisyon
      toplamı şişerdi.
    */
    const result = detectWashTrades([
      order({ id: 's1', side: 'sell', executedAt: at(0), feeCents: kurus(100n) }),
      order({ id: 'b1', side: 'buy', executedAt: at(1), feeCents: kurus(100n) }),
      order({ id: 'b2', side: 'buy', executedAt: at(2), feeCents: kurus(100n) }),
    ]);

    expect(result!.facts.count).toBe(1);
    expect(result!.facts.feeCents).toBe('200');
  });

  it('sırasız gelen liste de doğru çalışır', () => {
    // Sorgu sıralı dönüyor ama fonksiyon buna GÜVENMEMELİ.
    const result = detectWashTrades([
      order({ id: 'b1', side: 'buy', executedAt: at(3) }),
      order({ id: 's1', side: 'sell', executedAt: at(0) }),
    ]);

    expect(result!.facts.count).toBe(1);
  });

  it('temiz geçmişte bulgu yok', () => {
    expect(detectWashTrades([order({ id: 'b1' })])).toBeNull();
    expect(detectWashTrades([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. AŞIRI İŞLEM
// ---------------------------------------------------------------------------

describe('detectOvertrading', () => {
  const CAPITAL = kurus(10_000_000n); // 100.000 ₺

  it('sermayenin binde 5’ini komisyona verince yakalanır', () => {
    // 10.000.000 × 5/1000 = 50.000 kuruş = 500 ₺
    const orders = Array.from({ length: 10 }, (_u, i) =>
      order({ id: `o${i}`, feeCents: kurus(5_000n) }),
    );

    const result = detectOvertrading(orders, CAPITAL);

    expect(result).not.toBeNull();
    expect(result!.facts.feeCents).toBe('50000');
    expect(result!.facts.feeRatioBps).toBe('50');
    expect(result!.facts.orderCount).toBe(10);
  });

  it('eşiğin ALTINDA bulgu yok', () => {
    const orders = Array.from({ length: 10 }, (_u, i) =>
      order({ id: `o${i}`, feeCents: kurus(4_000n) }),
    );

    // 40.000 / 10.000.000 = binde 4 → eşiğin altı
    expect(detectOvertrading(orders, CAPITAL)).toBeNull();
  });

  it('ÇOK İŞLEM ama KÜÇÜK komisyon yakalanmaz', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      "Günde kaç işlem" ölçseydik bu kullanıcı aşırı işlemci sayılırdı.
      Ama 50 işlemin toplam komisyonu 500 kuruş (5 ₺) — sermayesinin
      binde 0,05'i. Kimseye zarar veren bir şey yok.

      Ölçtüğümüz şey sayı değil, sermayeden götürdüğü pay.
    */
    const orders = Array.from({ length: 50 }, (_u, i) =>
      order({ id: `o${i}`, feeCents: kurus(10n) }),
    );

    expect(detectOvertrading(orders, CAPITAL)).toBeNull();
  });

  it('kaç ayrı günde işlem yapıldığını sayar', () => {
    const result = detectOvertrading(
      [
        order({ id: 'a', feeCents: kurus(30_000n), executedAt: new Date('2026-08-25T10:00:00Z') }),
        order({ id: 'b', feeCents: kurus(30_000n), executedAt: new Date('2026-08-25T18:00:00Z') }),
        order({ id: 'c', feeCents: kurus(30_000n), executedAt: new Date('2026-08-27T10:00:00Z') }),
      ],
      CAPITAL,
    );

    // Üç emir ama iki ayrı gün.
    expect(result!.facts.activeDays).toBe(2);
    expect(result!.facts.orderCount).toBe(3);
  });

  it('sermaye sıfır ya da emir yoksa bölme yapılmaz', () => {
    // ⚠️ Korumasız bırakılsa sıfıra bölme olurdu.
    expect(detectOvertrading([order({ id: 'a' })], kurus(0n))).toBeNull();
    expect(detectOvertrading([], CAPITAL)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. YERLEŞİM ETKİSİ
// ---------------------------------------------------------------------------

/**
 * Bir varlığı al-sat eden kısa yol.
 *
 * `netCents` alışta ödenen, satışta ele geçen. Kâr/zarar bu ikisinin farkı.
 */
function alSat(opts: {
  symbol: string;
  alDk: number;
  satDk: number;
  odenen: bigint;
  eleGecen: bigint;
}): BehaviorOrder[] {
  return [
    order({
      id: `${opts.symbol}-al`,
      symbol: opts.symbol,
      side: 'buy',
      executedAt: at(opts.alDk),
      netCents: kurus(opts.odenen),
    }),
    order({
      id: `${opts.symbol}-sat`,
      symbol: opts.symbol,
      side: 'sell',
      executedAt: at(opts.satDk),
      netCents: kurus(opts.eleGecen),
    }),
  ];
}

describe('detectDispositionEffect', () => {
  /** İki kârlı satış hızlı, iki zararlı satış geç. */
  const KLASIK = [
    ...alSat({ symbol: 'BTC', alDk: 0, satDk: 30, odenen: 100_000n, eleGecen: 120_000n }),
    ...alSat({ symbol: 'ETH', alDk: 0, satDk: 60, odenen: 100_000n, eleGecen: 110_000n }),
    ...alSat({ symbol: 'XRP', alDk: 0, satDk: 5_000, odenen: 100_000n, eleGecen: 90_000n }),
    ...alSat({ symbol: 'SOL', alDk: 0, satDk: 6_000, odenen: 100_000n, eleGecen: 80_000n }),
  ];

  it('kazananı çabuk, kaybedeni geç satan yakalanır', () => {
    const result = detectDispositionEffect(KLASIK);

    expect(result).not.toBeNull();
    expect(result!.facts.winnerCount).toBe(2);
    expect(result!.facts.loserCount).toBe(2);
    // Kazanan ortalaması (30 + 60) / 2 = 45 dk, kaybeden (5000 + 6000) / 2 = 5500 dk
    expect(result!.facts.winnerAvgHoldMinutes).toBe('45');
    expect(result!.facts.loserAvgHoldMinutes).toBe('5500');
    // 5500 / 45 ≈ 122,2 kat
    expect(result!.facts.ratioBps).toBe('1222222');
  });

  it('kanıt olarak ÖNCE kazanan, sonra kaybeden satışlar veriliyor', () => {
    // Anlatı "bunları çabuk sattın, şunları elde tuttun" sırasıyla kuruluyor.
    expect(detectDispositionEffect(KLASIK)!.orderIds).toEqual([
      'BTC-sat',
      'ETH-sat',
      'XRP-sat',
      'SOL-sat',
    ]);
  });

  it('fark küçükse bulgu yok', () => {
    const result = detectDispositionEffect([
      ...alSat({ symbol: 'BTC', alDk: 0, satDk: 100, odenen: 100_000n, eleGecen: 120_000n }),
      ...alSat({ symbol: 'ETH', alDk: 0, satDk: 100, odenen: 100_000n, eleGecen: 110_000n }),
      ...alSat({ symbol: 'XRP', alDk: 0, satDk: 120, odenen: 100_000n, eleGecen: 90_000n }),
      ...alSat({ symbol: 'SOL', alDk: 0, satDk: 120, odenen: 100_000n, eleGecen: 80_000n }),
    ]);

    // 120 / 100 = 1,2 kat — eşik 1,5. Küçük farklar rastlantı.
    expect(result).toBeNull();
  });

  it('tek kârlı + tek zararlı satıştan alışkanlık çıkarılmaz', () => {
    /*
      ⚠️ İKİ OLAY BİR EĞİLİM DEĞİLDİR. Aşağıdaki oran 100 kat ama
      dayanağı tek bir kârlı ve tek bir zararlı satış.
    */
    const result = detectDispositionEffect([
      ...alSat({ symbol: 'BTC', alDk: 0, satDk: 10, odenen: 100_000n, eleGecen: 120_000n }),
      ...alSat({ symbol: 'XRP', alDk: 0, satDk: 1_000, odenen: 100_000n, eleGecen: 90_000n }),
    ]);

    expect(result).toBeNull();
  });

  it('KISMİ satışta maliyet oransal düşüyor', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      2 adet 200.000 kuruşa alınmış, yarısı 150.000 kuruşa satılmış.
      Satılan yarının maliyeti 100.000 → 50.000 kuruş KÂR.

      Maliyetin tamamını (200.000) düşseydik 50.000 kuruş ZARAR çıkardı ve
      satış yanlış gruba girerdi — yani gösterge tam ters sonuç verirdi.
    */
    const yarimSatis: BehaviorOrder[] = [
      order({ id: 'b1', symbol: 'BTC', side: 'buy', executedAt: at(0), quantity: adet(2_0000000000n), netCents: kurus(200_000n) }),
      order({ id: 's1', symbol: 'BTC', side: 'sell', executedAt: at(10), quantity: adet(1_0000000000n), netCents: kurus(150_000n) }),
    ];

    const result = detectDispositionEffect([
      ...yarimSatis,
      ...alSat({ symbol: 'ETH', alDk: 0, satDk: 10, odenen: 100_000n, eleGecen: 120_000n }),
      ...alSat({ symbol: 'XRP', alDk: 0, satDk: 1_000, odenen: 100_000n, eleGecen: 90_000n }),
      ...alSat({ symbol: 'SOL', alDk: 0, satDk: 1_000, odenen: 100_000n, eleGecen: 80_000n }),
    ]);

    // Kısmi satış KAZANAN grubunda; iki kazanan var.
    expect(result!.facts.winnerCount).toBe(2);
    expect(result!.orderIds).toContain('s1');
  });

  it('alış zamanı miktara göre AĞIRLIKLANIYOR', () => {
    /*
      ⚠️ Pozisyona ekleme yapınca tek bir "alış tarihi" kalmıyor.

      0. dakikada 1 adet, 100. dakikada 3 adet alınıyor →
      ağırlıklı ortalama (0×1 + 100×3) / 4 = 75. dakika.
      175. dakikada satılınca elde tutma 100 dakika.

      İlk alışı seçseydik 175, son alışı seçseydik 75 çıkardı.
    */
    const ekleme = (symbol: string): BehaviorOrder[] => [
      order({ id: `${symbol}-1`, symbol, side: 'buy', executedAt: at(0), quantity: adet(1_0000000000n), netCents: kurus(100_000n) }),
      order({ id: `${symbol}-2`, symbol, side: 'buy', executedAt: at(100), quantity: adet(3_0000000000n), netCents: kurus(300_000n) }),
      order({ id: `${symbol}-sat`, symbol, side: 'sell', executedAt: at(175), quantity: adet(4_0000000000n), netCents: kurus(500_000n) }),
    ];

    const result = detectDispositionEffect([
      ...ekleme('BTC'),
      ...ekleme('ETH'),
      ...alSat({ symbol: 'XRP', alDk: 0, satDk: 1_000, odenen: 100_000n, eleGecen: 90_000n }),
      ...alSat({ symbol: 'SOL', alDk: 0, satDk: 1_000, odenen: 100_000n, eleGecen: 80_000n }),
    ]);

    expect(result!.facts.winnerAvgHoldMinutes).toBe('100');
  });

  it('pozisyon kapanıp tekrar açılınca süre şişmiyor', () => {
    /*
      BTC 0'da alınıp 10'da satılıyor, sonra 1000'de yeniden alınıp 1010'da
      satılıyor. İkinci satışın elde tutma süresi de 10 dakika olmalı —
      1010 değil.

      Bunu sağlayan şey ayrı bir sıfırlama değil, ağırlıklı ortalamanın
      kendisi: pozisyon kapandığında miktar sıfır olduğu için eski zaman
      `eskiZaman × 0` ile ağırlığa hiç giremiyor.
    */
    const result = detectDispositionEffect([
      ...alSat({ symbol: 'BTC', alDk: 0, satDk: 10, odenen: 100_000n, eleGecen: 120_000n }),
      order({ id: 'b2', symbol: 'BTC', side: 'buy', executedAt: at(1_000), netCents: kurus(100_000n) }),
      order({ id: 's2', symbol: 'BTC', side: 'sell', executedAt: at(1_010), netCents: kurus(130_000n) }),
      ...alSat({ symbol: 'XRP', alDk: 0, satDk: 500, odenen: 100_000n, eleGecen: 90_000n }),
      ...alSat({ symbol: 'SOL', alDk: 0, satDk: 500, odenen: 100_000n, eleGecen: 80_000n }),
    ]);

    // İki kazanan da 10 dakika tutulmuş.
    expect(result!.facts.winnerAvgHoldMinutes).toBe('10');
  });

  it('başa baş satış hiçbir gruba girmiyor', () => {
    // Ne "haklı çıktım" ne "kaybı kabullendim" — ölçtüğümüz duygu yok.
    const result = detectDispositionEffect([
      ...KLASIK,
      ...alSat({ symbol: 'ADA', alDk: 0, satDk: 3_000, odenen: 100_000n, eleGecen: 100_000n }),
    ]);

    expect(result!.facts.winnerCount).toBe(2);
    expect(result!.facts.loserCount).toBe(2);
    expect(result!.orderIds).not.toContain('ADA-sat');
  });

  it('elde tutulan zararlı pozisyon hesaba girmiyor', () => {
    /*
      ⚠️ BU BİR SINIR, HATA DEĞİL — ve ölçümü OLDUĞUNDAN ZAYIF gösteriyor.

      Aylardır tutulan zarardaki DOGE hiç satılmadığı için görünmüyor.
      Yani yanılgı güçlüyse bile bulgu ılımlı çıkıyor; yanlış tarafa
      yanılıyoruz. Bulgu verdiğimizde gerçekten vardır.
    */
    const result = detectDispositionEffect([
      ...KLASIK,
      order({ id: 'doge', symbol: 'DOGE', side: 'buy', executedAt: at(0), netCents: kurus(100_000n) }),
    ]);

    expect(result!.orderIds).not.toContain('doge');
  });

  it('satış yoksa bulgu yok', () => {
    expect(detectDispositionEffect([order({ id: 'b1' })])).toBeNull();
    expect(detectDispositionEffect([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. YOĞUNLAŞMA
// ---------------------------------------------------------------------------

describe('detectConcentration', () => {
  const emirler = [
    order({ id: 'btc-1', symbol: 'BTC' }),
    order({ id: 'btc-2', symbol: 'BTC' }),
    order({ id: 'eth-1', symbol: 'ETH' }),
  ];

  it('portföyün %70’i tek varlıktaysa yakalanır', () => {
    const result = detectConcentration(
      [
        { symbol: 'BTC', valueCents: kurus(70_000n) },
        { symbol: 'ETH', valueCents: kurus(20_000n) },
      ],
      kurus(10_000n), // nakit
      emirler,
    );

    expect(result).not.toBeNull();
    expect(result!.facts.symbol).toBe('BTC');
    // 70.000 / 100.000 = %70
    expect(result!.facts.shareBps).toBe('7000');
    // Kanıt: yalnızca BTC emirleri.
    expect(result!.orderIds).toEqual(['btc-1', 'btc-2']);
  });

  it('eşiğin altında bulgu yok', () => {
    const result = detectConcentration(
      [
        { symbol: 'BTC', valueCents: kurus(50_000n) },
        { symbol: 'ETH', valueCents: kurus(50_000n) },
      ],
      kurus(0n),
      emirler,
    );

    // %50 — eşik %60.
    expect(result).toBeNull();
  });

  it('NAKİT paydaya giriyor', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      Yalnızca yatırımlara baksaydık bu kişi "%100 BTC'de" sayılırdı.
      Oysa serveti 100.000, BTC'si 10.000: BTC yarıya inse serveti %5
      azalır. Risk almıyor.
    */
    const result = detectConcentration(
      [{ symbol: 'BTC', valueCents: kurus(10_000n) }],
      kurus(90_000n),
      emirler,
    );

    expect(result).toBeNull();
  });

  it('fiyatı çekilemeyen pozisyon varsa hiç bulgu üretilmez', () => {
    /*
      ⚠️ null'ı sıfır saymak paydayı küçültür ve kalan varlığın payını
      OLDUĞUNDAN BÜYÜK gösterir — veri eksikliği uydurma bir bulguya
      dönüşürdü. Aşağıdaki girdi öyle sayılsaydı BTC %100 çıkardı.
    */
    const result = detectConcentration(
      [
        { symbol: 'BTC', valueCents: kurus(50_000n) },
        { symbol: 'SOL', valueCents: null },
      ],
      kurus(0n),
      emirler,
    );

    expect(result).toBeNull();
  });

  it('boş portföyde bölme yapılmaz', () => {
    expect(detectConcentration([], kurus(10_000n), [])).toBeNull();
    // ⚠️ Korumasız bırakılsa sıfıra bölme olurdu.
    expect(
      detectConcentration(
        [{ symbol: 'BTC', valueCents: kurus(0n) }],
        kurus(0n),
        [],
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. FOMO ALIMI
// ---------------------------------------------------------------------------

/**
 * Alım emri + öncesindeki fiyat.
 *
 * `priceTry` alış fiyatı, `oncekiFiyat` 24 saat öncesi. İkisinin farkı
 * "trene atladı mı" sorusunun cevabı.
 */
function alim(id: string, fiyat: bigint, oncekiFiyat: bigint | null): BehaviorPricedOrder {
  return {
    ...order({ id, side: 'buy', priceTry: fiyat }),
    priceBeforeTry: oncekiFiyat,
  };
}

describe('detectFomoBuying', () => {
  it('sürekli yükselişin ardından alım yakalanır', () => {
    const result = detectFomoBuying([
      alim('a1', 110n, 100n), // +%10
      alim('a2', 130n, 100n), // +%30
      alim('a3', 120n, 100n), // +%20
      alim('a4', 100n, 100n), // değişim yok
    ]);

    expect(result).not.toBeNull();
    expect(result!.facts.chasingCount).toBe(3);
    expect(result!.facts.measuredBuyCount).toBe(4);
    // 3 / 4 = %75
    expect(result!.facts.shareBps).toBe('7500');
    // Ortalama yükseliş (1000 + 3000 + 2000) / 3 = 2000 bps = %20
    expect(result!.facts.avgRiseBps).toBe('2000');
    expect(result!.orderIds).toEqual(['a1', 'a2', 'a3']);
  });

  it('tek seferlik yükseliş alımı alışkanlık sayılmaz', () => {
    // Bir kez trene atlamak tesadüf; eşik üç.
    const result = detectFomoBuying([
      alim('a1', 150n, 100n),
      alim('a2', 100n, 100n),
      alim('a3', 90n, 100n),
    ]);

    expect(result).toBeNull();
  });

  it('ÇOK ALIM yapanda oran düşükse bulgu yok', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      Bu kişinin üç FOMO alımı var — sayı eşiğini geçiyor. Ama 20 alımının
      yalnızca %15'i böyle; bu bir yöntem değil, çok işlem yapmanın doğal
      sonucu. Oran olmasaydı gösterge aktif kullanıcıyı cezalandırırdı.
    */
    const buys = [
      alim('f1', 150n, 100n),
      alim('f2', 150n, 100n),
      alim('f3', 150n, 100n),
      ...Array.from({ length: 17 }, (_u, i) => alim(`n${i}`, 100n, 100n)),
    ];

    expect(detectFomoBuying(buys)).toBeNull();
  });

  it('düşüşten sonra alım FOMO değildir', () => {
    // Ucuza almak bu göstergenin tersi.
    const result = detectFomoBuying([
      alim('a1', 80n, 100n),
      alim('a2', 70n, 100n),
      alim('a3', 90n, 100n),
    ]);

    expect(result).toBeNull();
  });

  it('geçmiş fiyatı bilinmeyen alım PAYDAYA da girmiyor', () => {
    /*
      ⚠️ Ölçülemeyen alımı "FOMO değil" sayıp paydaya koysaydık oran
      düşerdi ve gerçek eğilim eşiğin altında kalırdı. Yeni listelenen bir
      varlığın 24 saat öncesi yok — bu bir veri eksikliği, kullanıcının
      kararı hakkında bilgi değil.
    */
    const result = detectFomoBuying([
      alim('a1', 150n, 100n),
      alim('a2', 150n, 100n),
      alim('a3', 150n, 100n),
      alim('yok1', 150n, null),
      alim('yok2', 150n, null),
      alim('yok3', 150n, null),
      alim('yok4', 150n, null),
    ]);

    // Ölçülebilir 3 alımın 3'ü de FOMO → %100.
    expect(result!.facts.measuredBuyCount).toBe(3);
    expect(result!.facts.shareBps).toBe('10000');
    expect(result!.orderIds).not.toContain('yok1');
  });

  it('sıfır ya da negatif geçmiş fiyat bölmeye girmiyor', () => {
    // ⚠️ Korumasız bırakılsa sıfıra bölme olurdu.
    const result = detectFomoBuying([
      alim('a1', 150n, 0n),
      alim('a2', 150n, 0n),
      alim('a3', 150n, 0n),
    ]);

    expect(result).toBeNull();
    expect(detectFomoBuying([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. PANİK SATIŞI
// ---------------------------------------------------------------------------

/**
 * Zararına satılacak bir pozisyon kurar.
 *
 * Önce 100.000 kuruşa alım, sonra `eleGecen` kadarına satış. `eleGecen`
 * küçükse satış zararla kapanıyor — panik göstergesinin şartı bu.
 */
function alSonraSat(
  symbol: string,
  satisFiyati: bigint,
  oncekiFiyat: bigint | null,
  eleGecen: bigint,
): BehaviorPricedOrder[] {
  return [
    {
      ...order({ id: `${symbol}-al`, symbol, side: 'buy', executedAt: at(0) }),
      priceBeforeTry: null,
    },
    {
      ...order({
        id: `${symbol}-sat`,
        symbol,
        side: 'sell',
        executedAt: at(10),
        priceTry: satisFiyati,
        netCents: kurus(eleGecen),
      }),
      priceBeforeTry: oncekiFiyat,
    },
  ];
}

describe('detectPanicSelling', () => {
  it('sert düşüşte zararına satış yakalanır', () => {
    const result = detectPanicSelling([
      ...alSonraSat('BTC', 80n, 100n, 80_000n), // −%20, zarar
      ...alSonraSat('ETH', 85n, 100n, 85_000n), // −%15, zarar
      ...alSonraSat('XRP', 90n, 100n, 90_000n), // −%10, zarar
    ]);

    expect(result).not.toBeNull();
    expect(result!.facts.panicCount).toBe(3);
    // (2000 + 1500 + 1000) / 3 = 1500 bps = %15
    expect(result!.facts.avgDropBps).toBe('1500');
    expect(result!.orderIds).toEqual(['BTC-sat', 'ETH-sat', 'XRP-sat']);
  });

  it('düşüşte ama KÂRLA satış panik sayılmaz', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      Fiyat %20 düşmüş ama pozisyon hâlâ kârda (100.000 kuruşa alınmış,
      140.000 kuruşa satılmış). Bu panik değil, kazancı masada bırakmama
      kararı. Zarar şartı olmasaydı üçü de bulgu sayılırdı.
    */
    const result = detectPanicSelling([
      ...alSonraSat('BTC', 80n, 100n, 140_000n),
      ...alSonraSat('ETH', 80n, 100n, 140_000n),
      ...alSonraSat('XRP', 80n, 100n, 140_000n),
    ]);

    expect(result).toBeNull();
  });

  it('yükselişte satış panik değildir', () => {
    // Yükselen fiyatta satmak kâr almak; bu göstergenin tersi.
    const result = detectPanicSelling([
      ...alSonraSat('BTC', 120n, 100n, 80_000n),
      ...alSonraSat('ETH', 130n, 100n, 80_000n),
      ...alSonraSat('XRP', 140n, 100n, 80_000n),
    ]);

    expect(result).toBeNull();
  });

  it('ÇOK SATIŞ yapanda oran düşükse bulgu yok', () => {
    // 5. göstergedeki gerekçenin aynısı: oran olmasa aktif kullanıcı
    // otomatik olarak "panikçi" damgası yerdi.
    const kalabalik: BehaviorPricedOrder[] = [
      ...alSonraSat('A', 80n, 100n, 80_000n),
      ...alSonraSat('B', 80n, 100n, 80_000n),
      ...alSonraSat('C', 80n, 100n, 80_000n),
    ];
    for (let i = 0; i < 17; i++) {
      kalabalik.push(...alSonraSat(`N${i}`, 100n, 100n, 80_000n));
    }

    expect(detectPanicSelling(kalabalik)).toBeNull();
  });

  it('tek seferlik düşüş satışı alışkanlık sayılmaz', () => {
    expect(detectPanicSelling(alSonraSat('BTC', 70n, 100n, 70_000n))).toBeNull();
    expect(detectPanicSelling([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. ORTALAMA DÜŞÜRME
// ---------------------------------------------------------------------------

/**
 * Bir adet alım emri.
 *
 * Fiyat ve ödenen tutar tutarlı olmak zorunda — ortalama maliyet ikisinden
 * çıkıyor. 1 adet alındığı için: tutar (kuruş) = fiyat × 100.
 */
function ekleme(
  id: string,
  symbol: string,
  fiyat: bigint,
  dakika: number,
): BehaviorOrder {
  return order({
    id,
    symbol,
    side: 'buy',
    executedAt: at(dakika),
    priceTry: fiyat * 100_000_000n,
    netCents: kurus(fiyat * 100n),
    quantity: adet(1_0000000000n),
  });
}

describe('detectAveragingDown', () => {
  it('düşen fiyata sürekli ekleme yakalanır', () => {
    const result = detectAveragingDown([
      ekleme('a1', 'BTC', 100n, 0),
      ekleme('a2', 'BTC', 80n, 10), // ortalama 100 -> 80'e ekleme
      ekleme('a3', 'BTC', 60n, 20), // ortalama 90  -> 60'a ekleme
      ekleme('a4', 'BTC', 40n, 30), // ortalama 80  -> 40'a ekleme
    ]);

    expect(result).not.toBeNull();
    // İlk alım EKLEME değil; üç ekleme var ve üçü de zararda.
    expect(result!.facts.totalAddCount).toBe(3);
    expect(result!.facts.downAddCount).toBe(3);
    expect(result!.facts.shareBps).toBe('10000');
    expect(result!.orderIds).toEqual(['a2', 'a3', 'a4']);
  });

  it('İLK ALIM ekleme sayılmıyor', () => {
    /*
      ⚠️ Elde pozisyon yokken alım yapmak sıradan bir giriş —
      karşılaştırılacak bir ortalama maliyet bile yok. Beş ayrı varlığa
      birer kez girmiş bu kullanıcının hiç eklemesi yok.
    */
    const result = detectAveragingDown([
      ekleme('a1', 'BTC', 100n, 0),
      ekleme('a2', 'ETH', 100n, 10),
      ekleme('a3', 'XRP', 100n, 20),
      ekleme('a4', 'SOL', 100n, 30),
      ekleme('a5', 'ADA', 100n, 40),
    ]);

    expect(result).toBeNull();
  });

  it('PLANLI kademeli alım (yukarıda da ekleyen) yakalanmıyor', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU — VE GÖSTERGENİN TEMEL SORUNU.

      Ortalama düşürmek kendi başına yanlış değil; planlı kademeli alım
      (DCA) aynı işlemleri üretir. Ayırt edebildiğimiz tek şey TUTARLILIK:
      planlı alan kişi fiyat yukarıdayken de ekler, çünkü planı takvime
      bağlı, fiyata değil.

      Aşağıdaki kişinin beş eklemesinin üçü aşağıda -> %60, eşik %75.

      ⚠️ ZARAR EKLEMESİ SAYISI BİLEREK ÜÇ (yani MIN_COUNT eşiğinin tam
      üstünde). İki tane bıraksaydım test yine geçerdi ama YANLIŞ SEBEPTEN:
      sayı eşiğine takılır, oran eşiği hiç sınanmazdı. Mutasyon testi bunu
      yakaladı — eşiği %75'ten %40'a düşürdüğümde hiçbir test kızarmadı.
    */
    const result = detectAveragingDown([
      ekleme('a1', 'BTC', 100n, 0), // giriş (ekleme değil), ortalama 100
      ekleme('a2', 'BTC', 80n, 10), // aşağıda  -> ortalama 90
      ekleme('a3', 'BTC', 200n, 20), // yukarıda -> ortalama ~126
      ekleme('a4', 'BTC', 100n, 30), // aşağıda  -> ortalama 120
      ekleme('a5', 'BTC', 300n, 40), // yukarıda -> ortalama 156
      ekleme('a6', 'BTC', 100n, 50), // aşağıda
    ]);

    expect(result).toBeNull();
  });

  it('BÜYÜYEN tutarla ekleme ayrıca sayılıyor', () => {
    /*
      "Katlayarak gitme" imzası. Eşiğe girmiyor, anlatıya giriyor:
      büyüyen tutar yanılgının ŞİDDETİNİ gösterir, varlığını değil.
    */
    const result = detectAveragingDown([
      ekleme('a1', 'BTC', 100n, 0),
      { ...ekleme('a2', 'BTC', 80n, 10), netCents: kurus(8_000n) },
      { ...ekleme('a3', 'BTC', 60n, 20), netCents: kurus(20_000n) },
      { ...ekleme('a4', 'BTC', 40n, 30), netCents: kurus(50_000n) },
    ]);

    // a3 ve a4 bir öncekinden büyük.
    expect(result!.facts.escalatingCount).toBe(2);
  });

  it('SATIŞ sonrası ortalama birim maliyet kaymıyor', () => {
    /*
      Satış maliyeti oransal düşürüyor; ortalama BİRİM maliyet
      değişmiyor. 100'den alınan pozisyonun yarısı satılsa bile ortalama
      100 kalmalı, yani 90'a yapılan alım hâlâ "aşağıda" sayılmalı.
    */
    const result = detectAveragingDown([
      ekleme('a1', 'BTC', 100n, 0),
      ekleme('a2', 'BTC', 100n, 5),
      order({
        id: 's1',
        symbol: 'BTC',
        side: 'sell',
        executedAt: at(8),
        quantity: adet(1_0000000000n),
        netCents: kurus(10_000n),
      }),
      ekleme('a3', 'BTC', 90n, 10),
      ekleme('a4', 'BTC', 80n, 20),
      ekleme('a5', 'BTC', 70n, 30),
    ]);

    expect(result!.facts.downAddCount).toBe(3);
  });

  it('ekleme yoksa bulgu yok', () => {
    expect(detectAveragingDown([])).toBeNull();
    expect(detectAveragingDown([ekleme('a1', 'BTC', 100n, 0)])).toBeNull();
  });
});
