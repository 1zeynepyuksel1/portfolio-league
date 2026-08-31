import type { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { colors, fonts } from '../theme';

/**
 * TabBar — `docs/export/8a` ve `9a`'nın alt çubuğu.
 *
 * ⚠️ SEKME SAYISI BEŞTEN DÖRDE İNDİ ve bu tasarımın kararı.
 *
 * Eskiden Arkadaşlar ayrı bir sekmeydi. Tasarım onu Lig'in içine bir
 * alt sekme olarak koyuyor (`Genel Lig` / `Arkadaşlarım`), çünkü ikisi
 * de aynı soruyu soruyor: "başkalarına göre neredeyim". Ayrı sekme
 * olduğunda kullanıcı ikisi arasında gidip gelerek karşılaştırmak
 * zorundaydı; artık yan yanalar.
 *
 * ⚠️ İKONLAR EMOJİ DEĞİL, SVG. Emoji her platformda farklı çiziliyor
 * (iOS'ta renkli Apple seti, Android'de Noto, web'de sistem fontu) ve
 * boyutları tutmuyor. Tasarımın ince çizgili ikonlarına benzemeleri
 * imkânsız. SVG her yerde birebir aynı.
 */

export type TabKey =
  | 'wallet'
  | 'market'
  | 'league'
  | 'whatif'
  | 'coach'
  | 'profile';

/**
 * ⚠️ ALTINCI SEKME EKLENDİ — VE BU ÖNCEKİ NOTU ÇÜRÜTÜYOR.
 *
 * Burada uzun süre "beşten fazlası alt çubuğu okunmaz yapar" yazıyordu ve
 * davranış analizi bu yüzden Profil'in içine konmuştu. Karar değişti:
 * özellik büyüdü (yedi gösterge + yapay zekâ yorumu + sohbet) ve bir
 * ayarlar sayfasının içinde durmayacak kadar bağımsız bir iş oldu.
 *
 * Bedeli gerçek: altı sekmede her birine ekranın ~%16'sı düşüyor. Onun
 * için etiket kısa tutuldu: 'KocAI', beş harf. 'Alışkanlıklar' ya da
 * 'Analiz' yazsaydık en uzun etiket olur ve çubuğun tamamını daraltırdı.
 *
 * ⚠️ 'KOÇ' DEĞİL 'KocAI' — ve inceltme işareti bilerek yok. 'Koç' Türkçe
 * yazımı doğru olan hâli ama etiket bir MARKA adı gibi kullanılıyor;
 * 'KocAI' iki parçayı (koç + AI) tek kelimede birleştiriyor ve
 * 'KoçAI' yazımı okurken duraksatıyor.
 *
 * ⚠️ YEDİNCİ SEKME EKLENMEMELİ. Altı sınırın kendisi; bir tane daha
 * eklenirse etiketler kırpılmaya başlar ve simgeler tek başına kalır.
 */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'coach', label: 'KocAI' },
  { key: 'market', label: 'Piyasa' },
  { key: 'league', label: 'Lig' },
  { key: 'whatif', label: 'Alsaydın' },
  { key: 'wallet', label: 'Cüzdan' },
  { key: 'profile', label: 'Profil' },
];

/*
  ⚠️ SIRA DEĞİŞTİ AMA `START_TAB` DEĞİŞMEDİ — VE İKİSİ AYRI ŞEYLER.

  Bu dizi sekmelerin ÇİZİLME sırasını belirliyor; uygulamanın hangi
  sekmeyle AÇILDIĞINI `App.tsx`'teki `START_TAB` söylüyor ve o hâlâ
  'wallet'. Yani KocAI en solda duruyor ama uygulama yine Cüzdan'da
  açılıyor.

  Karıştırılırsa sinsi bir hata çıkar: diziyi sıralamak "ilk sekme
  açılsın" sanılır, oysa ilişki yok. İkisinin ayrı durması bilinçli —
  kullanıcı en çok Cüzdan'a bakıyor, ama en soldaki yer yeni özelliğin
  görünmesi için ayrıldı.
*/

/** Cüzdan — kart yuvası. */
function WalletIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={6} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18" />
      <Path d="M17 14.5h.01" />
    </Svg>
  );
}

/** Piyasa — sütun grafiği. */
function MarketIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round">
      <Path d="M5 15v4" />
      <Path d="M10 9v10" />
      <Path d="M15 12v7" />
      <Path d="M20 5v14" />
    </Svg>
  );
}

