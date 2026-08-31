import { getPreference, setPreference } from './storage';

/**
 * chat-store.ts — KocAI sohbetlerinin kalıcı deposu.
 *
 * ⚠️ CİHAZDA TUTULUYOR, SUNUCUDA DEĞİL — VE BU BİR TAKAS.
 *
 * Sunucuda tutmak tablo, tablo da migration ister; migration'ların sahibi
 * Zeynep, yani özellik onun sırasını beklerdi. Cihazda tutmak bugün
 * çalışıyor.
 *
 * Bedeli açık olsun:
 *   - Telefon değişirse geçmiş gitmez, GELMEZ (yedeklenmiyor)
 *   - Aynı hesap iki cihazda farklı geçmiş görür
 *   - Uygulama silinirse geçmiş de silinir
 *
 * Sohbet geçmişi için bu kabul edilebilir: kayıt değil, hatırlatma.
 * Emir defteri olsaydı asla kabul edilemezdi.
 *
 * ⚠️ SUNUCU BU GEÇMİŞE GÜVENMİYOR. İstemci ne saklarsa saklasın, her
 * istekte gönderilen geçmiş `chat.ts`'teki `sanitizeHistory`'den
 * geçiyor: rolü, uzunluğu ve sayısı sınırlanıyor. Buradaki depo bir
 * KOLAYLIK; güvenlik sınırı sunucuda.
 */

export type Turn = { role: 'user' | 'model'; text: string };

export interface Conversation {
  id: string;
  /** Listede görünen ad — ilk sorudan türetiliyor. */
  title: string;
  /** Son değişiklik anı (epoch ms). Sıralama buna göre. */
  updatedAt: number;
  turns: Turn[];
}

const KEY = 'kocai.conversations';

/**
 * En fazla kaç sohbet saklanır.
 *
 * ⚠️ ÜST SINIR ŞART. `AsyncStorage` sınırsız değil ve her sohbet
 * büyüyebilir; sınırsız bırakmak, aylar sonra açılışta yavaşlayan bir
 * uygulama demek. Sebebi de bulunamaz — kod "çalışıyor", sadece
 * şişiyor. Aynı gerekçe sunucudaki yorum önbelleğinde de yazılı.
 */
const MAX_CONVERSATIONS = 20;

/** Bir sohbette saklanan en fazla mesaj. */
const MAX_TURNS = 60;

/**
 * Kaydedilmiş sohbetleri okur.
 *
 * ⚠️ BOZUK VERİ ÇÖKERTMEMELİ. Depoda ne olduğu garanti değil: eski bir
 * sürümden kalmış farklı bir şekil, yarım yazılmış bir JSON, elle
 * kurcalanmış bir değer. Ayrıştırma patlarsa boş liste dönüyoruz —
 * geçmişi kaybetmek, uygulamanın açılmamasından iyi.
 */
export async function loadConversations(): Promise<Conversation[]> {
  try {
    const raw = await getPreference(KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(gecerliMi).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function gecerliMi(c: unknown): c is Conversation {
  if (typeof c !== 'object' || c === null) return false;

  const x = c as Partial<Conversation>;

  return (
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    typeof x.updatedAt === 'number' &&
    Array.isArray(x.turns)
  );
}

/** Bir sohbeti kaydeder (varsa günceller, yoksa ekler). */
export async function saveConversation(c: Conversation): Promise<Conversation[]> {
  const hepsi = await loadConversations();

  const kalan = hepsi.filter((x) => x.id !== c.id);

  const guncel: Conversation = {
    ...c,
    // ⚠️ Mesaj sınırı: uzun bir sohbet depoyu tek başına doldurmasın.
    // Baştakiler atılıyor — sohbetin en yeni kısmı en ilgili olanı.
    turns: c.turns.slice(-MAX_TURNS),
    updatedAt: Date.now(),
  };

  const yeni = [guncel, ...kalan].slice(0, MAX_CONVERSATIONS);

  await setPreference(KEY, JSON.stringify(yeni));
  return yeni;
}

export async function deleteConversation(id: string): Promise<Conversation[]> {
  const kalan = (await loadConversations()).filter((c) => c.id !== id);
  await setPreference(KEY, JSON.stringify(kalan));
  return kalan;
}

/**
 * İlk sorudan sohbet başlığı üretir.
 *
 * ⚠️ BAŞLIK MODELE YAZDIRILMADI. En doğal yol "bu sohbete bir isim ver"
 * demek olurdu ama her yeni sohbet fazladan bir model çağrısı demek —
 * ücretsiz katmanda günde 20 istek var. Kullanıcının kendi ilk sorusu
 * zaten sohbetin ne hakkında olduğunu söylüyor.
 */
export function baslikUret(ilkSoru: string): string {
  const temiz = ilkSoru.trim().replace(/\s+/g, ' ');

  return temiz.length <= 38 ? temiz : `${temiz.slice(0, 37)}…`;
}

/** Çakışmayan bir kimlik — sohbetler yalnızca bu cihazda yaşıyor. */
export function yeniId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
