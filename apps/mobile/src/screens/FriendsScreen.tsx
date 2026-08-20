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

type Friend = {
  id?: string;
  friendshipId?: string;
  friendId?: string;
  displayName?: string;
  email?: string;
  since?: string;
};

type IncomingRequest = {
  requestId: string;
  senderId: string;
  senderDisplayName: string;
  senderEmail: string;
  createdAt: string;
};

type OutgoingRequest = {
  requestId: string;
  recipientId: string;
  recipientDisplayName: string;
  recipientEmail: string;
  createdAt: string;
};

type RequestsResponse = {
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
};

export function FriendsScreen() {
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
        body: JSON.stringify({ addresseeEmail: emailInput.trim() }),
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
      {/* 1. Üst Kısım: Arkadaş Ekleme Formu */}
      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>👥 Arkadaş Ekle</Text>
        <Text style={styles.sectionSubtitle}>
          E-posta adresi yazarak arkadaşınızı ligde yarışmaya davet edin.
        </Text>

        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="ornek@gmail.com"
            placeholderTextColor="#64748B"
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.addButton, actionLoading && styles.buttonDisabled]}
            onPress={handleSendRequest}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.addButtonText}>İstek Gönder</Text>
            )}
          </TouchableOpacity>
        </View>

        {errorMsg && <Text style={styles.errorText}>⚠️ {errorMsg}</Text>}
        {successMsg && <Text style={styles.successText}>✅ {successMsg}</Text>}
      </View>

      {/* 2. Sekmeler (Arkadaşlarım vs İstekler) */}
      <View style={styles.subTabContainer}>
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
      </View>

      {/* 3. İçerik Alanı */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : activeTab === 'list' ? (
        // SEKME 1: ARKADAŞLARIM LİSTESİ
        <FlatList
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

            return (
              <View style={styles.friendCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.friendDetails}>
                  <Text style={styles.friendName}>{name}</Text>
                  <Text style={styles.friendEmail}>{item.email || ''}</Text>
                </View>

                {removeId ? (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(removeId)}
                  >
                    <Text style={styles.removeButtonText}>Çıkar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      ) : (
        // SEKME 2: GELEN VE GİDEN İSTEKLER LİSTESİ
        <FlatList
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
                <View style={styles.avatarCircleSmall}>
                  <Text style={styles.avatarTextSmall}>{initials}</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  addSection: {
    backgroundColor: '#1C2541',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#94A3B8',
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
    backgroundColor: '#0B132B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 8,
  },
  successText: {
    color: '#34D399',
    fontSize: 12,
    marginTop: 8,
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C2541',
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
    backgroundColor: '#3B82F6',
  },
  subTabText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tabBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notificationBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
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
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 6,
  },
  noRequestText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: '#1C2541',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarTextSmall: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  requestEmail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  outgoingSection: {
    marginTop: 20,
  },
  outgoingCard: {
    backgroundColor: '#1C2541',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waitingBadge: {
    color: '#F59E0B',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#64748B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  friendCard: {
    backgroundColor: '#1C2541',
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
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  friendEmail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  removeButtonText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
