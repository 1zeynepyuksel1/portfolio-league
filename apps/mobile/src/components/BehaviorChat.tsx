import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiError, apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

/**
 * BehaviorChat — kendi ölçümleri hakkında sınırlı sohbet.
 *
 * ⚠️ GEÇMİŞ İSTEMCİDE TUTULUYOR — VE BUNUN BEDELİ BİLİNİYOR.
 *
 * Sunucuda tutmak migration isterdi (sahibi Zeynep) ve sohbet geçmişi
 * kalıcı saklanması gereken bir veri değil. Bedeli: geçmiş her istekte
 * yeniden gönderiliyor ve sunucu ona GÜVENMİYOR — `chat.ts`'teki
 * `sanitizeHistory` rolü, uzunluğu ve sayıyı sınırlıyor.
 *
 * Yani buradaki `useState`, sunucu açısından "kullanıcının iddiası".
 * Uygulama dürüst davranıyor ama curl kullanan biri uydurabilir; asıl
 * koruma sunucuda.
 *
 * ⚠️ GEÇMİŞ EKRAN KAPANINCA SİLİNİYOR. Bu bir kayıp değil, tasarım:
 * sohbet bir danışma anı, arşiv değil. Kalıcı olsaydı kullanıcı aylar
 * önceki bir cevabı bugünün verisiymiş gibi okurdu.
 */

type Turn = { role: 'user' | 'model'; text: string };

/** Sunucudaki sınırla aynı — ikisi ayrışmasın diye burada da yazılı. */
const MAX_LENGTH = 500;

/**
 * Başlangıç önerileri.
 *
 * ⚠️ BOŞ BİR SOHBET KUTUSU KULLANICIYI ZORLUYOR: ne sorabileceğini
 * bilmiyor, ve yanlış şeyi sorup ("BTC yükselir mi") reddedilince
 * özelliğin bozuk olduğunu sanıyor. Örnekler sınırı davranışla
 * öğretiyor — kuralı okumasına gerek kalmadan.
 */
const ORNEKLER = [
  'Bu bulgular ne anlama geliyor?',
  'Bu alışkanlığı nasıl bırakabilirim?',
];

export function BehaviorChat({ hasFindings }: { hasFindings: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    ⚠️ `useRef` KULLANILIYOR, `useState` DEĞİL.

    Gönderim sırasında geçmişin O ANKİ hâli lazım. `turns`'ü doğrudan
    okusaydık, arka arkaya iki gönderimde ikincisi birincinin
    eklemesini görmeyebilirdi — React durum güncellemeleri toplu ve
    asenkron. `ref` her zaman en güncel değeri taşıyor.
  */
  const gecmis = useRef<Turn[]>([]);

  async function gonder(text: string) {
    const soru = text.trim();
    if (soru === '' || busy) return;

    setDraft('');
    setError(null);
    setBusy(true);

    const yeni: Turn[] = [...gecmis.current, { role: 'user', text: soru }];
    gecmis.current = yeni;
    setTurns(yeni);

    try {
      const r = await apiFetch<{ reply: string }>('/me/behavior/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: soru,
          // Sunucu son 6 mesajı alıyor; fazlasını göndermek boşuna.
          history: gecmis.current.slice(-6),
        }),
      });

      const sonraki: Turn[] = [...gecmis.current, { role: 'model', text: r.reply }];
      gecmis.current = sonraki;
      setTurns(sonraki);
    } catch (e) {
      /*
        ⚠️ HATA KODLARI AYRI MESAJLAR ALIYOR — sunucu onları bilerek
        ayırmıştı. "Biraz bekle" ile "bu özellik kapalı" aynı şey değil:
        biri geçici, öteki kalıcı. Tek mesaja indirseydik kullanıcı
        beklemesi mi yoksa vazgeçmesi mi gerektiğini bilemezdi.
      */
      const kod = e instanceof ApiError ? e.code : null;

      setError(
        kod === 'RATE_LIMITED'
          ? 'Çok hızlı soru sordun, birkaç dakika bekle.'
          : kod === 'AI_DISABLED'
            ? 'Yapay zekâ şu an kapalı.'
            : 'Cevap alınamadı, tekrar dene.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SOR</Text>

      {/*
        ⚠️ SINIR AÇIKÇA YAZILI. Bot fiyat sorusunu reddedecek; bunu
        önceden söylemek, reddedilmeyi "arıza" gibi göstermekten iyi.
      */}
      <Text style={styles.hint}>
        {hasFindings
          ? 'Kendi alışkanlıkların hakkında soru sorabilirsin. Fiyat tahmini ve yatırım tavsiyesi vermiyor.'
          : 'Ölçülmüş bir bulgun olmadığı için henüz konuşacak bir şey yok.'}
      </Text>

      {turns.map((t, i) => (
        <View
          key={i}
          style={[styles.turn, t.role === 'user' ? styles.mine : styles.theirs]}
        >
          <Text style={t.role === 'user' ? styles.mineText : styles.theirsText}>
            {t.text}
          </Text>
        </View>
      ))}

      {busy && <ActivityIndicator color={colors.inkFaint} style={styles.spin} />}

      {error !== null && <Text style={styles.error}>{error}</Text>}

      {/* Örnekler yalnızca sohbet HENÜZ BAŞLAMADIYSA görünüyor. */}
      {turns.length === 0 && hasFindings && (
        <View style={styles.chips}>
          {ORNEKLER.map((o) => (
            <TouchableOpacity
              key={o}
              style={styles.chip}
              onPress={() => void gonder(o)}
              disabled={busy}
            >
              <Text style={styles.chipText}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Sorunu yaz…"
          placeholderTextColor={colors.inkDisabled}
          maxLength={MAX_LENGTH}
          editable={!busy}
          multiline
          onSubmitEditing={() => void gonder(draft)}
        />

        <TouchableOpacity
          style={[styles.send, (busy || draft.trim() === '') && styles.sendOff]}
          onPress={() => void gonder(draft)}
          disabled={busy || draft.trim() === ''}
          accessibilityRole="button"
        >
          <Text style={styles.sendText}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 8,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkDisabled,
    marginBottom: 12,
  },
  turn: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    maxWidth: '92%',
  },
  // Kullanıcı sağda ve ters zeminde — tasarımın "seçili" dili.
  mine: { alignSelf: 'flex-end', backgroundColor: colors.inverse },
  mineText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onInverse },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised },
  theirsText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkBright,
  },
  spin: { marginVertical: 8 },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
  },
  send: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  sendText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onInverse },
});
