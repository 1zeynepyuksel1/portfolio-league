import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
/**
 * ⚠️ UZANTI YOK — VE BU CLAUDE.md'DEKİ 4. TUZAK.
 *
 * API tarafı `moduleResolution: nodenext` kullanıyor, orada göreli
 * import'larda `.js` ZORUNLU. Mobil taraf `bundler` kullanıyor, orada
 * yazılmaz. Alışkanlıkla `./storage.js` yazmıştım.
 *
 * ⚠️ Ve `npm run typecheck` BUNU YAKALAMADI: TypeScript `.js`'i `.ts`'e
 * eşliyor, sorun görmüyor. Hata ancak Metro paketlerken çıktı. Yani
 * tip kontrolü ile paketleme İKİ FARKLI ŞEYİ ölçüyor — biri diğerinin
 * yerini tutmuyor (money.ts notundaki test/typecheck ayrımının aynısı).
 */
import { getPreference, setPreference } from './storage';

/**
 * currency.tsx — TL / USD gösterim tercihi.
 *
 * ⚠️ BU BİR GÖSTERİM MERCEĞİ, PARA BİRİMİ DEĞİŞTİRME DEĞİL.
 *
 * Nakit bakiye sunucuda TL kuruşu olarak duruyor ve öyle kalıyor. Dolar
 * görünümü `bakiyeTL ÷ güncel kur` ile HESAPLANIYOR, saklanmıyor. İki para
 * biriminde bakiye tutmak yeni bir hata sınıfı açar: hangisi doğru? emir
 * hangisinden düşer? kur değişince ikisi nasıl uyumlu kalır?
 *
 * ⚠️ LİG SIRALAMASI BU DÜĞMEYE BAKMAZ. Sıralama TL bazlı TWR ile
 * yapılıyor (docs/01-plan.md). Baksaydı aynı portföy iki kullanıcının
 * ekranında farklı sırada görünürdü — çünkü tercih kullanıcıya özel.
 */

export type DisplayCurrency = 'try' | 'usd';

const STORAGE_KEY = 'pl_display_currency';

/** Varsayılan TL — lig TL bazlı, para TL kuruşu olarak tutuluyor. */
const DEFAULT_CURRENCY: DisplayCurrency = 'try';

type CurrencyContextValue = {
  currency: DisplayCurrency;
  /** Sunucuya gidecek sorgu parçası: `?currency=usd`. */
  query: string;
  toggle: () => void;
  /** Tercih depodan okunana kadar `true`. */
  loading: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  /**
   * Tercih uygulama açılışında bir kez okunuyor.
   *
   * ⚠️ OKUMA ASENKRON — ilk çizimde tercih HENÜZ BİLİNMİYOR. `loading`
   * bayrağı olmasaydı ekran önce TL çizer, yarım saniye sonra dolara
   * atlardı; kullanıcı bunu bir hata sanır.
   */
  useEffect(() => {
    let cancelled = false;

    void getPreference(STORAGE_KEY).then((stored) => {
      if (cancelled) return;

      // Depoda saçma bir değer varsa (elle kurcalanmış localStorage)
      // varsayılana dönülüyor — uydurma bir para birimi sunucuya gitmesin.
      if (stored === 'try' || stored === 'usd') setCurrency(stored);

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setCurrency((previous) => {
      const next: DisplayCurrency = previous === 'try' ? 'usd' : 'try';

      // Yazma beklenmiyor: kullanıcı düğmeye bastığı an ekran değişmeli.
      // Yazma başarısız olursa sadece "hatırlamama" olur, veri kaybı değil.
      void setPreference(STORAGE_KEY, next);

      return next;
    });
  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        query: currency === 'usd' ? '?currency=usd' : '',
        toggle,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * ⚠️ Provider dışında çağrılırsa SESSİZCE varsayılana düşmüyor, hata
 * fırlatıyor. Sessiz varsayılan, "düğmeye bastım ama bu ekran değişmedi"
 * hatasını gizler — ve o hata ancak ekrana bakarak fark edilir.
 */
export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext);

  if (value === null) {
    throw new Error('useCurrency yalnızca CurrencyProvider içinde kullanılır.');
  }

  return value;
}
