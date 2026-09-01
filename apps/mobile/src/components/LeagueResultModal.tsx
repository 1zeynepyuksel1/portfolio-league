import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Crown, Share2, Trophy } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

/**
 * LeagueResultModal — lig kapandıktan sonraki İLK açılışta çıkan kutlama.
 *
 * ⚠️ "GÖRDÜ MÜ" BİLGİSİ SUNUCUDA TUTULUYOR, telefonda değil.
 *
 * Yerel depoda tutmak daha kolaydı ama üç yerde bozulurdu: uygulamayı
 * silip kuran kullanıcı, ikinci cihazdan giren kullanıcı, ve depoyu
 * temizleyen kullanıcı aynı kutlamayı tekrar görürdü. Sunucu
 * `league_entries.result_seen_at` kolonunu işaretliyor.
 *
 * ⚠️ İŞARETLEME KAPATIRKEN YAPILIYOR, AÇILIRKEN DEĞİL.
 *
 * Açılışta işaretleseydik: modal açıldığı anda uygulama çökerse ya da
 * kullanıcı hemen kapatırsa sonuç "görüldü" sayılır ve bir daha asla
 * gösterilmezdi. Kullanıcı ligi kazandığını hiç öğrenemezdi.
 *
 * Ters yönde risk daha ucuz: işaretleme isteği başarısız olursa kutlama
 * bir kez daha çıkar. Can sıkıcı, ama bilgi kaybı yok.
 */

type Result = {
  periodId: string;
  periodName: string;
  rank: number;
  totalParticipants: number;
  twrPercent: string;
} | null;

export function LeagueResultModal() {
  const [result, setResult] = useState<Result>(null);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [paylasildi, setPaylasildi] = useState(false);

  useEffect(() => {
    /*
      ⚠️ Hata sessizce yutuluyor. Bu bir kutlama; getirilemezse ekranda
      hiçbir şey olmaması doğru davranış. Kullanıcıya "kutlama
      yüklenemedi" demek anlamsız olurdu.
    */
    apiFetch<{ result: Result }>('/leagues/my-result')
      .then((res) => setResult(res.result))
      .catch(() => {});
  }, []);

  if (result === null) return null;

  const birinci = result.rank === 1;
  /*
    ⚠️ TAÇ İLK ÜÇE, SONRASINA KUPA — ve bu kural ÜÇ YERDE AYNI olmalı:

        LeagueResultModal   (burası)
        PostCard            akıştaki paylaşım kartı
        ProfileScreen       profil fotoğrafındaki rozet

    Burası eskiden yalnızca 1.'ye taç veriyordu, diğer ikisi ilk üçe.
    Aynı kullanıcı kutlamada kupa, profilinde taç görüyordu — kural
    tek yerde yaşamadığı için ikisi ayrı düştü.

    ⚠️ Dördüncüden sonrasına taç YOK. Dokuzuncu olan birine taç çizmek
    ödülü değersizleştirir; kupa "katıldın ve bitirdin" diyor, taç
    "kazandın" diyor.
  */
  const madalya = result.rank >= 1 && result.rank <= 3;

  /**
   * Sonucu akışa paylaşır.
   *
   * ⚠️ DERECE GÖNDERİLMİYOR. İstek yalnızca `{ type: 'crown_share' }`
   * taşıyor; sıralamayı sunucu kendi verisinden okuyup yazıyor.
   * Buradan `rank` gönderseydik, isteği elle atan herkes istediği
   * dereceyi iddia edebilirdi.
   *
   * ⚠️ PAYLAŞTIKTAN SONRA MODAL KAPANMIYOR. Kapatsaydık kullanıcı
   * paylaşımın gerçekten olup olmadığını göremezdi; düğme "Paylaşıldı"ya
   * dönüp yerinde kalıyor, kapatma kararı kullanıcının.
   */
  async function paylas() {
    setPaylasiliyor(true);
    try {
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({ type: 'crown_share', visibility: 'public', caption: '' }),
      });
      setPaylasildi(true);
    } catch {
      /*
        ⚠️ Sessiz değil ama gürültülü de değil: düğme eski hâline
        dönüyor, kullanıcı tekrar deneyebiliyor. Kutlama ekranında
        kırmızı bir hata kutusu açmak anın havasını bozardı.
      */
      setPaylasiliyor(false);
      return;
    }
    setPaylasiliyor(false);
  }

  async function kapat() {
    const periodId = result?.periodId;
    setResult(null); // önce kapat: ağ beklemesi ekranı kilitlemesin
    if (periodId === undefined) return;
    try {
      await apiFetch('/leagues/my-result/seen', {
        method: 'POST',
        body: JSON.stringify({ periodId }),
      });
    } catch {
      // Başarısızsa kutlama bir kez daha çıkar — bilgi kaybı yok.
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void kapat()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, madalya && styles.iconWrapGold]}>
            {madalya ? (
              <Crown
                size={40}
                color={result.rank === 1 ? colors.gold : result.rank === 2 ? '#94A3B8' : '#B45309'}
                strokeWidth={2}
              />
            ) : (
              <Trophy size={36} color={colors.accent} strokeWidth={2} />
            )}
          </View>

          <Text style={styles.period}>{result.periodName}</Text>

          <Text style={styles.headline}>
            {birinci
              ? 'Bu hafta ligi kazandın!'
              : `Bu hafta ligde ${result.rank}. oldun`}
          </Text>

          <Text style={styles.detail}>
            {result.totalParticipants} katılımcı arasında{' '}
            <Text style={styles.detailStrong}>{result.rank}.</Text> sıradasın.
          </Text>

          {/*
            ⚠️ YÜZDE GÖSTERİLİYOR, TUTAR DEĞİL. Ligin ölçütü TWR (yüzde
            getiri); mutlak tutar göstermek "kim daha zengin" sorusuna
            kayardı ve TWR'nin seçilme sebebi tam olarak buydu.
          */}
          <Text
            style={[
              styles.twr,
              {
                color: result.twrPercent.startsWith('-')
                  ? colors.loss
                  : colors.gain,
              },
            ]}
          >
            {result.twrPercent.startsWith('-') ? '' : '+'}
            {result.twrPercent}%
          </Text>

          {/*
            ⚠️ PAYLAŞ ÜSTTE, TAMAM ALTTA. Kutlama ekranının amacı paylaşım;
            "Tamam" kaçış yolu. Sıralamayı tersine çevirseydik asıl eylem
            ikincil görünürdü.
          */}
          <TouchableOpacity
            style={[styles.button, paylasildi && styles.buttonDone]}
            onPress={() => void paylas()}
            disabled={paylasiliyor || paylasildi}
          >
            <View style={styles.buttonRow}>
              {!paylasildi && <Share2 size={17} color="#FFF" />}
              <Text style={styles.buttonText}>
                {paylasildi
                  ? 'Akışta paylaşıldı'
                  : paylasiliyor
                    ? 'Paylaşılıyor…'
                    : 'Akışta paylaş'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondary} onPress={() => void kapat()}>
            <Text style={styles.secondaryText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfacePressed,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrapGold: { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
  period: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  detail: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  detailStrong: { fontFamily: fonts.bold, color: colors.ink },
  twr: { fontFamily: fonts.bold, fontSize: 34, marginTop: 16, marginBottom: 24 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: '#FFF' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonDone: { backgroundColor: colors.gain },
  secondary: {
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
});
