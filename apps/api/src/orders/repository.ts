/**
 * Emir motoru — TRANSACTION KATMANI.
 *
 * Bu dosyanın cevapladığı soru tek: "Kullanıcı aynı anda iki alım emri
 * gönderirse bakiyesi eksiye düşer mi?"
 *
 * Naif kod şunu yapar ve YANLIŞTIR:
 *
 *   t1  A: bakiye oku -> 100.000
 *   t2  B: bakiye oku -> 100.000        (A henüz düşmedi)
 *   t3  A: 80.000 yeterli mi? evet
 *   t4  B: 80.000 yeterli mi? evet
 *   t5  A: bakiye = 20.000
 *   t6  B: bakiye = 20.000              (A'nın yazdığını görmedi)
 *
 * Sonuç: 100.000 TL ile 160.000 TL'lik alım. Kod satır satır doğru görünür,
 * tek başına test edilince geçer, sadece iki istek çakışınca para uydurur.
 *
 * ÜÇ SAVUNMA KATMANI (docs/01-plan.md 8.1):
 *   1. SELECT ... FOR UPDATE   -> eşzamanlı isteği sıraya sokar   (bu dosya)
 *   2. CHECK cash_cents >= 0   -> kod hatalıysa veri bozulmaz     (şemada)
 *   3. UNIQUE(user, idem_key)  -> ağ hatasında çift emir olmaz    (şemada)
 *
 * Üçü farklı şeyi koruyor. İkincisi özellikle önemli: birinci katmanı
 * ELLE yazıyoruz, yani hata yapabiliriz. Veritabanı kısıtı hiç kimseye
 * güvenmiyor.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  accounts,
  assets,
  cashMovements,
  holdings,
  orders,
  priceHistory,
} from "../db/schema.js";
import {
  AMOUNT_SCALE,
  PRICE_SCALE,
  type Amount,
  type Penny,
  type Price,
  formatScaled,
  toAmount,
  toPrice,
} from "../lib/money.js";
import {
  type OrderSide,
  OrderValidationError,
  calculateOrder,
} from "./calculate.js";
/**
 * ⚠️ `market/` KLASÖRÜNDEN IMPORT — ama AĞ İSTEĞİ GELMİYOR.
 *
 * `market-hours.ts` saf bir takvim: `Intl` dışında hiçbir şeye dokunmuyor,
 * fetch yok, veritabanı yok. Bu yüzden aşağıdaki transaction'ın içinden
 * çağrılması güvenli. Yahoo yanıtında da seans bilgisi var ama onu
 * kullanmak "transaction içinde ağ isteği yapma" kuralını çiğnerdi.
 */
import {
  describeNextSessionOpen,
  isRegularSessionOpen,
} from "../market/market-hours.js";

// ---------------------------------------------------------------------------
// 1. SABİT
// ---------------------------------------------------------------------------

/**
 * Fiyatın kabul edilebilir azami yaşı: 120 saniye (docs/01-plan.md 8.1).
 *
 * NEDEN VAR: cron durursa price_history'deki son kayıt eskir. Kontrol
 * olmasaydı kullanıcı saatler önceki fiyattan işlem yapardı — piyasa
 * düştüyse eski yüksek fiyattan satar, bedava kâr eder.
 *
 * NEDEN 120: cron 15 saniyede bir yazıyor. Üst üste 7 tur başarısız olsa
 * bile sınırın altında kalıyoruz. Dar tutulsa geçici ağ sorunlarında
 * emirler gereksiz reddedilirdi.
 */
export const MAX_PRICE_AGE_MS = 120_000;

/**
 * Hisse için ayrı ve daha geniş sınır: 300 saniye.
 *
 * ⚠️ NEDEN AYRI — cron kadansı farklı. Kripto/döviz/maden 15 saniyede bir
 * yazılıyor, hisse seans boyunca 60 saniyede bir. 120 saniyelik sınır
 * hisseye uygulansaydı tek bir gecikmiş tur emirleri durdururdu; 300
 * saniye beş tur pay bırakıyor.
 *
 * ⚠️ BU SINIR YALNIZCA SEANS İÇİNDE ANLAMLI. Piyasa kapalıyken fiyat
 * zaten saatlerce eski olur ve bu NORMALDİR — o durum aşağıda ayrıca,
 * `MARKET_CLOSED` ile ele alınıyor. Bayatlık kontrolü hisse için sadece
 * şu soruyu soruyor: "seans açıkken beslememiz çalışıyor mu?"
 */
