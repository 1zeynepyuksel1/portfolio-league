import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BehaviorCard } from '../components/BehaviorCard';
import { colors, fonts, spacing } from '../theme';

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
      <Text style={styles.title}>KocAI</Text>

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
    paddingTop: 18,
    // Alt çubuğun üstüne binmesin; sohbet kutusu en altta.
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
    marginBottom: 22,
  },
  body: { marginTop: 2 },
});
