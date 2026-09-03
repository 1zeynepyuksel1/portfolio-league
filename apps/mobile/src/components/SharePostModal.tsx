import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, DeviceEventEmitter } from 'react-native';
import { X, Share2, Globe, Users } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import { getPreference } from '../lib/storage';
import { PostCard } from './PostCard';

export type ShareScope = 
  | { type: 'single_asset', assetKey: string }
  | { type: 'portfolio', period: 'week' | 'month' | 'custom' | 'all' }
  | { type: 'horoscope', content: string, assetName: string }
  | { type: 'wheel', prizeText: string }
  | { type: 'market_asset', assetKey: string, assetName: string, changePercent: number };

type PreviewData = any;

type Props = {
  visible: boolean;
  scope: ShareScope | null;
  onClose: () => void;
  onSuccess: () => void;
  setScope?: (s: ShareScope | null) => void;
}

export function SharePostModal({ visible, scope, onClose, onSuccess, setScope }: Props) {
  const [user, setUser] = useState<any>({});
  useEffect(() => { apiFetch('/users/me').then((res: any) => setUser(res.profile)).catch(() => {}); }, []);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [caption, setCaption] = useState('');
    const [errorText, setErrorText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends_only'>('public');

  /*
    ⚠️ VARSAYILAN ONBOARDING'DEN GELİYOR — AMA KİLİT DEĞİL.

    Kullanıcı kayıt olurken "paylaşımlarımı kimler görsün" sorusuna
    cevap verdi; kutu o cevapla açılıyor. Yine de her gönderi için
    değiştirebilir — aşağıdaki iki düğme duruyor.

    ⚠️ KUTU HER AÇILDIĞINDA OKUNUYOR, BİR KEZ DEĞİL.
    `[]` bağımlılığıyla yalnızca ilk kurulumda okusaydık, kullanıcı
    ayarını değiştirdikten sonra uygulamayı kapatıp açana kadar eski
    değer geçerli kalırdı.

    ⚠️ Tercih okunamazsa 'public' kalıyor — yani mevcut davranış.
    Yeni bir özelliğin hatası, eski davranışı bozmamalı.
  */
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void getPreference('defaultPostVisibility').then((v) => {
      if (alive && (v === 'public' || v === 'friends_only')) setVisibility(v);
    });
    return () => { alive = false; };
  }, [visible]);

  useEffect(() => {
    if (visible && scope) {
      loadPreview();
    } else {
      setPreview(null);
      setCaption('');
      setVisibility('public');
    }
  }, [visible, scope]);

  async function loadPreview() {
    if (scope?.type === 'horoscope') {
      setPreview({
        fortune_content: scope.content,
        asset_name: scope.assetName
      });
      return;
    }
    if (scope?.type === 'market_asset') {
      setPreview({
        is_market: true,
        asset_name: scope.assetName,
        pnl_percent: scope.changePercent,
        pnl_amount: '0'
      });
      return;
    }
    if (scope?.type === 'wheel') {
      setPreview({
        prize_text: scope.prizeText
      });
      return;
    }

    setLoading(true);
    setPreview(null);
    try {
      let endpoint = '';
      if (scope?.type === 'single_asset') {
        endpoint = '/posts/share-preview/asset/' + scope.assetKey;
      } else if (scope?.type === 'portfolio') {
        endpoint = '/posts/share-preview/portfolio?period=' + scope.period;
      }
      const res = await apiFetch<{ preview: PreviewData }>(endpoint);
      setPreview(res.preview);
    } catch (err: any) {
      Alert.alert('Önizleme Hatası', err.message || 'Veri yüklenemedi.');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!scope || !preview) {
      Alert.alert('Hata', 'Önizleme verisi eksik.');
      return;
    }
    setErrorText('');
    setSharing(true);
    
    try {
      let type = '';
      let targetKey = null;
      let periodParams = null;
      let clientPayload = null;

      if (scope.type === 'single_asset') {
        type = 'pnl_share';
        targetKey = scope.assetKey;
      } else if (scope.type === 'portfolio') {
        type = 'pnl_share';
        periodParams = { period: scope.period };
      } else if (scope.type === 'market_asset') {
        type = 'pnl_share';
        targetKey = scope.assetKey;
        clientPayload = preview;
      } else {
        type = 'pnl_share';
      }

      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({
          type,
          scope: scope.type === 'single_asset' || scope.type === 'portfolio' ? scope.type : scope?.type === 'market_asset' ? 'single_asset' : null,
          targetKey,
          periodParams,
          caption,
          visibility,
          payload: clientPayload
        })
      });

      Alert.alert('Başarılı', 'Gönderin paylaşıldı!');
      DeviceEventEmitter.emit('refreshProfile');
      onSuccess();
    } catch (err: any) {
      setErrorText(err.message || 'Gönderi paylaşılamadı.');
      if (Platform.OS === 'web') alert(err.message || 'Gönderi paylaşılamadı.'); else Alert.alert('Paylaşım Hatası', err.message || 'Gönderi paylaşılamadı.');
    } finally {
      setSharing(false);
    }
  }

  const postObj = {
    type: scope?.type === 'horoscope' ? 'horoscope_share' : scope?.type === 'wheel' ? 'wheel_share' : 'pnl_share',
    scope: scope?.type === 'single_asset' || scope?.type === 'portfolio' ? scope.type : scope?.type === 'market_asset' ? 'single_asset' : null,
    payload: preview,
    caption,
  };

  return (
    <View style={[{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, elevation: 999, backgroundColor: colors.surface}, !visible && {display: 'none'}]}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={24} color={colors.ink} /></TouchableOpacity>
            <Text style={styles.title}>
              {scope?.type === 'horoscope' ? 'Falı Paylaş' : scope?.type === 'wheel' ? 'Ödülü Paylaş' : 'Kâr/Zarar Paylaş'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          {loading || !preview ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
          ) : (
            <ScrollView
        showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps='always'>
              <View style={styles.previewBox}>
                <PostCard post={postObj} user={user} isPreview={true} />
              </View>

              <Text style={styles.label}>Açıklama (İsteğe bağlı)</Text>
              <TextInput
                style={styles.input}
                placeholder="Düşüncelerini yaz..."
                placeholderTextColor={colors.inkMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={280}
              />

              <Text style={styles.label}>Kimler Görebilir?</Text>
              <View style={styles.visRow}>
                <TouchableOpacity 
                  style={[styles.visBtn, visibility === 'public' && styles.visBtnActive]}
                  onPress={() => setVisibility('public')}
                >
                  <Globe size={20} color={visibility === 'public' ? colors.ink : colors.inkMuted} />
                  <Text style={[styles.visText, visibility === 'public' && styles.visTextActive]}>Herkes</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.visBtn, visibility === 'friends_only' && styles.visBtnActive]}
                  onPress={() => setVisibility('friends_only')}
                >
                  <Users size={20} color={visibility === 'friends_only' ? colors.ink : colors.inkMuted} />
                  <Text style={[styles.visText, visibility === 'friends_only' && styles.visTextActive]}>Sadece Arkadaşlar</Text>
                </TouchableOpacity>
              </View>
            
                {!loading && !!preview && (
                  <View style={[styles.footer, { marginTop: 20, borderTopWidth: 0, paddingHorizontal: 0 }]}>
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
                      {sharing ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Share2 size={20} color="#fff" />
                          <Text style={styles.shareBtnText}>Paylaş</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {errorText ? <Text style={{ color: colors.loss, marginTop: 12, textAlign: 'center', fontFamily: fonts.medium }}>{errorText}</Text> : null}
                  </View>
                )}
              </ScrollView>
            )}

        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  previewBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginBottom: 8 },
  input: { backgroundColor: colors.surfacePressed, borderRadius: 14, padding: 16, color: colors.ink, fontFamily: fonts.regular, minHeight: 100, textAlignVertical: 'top', marginBottom: 24 },
  visRow: { flexDirection: 'row', gap: 12 },
  visBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.surfacePressed, borderWidth: 1, borderColor: 'transparent' },
  visBtnActive: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' },
  visText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
  visTextActive: { color: colors.accent },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  shareBtn: { backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 20 },
  shareBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' }
});
