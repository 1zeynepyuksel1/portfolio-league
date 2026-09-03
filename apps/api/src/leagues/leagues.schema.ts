import { z } from 'zod';

// Sıralama listesi sorgu parametreleri şeması
export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

// Liderlik tablosu kullanıcı satırı tipi
export type LeaderboardEntryDto = {
  rank: number;
  userId: string;
  /**
   * ⚠️ ARTIK KULLANICI ADI TAŞIYOR, GERÇEK AD DEĞİL.
   *
   * Lig tablosu herkese açık bir liste; oradaki her satır bir kişinin
   * GERÇEK ADINI yabancılara veriyordu. Ürünün kimseye gerçek ad
   * göstermesi gerekmiyor — kullanıcı adı zaten benzersiz ve kişinin
   * kendi seçtiği şey.
   *
   * ⚠️ ALAN SİLİNMEDİ, İÇERİĞİ DEĞİŞTİ. Silmek DTO'yu kullanan her
   * yeri kırardı; burada tek doğru kaynak repository'deki `select`.
   * Adı `displayName` kalıyor çünkü "ekranda gösterilecek ad"
   * anlamı hâlâ doğru — yalnızca o adın NE OLDUĞU değişti.
   */
  displayName: string;
  /** Profil adresi. Eski kayıtlarda boş olabilir. */
  username: string | null;
  isPublic: boolean;
  twrPercentRaw: number; // Örn: 0.3962
  twrPercentFormatted: string; // Örn: "+%39,62"
  startValueCents: string;
  endValueCents: string;
  updatedAt: Date;
};

// Lig bilgisi tipi
export type LeagueInfoDto = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  status: 'open' | 'closed';
  remainingSeconds: number;
  totalParticipants: number;
};
