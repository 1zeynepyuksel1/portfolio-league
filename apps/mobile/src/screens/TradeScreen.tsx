/**
 * TradeScreen — emir motorunun ekranı.
 *
 * Bu ekran Faz 1'in son parçası. Arkasındaki motor uzun zamandır hazırdı
 * (satır kilidi, idempotency, bigint kuruş aritmetiği) ama hiçbir ekran
 * onu çağırmıyordu — yani projenin en çok emek gören kısmı görünmezdi.
 *
 * ÜÇ KURAL, ÜÇÜ DE SUNUCU TARAFINDAN GELİYOR:
 *   1. Fiyatı sunucu belirler        -> ekrandaki tutar yalnızca ÖNİZLEME
 *   2. Aynı emir iki kez geçmemeli   -> Idempotency-Key
 *   3. 120 sn'den eski fiyatla emir yok -> STALE_PRICE hatası
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, apiFetch } from '../api/client';
import {
  decimalToCents,
  formatCents,
  formatCentsString,
  formatPrice,
  formatQuantity,
  formatRelativeTime,
} from '../lib/format';
import {
  estimateOrder,
  maxBuyableQuantity,
  MIN_ORDER_CENTS,
  quantityForAmount,
} from '../lib/order-math';
import { colors, fonts } from '../theme';

type Side = 'buy' | 'sell';

type Props = {
  symbol: string;
  name: string;
  onClose: () => void;
  /** Emir geçtikten sonra portföyün tazelenmesi için. */
  onOrderPlaced?: () => void;
  onGoToWallet?: () => void;
};

type AssetRow = {
  symbol: string;
  priceTry: string | null;
  asOf: string | null;
  /**
   * Sunucudan gelir. Hisse dışındaki her varlıkta `true`.
   *
   * ⚠️ `?` İLE İSTEĞE BAĞLI: sunucu bu alanı yeni döndürmeye başladı.
   * Zorunlu yapsaydık, eski bir sunucuya bağlanan uygulama (ya da alanın
   * eklenmediği bir uç) `undefined` verirdi ve aşağıdaki `!== false`
   * kontrolü olmasa düğme sessizce kapanırdı.
   */
  tradable?: boolean;
};

type PortfolioResponse = {
  cashCents: string;
  positions: Array<{ symbol: string; quantity: string }>;
};

type OrderResponse = {
  orderId: string;
  side: Side;
  symbol: string;
  quantity: string;
  priceTry: string;
  grossCents: string;
  feeCents: string;
  netCents: string;
  balanceCents: string;
  replayed: boolean;
};

/** MarketScreen ile aynı aralık — aynı gerekçe (faz kilidinden kaçınma). */
const REFRESH_MS = 5_000;

/**
 * Sunucu hata kodlarının Türkçe karşılıkları.
 *
 * ⚠️ Neden tablo: sunucu `INSUFFICIENT_FUNDS` gibi makine kodları
 * döndürüyor ve bu doğru — mesaj metni değişse bile kod sabit kalır,
 * istemci ona göre davranabilir. Ama kullanıcı o kodu görmemeli.
 */
const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Bakiyeniz bu emir için yeterli değil.',
  INSUFFICIENT_HOLDING: 'Bu kadar varlığınız yok.',
  STALE_PRICE:
    'Fiyat bilgisi eskidi. Birkaç saniye bekleyip tekrar deneyin.',
  NO_PRICE: 'Bu varlığın güncel fiyatı alınamıyor.',
  AMOUNT_TOO_SMALL: 'Emir tutarı çok küçük (en az 1,00 ₺).',
  INVALID_QUANTITY: 'Miktar sıfırdan büyük olmalı.',
  INVALID_PRICE: 'Fiyat geçersiz.',
  ASSET_NOT_FOUND: 'Varlık bulunamadı.',
  MISSING_IDEMPOTENCY_KEY: 'İstek kimliği eksik — uygulamayı yeniden başlatın.',
};

