import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MessageSquarePlus, Trash2 } from 'lucide-react-native';
import { ApiError, apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

import {
  baslikUret,
  deleteConversation,
  loadConversations,
  saveConversation,
  yeniId,
  type Conversation,
  type Turn,
} from '../lib/chat-store';

/**
 * KocAI maskotu.
 *
 * ⚠️ `require` KULLANILIYOR, `import` DEĞİL — React Native'de görsel
 * varlıkları paketleyici (Metro) derleme anında topluyor ve bunun için
 * yolun SABİT olması gerekiyor. Değişkenden yol üretilseydi görsel
 * pakete hiç girmez, çalışma anında sessizce boş kalırdı.
 *
 * ⚠️ İKİ KIRPIM VAR — VE FARKI BOYUT DEĞİL, KADRAJ.
 *
 *   kocai-head.png   kafaya yakın, köşeleri saydam  -> 26-34 piksel
 *   kocai-full.png   tam maskot, halkasıyla         -> 40 piksel ve üstü
 *
 * Avatar 34 piksel; o boyutta tam maskot koyu bir lekeye dönüşüyor
 * (bkz. `TabBar.tsx`'teki not). Kafa kırpımı beyaz kask ve parlak
 * gözleri öne çıkarıyor, ikisi de açık renk olduğu için koyu zeminde
 * ayrışıyor.
 *
 * Kaynak 1254x1254 / 1,6 MB idi; 34 piksellik bir avatar için o dosyayı
 * taşımak paketi boşuna şişirirdi.
 */
const MASKOT = require('../../assets/kocai/kocai-head.png');

/**
 * BehaviorChat — koç sohbeti.
 *
 * ⚠️ ÖNCE YALNIZCA KULLANICININ ÖLÇÜLMÜŞ BULGULARI HAKKINDA KONUŞUYORDU.
 * Açıldı: genel sohbet, yatırım kavramları ve "şu yaklaşım mantıklı mı"
 * soruları da cevaplanıyor. Reddedilen tek şey fiyat tahmini ve belirli
 * varlık tavsiyesi — gerekçesi `chat.ts`'te.
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
 * ⚠️ GEÇMİŞ ARTIK KALICI — VE ÖNCEKİ NOT ÇÜRÜTÜLDÜ.
 *
 * Burada "sohbet bir danışma anı, arşiv değil; ekran kapanınca silinsin"
 * yazıyordu. Kullanım gösterdi ki değil: kullanıcı önceki sohbete geri
 * dönmek ve yeni bir konuya temiz sayfayla başlamak istiyor.
 *
 * Depo cihazda (`lib/chat-store.ts`), sunucuda değil — gerekçesi orada.
 * Sunucu bu geçmişe hâlâ GÜVENMİYOR: her istekte gönderilen kısım
 * `sanitizeHistory`'den geçiyor.
 */

/** Sunucudaki sınırla aynı — ikisi ayrışmasın diye burada da yazılı. */
const MAX_LENGTH = 500;

/**
 * Karşılamada sayılan yetenekler.
 *
 * ⚠️ SIRALAMA RASTGELE DEĞİL: en somut olan başta. "Cüzdanını
 * yorumlayabilirim" kullanıcının hemen deneyebileceği bir şey; "yatırım
 * kavramlarını anlatırım" ise soyut. İlk madde denenmezse hiçbiri
 * denenmiyor.
 */
const YETENEKLER = [
  'Cüzdanını yorumlayabilirim — dağılım, yoğunlaşma, ne kârda ne zararda',
  'Alım-satım notlarına bakıp kararlarınla davranışını karşılaştırabilirim',
  'Ölçülmüş alışkanlıklarını açıklayabilirim',
  'Yatırım kavramlarını anlatır, bir yaklaşımın mantıklı olup olmadığını tartışırım',
];

/**
 * Başlangıç önerileri.
 *
 * ⚠️ BOŞ BİR SOHBET KUTUSU KULLANICIYI ZORLUYOR: ne sorabileceğini
 * bilmiyor, ve yanlış şeyi sorup ("BTC yükselir mi") reddedilince
 * özelliğin bozuk olduğunu sanıyor. Örnekler sınırı davranışla
 * öğretiyor — kuralı okumasına gerek kalmadan.
 */
const ORNEKLER_BULGULU = [
  'Bu bulgular ne anlama geliyor?',
  'Bu alışkanlığı nasıl bırakabilirim?',
];

/**
 * Bulgusu olmayan kullanıcıya gösterilen örnekler.
 *
 * ⚠️ İKİSİ DE İLKE SORUSU, TAHMİN DEĞİL — ve bu bilinçli. Örnekler
 * yalnızca fikir vermiyor, botun NE TÜR sorulara cevap verdiğini de
 * öğretiyor. "BTC yükselir mi" yazsaydık kullanıcıya reddedilecek bir
 * soruyu önermiş olurduk.
 */
const ORNEKLER_BOS = [
  'Tek varlığa yüklenmek mantıklı mı?',
  'Komisyon nasıl işliyor?',
];

export function BehaviorChat({ hasFindings }: { hasFindings: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Kayıtlı sohbetler ve şu an açık olanın kimliği. */
  const [gecmisler, setGecmisler] = useState<Conversation[]>([]);
  const [acikId, setAcikId] = useState<string | null>(null);
  const [listeAcik, setListeAcik] = useState(false);

  useEffect(() => {
    /*
      ⚠️ AÇILIŞTA SON SOHBET YÜKLENMİYOR, YALNIZCA LİSTE OKUNUYOR.

      Kullanıcı sekmeye girdiğinde temiz bir sayfa görmeli: çoğu
      açılışta yeni bir soru soracak. Son sohbeti otomatik açsaydık,
      dünkü konuşmanın ortasına düşerdi ve "yeni sohbet"e basmak
      zorunda kalırdı — yani varsayılan yanlış tarafta olurdu.
    */
    void loadConversations().then(setGecmisler);
  }, []);

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

      /*
        ⚠️ KAYIT MODEL CEVABINDAN SONRA, SORUDAN SONRA DEĞİL.

        Soruyu anında kaydetseydik, cevabı gelmemiş yarım bir sohbet
        listede görünürdü. Kullanıcı ona geri döndüğünde kendi sorusunu
        görür ama cevabı göremezdi — bozuk gibi durur.
      */
      const id = acikId ?? yeniId();
      if (acikId === null) setAcikId(id);

      const kayit: Conversation = {
        id,
        title: baslikUret(sonraki[0]?.text ?? soru),
        updatedAt: Date.now(),
        turns: sonraki,
      };

      setGecmisler(await saveConversation(kayit));
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

  function yeniSohbet() {
    gecmis.current = [];
    setTurns([]);
    setAcikId(null);
    setError(null);
    setListeAcik(false);
  }

  function sohbetAc(c: Conversation) {
    gecmis.current = c.turns;
    setTurns(c.turns);
    setAcikId(c.id);
    setError(null);
    setListeAcik(false);
  }

  async function sohbetSil(id: string) {
    setGecmisler(await deleteConversation(id));
    // Açık olanı sildiysek ekranı da temizle; yoksa var olmayan bir
    // sohbetin içinde kalırdık ve sonraki mesaj onu diriltirdi.
    if (id === acikId) yeniSohbet();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>SOR</Text>

        <View style={styles.headActions}>
          {gecmisler.length > 0 && (
            <TouchableOpacity
              onPress={() => setListeAcik((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Geçmiş sohbetler"
            >
              <Text style={styles.headBtn}>
                Geçmiş ({gecmisler.length})
              </Text>
            </TouchableOpacity>
          )}

          {turns.length > 0 && (
            <TouchableOpacity
              onPress={yeniSohbet}
              accessibilityRole="button"
              accessibilityLabel="Yeni sohbet"
            >
              <MessageSquarePlus size={18} color={colors.inkFaint} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/*
        GEÇMİŞ LİSTESİ — katman değil, açılır blok.

        ⚠️ Ayrı bir ekran açmadık. Sohbet zaten Profil'in değil kendi
        sekmesinin içinde; bir katman daha açmak kullanıcıyı iki kez
        geri gitmek zorunda bırakırdı.
      */}
      {listeAcik && (
        <View style={styles.list}>
          {gecmisler.map((c) => (
            <View key={c.id} style={styles.listRow}>
              <TouchableOpacity
                style={styles.listMain}
                onPress={() => sohbetAc(c)}
                accessibilityRole="button"
              >
                <Text style={styles.listTitle} numberOfLines={1}>
                  {c.title}
                </Text>
                <Text style={styles.listMeta}>{c.turns.length} mesaj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void sohbetSil(c.id)}
                accessibilityRole="button"
                accessibilityLabel="Sohbeti sil"
              >
                <Trash2 size={16} color={colors.inkDisabled} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/*
        ⚠️ ESKİ METİN BULGU YOKKEN "konuşacak bir şey yok" DİYORDU —
        ve bu hem yanlış hem caydırıcıydı. Bulgu olmaması, sorulacak
        soru olmaması demek değil: "tek varlığa yüklenmek mantıklı mı"
        bir İLKE sorusu ve her zaman cevaplanabilir.

        Metin sınırı önden söylüyor. Bot fiyat tahminini reddedecek;
        bunu baştan bilmek, reddedilmeyi "arıza" olmaktan çıkarıyor.
      */}
      <Text style={styles.hint}>
        Fiyat tahmini ve varlık tavsiyesi vermiyor.
      </Text>

      {/*
        KARŞILAMA — YEREL METİN, MODEL ÇAĞRISI DEĞİL.

        ⚠️ Modele "kendini tanıt" dedirtmek en doğal yol gibi görünüyor
        ama her ekran açılışında bir istek harcardı. Ücretsiz katmanda
        günde 20 istek var; kullanıcı sekmeye üç kez girse kotanın altısı
        selamlaşmaya giderdi.

        ⚠️ Ayrıca DEĞİŞMEZ olması iyi: karşılama, botun ne yapabildiğini
        öğreten tek yer. Model her seferinde farklı yazsaydı bazı
        açılışlarda yetenekleri saymayı unuturdu.
      */}
      {turns.length === 0 && (
        <View style={styles.turn0}>
          <Image source={MASKOT} style={styles.avatar} accessibilityLabel="KocAI" />

          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Merhaba, ben KocAI 👋</Text>

            <Text style={styles.welcomeText}>Sana nasıl yardımcı olabilirim?</Text>

            {/*
              ⚠️ MADDELER AYRI `Text` — tek metnin içine `\n` KOYULMADI.

              Kaçış karakteri kullanmak burada iki kez ters gitti: JSX
              içinde `{'\n'}` yazmak hem okunmaz hem de düzenleyiciler
              arasında taşınırken gerçek satır sonuna dönüşüp dosyayı
              bozabiliyor. Ayrı öğeler hem güvenli hem de her maddeye
              ayrı stil vermeyi mümkün kılıyor.
            */}
            {YETENEKLER.map((y) => (
              <Text key={y} style={styles.welcomeItem}>
                • {y}
              </Text>
            ))}
          </View>
        </View>
      )}

      {turns.map((t, i) => (
        <View key={i} style={styles.turnRow}>
          {/*
            ⚠️ AVATAR YALNIZCA MODEL TARAFINDA. Kullanıcının kendi
            mesajına kendi simgesini koymak yer kaplar ve hiçbir şey
            söylemez — zaten sağda ve ters zeminde, kimin yazdığı belli.
          */}
          {t.role === 'model' && (
            <Image source={MASKOT} style={styles.avatar} accessibilityLabel="KocAI" />
          )}

          <View
            style={[styles.turn, t.role === 'user' ? styles.mine : styles.theirs]}
          >
            <Text style={t.role === 'user' ? styles.mineText : styles.theirsText}>
              {t.text}
            </Text>
          </View>
        </View>
      ))}

      {busy && <ActivityIndicator color={colors.inkFaint} style={styles.spin} />}

      {error !== null && <Text style={styles.error}>{error}</Text>}

      {/* Örnekler yalnızca sohbet HENÜZ BAŞLAMADIYSA görünüyor. */}
      {turns.length === 0 && (
        <View style={styles.chips}>
          {(hasFindings ? ORNEKLER_BULGULU : ORNEKLER_BOS).map((o) => (
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
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkDisabled,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headBtn: { fontFamily: fonts.medium, fontSize: 11, color: colors.inkFaint },
  list: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listMain: { flex: 1 },
  listTitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkBright },
  listMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.inkDisabled },
  turnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  turn0: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  /*
    ⚠️ MASKOT BÜYÜTÜLDÜ: 28 -> 34. Simge yerine ÇİZİM koyunca 28 piksel
    yetmiyor — gözlük, kravat ve grafik detayları bulanıklaşıyordu.
    Çizgi simge küçükken de okunur, resim okunmaz.

    Arka plan rengi VERİLMEDİ: görselin kendi zemini zaten koyu ve
    uygulamanın yüzeyiyle yakın. Altına bir dolgu koysaydık kenarında
    ince bir halka görünürdü.
  */
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginTop: 2,
  },
  welcome: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
  },
  welcomeTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 8,
  },
  welcomeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  welcomeItem: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
    marginBottom: 4,
  },
  turn: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    maxWidth: '92%',
  },
  // Kullanıcı sağda ve ters zeminde — tasarımın "seçili" dili.
  mine: { alignSelf: 'flex-end', marginLeft: 'auto', backgroundColor: colors.inverse },
  mineText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onInverse },
  theirs: { flex: 1, backgroundColor: colors.surfaceRaised },
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
