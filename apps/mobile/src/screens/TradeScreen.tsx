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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
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
};

type AssetRow = { symbol: string; priceTry: string | null; asOf: string | null };

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

export function TradeScreen({ symbol, name, onClose, onOrderPlaced }: Props) {
  const [side, setSide] = useState<Side>('buy');
  const [quantity, setQuantity] = useState('');

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
    !submitting && estimate !== null && !tooSmall && price !== null;

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
        body: JSON.stringify({ symbol, side, quantity: quantity.trim() }),
      });

      setResult(res);
      setQuantity('');
      resetKey(); // emir geçti, sonraki emir yeni bir kimlik alacak

      await loadPortfolio();
      onOrderPlaced?.();
    } catch (err) {
      // apiFetch hata mesajını sunucudan alıyor; kodu tanıyorsak
      // kendi Türkçe metnimizi tercih ediyoruz.
      const raw = err instanceof Error ? err.message : '';
      const known = Object.keys(ERROR_MESSAGES).find((code) =>
        raw.includes(code),
      );

      setError(
        known !== undefined
          ? (ERROR_MESSAGES[known] as string)
          : raw || 'Emir gönderilemedi.',
      );
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
        {result !== null && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>
              {result.replayed ? '↺ Bu emir zaten işlenmişti' : '✅ Emir geçti'}
            </Text>
            <Row
              label={result.side === 'buy' ? 'Alınan' : 'Satılan'}
              value={`${formatQuantity(result.quantity)} ${result.symbol}`}
            />
            <Row label="Fiyat" value={formatPrice(result.priceTry)} />
            <Row label="Komisyon" value={formatCentsString(result.feeCents)} />
            <Row
              label={result.side === 'buy' ? 'Ödenen' : 'Alınan'}
              value={formatCentsString(result.netCents)}
              strong
            />
            <Row
              label="Kalan bakiye"
              value={formatCentsString(result.balanceCents)}
            />
            {result.replayed && (
              <Text style={styles.disclaimer}>
                Aynı istek daha önce gönderilmiş. Yeni emir oluşturulmadı,
                bakiyeniz iki kez düşmedi.
              </Text>
            )}
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

  resultBox: {
    backgroundColor: colors.gainSoft,
    borderColor: colors.gain,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 6,
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
