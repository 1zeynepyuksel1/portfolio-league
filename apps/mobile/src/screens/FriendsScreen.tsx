import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

import { Image } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';

const localAvatars: Record<string, any> = {
  meerkat: require('../../assets/avatars/meerkat.png'),
  chicken: require('../../assets/avatars/chicken.png'),
  bear: require('../../assets/avatars/bear.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  cat: require('../../assets/avatars/cat.png'),
  panda: require('../../assets/avatars/panda.png'),
};

const bgColors = [colors.surfaceRaised.replace('#',''), colors.surfacePressed.replace('#','')];
const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent].map(c => c.replace('#', ''));


type Friend = {
  id?: string;
  friendshipId?: string;
  friendId?: string;
  displayName?: string;
  /** Ligdeki kimlik — e-postadan daha kullanışlı. */
  username?: string;
  email?: string;
  since?: string;
  avatarSeed?: string;
  avatarStyle?: string;
};

type IncomingRequest = {
  requestId: string;
  senderId: string;
  senderDisplayName: string;
  senderEmail: string;
  avatarSeed?: string;
  avatarStyle?: string;
  createdAt: string;
};

type OutgoingRequest = {
  requestId: string;
  recipientId: string;
  recipientDisplayName: string;
  recipientEmail: string;
  avatarSeed?: string;
  avatarStyle?: string;
  createdAt: string;
};

type RequestsResponse = {
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
};

/**
 * ⚠️ BU EKRAN BİR SÜRE ERİŞİLEMEZ DURUMDAYDI.
 *
 * Tasarım turunda 'friends' sekmesi kaldırıldı (App.tsx'te gerekçesi var)
 * ama yerine bir kapı açılmadı. Dosya yazılıydı, App.tsx'te import bile
 * ediliyordu — hiçbir yerde ÇİZİLMİYORDU.
 *
 * Sonucu backend'de değil kullanışta görünüyordu: istek gönderiliyor,
 * karşı taraf onu GÖREMİYOR ve kabul EDEMİYORDU. Arkadaşlık sistemi
 * sunucuda tam, arayüzde yarımdı.
 *
 * Artık Lig ekranındaki "Arkadaşlar" alt sekmesinden bir katman olarak
 * açılıyor; `onClose` o katmanı kapatıyor.
 */
