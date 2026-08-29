import React, { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Wallet, LineChart, Trophy, User, Compass } from 'lucide-react-native';
import { colors, fonts } from '../theme';

export type TabKey = 'wallet' | 'market' | 'discovery' | 'league' | 'profile';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'wallet', label: 'Cüzdan' },
  { key: 'market', label: 'Piyasa' },
  { key: 'discovery', label: 'Keşfet' },
  { key: 'league', label: 'Lig' },
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

function ProfileIcon({ color }: { color: string }) {
  return <User size={24} color={color} strokeWidth={2} />;
}

const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
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
