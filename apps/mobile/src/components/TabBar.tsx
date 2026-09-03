import React, { ReactElement } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wallet, LineChart, Trophy, Compass } from 'lucide-react-native';
import { colors, fonts } from '../theme';

/**
 * ⚠️ SEKMELER İKİ TUR DEĞİŞTİ — SON HÂLİ VE NEDENİ.
 *
 * Tur 1: Lig, Keşfet'in içine alt sekme olarak taşındı (yer kazanmak
 *        için). Profesör itiraz etti: "3'de bunu çok saklamışsınız."
 * Tur 2: Profil sekmeden çıkarıldı, yerine `+` menüsü kondu. Menü
 *        Lig/Alsaydın/Sosyal taşıyordu — ama o üçü Keşfet'in içinde
 *        DE duruyordu. Aynı şeye iki kapı: kararsız bir yapı.
 *
 * ŞİMDİ: her şey bir tek yerde.
 *
 *   Akış · Piyasa · Lig · Cüzdan · KocAI        ← beş YER
 *   Profil       → sol üstteki avatar
 *   Ya Alsaydın  → Piyasa'nın alt sekmesi  (varlıkla ilgili bir ARAÇ)
 *   Sosyal       → Keşfet'in alt sekmesi
 *
 * ⚠️ AYRIMIN ADI: YER Mİ, ARAÇ MI. Bir "yer"e geri dönersin ve içeriği
 * zamanla değişir — sekmeye layık olan budur. Bir "araç"ı kullanır,
 * cevabını alır, çıkarsın; ona kalıcı bir kutu vermek yer israfıdır.
 * Alsaydın bir araç: kimse "Alsaydın'a bakayım" diye uygulamayı açmaz.
 *
 * ⚠️ LİG İKİ YERDEN GÖRÜNÜYOR AMA TEKRAR DEĞİL. Sekme "Lig var" der;
 * akışın üstündeki `LeagueRankCard` "Lig'de 4. sıradasın" der. Biri
 * navigasyon, öbürü davet. İkisi farklı iş yapıyor.
 *
 * ⚠️ ALTINCI SEKME EKLENMEMELİ. Beş, etiketlerin rahat okunduğu sınır.
 * Yeni bir özellik gelirse mevcut bir sekmenin İÇİNE alt sekme olarak
 * konmalı.
 *
 * ⚠️ SIRA İLE `START_TAB` AYRI ŞEYLER. Bu dizi sekmelerin ÇİZİLME
 * sırasını belirler; uygulamanın hangi sekmeyle AÇILDIĞINI App.tsx'teki
 * `START_TAB` söyler. Artık ikisi de 'discovery' — ama tesadüfen değil,
 * ayrı ayrı karar verildi.
 */
export type TabKey =
  | 'discovery'
  | 'market'
  | 'league'
  | 'wallet'
  | 'coach';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'discovery', label: 'Akış' },
  { key: 'market', label: 'Piyasa' },
  { key: 'league', label: 'Lig' },
  { key: 'wallet', label: 'Cüzdan' },
  { key: 'coach', label: 'KocAI' },
];

function WalletIcon({ color }: { color: string }) {
  return <Wallet size={24} color={color} strokeWidth={2} />;
}

function MarketIcon({ color }: { color: string }) {
  return <LineChart size={24} color={color} strokeWidth={2} />;
}

function DiscoveryIcon({ color }: { color: string }) {
  return <Compass size={24} color={color} strokeWidth={2} />;
}

function LeagueIcon({ color }: { color: string }) {
  return <Trophy size={24} color={color} strokeWidth={2} />;
}

/**
 * Maskotun KAFA kırpımı, 96 piksel (24pt × 4 retina).
 *
 * ⚠️ TAM MASKOT KULLANILAMADI — ÇALIŞTIRINCA GÖRÜLDÜ.
 *
 * İlk sürüm görselin tamamıydı ve alt çubukta "karanlık bir kare" gibi
 * duruyordu. İki ayrı sebep vardı:
 *
 *   1. Görselin kendi arka planı koyu lacivert, çubuğunki #0F0F10 —
 *      iki farklı koyu ton yan yana gelince kenar belli oluyordu.
 *   2. Robot dairenin içinde küçük kalıyor; 26 pikselde kalan şey
 *      koyu bir leke.
 *
 * Çözüm iki adımlı: köşeler dairesel maskeyle SAYDAM yapıldı (zemin
 * rengi ne olursa olsun oturuyor), ve kadraj robotun KAFASINA
 * yakınlaştırıldı. Kafa beyaz, gözler parlak — ikisi de açık renk, yani
 * koyu bir çubukta kendiliğinden ayrışıyor.
 */