/** Lig — kupa. */
function LeagueIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <Path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4" />
      <Path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 4" />
      <Path d="M12 14v3" />
      <Path d="M8.5 20h7" />
    </Svg>
  );
}

/** Ya alsaydın — geriye saat. */
function HistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12a9 9 0 1 0 3-6.7" />
      <Polyline points="3,4 3,9 8,9" />
      <Path d="M12 8v4.5l3 1.8" />
    </Svg>
  );
}

// ⚠️ `JSX.Element` DEĞİL, `ReactElement`. Yeni JSX dönüşümünde global
// `JSX` ad alanı yok; React'ten içe aktarılan tip kullanılıyor.
/** Profil — omuz ve baş. */
function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={3.6} />
      <Path d="M4.5 20c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6" />
    </Svg>
  );
}

/**
 * Koç — konuşma balonu + içinde yükselen çizgi.
 *
 * ⚠️ ROBOT/KIVILCIM SİMGESİ KULLANILMADI. "Yapay zekâ" çağrışımı yapan
 * simgeler özelliği modelin kendisi gibi gösterir; oysa sekmenin içeriği
 * ÖLÇÜM (yedi gösterge, kesin sayılarla), model onun üstüne konuşuyor.
 * Konuşma balonu + grafik çizgisi ikisini birlikte anlatıyor.
 */
function CoachIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5.5h16v11H9l-4 3.5v-3.5H4z" />
      <Polyline points="7.5,13 10.5,10 13,12 16.5,8.5" />
    </Svg>
  );
}

const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
  wallet: WalletIcon,
  market: MarketIcon,
  league: LeagueIcon,
  whatif: HistoryIcon,
  coach: CoachIcon,
  profile: ProfileIcon,
};

export function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /**
   * Sekme üstünde gösterilecek sayılar. Verilmeyen ya da 0 olan sekmede
   * rozet çizilmiyor.
   *
   * ⚠️ SEKMEYE DEĞİL, DIŞARIDAN GELİYOR. TabBar'ın kendisi veri çekseydi
   * bir görünüm bileşeni ağ isteği yapıyor olurdu; hangi ekranda olursa
   * olsun tazelenmesi gereken bir sayı, kabuk katmanının işi (App.tsx).
   */
  badges?: Partial<Record<TabKey, number>> | undefined;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        const Icon = ICONS[tab.key];
        // Aktif sekme BEYAZ, pasif soluk. Renk kullanmıyoruz: yeşil/kırmızı
        // bu uygulamada yön demek, aktif sekmeyi yeşil yapsaydık "yükseliş"
        // gibi okunurdu.
        const color = on ? colors.ink : colors.inkFaint;
        const badge = badges?.[tab.key] ?? 0;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
          >
            <View>
              <Icon color={color} />

              {/*
                ⚠️ ROZET SİMGENİN ÜSTÜNDE, ETİKETİN DEĞİL — ve konumu
                `position: absolute`. Akışa koysaydık sekmenin genişliği
                rozet çıkınca değişir, beş sekme birden kayardı: kullanıcı
                tam dokunacakken düğmeler yer değiştirirdi.
              */}
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 9 ? '9+' : badge}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.label, { color }, on && styles.labelOn]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Bildirim rozeti.
   *
   * ⚠️ RENK `accent`, `gain`/`loss` DEĞİL. Bu uygulamada yeşil ve kırmızı
   * YÖN demek (kazanç/kayıp). Rozeti yeşil yapsaydık "kazandın" gibi,
   * kırmızı yapsaydık "kaybettin" gibi okunurdu; oysa taşıdığı bilgi
   * "bekleyen bir şey var".
   */
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    // Koyu çubuk üstünde rozetin kenarı simgeye yapışmasın.
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.onInverse,
    lineHeight: 12,
  },

  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 10,
    // Alt boşluk: telefonun ana ekran çizgisi çubuğun üstüne binmesin.
    paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  /*
    ⚠️ PUNTO 10 -> 9 VE HARF ARALIĞI SIFIRA İNDİ.

    Altıncı sekmeyle birlikte 'Alsaydın' (en uzun etiket) 10 puntoda
    komşusuna değiyordu. Etiketi kısaltmak yerine puntoyu düşürdük:
    'Alsaydın' zaten bir kez kısaltılmış bir ad, daha da kısaltmak
    anlamını götürürdü.
  */
  label: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 0 },
  labelOn: { fontFamily: fonts.semibold },
});
