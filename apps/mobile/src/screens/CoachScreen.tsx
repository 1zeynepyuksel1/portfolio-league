import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { BehaviorCard } from '../components/BehaviorCard';
import { colors, fonts, radius, spacing, type } from '../theme';

/**
 * Ekran başlığındaki maskot — TAM sürüm, halkasıyla.
 *
 * ⚠️ Sekme ve sohbet avatarı KAFA kırpımını kullanıyor çünkü 26-34
 * pikselde tam maskot okunmuyor. Başlıkta halkanın tamamı görünebiliyor
 * ve markanın asıl hâli bu.
 */
const MASKOT = require('../../assets/kocai/kocai-full.png');

/**
 * CoachScreen — yatırım alışkanlıkları ve sohbet.
 *
 * ⚠️ BAŞLIK YENİDEN TASARLANDI — ÖNCEKİ HÂLİ EKRANI "AYAR SAYFASI"
 * GİBİ GÖSTERİYORDU.
 *
 * Eskiden: 40 piksellik maskot, yanında düz metin "KocAI", altında iki
 * satırlık gri paragraf. Üçü de aynı ağırlıkta, hiçbiri diğerinden
 * önemli görünmüyordu — ve gri paragraf en çok yer kaplayan şeydi.
 *
 * Şimdi bir TANITIM BLOĞU:
 *
 *   - maskot büyüdü (40 -> 56) ve kendi yuvasına oturdu; artık ekranın
 *     kimliği, bir liste öğesinin simgesi değil
 *   - adın altına ne yaptığını söyleyen tek satır geldi
 *   - kısıt uyarısı gri paragraf olmaktan çıkıp KÜÇÜK BİR ROZETE döndü
 *
 * ⚠️ KISIT NEDEN ROZET OLDU. O metin bir açıklama değil, bir SÖZ:
 * "fiyat tahmini yapmam". Paragraf hâlindeyken okunmuyordu ve ekranın
 * en büyük gri bloğuydu. Rozet küçük ama gözden kaçmıyor — ve kalkan
 * simgesi "bu bir sınır" fikrini kelimeden önce iletiyor.
 *
 * ⚠️ İÇERİK ÇOĞALTILMADI. `BehaviorCard` hâlâ tek bileşen ve tüm
 * istekler onun içinde. Burada yalnızca sayfa iskeleti var.
 */
export function CoachScreen() {
  return (
    <ScrollView
        showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        {/*
          ⚠️ MASKOT KENDİ YUVASINDA. Doğrudan zemine koyduğumuzda
          görselin saydam kenarları arka planla karışıyor ve maskot
          "yapıştırılmış" duruyordu. İnce kenarlıklı bir daire onu
          ekrana bağlıyor.
        */}
        <View style={styles.avatarWrap}>
          <Image source={MASKOT} style={styles.avatar} accessibilityLabel="KocAI" />
        </View>

        <View style={styles.heroText}>
          <Text style={styles.title}>KocAI</Text>
          <Text style={styles.tagline}>
            Alım-satım geçmişini okur, alışkanlıklarını söyler.
          </Text>
        </View>
      </View>

      {/*
        ⚠️ SINIR ÖNDEN SÖYLENİYOR — VE BU BİR KULLANIM SORUNUNU ÇÖZÜYOR.

        Kullanıcı "yapay zekâ" görünce fiyat sorusu sormaya meyilli; bot
        reddedince özelliğin bozuk olduğunu sanıyor. Ne YAPMADIĞINI
        baştan yazmak, reddedilmeyi bir arıza olmaktan çıkarıyor.
      */}
      <View style={styles.guardrail}>
        <ShieldCheck size={14} color={colors.inkMuted} strokeWidth={2} />
        <Text style={styles.guardrailText}>
          Fiyat tahmini ve yatırım tavsiyesi vermez
        </Text>
      </View>

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

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 52, height: 52 },
  heroText: { flex: 1 },
  title: {
    fontFamily: fonts.bold,
    fontSize: type.headline,
    color: colors.ink,
    /*
      ⚠️ NEGATİF HARF ARALIĞI YALNIZCA BÜYÜK BOYUTTA. 26 piksellik bir
      başlıkta harfler varsayılan aralıkla dağınık duruyor; küçük
      metinde aynı şeyi yapmak okunurluğu düşürürdü.
    */
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    color: colors.inkMuted,
    marginTop: 2,
  },

  guardrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guardrailText: {
    fontFamily: fonts.medium,
    fontSize: type.caption,
    color: colors.inkMuted,
  },

  body: { marginTop: 0 },
});