export const STOCK_MAX_PRICE_AGE_MS = 300_000;

/** Varlık türüne göre kabul edilebilir fiyat yaşı. */
function maxPriceAgeMs(kind: string): number {
  return kind === "stock" ? STOCK_MAX_PRICE_AGE_MS : MAX_PRICE_AGE_MS;
}

// ---------------------------------------------------------------------------
// 2. GİRDİ / ÇIKTI
// ---------------------------------------------------------------------------

export interface ExecuteOrderInput {
  userId: string;
  symbol: string;
  side: OrderSide;
  quantity: Amount;
  /** İstemcinin ürettiği tekrar anahtarı — aynı emir iki kez işlenmesin */
  idempotencyKey: string;
  /** Karar notu: "neden aldım" */
  note?: string;
}

export interface ExecuteOrderResult {
  orderId: string;
  side: OrderSide;
  symbol: string;
  /** İnsan okunabilir biçimde, string — zincir kırılmasın */
  quantity: string;
  priceTry: string;
  grossCents: bigint;
  feeCents: bigint;
  netCents: bigint;
  /** İşlem sonrası bakiye */
  balanceCents: bigint;
  /** Aynı anahtarla daha önce işlenmiş emir mi */
  replayed: boolean;
}

// ---------------------------------------------------------------------------
// 3. EMİR GERÇEKLEŞTİRME
// ---------------------------------------------------------------------------

/**
 * Bir emri baştan sona işler. Ya hepsi olur ya hiçbiri.
 *
 * KİLİT SIRASI KURALI — bunu bozma:
 * Her yol ÖNCE accounts satırını kilitler. Holdings için ayrı kilit
 * almıyoruz; aynı kullanıcının bütün emirleri zaten accounts kilidinde
 * sıraya girdiği için holdings de dolaylı olarak korunuyor.
 *
 * Farklı yerlerde farklı sırayla kilit alınırsa iki transaction birbirini
 * bekler ve DEADLOCK oluşur. Tek kilit + tutarlı sıra bu riski sıfırlıyor.
 *
 * ⚠️ Transaction içinde AĞ İSTEĞİ YAPMA. Binance'i beklerken satır kilidini
 * tutuyor olursun ve o kullanıcının bütün emirleri donar. Fiyat zaten
 * price_history'den okunuyor — cron'un işi, bizim değil.
 */
