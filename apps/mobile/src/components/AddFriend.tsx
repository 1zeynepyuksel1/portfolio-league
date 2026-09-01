import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

/**
 * AddFriend — `docs/export/8a` sağ ekranın "Arkadaş davet et" düğmesi.
 *
 * ⚠️ E-POSTA İLE, KULLANICI ADIYLA DEĞİL.
 *
 * Tasarım "davet et" diyor ama hangi anahtarla olduğunu söylemiyor.
 * Sunucudaki uç (`POST /friends/requests`) `addresseeEmail` bekliyor —
 * kullanıcı adı sistemi henüz yok. Kullanıcı adı alanı koyup e-posta
 * göndersek ekran yalan söylerdi.
 *
 * Kullanıcı adı geldiğinde değişecek tek yer burası; çağıran ekran aynı
 * kalacak.
 */
export function AddFriend({ onSent }: { onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function send() {
    const trimmed = email.trim();

    if (trimmed === '') {
      setFailed(true);
      setMessage('Kullanıcı adı ya da e-posta girin.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await apiFetch('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ addressee: trimmed }),
      });

      setFailed(false);
      setMessage('İstek gönderildi.');
      setEmail('');
      onSent?.();
    } catch (err) {
      setFailed(true);
      // ⚠️ Sunucunun mesajı doğrudan gösteriliyor: "kullanıcı bulunamadı",
      // "zaten arkadaşsınız" gibi durumları burada tekrar yazmak iki ayrı
      // metin listesi tutmak olurdu ve biri eskirdi.
      setMessage(err instanceof Error ? err.message : 'İstek gönderilemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <TouchableOpacity
        style={styles.invite}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.inviteText}>+  Arkadaş davet et</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        {/*
          ⚠️ `keyboardType="email-address"` DEĞİL.

          O klavye "@" ve "." tuşlarını öne çıkarır ama boşluğu daraltır —
          alan yalnızca e-posta kabul ederken doğruydu. Artık kullanıcı adı
          da girilebiliyor; düz klavye ikisine de uygun.
        */}
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="@kullaniciadi ya da e-posta"
          placeholderTextColor={colors.inkDisabled}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
        />

        <TouchableOpacity
          style={styles.send}
          onPress={() => void send()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="İsteği gönder"
        >
          {busy ? (
            <ActivityIndicator color={colors.onInverse} size="small" />
          ) : (
            <Text style={styles.sendText}>Gönder</Text>
          )}
        </TouchableOpacity>
      </View>

      {message !== null && (
        <Text style={[styles.message, failed && styles.messageFailed]}>
          {message}
        </Text>
      )}

      <TouchableOpacity onPress={() => setOpen(false)}>
        <Text style={styles.cancel}>Vazgeç</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  invite: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    // Kesikli kenar tasarımın işareti: bu bir "yer tutucu", henüz
    // dolmamış bir alan. Dolu bir düğme gibi durmuyor.
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.inkBright },

  box: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  send: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onInverse },

  message: { fontFamily: fonts.regular, fontSize: 12, color: colors.gain },
  messageFailed: { color: colors.error },
  cancel: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkFaint },
});
