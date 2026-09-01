import React, { ReactElement } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wallet, LineChart, Trophy, User, Compass } from 'lucide-react-native';
import { colors, fonts } from '../theme';

/**
 * ⚠️ 'league' BURADAN KALDIRILDI — SEKME SİLİNMEDİ, TAŞINDI.
 *
 * Lig artık Keşfet'in içinde bir üst sekme (`Akış · Lig · Alsaydın ·
 * Sosyal`). Gerekçe: altı alt sekme ekranın her birine ~%16 veriyordu ve
 * etiketler sığmıyordu; ayrıca Lig kavramsal olarak zaten sosyal tarafa
 * ait — sıralama, arkadaşlar ve akış aynı yerde.
 *
 * ⚠️ TİPTEN ÇIKARMAK BİLİNÇLİ: `'league'` bir yerde hâlâ kullanılıyorsa
 * TypeScript onu gösterir. Tipte bıraksaydık ölü bir dal sessizce
 * kalırdı ve hiçbir zaman çizilmeyen bir sekmeye geçiş yapan kod
 * fark edilmezdi.
 */
export type TabKey =
  | 'coach'
  | 'wallet'
  | 'market'
  | 'discovery'
  | 'profile';

/**
 * ⚠️ ALTINCI SEKME: KocAI — davranış göstergeleri + yapay zekâ.
 *
 * Beş sekmeye bir tane daha eklendi. Bedeli gerçek: her sekmeye ekranın
 * ~%16'sı düşüyor. Etiket bu yüzden kısa ('KocAI', beş harf); uzun bir ad
 * altı sekmenin tamamını daraltırdı.
 *
 * ⚠️ YEDİNCİ SEKME EKLENMEMELİ. Altı, etiketlerin okunabildiği sınır.
 * Yeni bir özellik gelirse mevcut bir sekmenin İÇİNE alt sekme olarak
 * konmalı — nitekim 'Ya alsaydın', çark ve astro tam olarak öyle yapıldı
 * (`DiscoveryScreen`).
 *
 * ⚠️ SIRA DEĞİŞTİ AMA `START_TAB` DEĞİŞMEDİ — VE İKİSİ AYRI ŞEYLER.
 *
 * Bu dizi sekmelerin ÇİZİLME sırasını belirliyor; uygulamanın hangi
 * sekmeyle AÇILDIĞINI `App.tsx`'teki `START_TAB` söylüyor ve o hâlâ
 * 'wallet'. Yani KocAI en solda duruyor ama uygulama Cüzdan'da açılıyor.
 * Karıştırılırsa "diziyi sıraladım, ilk sekme açılır" sanılır; ilişki yok.
 */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'coach', label: 'KocAI' },
  { key: 'market', label: 'Piyasa' },
  { key: 'discovery', label: 'Keşfet' },
  { key: 'wallet', label: 'Cüzdan' },
  { key: 'profile', label: 'Profil' },
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

function ProfileIcon({ color }: { color: string }) {
  return <User size={24} color={color} strokeWidth={2} />;
}

const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
  coach: CoachIcon,
  wallet: WalletIcon,
  market: MarketIcon,
  discovery: DiscoveryIcon,
  profile: ProfileIcon,
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
          >
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
  },
  coachIcon: { width: 26, height: 26 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
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
