import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Crown, Trophy } from 'lucide-react-native';
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
          <View style={[styles.iconWrap, birinci && styles.iconWrapGold]}>
            {birinci ? (
              <Crown size={40} color={colors.gold} strokeWidth={2} />
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

          <TouchableOpacity style={styles.button} onPress={() => void kapat()}>
            <Text style={styles.buttonText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: 6,
  },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  detail: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  detailStrong: { fontFamily: fonts.bold, color: colors.ink },
  twr: { fontFamily: fonts.bold, fontSize: 30, marginTop: 14, marginBottom: 22 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFF' },
});
