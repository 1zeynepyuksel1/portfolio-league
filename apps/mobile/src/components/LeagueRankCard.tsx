import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Trophy, ChevronRight } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { colors, fonts, radius, shadows, spacing, type } from '../theme';

/*
  ⚠️ SUNUCUDA "BENİM SIRAM" UCU YOK — VE BU GEÇİCİ BİR ÇÖZÜM.

  `/leagues/current/leaderboard` tüm tabloyu döndürüyor; kendi
  satırımızı İSTEMCİDE arıyoruz. Doğru çözüm sunucuda tek satır
  dönen bir uç olurdu (`GET /leagues/current/my-rank`).

  Şimdilik çalışıyor çünkü bir lig döneminde 7-8 katılımcı var ve
  `limit=100` hepsini kapsıyor. ⚠️ Katılımcı 100'ü geçtiği gün bu
  bileşen SESSİZCE "sıran yok" demeye başlar — hata vermez, sadece
  yanlış olur. O yüzden buraya yazılı duruyor.
*/
const LIMIT = 100;

type Entry = {
  rank: number;
  username: string;
  twrPercentFormatted: string;
};

type Response = {
  league: { name: string; totalParticipants: number };
  leaderboard: Entry[];
};

/**
 * Akışın en üstündeki lig kartı — bir GİRİŞ NOKTASI.
 *
 * ⚠️ NEDEN VAR. Lig, Keşfet'in içinde bir alt sekme; yani iki dokunuş
 * uzakta ve adı dışında hiçbir şey söylemiyor. Bir sekme "burada bir
 * şey var" der; bu kart "burada SENİNLE ilgili bir şey var" der.
 * Aradaki fark, kullanıcının dokunup dokunmamasını belirliyor.
 *
 * ⚠️ CANLI VERİ TAŞIMASI ŞART. "Lig'e göz at" yazan bir kart reklam
 * gibi okunur ve görmezden gelinir (banner körlüğü). "4. sıradasın"
 * bir bilgidir ve merak uyandırır. Kartın tamamı bu ayrımın üstüne
 * kurulu — sayı gelmezse kart kendini gizliyor değil, DURUMU
 * söylüyor (aşağıya bak).
 */
export function LeagueRankCard({ username, onPress }: { username?: string | undefined; onPress: () => void }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'yok'>('yukleniyor');

  useEffect(() => {
    if (!username) {
      setDurum('yok');
      return;
    }

    let alive = true;

    async function load() {
      try {
        const res = await apiFetch<Response>(
          `/leagues/current/leaderboard?limit=${LIMIT}&offset=0`,
        );
        if (!alive) return;

        const benim = res.leaderboard.find((e) => e.username === username) ?? null;
        setEntry(benim);
        setTotal(res.league?.totalParticipants ?? res.leaderboard.length);
        setDurum(benim ? 'hazir' : 'yok');
      } catch {
        /*
          ⚠️ HATA DA 'yok' SAYILIYOR — ve bu bilinçli.

          Kullanıcı için "istek başarısız oldu" ile "henüz sıran yok"
          arasında yapabileceği bir fark yok: iki durumda da yapması
          gereken şey aynı, ligi açıp bakmak. Ayrı bir hata kutusu
          göstermek, çözemeyeceği bir sorunu haber vermek olurdu.
        */
        if (alive) setDurum('yok');
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [username]);

  /*
    ⚠️ YÜKLENİRKEN HİÇBİR ŞEY ÇİZİLMİYOR — ve alternatifi daha kötüydü.

    Bir iskelet kutusu koysaydık akışın en üstü her açılışta bir
    saniye "titrer" ve altındaki gönderiler aşağı kayardı. Kart
    hazır olunca beliriyor; kullanıcı bir şeyin kaybolduğunu değil,
    bir şeyin geldiğini görüyor.
  */
  if (durum === 'yukleniyor') return null;

  const yok = durum === 'yok' || entry === null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        yok ? 'Lige git' : `Ligde ${entry.rank}. sıradasın, lig tablosunu aç`
      }
    >
      <View style={styles.iconWell}>
        <Trophy size={20} color={colors.gold} strokeWidth={2} />
      </View>

      <View style={styles.text}>
        {yok ? (
          <>
            {/*
              ⚠️ BOŞ DURUM KURALI (K6): NE YOK · NEDEN YOK · NE YAPMALIYIM.
              "Sıralama bulunamadı" demiyoruz — hiçbir şey bulunamamış
              değil, kullanıcı henüz katılmamış. Üçüncü cümle olmadan
              bu kart bir özür olurdu.
            */}
            <Text style={styles.title}>Ligde henüz yerin yok</Text>
            <Text style={styles.sub}>
              İlk işlemini yap, bu haftanın sıralamasına gir
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              Bu hafta{' '}
              <Text style={styles.rank}>{entry.rank}.</Text> sıradasın
            </Text>
            <Text style={styles.sub}>
              {total} kişi arasında · {entry.twrPercentFormatted}
            </Text>
          </>
        )}
      </View>

      {/*
        ⚠️ OK İŞARETİ BİR SÜS DEĞİL. Kartın basılabilir olduğunu
        söyleyen tek görsel işaret (signifier) bu. Olmasaydı kart
        bir bilgi kutusu gibi okunur ve kimse dokunmayı denemezdi.
      */}
      <ChevronRight size={18} color={colors.inkFaint} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.group,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `flex: 1` tek başına yetmiyor — uzun metin kutuyu şişirmesin diye.
  text: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: type.body,
    color: colors.ink,
  },
  rank: {
    fontFamily: fonts.bold,
    color: colors.gold,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
});
