/**
 * WelcomeScreen — uygulamanın ilk açılış ekranı.
 *
 * Kaynak: design_handoff_portfolioyun_auth/README.md §1
 *
 * ⚠️ METİNLER ÜRÜNE UYARLANDI — ve nedeni ciddi.
 *
 * Tasarımda üç iddia vardı, üçü de ürün için doğru değil:
 *
 *   "SPK lisanslı"            -> Portfolioyun sanal bakiyeli bir simülasyon.
 *                                SPK lisansı iddiası gerçek dışı bir
 *                                DÜZENLEYİCİ BEYAN olur. Yazılmadı.
 *   "Komisyonsuz ilk 30 gün"  -> İlk emirden itibaren %0,1 komisyon var
 *                                (orders/calculate.ts FEE_BASIS_POINTS = 10).
 *   "Hisse, fon ve kripto"    -> Fon hiç yok.
 *
 * Yerlerine doğru olan ve aynı ritmi tutan metinler kondu. Düzen, punto,
 * renk, boşluk tasarımdaki gibi bırakıldı — değişen yalnızca kelimeler.
 *
 * Bir pazarlama metni ürünün yapabildiğinden fazlasını söylüyorsa, o metni
 * düzeltmek tasarımı bozmak değil; tasarımı doğru kılmaktır.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck, Trophy, History, MessagesSquare } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChartBackground } from '../components/ChartBackground';
import {
  HomeIndicator,
  PrimaryButton,
  SecondaryButton,
} from '../components/AuthControls';
import { colors, fonts, spacing } from '../theme';

type Props = {
  onGoToRegister: () => void;
  onGoToLogin: () => void;
};

/**
 * KocAI maskotu — TAM sürüm.
 *
 * ⚠️ KAFA KIRPIMI DEĞİL. Sekme çubuğu ve sohbet avatarı `kocai-head`
 * kullanıyor çünkü 24-34 pikselde tam maskot okunmuyor. Burada yer var.
 */
const MASKOT = require('../../assets/kocai/kocai-full.png');

/**
 * Çip şeridi — bir GÜVENCE, üç ÖZELLİK.
 *
 * ⚠️ BURASI BİR KEZ BOŞALTILDI, ŞİMDİ YENİDEN DOLDU — VE ARADAKİ
 * FARK ÖNEMLİ.
 *
 * Silinen cümle şuydu: "ABD hissesi, kripto ve döviz tek portföyde."
 * O bir VARLIK listesiydi; aynı cümleyi Midas da Binance de kurabilir,
 * yani ayırt etmiyordu.
 *
 * Buradakiler farklı: haftalık lig, geçmişe dönük "ya alsaydın"
 * hesabı ve akış — üçü de rakiplerde YOK. Yani bu bir özellik listesi
 * değil, FARK listesi. Profesörün "value'nuzu göremiyorum"
 * eleştirisine doğrudan cevap veriyor.
 *
 * ⚠️ İLK ÇİP HÂLÂ GÜVENCE. "Sadece sanal bakiye" korkan kullanıcıya
 * (persona a) konuşan tek satır; özelliklerin arasına karışmasın diye
 * en başta duruyor. Sıra bir tasarım kararı.
 *
 * ⚠️ İKONLAR ARTIK `lucide` — elle yazılmış üç SVG silindi. Uygulamanın
 * geri kalanı zaten lucide kullanıyordu; bu ekran tek başına kendi
 * simgelerini çiziyordu. Aynı kalem, aynı çizgi kalınlığı.
 */
const TRUST_ITEMS = [
  { Icon: ShieldCheck,  label: 'Sadece sanal bakiye', tint: colors.gain },
  { Icon: Trophy,       label: 'Lig sistemi',         tint: colors.gold },
  { Icon: History,      label: 'Ya Alsaydın',         tint: colors.accent },
  { Icon: MessagesSquare, label: 'Forum',             tint: colors.violet },
];