/**
 * Tekrar anahtarı üretir.
 *
 * `crypto.randomUUID` her ortamda yok (eski Android WebView, bazı RN
 * sürümleri). Zaman damgası + iki rastgele parça yeterince benzersiz:
 * anahtarın amacı evrensel teklik değil, AYNI KULLANICININ aynı emri iki
 * kez göndermesini ayırt etmek.
 */
function newIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `ord-${Date.now().toString(36)}-${rand()}${rand()}`;
}

export function TradeScreen({ symbol, name, onClose, onOrderPlaced, onGoToWallet }: Props) {
  const [side, setSide] = useState<Side>('buy');
  const [quantity, setQuantity] = useState('');

  /**
   * Karar notu — "neden aldım".
   *
   * ⚠️ İSTEĞE BAĞLI VE ÖYLE KALMALI. Zorunlu yapsaydık kullanıcı fiyat
   * kaçmasın diye rastgele bir şey yazıp geçerdi; elimizde not olurdu
   * ama hiçbir bilgi taşımazdı. Boş bırakılabilen bir alan, dolu
   * olduğunda gerçekten bir şey söylüyor.
   */
  const [note, setNote] = useState('');

  /**
   * Giriş modu: miktar mı, tutar mı.
   *
   * ⚠️ TEK KAYNAK MİKTAR. Tutar modunda kullanıcı TL yazıyor ama sunucuya
   * giden hep `quantity`. İki alanı birbirine bağlı state olarak tutsaydık
   * yuvarlama yüzünden birbirlerini sürekli düzeltirlerdi (5.000 -> 0,0013
   * -> 4.999,87 -> ...). Tutar yalnızca bir GİRİŞ ARACI.
   */
  const [inputMode, setInputMode] = useState<'quantity' | 'amount'>('quantity');
  const [amountInput, setAmountInput] = useState('');

  const [price, setPrice] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  const [cashCents, setCashCents] = useState<bigint>(0n);
  const [holding, setHolding] = useState<string>('0');

  const [submitting, setSubmitting] = useState(false);
  // Varsayılan AÇIK: bilgi gelene kadar düğmeyi kapatmak, kripto alacak
  // kullanıcıyı da bekletirdi. Sunucu zaten son sözü söylüyor.
  const [tradable, setTradable] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrderResponse | null>(null);

  /**
   * ⚠️ EKRANIN EN ÖNEMLİ SATIRI.
   *
   * Anahtar `useRef`'te, `useState`'te DEĞİL — çünkü değişmesi ekranı
   * yeniden çizmemeli ve gönderim sırasında güncel değeri okunmalı.
   *
   * Yaşam döngüsü:
   *   - `null` iken gönderimde üretilir
   *   - Ağ hatası olursa AYNISI kalır -> tekrar denemek yeni emir yaratmaz
   *   - Miktar veya yön değişince sıfırlanır -> artık BAŞKA bir emir
   *   - Başarıdan sonra sıfırlanır
   *
   * Her basışta yenisini üretseydik idempotency'nin tamamı iptal olurdu:
   * ağ koptuğunda kullanıcı tekrar basar ve iki emir geçer.
   */
  const idempotencyKey = useRef<string | null>(null);

  /** Emrin kimliğini değiştiren her düzenleme anahtarı geçersiz kılar. */
  function resetKey() {
    idempotencyKey.current = null;
  }

  const loadPrice = useCallback(async () => {
    try {
      // ⚠️ GET /assets artık dizi DEĞİL, zarflı nesne döndürüyor.
      // Tip iddiası (`apiFetch<T>`) çalışma anında doğrulanmıyor; eski
      // hâli bırakılsaydı `rows.find` "find is not a function" derdi ve
      // hata ancak Al/Sat ekranı açılınca ortaya çıkardı.
      const data = await apiFetch<{ assets: AssetRow[] }>('/assets');
      const row = data.assets.find((r) => r.symbol === symbol);

      if (row) {
        setPrice(row.priceTry);
        setAsOf(row.asOf);
        // ⚠️ `!== false` — `undefined` gelirse AÇIK sayılıyor (bkz. AssetRow).
        setTradable(row.tradable !== false);
      }
    } catch {
      // Fiyat tazelemesi sessizce başarısız olabilir — ekranda son bilinen
      // fiyat kalır ve `asOf` eskidiği için kullanıcı bunu görür.
    }
  }, [symbol]);

  const loadPortfolio = useCallback(async () => {
    try {
      const p = await apiFetch<PortfolioResponse>('/portfolio');
      setCashCents(BigInt(p.cashCents));
      setHolding(p.positions.find((x) => x.symbol === symbol)?.quantity ?? '0');
    } catch {
      // Portföy okunamazsa "kullanılabilir" satırı boş kalır; emir yine
      // gönderilebilir, sunucu zaten kontrol ediyor.
    }
  }, [symbol]);

  useEffect(() => {
    void loadPrice();
    void loadPortfolio();

    const timer = setInterval(() => void loadPrice(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadPrice, loadPortfolio]);

  const estimate = estimateOrder(side, price, quantity);

  /**
   * Gönderilebilir mi?
   *
   * Sunucu bunların hepsini zaten kontrol ediyor. Burada tekrar etmemizin
   * sebebi kullanıcıya ağ turu beklemeden söylemek — sunucunun kararını
   * değiştirmiyoruz, öne alıyoruz.
   */
  const tooSmall = estimate !== null && estimate.grossCents < MIN_ORDER_CENTS;
  const canSubmit =
    !submitting && estimate !== null && !tooSmall && price !== null && tradable;

  async function handleSubmit() {
    if (!canSubmit || estimate === null) return;

    setError('');
    setSubmitting(true);

    // Anahtar YOKSA üretilir, VARSA korunur. Tekrar denemede aynısı gider.
    idempotencyKey.current ??= newIdempotencyKey();

    try {
      const res = await apiFetch<OrderResponse>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          symbol,
          side,
          quantity: quantity.trim(),
          /*
            ⚠️ BOŞ NOT `undefined` OLARAK GİDİYOR, BOŞ METİN OLARAK DEĞİL.

            Zod şeması notu isteğe bağlı tanımlıyor; boş metin
            gönderseydik veritabanına '' yazılırdı ve "not yazmadı" ile
            "not yazdı ama sildi" ayırt edilemezdi. Ekran da boş bir not
            satırı çizmek zorunda kalırdı.
          */
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      });

      setResult(res);
      setQuantity('');
      setNote('');
      resetKey(); // emir geçti, sonraki emir yeni bir kimlik alacak

      await loadPortfolio();
      onOrderPlaced?.();
    } catch (err) {
      // apiFetch hata mesajını sunucudan alıyor; kodu tanıyorsak
      // kendi Türkçe metnimizi tercih ediyoruz.
      /**
       * ⚠️ ARTIK METİNDE DEĞİL, KODDA ARANIYOR.
       *
       * Eski hâli `raw.includes('INSUFFICIENT_FUNDS')` diyordu — yani
       * sunucunun MESAJININ içinde kodu arıyordu. Sunucu kodu mesaja
       * koymadığı için tablo hiç eşleşmiyordu ve kullanıcı her zaman ham
       * sunucu mesajını görüyordu. Şans eseri çalışıyordu; mesajlar zaten
       * Türkçe.
       *
       * `client.ts` artık `ApiError` fırlatıyor ve kod içinde geliyor.
       *
       * ⚠️ TABLODA OLMAYAN KOD İÇİN SUNUCU MESAJI KULLANILIYOR — ve bu
       * bilinçli. `MARKET_CLOSED` tabloda YOK çünkü mesajı dinamik:
       * "Piyasa kapalı. Açılış: Perşembe 16:30". Sabit bir metinle
       * değiştirseydik açılış saatini kaybederdik.
       */
      const raw = err instanceof Error ? err.message : '';
      const code = err instanceof ApiError ? err.code : undefined;
      const known = code !== undefined ? ERROR_MESSAGES[code] : undefined;

      setError(known ?? raw ?? 'Emir gönderilemedi.');
      // ⚠️ Anahtar SIFIRLANMIYOR: kullanıcı tekrar denerse aynı emir
      // olduğunu sunucuya söyleyebilmeliyiz.
    } finally {
      setSubmitting(false);
    }
  }

  function fillMax() {
    const max =
      side === 'buy' ? maxBuyableQuantity(cashCents, price) : holding;

    setQuantity(max);
    resetKey();
  }

  const available =
    side === 'buy'
      ? formatCents(cashCents)
      : `${formatQuantity(holding)} ${symbol}`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Başlık */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
          <Text style={styles.title}>
            {name} ({symbol})
          </Text>
        </View>

        {/* Canlı fiyat */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Güncel fiyat</Text>
          <Text style={styles.priceValue}>
            {price === null ? '—' : formatPrice(price)}
          </Text>
          <Text style={styles.priceAge}>{formatRelativeTime(asOf)}</Text>
        </View>

        {/* Al / Sat */}
        <View style={styles.sideRow}>
          {(['buy', 'sell'] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setSide(s);
                resetKey(); // yön değişti -> başka bir emir
                setResult(null);
                setError('');
              }}
              style={[
                styles.sideButton,
                side === s && (s === 'buy' ? styles.buyActive : styles.sellActive),
              ]}
            >
              <Text
                style={[styles.sideText, side === s && styles.sideTextActive]}
              >
                {s === 'buy' ? 'AL' : 'SAT'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Giriş modu */}
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.mode, inputMode === 'quantity' && styles.modeOn]}
            onPress={() => setInputMode('quantity')}
          >
            <Text
              style={[
                styles.modeText,
                inputMode === 'quantity' && styles.modeTextOn,
              ]}
            >
              Miktar ({symbol})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.mode, inputMode === 'amount' && styles.modeOn]}
            onPress={() => setInputMode('amount')}
          >
            <Text
              style={[
                styles.modeText,
                inputMode === 'amount' && styles.modeTextOn,
              ]}
            >
              Tutar (₺)
            </Text>
          </Pressable>
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {inputMode === 'amount' ? 'Kaç liralık?' : `Miktar (${symbol})`}
          </Text>
          <Pressable onPress={fillMax} hitSlop={8}>
            <Text style={styles.available}>Kullanılabilir: {available}</Text>
          </Pressable>
        </View>

        {inputMode === 'quantity' ? (
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={(v) => {
              // Virgülü noktaya çeviriyoruz: Türkçe klavye virgül basıyor ama
              // sunucudaki şema yalnızca nokta kabul ediyor (makine biçimi).
              setQuantity(v.replace(',', '.'));
              resetKey(); // miktar değişti -> başka bir emir
              setResult(null);
            }}
            placeholder="0.00"
            placeholderTextColor={colors.inkFaint}
            keyboardType="decimal-pad"
            editable={!submitting}
          />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={amountInput}
              onChangeText={(v) => {
                const clean = v.replace(',', '.');
                setAmountInput(clean);
                resetKey();
                setResult(null);

                // Tutar -> miktar çevrimi ANINDA yapılıyor ve `quantity`
                // güncelleniyor. Gönderim anına bıraksaydık kullanıcı
                // kaç coin aldığını ancak emir geçtikten sonra görürdü.
                const cents = decimalToCents(clean === '' ? '0' : clean);
                setQuantity(quantityForAmount(cents, price));
              }}
              placeholder="0"
              placeholderTextColor={colors.inkFaint}
              keyboardType="decimal-pad"
              editable={!submitting}
            />

            {quantity !== '' && quantity !== '0' && (
              <Text style={styles.converted}>
                ≈ {formatQuantity(quantity)} {symbol}
              </Text>
            )}
          </>
        )}

        {/* Önizleme */}
        {estimate !== null && (
          <View style={styles.estimate}>
            <Row label="Tutar" value={formatCents(estimate.grossCents)} />
            <Row
              label="Komisyon (%0,1)"
              value={formatCents(estimate.feeCents)}
            />
            <View style={styles.divider} />
            <Row
              label={side === 'buy' ? 'Ödenecek' : 'Eline geçecek'}
              value={formatCents(estimate.netCents)}
              strong
            />
            <Text style={styles.disclaimer}>
              Tahmini tutar. Kesin fiyatı emir anında sunucu belirler.
            </Text>
          </View>
        )}

        {tooSmall && (
          <Text style={styles.warning}>
            ⚠️ Emir tutarı en az 1,00 ₺ olmalı.
          </Text>
        )}

        {error !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Sonuç */}
                  <Modal visible={result !== null} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalIconBox}>
                  <Text style={styles.modalIcon}>✅</Text>
                </View>
                <Text style={styles.modalTitle}>
                  İşlem Başarılı!
                </Text>
                <Text style={styles.modalSubtitle}>
                  {result?.side === 'buy' ? 'Alım' : 'Satım'} emriniz gerçekleşti
                </Text>
                
                <View style={styles.modalDetails}>
                  <Row
                    label="Miktar"
                    value={result ? `${formatQuantity(result.quantity)} ${result.symbol}` : ''}
                  />
                  <Row label="Fiyat" value={result ? formatPrice(result.priceTry) : ''} />
                  <Row label="Komisyon" value={result ? formatCentsString(result.feeCents) : ''} />
                  <View style={styles.modalDivider} />
                  <Row
                    label={result?.side === 'buy' ? 'Ödenen' : 'Alınan'}
                    value={result ? formatCentsString(result.netCents) : ''}
                    strong
                  />
                  <Row
                    label="Kalan Bakiye"
                    value={result ? formatCentsString(result.balanceCents) : ''}
                  />
                </View>
                
                {result?.replayed && (
                  <Text style={styles.disclaimer}>
                    Aynı istek daha önce gönderilmiş. Yeni emir oluşturulmadı,
                    bakiyeniz iki kez düşmedi.
                  </Text>
                )}

                <Pressable
                  style={styles.modalPrimaryButton}
                  onPress={() => {
                    if (onGoToWallet) onGoToWallet();
                    else onClose();
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>Cüzdana Git</Text>
                </Pressable>
                
                <Pressable
                  style={styles.modalSecondaryButton}
                  onPress={() => onClose()}
                >
                  <Text style={styles.modalSecondaryButtonText}>Kapat</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

        {/*
          Piyasa kapalıysa SEBEBİ yazılıyor, sadece düğme kapatılmıyor.

          ⚠️ Tepkisiz bir düğme, hata mesajından DAHA KÖTÜ. Kullanıcı
          basar, hiçbir şey olmaz, uygulamanın bozuk olduğunu düşünür.
          Kapatmanın işe yaraması için gerekçenin görünmesi şart.

          Metin sunucudakiyle aynı olmak zorunda değil: burada henüz emir
          göndermedik, dolayısıyla açılış saatini bilmiyoruz. Sunucu
          reddederken tam saati söylüyor (`describeNextSessionOpen`).
        */}
        {/*
          KARAR NOTU — onay düğmesinin hemen ÜSTÜNDE.

          ⚠️ YERİ RASTGELE DEĞİL. Not, emir verilmeden ÖNCE yazılmalı:
          sonradan sorulsaydı kullanıcı gerekçeyi sonucu bildikten sonra
          uydururdu ("zaten yükseleceğini biliyordum"). Karar anındaki
          düşünceyi yakalamak, o düşünceyi sonradan hatırlamaktan
          tamamen farklı bir şey — ve özelliğin tek değeri bu.

          ⚠️ Miktar alanının ALTINDA çünkü ikincil: emir notsuz da
          geçerli. Üstte olsaydı zorunluymuş gibi görünürdü.
        */}
        <View style={styles.noteBlock}>
          <Text style={styles.label}>Karar notu (isteğe bağlı)</Text>

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Neden bu emri veriyorsun?"
            placeholderTextColor={colors.inkPlaceholder}
            /* Sunucudaki Zod şeması da 500 — ikisi ayrışmasın. */
            maxLength={500}
            multiline
            editable={!submitting}
          />

          <Text style={styles.noteHint}>
            Sonradan Cüzdan'daki işlem geçmişinde görünür.
          </Text>
        </View>

        {!tradable && (
          <View style={styles.closedBox}>
            <Text style={styles.closedText}>
              🔴 ABD borsası kapalı. İşlem saatleri hafta içi 16:30 – 23:00.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          style={[
            styles.submit,
            side === 'buy' ? styles.submitBuy : styles.submitSell,
            !canSubmit && styles.submitDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.submitText}>
              {side === 'buy' ? 'Satın Al' : 'Sat'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
  },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  modeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkMuted },
  modeTextOn: { fontFamily: fonts.bold, color: colors.onInverse },
  converted: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.gain,
    marginTop: 8,
  },

  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },

  header: { gap: 8, marginBottom: 16 },
  back: { color: colors.gain, fontSize: 15, fontFamily: fonts.semibold },
  title: { color: colors.ink, fontSize: 22, fontFamily: fonts.bold },

  priceCard: {
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  priceLabel: { color: colors.inkMuted, fontSize: 13 },
  priceValue: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.bold,
    marginVertical: 4,
  },
  priceAge: { color: colors.inkFaint, fontSize: 12 },

  sideRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  sideButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  buyActive: { backgroundColor: colors.gain, borderColor: colors.gain },
  sellActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sideText: { color: colors.inkMuted, fontFamily: fonts.bold, fontSize: 15 },
  sideTextActive: { color: colors.ink },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: { color: colors.ink, fontSize: 13, fontFamily: fonts.medium },
  available: { color: colors.gain, fontSize: 12 },

  input: {
    backgroundColor: colors.fieldFill,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 18,
  },

  noteBlock: { gap: 8, marginTop: 18 },
  noteInput: {
    backgroundColor: colors.fieldFill,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
    // Miktar alanından KÜÇÜK punto: o sayı, bu cümle.
    minHeight: 72,
    textAlignVertical: 'top',
  },
  noteHint: { color: colors.inkFaint, fontSize: 11 },

  estimate: {
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.inkMuted, fontSize: 13 },
  rowValue: { color: colors.ink, fontSize: 13, fontFamily: fonts.semibold },
  rowValueStrong: { color: colors.ink, fontSize: 16, fontFamily: fonts.bold },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 4 },
  disclaimer: {
    color: colors.inkFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  warning: { color: colors.warn, fontSize: 13, marginTop: 12 },

  errorBox: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: { color: colors.error, fontSize: 13 },
  closedBox: {
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  closedText: { color: colors.warn, fontSize: 13, lineHeight: 18 },

  resultBox: {
    backgroundColor: colors.gainSoft,
    borderColor: colors.gain,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.fieldFill,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gainSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  modalDetails: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.hairlineSoft,
    marginVertical: 4,
  },
  modalPrimaryButton: {
    width: '100%',
    backgroundColor: colors.gain,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrimaryButtonText: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  modalSecondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: colors.inkMuted,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  resultTitle: {
    color: colors.gain,
    fontSize: 15,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },

  submit: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
  },
  submitBuy: { backgroundColor: colors.gain },
  submitSell: { backgroundColor: colors.accent },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: colors.ink, fontSize: 17, fontFamily: fonts.bold },
});
