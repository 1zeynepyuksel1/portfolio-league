import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, SafeAreaView } from 'react-native';
import { SharePostModal, ShareScope } from './SharePostModal';
import { AssetLogo } from './AssetLogo';
import { TrendingUp, TrendingDown, Coins, Sparkles, X, ChevronRight, Calendar } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import * as SecureStore from 'expo-secure-store';

type MenuStep = 'main' | 'asset' | 'period' | 'market_asset';

export function GlobalShareMenu({ visible, onClose, } : { visible: boolean, onClose: () => void }) {
  const [step, setStep] = useState<MenuStep>('main');
  const [shareScope, setShareScope] = useState<ShareScope | null>(null);
  const [tradedAssets, setTradedAssets] = useState<any[]>([]);
  const [marketAssets, setMarketAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAssets();
      setStep('main');
    } else {
      setStep('main');
      setShareScope(null);
    }
  }, [visible]);

  async function loadAssets() {
    setLoadingAssets(true);
    try {
      try {
          const res = await apiFetch<{ assets: any[] }>('/posts/traded-assets');
          setTradedAssets(res.assets || []);
        } catch(e) { console.warn('traded-assets err', e); }
        
        try {
          const mRes = await apiFetch<{ assets: any[] }>('/assets?currency=try');
          setMarketAssets(mRes.assets || []);
        } catch(e) { console.warn('assets err', e); }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingAssets(false);
    }
  }

  const handlePeriodSelect = (period: 'all' | 'week' | 'month' | 'custom') => {
    // Custom date picker could be expanded here. For now, we will map 'custom' to 'all' as fallback if not implemented,
    // but backend supports 'custom' if we pass start/end. 
    setShareScope({ type: 'portfolio', period });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[{flex: 1}, shareScope && {display: 'none'}]}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {step === 'main' ? 'Ne Paylaşmak İstersin?' : step === 'asset' || step === 'market_asset' ? 'Varlık Seç' : 'Dönem Seç'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}><X size={24} color={colors.inkMuted} /></TouchableOpacity>
            </View>

            {step === 'main' && (
              <View style={styles.optionsList}>
                <TouchableOpacity style={styles.optionCard} onPress={() => setShareScope({ type: 'portfolio', period: 'all' })}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <TrendingUp size={24} color={colors.gain} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Portföyünü Paylaş</Text>
                    <Text style={styles.optionSub}>Toplam kâr/zarar durumunu paylaş</Text>
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionCard, tradedAssets.length === 0 && !loadingAssets && { opacity: 0.5 }]} 
                  disabled={tradedAssets.length === 0 && !loadingAssets}
                  onPress={() => setStep('asset')}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Coins size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Bir Varlığı Paylaş</Text>
                    {loadingAssets ? (
                      <Text style={styles.optionSub}>Varlıklar yükleniyor...</Text>
                    ) : tradedAssets.length === 0 ? (
                      <Text style={styles.optionSub}>Henüz bir varlık almadın</Text>
                    ) : (
                      <Text style={styles.optionSub}>Elindeki bir varlığın performansını paylaş</Text>
                    )}
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => setStep('market_asset')}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <TrendingDown size={24} color={colors.loss} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Piyasa Değişimi Paylaş</Text>
                    {loadingAssets ? (
                      <Text style={styles.optionSub}>Piyasalar yükleniyor...</Text>
                    ) : (
                      <Text style={styles.optionSub}>Herhangi bir varlığın anlık değişimini paylaş</Text>
                    )}
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                </View>
            )}

            {step === 'market_asset' && (
              <View style={styles.assetPicker}>
                <TouchableOpacity onPress={() => setStep('main')} style={{ marginBottom: 16 }}><Text style={styles.backBtn}>Geri</Text></TouchableOpacity>
                <FlatList 
                  data={marketAssets}
                  keyExtractor={item => item.symbol}
                  renderItem={({item}) => (
                    <TouchableOpacity style={styles.assetRow} onPress={() => { setShareScope({ type: 'market_asset', assetKey: item.symbol, assetName: item.name, changePercent: parseFloat(item.changePercent24h || '0') }); }}>
                      {/*
                        ⚠️ Secici satirlarinda logo HIC YOKTU — eksik veri
                        degil, eksik bileşendi. `AssetLogo` sembolu tek
                        basina aliyor, sunucudan ek alan gerekmiyor.
                      */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <AssetLogo symbol={item.symbol} size={28} />
                        <Text style={styles.assetName}>{item.name}</Text>
                      </View>
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={styles.assetSymbol}>{item.symbol}</Text>
                        <Text style={{fontFamily: fonts.medium, fontSize: 13, color: parseFloat(item.changePercent24h || '0') >= 0 ? colors.gain : colors.loss}}>
                          {parseFloat(item.changePercent24h || '0') > 0 ? '+' : ''}{item.changePercent24h}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 300 }}
                />
              </View>
            )}

            {step === 'asset' && (
              <View style={styles.assetPicker}>
                <TouchableOpacity onPress={() => setStep('main')} style={{ marginBottom: 16 }}><Text style={styles.backBtn}>← Geri</Text></TouchableOpacity>
                <FlatList 
                  data={tradedAssets}
                  keyExtractor={item => item.symbol}
                  renderItem={({item}) => (
                    <TouchableOpacity style={styles.assetRow} onPress={() => { setShareScope({ type: 'single_asset', assetKey: item.symbol }); }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <AssetLogo symbol={item.symbol} size={28} />
                        <Text style={styles.assetName}>{item.name}</Text>
                      </View>
                      <Text style={styles.assetSymbol}>{item.symbol}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 300 }}
                />
              </View>
            )}

            {step === 'period' && (
              <View style={styles.optionsList}>
                <TouchableOpacity onPress={() => setStep('main')} style={{ marginBottom: 16 }}><Text style={styles.backBtn}>← Geri</Text></TouchableOpacity>
                
                <TouchableOpacity style={styles.optionCard} onPress={() => handlePeriodSelect('all')}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Calendar size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Tüm Zamanlar</Text>
                    <Text style={styles.optionSub}>Bugüne kadarki genel portföy durumu</Text>
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => handlePeriodSelect('week')}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Calendar size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Bu Hafta</Text>
                    <Text style={styles.optionSub}>Son 7 günlük portföy değişimi</Text>
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => handlePeriodSelect('month')}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Calendar size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Bu Ay</Text>
                    <Text style={styles.optionSub}>Son 30 günlük portföy değişimi</Text>
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => handlePeriodSelect('custom')}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <Calendar size={24} color={colors.accent} />
                  </View>
                  <View style={styles.optionTexts}>
                    <Text style={styles.optionTitle}>Özel Tarih (Şu An)</Text>
                    <Text style={styles.optionSub}>Güncel anlık durumu paylaş</Text>
                  </View>
                  <ChevronRight size={20} color={colors.inkMuted} />
                </TouchableOpacity>
              </View>
            )}
            
            <SafeAreaView />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      <SharePostModal
        visible={!!shareScope}
        scope={shareScope}
        setScope={setShareScope}
        onClose={() => { setShareScope(null); setStep('main'); }}
        onSuccess={() => {
          setShareScope(null);
          onClose();
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  optionsList: { gap: 12, paddingBottom: 20 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfacePressed, padding: 16, borderRadius: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionTexts: { flex: 1 },
  optionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 4 },
  optionSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  assetPicker: { paddingBottom: 20 },
  backBtn: { fontFamily: fonts.medium, fontSize: 15, color: colors.accent },
  assetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  assetName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  assetSymbol: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted }
});





