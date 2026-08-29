import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Image, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { colors, fonts } from '../theme';
import { Heart, MessageSquare, TrendingUp, TrendingDown, Gift } from 'lucide-react-native';
import { WhatIfScreen } from './WhatIfScreen';
import { WheelTab } from '../components/WheelTab';
import { AstroTab } from '../components/AstroTab';

type DiscoveryTab = 'feed' | 'whatif' | 'wheel' | 'astro';

export function DiscoveryScreen() {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('feed');

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.topTabBar}>
          <TouchableOpacity onPress={() => setActiveTab('feed')} style={[styles.tabButton, activeTab === 'feed' && styles.tabButtonActive]}>
            <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Akış</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('whatif')} style={[styles.tabButton, activeTab === 'whatif' && styles.tabButtonActive]}>
            <Text style={[styles.tabText, activeTab === 'whatif' && styles.tabTextActive]}>Alsaydın</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('wheel')} style={[styles.tabButton, activeTab === 'wheel' && styles.tabButtonActive]}>
            <Text style={[styles.tabText, activeTab === 'wheel' && styles.tabTextActive]}>Çark</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('astro')} style={[styles.tabButton, activeTab === 'astro' && styles.tabButtonActive]}>
            <Text style={[styles.tabText, activeTab === 'astro' && styles.tabTextActive]}>Burç</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabBorderLine} />
      </SafeAreaView>

      <View style={styles.content}>
        {activeTab === 'feed' && <FeedTab />}
        {activeTab === 'whatif' && <WhatIfScreen />}
        {activeTab === 'wheel' && <WheelTab />}
        {activeTab === 'astro' && <AstroTab />}
      </View>
    </View>
  );
}

function FeedTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedContent}>
      {/* Post 1 */}
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarWrap}>
            <Image source={require('../../assets/avatars/bear.png')} style={styles.avatar} />
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postName}>Alex Mercer</Text>
            <Text style={styles.postTime}>2s önce</Text>
          </View>
          <View style={[styles.postBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={[styles.postBadgeText, { color: colors.gain }]}>Kâr/Zarar</Text>
          </View>
        </View>

        <View style={styles.innerBox}>
          <View>
            <Text style={styles.innerBoxLabel}>Portföy Değişimi</Text>
            <Text style={[styles.innerBoxValue, { color: colors.gain }]}>+42.8%</Text>
          </View>
          <TrendingUp size={28} color={colors.gain} strokeWidth={2.5} />
        </View>

        <Text style={styles.postText}>Teknoloji rallisini yakaladık! Sabrın sonu selamet.</Text>

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.actionBtn}>
            <Heart size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>124</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MessageSquare size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>12</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post 2 */}
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarWrap}>
            <Image source={require('../../assets/avatars/cat.png')} style={styles.avatar} />
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postName}>Sarah Jenkins</Text>
            <Text style={styles.postTime}>5s önce</Text>
          </View>
          <View style={[styles.postBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Text style={[styles.postBadgeText, { color: colors.warn }]}>Çark Kazancı</Text>
          </View>
        </View>

        <Text style={styles.postText}>Günlük çarktan "Kripto Kurdu" rozeti çıktı! Şans bugün benden yana 🐺🪙</Text>

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.actionBtn}>
            <Heart size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>89</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MessageSquare size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>4</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post 3 */}
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatarWrap}>
            <Image source={require('../../assets/avatars/panda.png')} style={styles.avatar} />
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postName}>Cem Yılmaz</Text>
            <Text style={styles.postTime}>1g önce</Text>
          </View>
          <View style={[styles.postBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Text style={[styles.postBadgeText, { color: colors.loss }]}>Kâr/Zarar</Text>
          </View>
        </View>

        <View style={styles.innerBox}>
          <View>
            <Text style={styles.innerBoxLabel}>Portföy Değişimi</Text>
            <Text style={[styles.innerBoxValue, { color: colors.loss }]}>-12.4%</Text>
          </View>
          <TrendingDown size={28} color={colors.loss} strokeWidth={2.5} />
        </View>

        <Text style={styles.postText}>Piyasa bugün epey sert vurdu. Stop-loss'lar patladı maalesef, sağlık olsun.</Text>

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.actionBtn}>
            <Heart size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>210</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <MessageSquare size={20} color={colors.inkMuted} />
            <Text style={styles.actionText}>45</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function PlaceholderTab({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderIconBox}>{icon}</View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>{description}</Text>
      <TouchableOpacity style={styles.placeholderBtn}>
        <Text style={styles.placeholderBtnText}>Çok Yakında</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  topTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabBorderLine: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: -1,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.inkBright,
    zIndex: 1, // stays above the border line
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.inkMuted,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
    color: colors.inkBright,
  },
  content: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  postCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfacePressed,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  postMeta: {
    flex: 1,
  },
  postName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 2,
  },
  postTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
  },
  postBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  innerBox: {
    backgroundColor: colors.surface, // Daha koyu zemin (arka planla aynı)
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  innerBoxLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: 4,
  },
  innerBoxValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  postText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkBright,
    lineHeight: 22,
    marginBottom: 20,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  placeholderBtn: {
    backgroundColor: colors.surfacePressed,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderBtnText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
  }
});
