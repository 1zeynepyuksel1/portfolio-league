import React, { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wallet, LineChart, Trophy, User, Compass, Lightbulb } from 'lucide-react-native';
import { colors, fonts } from '../theme';

export type TabKey =
  | 'coach'
  | 'wallet'
  | 'market'
  | 'discovery'
  | 'league'
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
  { key: 'league', label: 'Lig' },
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
 * KocAI — ampul.
 *
 * ⚠️ KIVILCIM/ROBOT SİMGESİ SEÇİLMEDİ. Onlar "yapay zekâ" diyor; oysa
 * sekmenin içeriği ÖLÇÜM (yedi gösterge, kesin sayılarla) ve model onun
 * üstüne konuşuyor. Ampul "içgörü" diyor — yapılan işi anlatıyor, aracı
 * değil.
 */
function CoachIcon({ color }: { color: string }) {
  return <Lightbulb size={24} color={color} strokeWidth={2} />;
}

function ProfileIcon({ color }: { color: string }) {
  return <User size={24} color={color} strokeWidth={2} />;
}

const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
  coach: CoachIcon,
  wallet: WalletIcon,
  market: MarketIcon,
  discovery: DiscoveryIcon,
  league: LeagueIcon,
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
