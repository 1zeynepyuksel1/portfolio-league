import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BehaviorCard } from '../components/BehaviorCard';
import { colors, fonts, spacing } from '../theme';

/**
 * Ekran başlığındaki maskot — TAM sürüm, halkasıyla.
 *
 * ⚠️ Sekme ve sohbet avatarı KAFA kırpımını kullanıyor çünkü 26-34
 * pikselde tam maskot okunmuyor. Başlık 40 piksel ve tek başına duruyor;
 * burada halkanın tamamı görünebiliyor ve markanın asıl hâli bu.
 */
const MASKOT = require('../../assets/kocai/kocai-full.png');

/**
 * CoachScreen — yatırım alışkanlıkları ve sohbet.
 *
 * ⚠️ ÖNCE PROFİL'İN İÇİNDEYDİ, SEKMEYE TAŞINDI.
 *
 * İlk yerleştirmenin gerekçesi `TabBar.tsx`'te yazılıydı: alt çubukta beş
 * sekme vardı ve "beşten fazlası okunmaz" deniyordu. Karar değişti çünkü
 * özellik büyüdü — yedi gösterge, yapay zekâ yorumu ve sohbet, bir
 * ayarlar sayfasının altında duracak kadar küçük değil.
 *
 * ⚠️ İÇERİK ÇOĞALTILMADI, TAŞINDI. `BehaviorCard` hâlâ tek bileşen;
 * Profil'den kaldırıldı, buraya kondu. İki yerde bırakmak aynı veriyi
 * iki kez çeken, biri düzeltilip öteki eskiyen bir kopya üretirdi — bu
 * projede bulunan hataların en sık türü.
 *
 * ⚠️ EKRAN KENDİ VERİSİNİ ÇEKMİYOR. Tüm istekler `BehaviorCard`'ın
 * içinde. Burada yalnızca sayfa iskeleti var: başlık, kaydırma, boşluk.
 * Veri çekmeyi buraya taşısaydık bileşen tek başına kullanılamaz hâle
 * gelirdi.
 */
export function CoachScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/*
        BAŞLIK — maskot + ad.

        ⚠️ Aynı görsel sekmede, başlıkta ve sohbet balonlarında
        kullanılıyor. Üç yerde farklı bir simge koysaydık kullanıcı
        bunların aynı şey olduğunu bağlayamazdı; tek yüz, tek kimlik.
      */}
      <View style={styles.titleRow}>
        <Image source={MASKOT} style={styles.titleLogo} accessibilityLabel="KocAI" />
        <Text style={styles.title}>KocAI</Text>
      </View>

      {/*
        ⚠️ ALT BAŞLIK SINIRI ÖNDEN SÖYLÜYOR.

        Kullanıcı "yapay zekâ" görünce fiyat sorusu sormaya meyilli; bot
        reddedince özelliğin bozuk olduğunu sanıyor. Ne yaptığını baştan
        yazmak, reddedilmeyi bir arıza olmaktan çıkarıyor.
      */}
      <Text style={styles.subtitle}>
        Kendi alım-satım geçmişinden ölçülen alışkanlıklar. Fiyat tahmini
        ya da yatırım tavsiyesi yok.
      </Text>

      <View style={styles.body}>
        <BehaviorCard />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
    // Alt çubuğun üstüne binmesin; sohbet kutusu en altta.
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  titleLogo: { width: 40, height: 40, borderRadius: 20 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  body: { marginTop: 2 },
});