export function WelcomeScreen({ onGoToRegister, onGoToLogin }: Props) {
  return (
    <View style={styles.root}>
      <ChartBackground />

      <View style={styles.content}>
        {/*
          Kahraman blok.

          ⚠️ SIRA DEĞİŞTİ: MARKA KÜÇÜLDÜ, VAAT BÜYÜDÜ.

          Eskiden en büyük yazı "Portfolioyun"du. Ama uygulamayı indiren
          kişi ADINI ZATEN BİLİYOR — ekranın en büyük yazısını bilinen
          bir bilgiye harcamak, bilinmeyeni (ne işe yaradığını)
          söylememek demek. Profesörün "ana value'nuzu burada
          görmüyorum" cümlesi tam olarak buydu.

          Marka kaybolmuyor, küçülüp yukarı çıkıyor.

          ⚠️ ÖZELLİK LİSTESİ SİLİNDİ — VE BU BİR KAYIP.
          "ABD hissesi, kripto ve döviz tek portföyde" cümlesi hangi
          varlıkların olduğunu söylüyordu. Ama bir ÖZELLİK listesi,
          vaat değil; aynı cümleyi Midas da Binance de kurabilir, yani
          AYIRT ETMİYOR. Varlık listesi Piyasa sekmesinde zaten var —
          oraya ULAŞAN kullanıcı görecek. Bu ekranın işi ulaştırmak.
        */}
        <View style={styles.hero}>
          {/*
            MARKA KİLİDİ (logo lockup) — maskot + kelime yan yana.

            ⚠️ İKİSİ AYRI DURUYORDU VE İKİSİ DE ZAYIFTI. Küçük harfli
            "PORTFOLIOYUN" bir üst etiketti, maskot ayrı bir görseldi;
            ikisi ilişkisiz iki öğe gibi okunuyordu. Yan yana gelince
            tek bir kimlik oluyorlar — maskot işaret, yazı ad.

            ⚠️ AMA HÂLÂ EN BÜYÜK YAZI DEĞİL. Marka 26 punto, vaat 44.
            Sıralama korunuyor: kullanıcı önce ne işe yaradığını, sonra
            adını okuyor. Markayı büyütmek bu ekranın işini bozardı.

            ⚠️ IŞILTI SÜS DEĞİL, SICAKLIK. Profesörün istediği şey
            "daha sıcakkanlı görünmesi"ydi. Koyu bir zeminde tek başına
            duran bir görsel "yapıştırılmış" durur; arkasındaki renkli
            hale onu ekrana bağlıyor. Gradyan SAYDAMA GİDİYOR, kenarı
            yok: sert kenarlı bir daire ikinci bir nesne olur ve
            maskotla yarışırdı. Sönen hale nesne değil, ATMOSFER.
          */}
          <View style={styles.lockup}>
            <View style={styles.mascotWrap}>
              <LinearGradient
                colors={['rgba(79,141,247,0.32)', 'rgba(18,209,142,0.12)', 'rgba(0,0,0,0)']}
                style={styles.mascotGlow}
              />
              <Image source={MASKOT} style={styles.mascot} accessibilityLabel="KocAI" />
            </View>

            <Text style={styles.brand}>Portfolioyun</Text>
          </View>

          {/*
            ⚠️ SATIR KIRIĞI ELLE VERİLİYOR (`{'\n'}`) — otomatik sarmaya
            bırakılmadı. Otomatik sarma ekran genişliğine göre değişir;
            dar bir telefonda "Yatırımı, kaybetmeden" / "öğren." diye
            bölünüp son satırda tek kelime kalabilir (tipografide "öksüz"
            denir ve dengesiz durur). Kırığı virgülden sonra sabitlemek
            her ekranda aynı ritmi veriyor.
          */}
          {/*
            ⚠️ TEK KELİME RENKLİ — VE O KELİME TESADÜF DEĞİL.

            Vaadin tamamı "yatırımı öğren"; ayırt eden kısım
            "kaybetmeden". Persona (a)'nın korkusuna cevap veren kelime
            o, dolayısıyla gözün ilk yakalayacağı yer de o olmalı.

            ⚠️ RENK ANLAM TAŞIYOR, SÜSLEMİYOR. Yeşil uygulamanın her
            yerinde "kâr / güvenli taraf" demek; burada da aynı şeyi
            söylüyor. Rastgele bir vurgu rengi seçseydik kullanıcı
            renkten anlam çıkaramaz, sadece "renkli" görürdü.
          */}
          <Text style={styles.title}>
            {'Yatırımı,\n'}
            <Text style={styles.titleAccent}>kaybetmeden</Text>
            {' öğren.'}
          </Text>

          <Text style={styles.tagline}>
            Gerçek fiyatlarla dene, kararını yaz, sonucunu gör.
          </Text>

          <View style={styles.trustRow}>
            {TRUST_ITEMS.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.trustItem,
                  /*
                    ⚠️ ZEMİN VE KENAR, ÖĞENİN KENDİ RENGİNDEN TÜRETİLİYOR.
                    Üç çipe üç sabit renk yazsaydık tema değiştiğinde
                    geride kalırlardı — burada tek kaynak `item.tint`.
                    `12` ve `44` onaltılık alfa: ~%7 ve ~%27 opaklık.
                  */
                  { backgroundColor: `${item.tint}12`, borderColor: `${item.tint}44` },
                ]}
              >
                <item.Icon size={13} color={item.tint} strokeWidth={2} />
                <Text style={[styles.trustLabel, { color: item.tint }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Eylem bloğu — dibe yaslı */}
        <View style={styles.actions}>
          <PrimaryButton label="Hesap aç" onPress={onGoToRegister} />
          <SecondaryButton label="Giriş yap" onPress={onGoToLogin} />

          <Text style={styles.legal}>
            Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul
            edersiniz.
          </Text>

          <View style={styles.indicatorWrap}>
            <HomeIndicator />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
  },

  /*
    ⚠️ 'center' -> 'flex-start': İÇERİK YUKARI ÇIKTI.

    Dikeyde ortalanınca ekranın üst kenarıyla marka kilidi arasında
    ~90 piksellik boş bir bant kalıyordu. Ortalama "dengeli" görünür
    diye varsayılır ama burada tersini yaptı: içerik aşağı itilip
    üstte hiçbir işi olmayan bir boşluk doğdu.

    ⚠️ ORTALAMA HER ZAMAN DENGE DEMEK DEĞİL. Bir blok ekranın
    yarısından fazlasını dolduruyorsa (burada kilit + başlık + metin
    + çipler) ortalamak, kalan boşluğu tek bir yerde toplar. Üstten
    sabit bir pay verip aşağı doğru akıtmak daha dengeli duruyor.

    `paddingTop` ekranın üst güvenli alanına değmeyecek kadar var.
  */
  hero: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 18,
  },
  /*
    Marka adı — artık başlık değil, üst etiket.
    Harf aralığı AÇILDI: küçük ve seyrek harfler "logo" gibi okunuyor,
    aynı puntoda sıkışık bir metin ise gövde yazısı gibi durur.
  */
  /*
    Marka kilidi: maskot solda, ad sağda, dikeyde ortalı.
    ⚠️ `marginLeft: -6` — maskotun ışıltısı saydam bir halka olduğu
    için görsel kenar, kutunun kenarından içeride kalıyor. Negatif
    boşluk olmadan yazı "uzakta" duruyordu; göz halenin kendisini
    değil, maskotun kenarını referans alıyor.
  */
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  brand: {
    fontSize: 26,
    fontFamily: fonts.bold,
    // Büyük ve kalın bir kelimede harfler dağınık durur; hafif sıkıştırma
    // onu tek bir blok gibi gösteriyor — başlıkta da aynı yaklaşım var.
    letterSpacing: -0.6,
    color: colors.ink,
    /*
      ⚠️ -6 -> +8. Negatif boşluk maskotun saydam halesini telafi
      etsin diye konmuştu ama fazla geldi: yazı görselin üstüne
      binmiş gibi duruyordu. Kilitte iki öğe BİRBİRİNE AİT olmalı,
      YAPIŞIK değil — arada nefes payı olmadan tek bir bulanık kütle
      olarak okunuyor.
    */
    marginLeft: 8,
  },
  /*
    ⚠️ MASKOT SOLA YASLI, ORTALANMIŞ DEĞİL. Bloğun geri kalanı
    (`alignItems: 'flex-start'`) sola yaslı; maskotu ortalasaydık
    tek başına kaçık duran bir öğe olurdu ve dikey bir eksen
    kırılırdı.
  */
  /*
    ⚠️ MASKOT KÜÇÜLDÜ (104 -> 88). Tek başına dururken ekranın
    kahramanıydı; artık bir kilidin parçası. Aynı boyutta kalsaydı
    yanındaki yazıyı ezer, kilit "maskot + altyazı" gibi okunurdu.
  */
  mascotWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  mascot: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 44,
    // lineHeight punto'dan KÜÇÜK (46 × .98). Tasarımın istediği bu:
    // tek satırlık büyük başlıkta harfler biraz sıkışınca daha oturaklı
    // duruyor. Çok satırlı gövde metninde aynısını yapmak okunmaz kılardı.
    lineHeight: 46 * 0.98,
    fontFamily: fonts.bold,
    letterSpacing: -0.04 * 46,
    color: colors.ink,
  },
  /*
    Vaadin ayırt edici kelimesi. Punto ve yazı tipi başlıkla AYNI —
    değişen tek şey renk. Boyutu da değiştirseydik iki ayrı başlık
    gibi okunur, cümlenin bütünlüğü bozulurdu.
  */
  titleAccent: {
    color: colors.gain,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 16 * 1.45,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    maxWidth: 290,
    marginTop: 16,
  },
  /*
    ⚠️ `flexWrap` ŞART — ÇİP SAYISI 2'DEN 3'E ÇIKTI.

    Üç öğe ("Sadece sanal bakiye · 100.000 ₺ başlangıç · 7/24 emir")
    dar bir telefonda tek satıra sığmayabilir. Sarma olmadan son öğe
    ekrandan taşar ve sessizce kaybolur — yani en son eklenen bilgi
    hiç görünmez.

    Satır aralığı (`rowGap`) sütun aralığından küçük: alt satıra
    düşen çip, üsttekiyle aynı gruba ait olduğunu boşluktan anlatıyor.
  */
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 18,
    rowGap: 10,
    marginTop: 26,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // Çipler artık kutu: renkli zemin ancak bir yüzeye oturunca görünür.
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  trustLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.04 * 12,
    // Renk artık satır içinde `item.tint`'ten geliyor.
  },

  /*
    ⚠️ DÜĞMELER YUKARI ÇIKTI (24 -> 72).

    Çipler ile düğmeler arasında ~150 piksellik boş bir bant vardı;
    düğmeler ekranın en dibine yapışıktı. İkisi birlikte "içerik
    yukarıda, eylem aşağıda, arası boş" gibi duruyordu.

    ⚠️ Ama düğmeleri yukarı çekmek boşluğu YOK ETMİYOR — aşağı
    taşıyor. Bu bilinçli: alttaki boşluk artık arka plandaki
    grafiklerin göründüğü bir alan (ChartBackground'da y 795-840'a
    dört çizgi kondu), yani ölü değil.
  */
  actions: {
    paddingBottom: 72,
    gap: 10,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.inkGhost,
    textAlign: 'center',
    marginTop: 12,
  },
  indicatorWrap: {
    marginTop: 16,
  },
});