const MASKOT_HEAD = require('../../assets/kocai/kocai-head.png');

/**
 * KocAI — maskot görseli.
 *
 * ⚠️ TEK RESİM SİMGE, BEŞ ÇİZGİ SİMGENİN ARASINDA — VE BEDELİ BİLİNİYOR.
 *
 * Diğer sekmeler `lucide` çizgi simgeleri: tek renkli, aktif olunca
 * beyaza dönüyor. Maskot bir ÇİZİM, yani rengi değişmiyor; aktif/pasif
 * ayrımını renkle değil OPAKLIKLA veriyoruz.
 *
 * Karşılığında marka kimliği kazanılıyor — KocAI'nin bir yüzü oluyor ve
 * kullanıcı sekmeyi metni okumadan tanıyor. Bunu istemek makul; ama
 * simge sistemine ait olmadığı da doğru, o yüzden yazılı duruyor.
 *
 * ⚠️ 24 PİKSELDE DETAY KAYBOLUYOR. Gözlük, kravat ve arkadaki grafik bu
 * boyutta ayırt edilemiyor; kalan şey beyaz bir kafa silueti. Yeterli,
 * çünkü sekmeyi tanıtan şey siluet ve renk.
 */
function CoachIcon({ color }: { color: string }) {
  return (
    <Image
      source={MASKOT_HEAD}
      style={[
        styles.coachIcon,
        // Aktif sekme tam opak, pasif sönük. `color` burada rengi değil
        // DURUMU taşıyor: çizgi simgeler onu doğrudan kullanıyor, resim
        // kullanamıyor.
        { opacity: color === colors.ink ? 1 : 0.45 },
      ]}
    />
  );
}

const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
  discovery: DiscoveryIcon,
  market: MarketIcon,
  league: LeagueIcon,
  wallet: WalletIcon,
  coach: CoachIcon,
};

export function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  badges?: Partial<Record<TabKey, number>> | undefined;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        const Icon = ICONS[tab.key];
        const color = on ? colors.accent : colors.inkFaint;
        const badgeCount = badges?.[tab.key];

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
          >
            {/*
              ⚠️ AKTİF SEKME YALNIZCA RENKLE BELLİ OLUYORDU — VE BU
              YETERSİZ.

              Renk tek başına bir gösterge olamaz: renk körlüğü olan
              kullanıcı mavi ile griyi ayırt edemez, ve güneşte ekranda
              zaten ikisi de soluk görünür. Erişilebilirlik kılavuzunun
              temel kuralı: bilgi asla YALNIZCA renkle taşınmaz.

              Üstteki ince çizgi ikinci bir işaret — biçim. Renk
              görünmese bile hangi sekmede olduğun belli.
            */}
            <View style={[styles.indicator, on && styles.indicatorOn]} />

            <View>
              <Icon color={color} />
              {!!badgeCount && badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 24, // iOS safe area adjustment
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /*
      ⚠️ EN AZ 44 PİKSEL YÜKSEKLİK. Dokunma hedefleri için kabul edilen
      alt sınır bu; altına inince kullanıcı ıskalıyor ve "uygulama
      tepki vermiyor" diye algılıyor. Simge 26, etiket 10 piksel;
      ikisi arasındaki boşlukla birlikte zaten yaklaşıyordu ama açıkça
      garantiye alındı.
    */
    minHeight: 44,
    paddingTop: 6,
  },
  /*
    Aktif sekmenin üstündeki ince çizgi. Pasifken de yer kaplıyor
    (saydam) — yoksa aktif sekme diğerlerinden 3 piksel aşağı kayar ve
    çubuk her dokunuşta oynardı.
  */
  indicator: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorOn: { backgroundColor: colors.accent },

  coachIcon: { width: 26, height: 26 },
  label: {
    fontFamily: fonts.medium,
    // ⚠️ 10 -> 11: beş sekmeye düşünce yer açıldı. 10 piksel etiket
    // okunabilirlik sınırının altındaydı.
    fontSize: 11,
    marginTop: 4,
    color: colors.inkFaint,
  },
  labelOn: {
    color: colors.accent,
    fontFamily: fonts.bold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.loss,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surfaceRaised,
  },
  badgeText: {
    color: colors.ink,
    fontSize: 10,
    fontFamily: fonts.bold,
  },
});