export async function executeOrder(
  input: ExecuteOrderInput,
): Promise<ExecuteOrderResult> {
  return db.transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // 3a. SATIR KİLİDİ — dosyanın en kritik satırı
    // -----------------------------------------------------------------------
    //
    // `.for("update")` -> SQL'de "SELECT ... FOR UPDATE".
    // Satırı okumakla kalmaz, KİLİTLER. Aynı satıra gelen ikinci transaction
    // COMMIT/ROLLBACK olana kadar BEKLER, sonra GÜNCEL değeri okur.
    //
    // Kilit satır düzeyinde: sadece bu kullanıcının hesabı kilitleniyor.
    // Bin kişi aynı anda işlem yapabilir; sadece AYNI kişinin emirleri
    // sıraya giriyor.
    const [account] = await tx
      .select({ cashCents: accounts.cashCents })
      .from(accounts)
      .where(eq(accounts.userId, input.userId))
      .for("update");

    if (!account) {
      throw new OrderValidationError("Hesap bulunamadı", "ACCOUNT_NOT_FOUND");
    }

    // -----------------------------------------------------------------------
    // 3b. IDEMPOTENCY — tekrar gönderilen istek ikinci emri yaratmasın
    // -----------------------------------------------------------------------
    //
    // Bu kontrolün kilitten SONRA gelmesi tesadüf değil: aynı kullanıcının
    // eşzamanlı iki isteği zaten 3a'da sıraya girdi. Yani ikinci istek buraya
    // geldiğinde birincisi COMMIT etmiş ve kaydı görünür olmuştur.
    //
    // Kilitten önce olsaydı ikisi de "kayıt yok" görüp iki emir yaratırdı.
    //
    // UNIQUE(user_id, idempotency_key) yine de şemada duruyor — bu kontrolü
    // yanlış yazsak bile veritabanı ikinci kaydı reddeder.
    const [existing] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, input.userId),
          eq(orders.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing) {
      // Yeni emir YARATMIYORUZ, var olanın sonucunu döndürüyoruz.
      // Kullanıcı açısından "istek başarılı" — ki zaten başarılıydı.
      const [asset] = await tx
        .select({ symbol: assets.symbol })
        .from(assets)
        .where(eq(assets.id, existing.assetId))
        .limit(1);

      return {
        orderId: existing.id,
        side: existing.side,
        symbol: asset?.symbol ?? "",
        quantity: existing.quantity,
        priceTry: existing.priceTry,
        grossCents: existing.grossCents,
        feeCents: existing.feeCents,
        netCents: existing.netCents,
        balanceCents: account.cashCents,
        replayed: true,
      };
    }

    // -----------------------------------------------------------------------
    // 3c. VARLIK
    // -----------------------------------------------------------------------
    const [asset] = await tx
      // `kind` de okunuyor: aşağıdaki seans ve bayatlık kuralları
      // varlık türüne göre değişiyor.
      .select({ id: assets.id, symbol: assets.symbol, kind: assets.kind })
      .from(assets)
      .where(and(eq(assets.symbol, input.symbol), eq(assets.isActive, true)))
      .limit(1);

    if (!asset) {
      // İşlemden kaldırılmış varlık da buraya düşer. Elindeki durur,
      // yenisini alamaz — borsalarda delisting böyle işler.
      throw new OrderValidationError(
        `${input.symbol} işlem görmüyor`,
        "ASSET_NOT_FOUND",
      );
    }

    // -----------------------------------------------------------------------
    // 3d. FİYAT — sunucudan, istemciden DEĞİL
    // -----------------------------------------------------------------------
    //
    // Fiyatı istemci göndermiyor. Gönderseydi kullanıcı istediği fiyatı
    // yazıp ligi ilk gün kırardı (docs/01-plan.md kilitli kararlar).
    const [pricePoint] = await tx
      .select({ ts: priceHistory.ts, priceTry: priceHistory.priceTry })
      .from(priceHistory)
      .where(eq(priceHistory.assetId, asset.id))
      .orderBy(desc(priceHistory.ts))
      .limit(1);

    if (!pricePoint) {
      throw new OrderValidationError(
        `${input.symbol} için fiyat kaydı yok`,
        "NO_PRICE",
      );
    }

    /**
     * ⚠️ PİYASA KAPALI KONTROLÜ BAYATLIK KONTROLÜNDEN ÖNCE — SIRA ÖNEMLİ.
     *
     * ABD borsası yılın %81,4'ünde kapalı (market-hours.ts'te hesabı var).
     * Kapalıyken son kapanış fiyatı saatlerce, hafta sonu ise günlerce
     * eski olur. Sıra ters olsaydı kullanıcı şunu görürdü:
     *
     *     "Fiyat 216.000 saniye eski, emir alınamıyor"
     *
     * Mesaj teknik olarak doğru ama kullanıcıya YANLIŞ ŞEYİ söylüyor:
     * bir arıza olduğunu, biraz bekleyince düzeleceğini ima ediyor.
     * Oysa sistemde hiçbir sorun yok, sadece pazar günü.
     *
     * Doğru sıra önce "kapalı mı" diye sorup açılış saatini söylemek.
     */
    if (asset.kind === "stock" && !isRegularSessionOpen()) {
      throw new OrderValidationError(
        describeNextSessionOpen(),
        "MARKET_CLOSED",
      );
    }

    // ⚠️ Kolon `timestamp` (saat dilimsiz). Sürücü Date döndürse de içeriği
    // UTC; `timestamptz` olsaydı bu yorum gerekmezdi (market/repository.ts).
    const priceAge = Date.now() - pricePoint.ts.getTime();
    if (priceAge > maxPriceAgeMs(asset.kind)) {
      throw new OrderValidationError(
        `Fiyat ${Math.floor(priceAge / 1000)} saniye eski, emir alınamıyor`,
        "STALE_PRICE",
      );
    }

    // numeric(24,8) string olarak geliyor -> doğrudan bigint'e.
    // Hiçbir adımda `number` yok, float sızamıyor.
    const price: Price = toPrice(pricePoint.priceTry);

    // -----------------------------------------------------------------------
    // 3e. HESAP — katman 1 burada çağrılıyor
    // -----------------------------------------------------------------------
    const amounts = calculateOrder(input.side, price, input.quantity);

    // -----------------------------------------------------------------------
    // 3f. YETERLİLİK + YENİ DEĞERLER
    // -----------------------------------------------------------------------
    const [currentHolding] = await tx
      .select({ quantity: holdings.quantity })
      .from(holdings)
      .where(
        and(
          eq(holdings.userId, input.userId),
          eq(holdings.assetId, asset.id),
        ),
      )
      .limit(1);

    const heldQuantity: Amount = currentHolding
      ? toAmount(currentHolding.quantity)
      : (0n as Amount);

    let newBalance: Penny;
    let newQuantity: Amount;

    if (input.side === "buy") {
      // net = brüt + komisyon (hesaptan çıkan)
      if (account.cashCents < amounts.net) {
        throw new OrderValidationError(
          "Bakiye yetersiz",
          "INSUFFICIENT_FUNDS",
        );
      }
      newBalance = (account.cashCents - amounts.net) as Penny;
      newQuantity = (heldQuantity + input.quantity) as Amount;
    } else {
      // Satışta önce elinde var mı diye bakılır. Bu kontrol olmasaydı
      // kullanıcı sahip olmadığı varlığı satıp para basardı (açığa satış).
      if (heldQuantity < input.quantity) {
        throw new OrderValidationError(
          "Elinizdeki miktar yetersiz",
          "INSUFFICIENT_HOLDING",
        );
      }
      // net = brüt - komisyon (hesaba giren)
      newBalance = (account.cashCents + amounts.net) as Penny;
      newQuantity = (heldQuantity - input.quantity) as Amount;
    }

    // -----------------------------------------------------------------------
    // 3g. YAZMA — dört tablo, tek transaction
    // -----------------------------------------------------------------------
    //
    // Buradan sonrası ya tamamen olur ya hiç olmaz. Aradaki bir hatada
    // COMMIT'e ulaşılmaz, hiçbir satır kalıcı olmaz. "Para düştü ama varlık
    // verilmedi" durumu OLUŞAMAZ.

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        userId: input.userId,
        assetId: asset.id,
        side: input.side,
        quantity: formatScaled(input.quantity, AMOUNT_SCALE),
        priceTry: formatScaled(price, PRICE_SCALE),
        grossCents: amounts.gross,
        feeCents: amounts.fee,
        netCents: amounts.net,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: orders.id });

    if (!createdOrder) {
      throw new Error("orders: kayıt oluşturulamadı");
    }

    await tx
      .update(accounts)
      .set({ cashCents: newBalance })
      .where(eq(accounts.userId, input.userId));

    // Holding: yoksa oluştur, varsa güncelle.
    // Miktarı SQL'de artırmıyoruz (`quantity + x`) çünkü değeri zaten kilit
    // altında okuduk — hesabı burada yapmak daha okunur ve aynı derecede
    // güvenli.
    await tx
      .insert(holdings)
      .values({
        userId: input.userId,
        assetId: asset.id,
        quantity: formatScaled(newQuantity, AMOUNT_SCALE),
      })
      .onConflictDoUpdate({
        target: [holdings.userId, holdings.assetId],
        set: { quantity: formatScaled(newQuantity, AMOUNT_SCALE) },
      });

    // cash_movements'a İKİ satır: işlem ve komisyon ayrı.
    //
    // NEDEN AYRI: tek satır yazsaydık komisyon defterde görünmezdi.
    // Kullanıcı "toplam ne kadar komisyon ödedim" diye soramazdı.
    // Şemadaki `fee` türü de zaten bunun için ayrılmış.
    //
    // İşaret kuralı: negatif = paranın çıkışı.
    await tx.insert(cashMovements).values([
      {
        userId: input.userId,
        kind: input.side,
        amountCents:
          input.side === "buy" ? -amounts.gross : amounts.gross,
        orderId: createdOrder.id,
      },
      {
        userId: input.userId,
        kind: "fee" as const,
        // Komisyon her iki yönde de kullanıcıdan çıkar.
        amountCents: -amounts.fee,
        orderId: createdOrder.id,
      },
    ]);

    return {
      orderId: createdOrder.id,
      side: input.side,
      symbol: asset.symbol,
      quantity: formatScaled(input.quantity, AMOUNT_SCALE),
      priceTry: formatScaled(price, PRICE_SCALE),
      grossCents: amounts.gross,
      feeCents: amounts.fee,
      netCents: amounts.net,
      balanceCents: newBalance,
      replayed: false,
    };
  });
}
