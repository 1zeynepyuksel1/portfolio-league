import { describe, expect, it } from 'vitest';
import {
  MAX_REPORTED_FINDINGS,
  MIN_ORDERS_FOR_ANALYSIS,
  buildReport,
} from './service.js';
import type { BehaviorPricedOrder } from './indicators.js';
import type { Amount, Penny } from '../lib/money.js';

/**
 * ⚠️ BU DOSYA VERİTABANI İSTEMİYOR — VE SEBEBİ MİMARİ BİR KARAR.
 *
 * `service.ts` ikiye ayrıldı: `getBehaviorReport` sorguları çekiyor,
 * `buildReport` karar veriyor. Test edilen ikincisi. Tek parça olsaydı bu
 * testlerin tamamı Docker'a bağımlı olurdu ve muhtemelen hiç yazılmazdı.
 */

const kurus = (n: bigint): Penny => n as unknown as Penny;
const adet = (n: bigint): Amount => n as unknown as Amount;

const SERMAYE = kurus(10_000_000n); // 100.000 ₺

function order(
  over: Partial<BehaviorPricedOrder> & { id: string },
): BehaviorPricedOrder {
  return {
    symbol: 'BTC',
    side: 'buy',
    executedAt: new Date('2026-08-27T12:00:00Z'),
    priceTry: 100_00000000n,
    netCents: kurus(100_000n),
    feeCents: kurus(100n),
    quantity: adet(1_0000000000n),
    priceBeforeTry: 100_00000000n,
    ...over,
  };
}

/** Sıradan, hiçbir göstergeyi tetiklemeyen emirler. */
function sakinEmirler(count: number): BehaviorPricedOrder[] {
  return Array.from({ length: count }, (_u, i) =>
    order({
      id: `o${i}`,
      symbol: `A${i}`,
      executedAt: new Date(Date.parse('2026-08-27T12:00:00Z') + i * 86_400_000),
    }),
  );
}

describe('buildReport · veri eşiği', () => {
  it('beş emrin altında HİÇBİR iddia üretilmiyor', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      Aşağıdaki kullanıcının portföyünün %100'ü BTC'de — yoğunlaşma
      göstergesi bunu doğru buluyor. Ama tek emir vermiş biri için bu bir
      ALIŞKANLIK değil, tek işlemin kaçınılmaz sonucu.

      Gerçek veride tam bu oldu: `deneme3` ve `batuhanSwe` birer emirle
      "%100 yoğunlaşma" bulgusu aldılar.
    */
    const report = buildReport(
      [order({ id: 'tek' })],
      [{ symbol: 'BTC', valueCents: kurus(10_000_000n) }],
      kurus(0n),
      SERMAYE,
    );

    expect(report.hasEnoughData).toBe(false);
    expect(report.findings).toEqual([]);
    expect(report.orderCount).toBe(1);
  });

  it('tam eşikte analiz yapılıyor', () => {
    const report = buildReport(
      sakinEmirler(MIN_ORDERS_FOR_ANALYSIS),
      [],
      kurus(0n),
      SERMAYE,
    );

    expect(report.hasEnoughData).toBe(true);
  });
});

describe('buildReport · önceliklendirme', () => {
  /**
   * Aynı anda üç bulgu üreten bir defter:
   *   - yıkama işlemi (sat + 3 dk sonra al)
   *   - aşırı işlem (komisyon sermayenin binde 5'i)
   *   - yoğunlaşma (portföyün tamamı tek varlıkta)
   */
  const cokBulguluDefter: BehaviorPricedOrder[] = [
    order({ id: 'w-sat', symbol: 'BNB', side: 'sell', feeCents: kurus(25_000n), executedAt: new Date('2026-08-27T12:00:00Z') }),
    order({ id: 'w-al', symbol: 'BNB', side: 'buy', feeCents: kurus(25_000n), executedAt: new Date('2026-08-27T12:03:00Z') }),
    ...Array.from({ length: 3 }, (_u, i) =>
      order({ id: `f${i}`, feeCents: kurus(1_000n) }),
    ),
  ];

  const tekVarlik = [{ symbol: 'BTC', valueCents: kurus(10_000_000n) }];

  it('para kaybı önce, durum sonra sıralanıyor', () => {
    const report = buildReport(
      cokBulguluDefter,
      tekVarlik,
      kurus(0n),
      SERMAYE,
    );

    /*
      ⚠️ SIRA KODDA BELİRLENİYOR, MODELDE DEĞİL.

      Ödenmiş komisyon tartışmaya kapalı bir kayıp; yoğunlaşma ise bir
      DURUM — henüz kimse para kaybetmedi. Modele sorsaydık her çağrıda
      farklı sıra gelir ve gerekçesi açıklanamazdı.
    */
    expect(report.findings.map((f) => f.key)).toEqual([
      'overtrading',
      'wash_trade',
      'concentration',
    ]);
  });

  it('en fazla üç bulgu gösteriliyor', () => {
    const report = buildReport(
      cokBulguluDefter,
      tekVarlik,
      kurus(0n),
      SERMAYE,
    );

    // Kullanıcıya yedi maddelik bir suçlama listesi vermek işe yaramaz.
    expect(report.findings.length).toBeLessThanOrEqual(MAX_REPORTED_FINDINGS);
  });
});

describe('buildReport · metinler', () => {
  it('yıkama metni gerçek tutarı Türkçe para biçiminde veriyor', () => {
    const report = buildReport(
      [
        order({ id: 's1', symbol: 'BNB', side: 'sell', feeCents: kurus(7_000n), executedAt: new Date('2026-08-27T12:00:00Z') }),
        order({ id: 'b1', symbol: 'BNB', side: 'buy', feeCents: kurus(7_677n), executedAt: new Date('2026-08-27T12:03:00Z') }),
        ...sakinEmirler(3),
      ],
      [],
      kurus(0n),
      SERMAYE,
    );

    const wash = report.findings.find((f) => f.key === 'wash_trade');

    expect(wash).toBeDefined();
    // Gerçek olay: tunajr, 27 Ağu 2026, BNB — 146,77 ₺ komisyon.
    expect(wash!.message).toContain('146,77 ₺');
    expect(wash!.message).toContain('60 dakika');
  });

  it('her bulgu KANIT taşıyor', () => {
    /*
      ⚠️ `orderIds` boş bir bulgu, dayanağı gösterilemeyen bir iddiadır.
      Ekran "hangi işlemler" sorusuna cevap verebilmeli.
    */
    const report = buildReport(
      [
        order({ id: 's1', symbol: 'BNB', side: 'sell', executedAt: new Date('2026-08-27T12:00:00Z') }),
        order({ id: 'b1', symbol: 'BNB', side: 'buy', executedAt: new Date('2026-08-27T12:03:00Z') }),
        ...sakinEmirler(3),
      ],
      [],
      kurus(0n),
      SERMAYE,
    );

    for (const finding of report.findings) {
      expect(finding.orderIds.length).toBeGreaterThan(0);
      expect(finding.message.length).toBeGreaterThan(0);
      expect(finding.title.length).toBeGreaterThan(0);
    }
  });

  it('temiz kullanıcıda bulgu yok ama analiz yapılmış sayılıyor', () => {
    const report = buildReport(sakinEmirler(10), [], kurus(0n), SERMAYE);

    // "Yeterli veri yok" ile "veri var, sorun yok" farklı şeyler —
    // ekran ikisini farklı göstermeli.
    expect(report.hasEnoughData).toBe(true);
    expect(report.findings).toEqual([]);
  });
});