export function FriendsScreen({
  onClose,
  onSelectUser,
  /*
    ⚠️ `mode` TİPTE TANIMLIYDI AMA BURADAN ALINMIYORDU.

    Gövdede dört yerde `mode` okunuyor (247, 253, 321, 435) ve hiçbiri
    tanımlı bir değişkene bakmıyordu. TypeScript'in yakaladığı bu:
    "Cannot find name 'mode'".

    ⚠️ VARSAYILAN 'league' — çünkü çağıranlardan biri kipi hiç
    göndermiyor olabilir. Varsayılansız bıraksaydık `mode` `undefined`
    olur, `mode !== 'profile'` yine `true` dönerdi ve davranış kazara
    doğru çıkardı; ama niyeti kodda yazmayan bir doğruluk, ilk
    değişiklikte bozulur.
  */
  mode = 'league',
}: {
  onClose?: () => void;
    mode?: 'league' | 'profile';
  /**
   * Bir arkadaşa dokununca profilini açar.
   *
   * ⚠️ Kullanıcı adı olmayan eski kayıtta satır dokunulamaz kalıyor:
   * `undefined` bir profil adresine gitmektense hiç tepki vermemek
   * daha az yanıltıcı.
   */
  onSelectUser?: (username: string) => void;
}) {
  // Aktif Alt Sekme (Arkadaşlarım vs İstekler)
  const [activeTab, setActiveTab] = useState<'list' | 'requests'>('list');

  // Veri Durumları
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Alanı
  const [emailInput, setEmailInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Arama Önerileri
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; displayName: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearchTextChange = async (text: string) => {
    setEmailInput(text);
    const clean = text.trim();
    if (!clean) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const data = await apiFetch<{ users: { id: string; username: string; displayName: string; avatarSeed?: string; avatarStyle?: string }[] }>(
        `/users/search?q=${encodeURIComponent(clean)}`
      );
      setSearchResults(data.users || []);
    } catch (err) {
      console.error('Arama hatası:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSuggestion = (username: string) => {
    setEmailInput(username);
    setSearchResults([]);
  };

  // Verileri Yükle
  async function loadFriendsData() {
    setErrorMsg(null);
    try {
      // 1. Arkadaşlar Listesi
      const friendsRes = await apiFetch<{ friends: Friend[] }>('/friends');
      setFriends(friendsRes.friends || []);

      // 2. Bekleyen İstekler (Gelen ve Giden)
      const reqRes = await apiFetch<RequestsResponse>('/friends/requests');
      setIncomingRequests(reqRes.incoming || []);
      setOutgoingRequests(reqRes.outgoing || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Arkadaşlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFriendsData();
  }, []);

  // 1. Yeni Arkadaşlık İsteği Gönder
  async function handleSendRequest() {
    if (!emailInput.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await apiFetch('/friends/requests', {
        method: 'POST',
        // ⚠️ ALAN ADI `addressee` — eskiden `addresseeEmail` idi.
        // Bu ekranın KENDİ formu var (AddFriend bileşeninden ayrı) ve
        // alan adı değişince burası unutulmuştu: kullanıcı adı yazınca
        // sunucu "Geçersiz veri formatı" dönüyordu. Aynı isteği iki yerde
        // kurmanın bedeli.
        body: JSON.stringify({ addressee: emailInput.trim() }),
      });

      setSuccessMsg('Arkadaşlık isteği başarıyla gönderildi!');
      setEmailInput('');
      loadFriendsData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'İstek gönderilemedi.');
    } finally {
      setActionLoading(false);
    }
  }

  // 2. Gelen İsteği Kabul Et
  async function handleAccept(requestId: string) {
    try {
      await apiFetch(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      });
      setSuccessMsg('Arkadaşlık isteği kabul edildi! Artık ligde yarışabilirsiniz.');
      loadFriendsData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'İstek onaylanamadı.');
    }
  }

  // 3. Gelen İsteği Reddet
  async function handleReject(requestId: string) {
    try {
      await apiFetch(`/friends/requests/${requestId}/reject`, {
        method: 'POST',
      });
      loadFriendsData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'İstek reddedilemedi.');
    }
  }

  // 4. Arkadaşlıktan Çıkar veya Giden İsteği İptal Et
  async function handleRemove(id: string) {
    try {
      await apiFetch(`/friends/${id}`, {
        method: 'DELETE',
      });
      loadFriendsData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Silme işlemi başarısız.');
    }
  }

  const incomingCount = incomingRequests.length;

  return (
    <View style={styles.container}>
      {/*
        Kapatma başlığı — yalnızca katman olarak açıldığında.

        ⚠️ Kaçış yolu her zaman görünür olmalı: bu ekran tam sayfa
        açılıyor ve altındaki sekme çubuğunu kapatıyor. Geri tuşu
        olmasaydı kullanıcı burada kilitlenirdi.
      */}
      {onClose !== undefined && (
        <View style={styles.backRow}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.backText}>{mode === 'profile' ? '‹ Profile dön' : '‹ Lige dön'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Üst Kısım: Arkadaş Ekleme Formu */}
      {mode !== 'profile' && <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>👥 Arkadaş Ekle</Text>
        <Text style={styles.sectionSubtitle}>
          Kullanıcı adı ya da e-posta yazarak arkadaşını ligde yarışmaya
          davet et.
        </Text>

        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="@kullaniciadi ya da e-posta"
            placeholderTextColor={colors.inkFaint}
            value={emailInput}
            onChangeText={handleSearchTextChange}
            keyboardType="default"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.addButton, actionLoading && styles.buttonDisabled]}
            onPress={handleSendRequest}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.addButtonText}>İstek Gönder</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Arama Önerileri Listesi */}
        {searchResults.length > 0 && (
          
          <View style={styles.suggestionsContainer}>
              {searchResults.map((user: any) => {
                const name = user.displayName;
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.suggestionItem}
                    onPress={() => { if (onSelectUser) onSelectUser(user.username); }}
                  >
                    <View style={[styles.suggestionAvatar, user?.avatarSeed && { backgroundColor: 'transparent' }]}>
                      {user?.avatarStyle === 'local' && user?.avatarSeed && localAvatars[user.avatarSeed] ? (
                        <Image source={localAvatars[user.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
                      ) : user?.avatarSeed ? (
                        <SvgXml xml={createAvatar(shapes, { seed: user.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
                      ) : (
                        <Text style={styles.suggestionAvatarText}>{initials}</Text>
                      )}
                    </View>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionName}>{name}</Text>
                      <Text style={styles.suggestionUsername}>@{user.username}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {errorMsg && <Text style={styles.errorText}>⚠️ {errorMsg}</Text>}
          {successMsg && <Text style={styles.successText}>🏆 {successMsg}</Text>}
        </View>}

        {/* 2. Sekmeler (Arkadaşlarım vs İstekler) */}
      {mode !== 'profile' && <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTabButton, activeTab === 'list' && styles.subTabButtonActive]}
          onPress={() => {
            setActiveTab('list');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.subTabText, activeTab === 'list' && styles.subTabTextActive]}>
            👥 Arkadaşlarım ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabButton, activeTab === 'requests' && styles.subTabButtonActive]}
          onPress={() => {
            setActiveTab('requests');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <View style={styles.tabBadgeRow}>
            <Text style={[styles.subTabText, activeTab === 'requests' && styles.subTabTextActive]}>
              📬 İstekler
            </Text>
            {incomingCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{incomingCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>}

      {/* 3. İçerik Alanı */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gain} />
        </View>
      ) : activeTab === 'list' ? (
        // SEKME 1: ARKADAŞLARIM LİSTESİ
        <FlatList
        showsVerticalScrollIndicator={false}
          data={friends}
          keyExtractor={(item, index) => item.friendshipId || item.id || item.friendId || String(index)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>Henüz Arkadaşınız Yok</Text>
              <Text style={styles.emptyText}>
                Yukarıdan arkadaşınızın e-postasını yazarak ekleyin ve Haftalık Ligde yarışmaya başlayın!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.displayName || 'Arkadaş';
            const initials = name.slice(0, 2).toUpperCase();
            const removeId = item.friendshipId || item.id || '';

            const openable =
              item.username !== undefined && onSelectUser !== undefined;

            return (
              /*
                Arkadaş satırı profile açılıyor.

                ⚠️ Kaldır düğmesi satırın İÇİNDE ve o da dokunulabilir.
                İç içe dokunma hedeflerinde çocuk önce yakalar, yani
                "Kaldır"a basmak profili AÇMAZ — React Native dokunmayı
                en içteki hedefe veriyor. Ayrıca dış hedefi Pressable
                yapıp iç düğmeyi hariç tutmaya gerek yok.
              */
              <TouchableOpacity
                style={styles.friendCard}
                disabled={!openable}
                onPress={() => {
                  if (item.username !== undefined) onSelectUser?.(item.username);
                }}
                accessibilityRole={openable ? 'button' : undefined}
                accessibilityLabel={`${name} profilini aç`}
              >
                
<View style={[styles.avatarCircle, item?.avatarSeed && { backgroundColor: 'transparent' }]}>
  {item?.avatarStyle === 'local' && item?.avatarSeed && localAvatars[item.avatarSeed] ? (
    <Image source={localAvatars[item.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
  ) : item?.avatarSeed ? (
    <SvgXml xml={createAvatar(shapes, { seed: item.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
  ) : (
    <Text style={styles.avatarText}>{initials}</Text>
  )}
</View>


                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>{name}</Text>
                  {/*
                    ⚠️ E-POSTA YERİNE KULLANICI ADI.

                    E-posta hem kişisel bir veri hem de arkadaş listesinde
                    işe yaramıyor: kimse arkadaşını e-postasından tanımıyor.
                    Kullanıcı adı ligde görünen kimlik — profilde,
                    sıralamada, arkadaş eklemede hep o kullanılıyor.

                    Kullanıcı adı yoksa (eski kayıt) e-postaya düşüyor:
                    boş satır bırakmaktansa elimizdeki bilgiyi göstermek
                    daha iyi.
                  */}
                  <Text style={styles.friendEmail}>
                    {item.username !== undefined ? `@${item.username}` : item.email || ''}
                  </Text>
                </View>

                {removeId && mode !== 'profile' ? (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(removeId)}
                  >
                    <Text style={styles.removeButtonText}>Çıkar</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        // SEKME 2: GELEN VE GİDEN İSTEKLER LİSTESİ
        <FlatList
        showsVerticalScrollIndicator={false}
          data={incomingRequests}
          keyExtractor={(item) => item.requestId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Text style={styles.groupHeader}>
                📥 Gelen İstekler ({incomingRequests.length})
              </Text>
              {incomingRequests.length === 0 && (
                <Text style={styles.noRequestText}>Gelen bekleyen istek yok.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const name = item.senderDisplayName || 'Kullanıcı';
            const initials = name.slice(0, 2).toUpperCase();

            return (
              <View style={styles.requestCard}>
                
<View style={[styles.avatarCircleSmall, item?.avatarSeed && { backgroundColor: 'transparent' }]}>
  {item?.avatarStyle === 'local' && item?.avatarSeed && localAvatars[item.avatarSeed] ? (
    <Image source={localAvatars[item.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
  ) : item?.avatarSeed ? (
    <SvgXml xml={createAvatar(shapes, { seed: item.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
  ) : (
    <Text style={styles.avatarTextSmall}>{initials}</Text>
  )}
</View>


                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>{name}</Text>
                  <Text style={styles.requestEmail}>{item.senderEmail}</Text>
                </View>

                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item.requestId)}
                  >
                    <Text style={styles.actionButtonText}>Kabul Et</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(item.requestId)}
                  >
                    <Text style={styles.actionButtonText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            outgoingRequests.length > 0 ? (
              <View style={styles.outgoingSection}>
                <Text style={styles.groupHeader}>
                  📤 Gönderdiğiniz Bekleyen İstekler ({outgoingRequests.length})
                </Text>
                {outgoingRequests.map((outReq) => (
                  <View key={outReq.requestId} style={styles.outgoingCard}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {outReq.recipientDisplayName || outReq.recipientEmail}
                      </Text>
                      <Text style={styles.requestEmail}>{outReq.recipientEmail}</Text>
                      <Text style={styles.waitingBadge}>⏳ Yanıt Bekleniyor</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleRemove(outReq.requestId)}
                    >
                      <Text style={styles.cancelButtonText}>İptal Et</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 16,
  },
  backText: {
    color: colors.gain,
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  addSection: {
    backgroundColor: colors.fieldFill,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
  },
  suggestionsContainer: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.inkBright,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.inkBright,
  },
  suggestionUsername: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 1,
  },
  
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  sectionSubtitle: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.ink,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.gain,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 8,
  },
  successText: {
    color: colors.gain,
    fontSize: 12,
    marginTop: 8,
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.fieldFill,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabButtonActive: {
    backgroundColor: colors.accent,
  },
  subTabText: {
    color: colors.inkMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  subTabTextActive: {
    color: colors.ink,
    fontFamily: fonts.bold,
  },
  tabBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  notificationBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
  },
  groupHeader: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bold,
    marginBottom: 8,
    marginTop: 6,
  },
  noRequestText: {
    color: colors.inkFaint,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: colors.fieldFill,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderColor: colors.warnSoft,
    borderWidth: 1,
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarTextSmall: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  requestEmail: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: colors.gain,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  outgoingSection: {
    marginTop: 20,
  },
  outgoingCard: {
    backgroundColor: colors.fieldFill,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waitingBadge: {
    color: colors.warn,
    fontSize: 11,
    marginTop: 4,
    fontFamily: fonts.medium,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.inkFaint,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: colors.inkMuted,
    fontSize: 11,
  },
  friendCard: {
    backgroundColor: colors.fieldFill,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  friendEmail: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  removeButtonText: {
    color: colors.error,
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  emptyText: {
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
