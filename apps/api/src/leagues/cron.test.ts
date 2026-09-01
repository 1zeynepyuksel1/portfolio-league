import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ⚠️ BU TEST ESKİDEN GERÇEK VERİTABANINDAKİ CANLI LİGİ KAPATIYORDU.
 *
 * Eski hâli üç satırdı ve hepsi gerçek `db` üzerinde çalışıyordu:
 *
 *     const initialLeague = await ensureCurrentLeaguePeriod();
 *     const result = await closeAndRotateLeague();
 *
 * Yani her `npm test` çalıştırması yarışmayı MÜHÜRLÜYOR, herkesin
 * derecesini yazıyor ve yeni bir dönem açıyordu. Test yeşildi, çünkü
 * yaptığı şey tam olarak sınadığı şeydi — ama yan etkisi kalıcıydı.
 *
 * Ölçüldü:
 *
 *     test öncesi : 76 dönem, 50 kapalı
 *     test sonrası: 77 dönem, 51 kapalı
 *
 * Biriken hasar: 77 dönem, aynı hafta adı 25 kez, katılımcılar 26 ayrı
 * "açık" lige dağılmış (çoğunda 0 kişi). Lig sıralaması bu yüzden
 * bölünmüştü ve "son kapanan ligin şampiyonu" aslında bir TEST
 * çalıştırmasının kapattığı ligin birincisiydi.
 *
 * ⚠️ DERS: yan etkisi olan bir fonksiyonu gerçek veriye karşı çalıştıran
 * test, test değil bir MİGRASYONDUR. Zararı testin kendisinde değil,
 * çalıştıktan sonra geride bıraktığı durumda görünür — ve orada kimse
 * aramaz.
 *
 * Artık bağımlılıklar taklit ediliyor: sınanan şey ORKESTRASYON —
 * "önce sırala, sonra mühürle, sonra yenisini aç" sırası. Veritabanına
 * hiç dokunulmuyor.
 */

const repository = vi.hoisted(() => ({
  findCurrentOpenLeague: vi.fn(),
  getLeaderboardByLeagueId: vi.fn(),
  updateEntryRank: vi.fn(),
  updateLeaguePeriodStatus: vi.fn(),
  createLeaguePeriod: vi.fn(),
}));

const twr = vi.hoisted(() => ({
  syncAllLeagueEntriesAndRanks: vi.fn(),
  createPortfolioSnapshot: vi.fn(),
}));

vi.mock('./repository.js', () => repository);
vi.mock('./twr-engine.js', () => twr);
vi.mock('../portfolio/service.js', () => ({
  getPortfolio: vi.fn().mockResolvedValue({ totalValueCents: 0n }),
}));
vi.mock('../achievements/cron-hooks.js', () => ({
  checkLeagueAchievements: vi.fn(),
  checkDiamondHands: vi.fn(),
}));
vi.mock('../db/client.js', () => ({
  db: { select: () => ({ from: () => Promise.resolve([]) }) },
}));

const { closeAndRotateLeague } = await import('./cron.js');

const ACIK_LIG = {
  id: 'period-1',
  name: '2026 - 35. Hafta Ligi',
  endsAt: new Date('2026-08-30T20:59:59.999Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.findCurrentOpenLeague.mockResolvedValue(ACIK_LIG);
  repository.getLeaderboardByLeagueId.mockResolvedValue([]);
  repository.createLeaguePeriod.mockResolvedValue({
    id: 'period-2',
    name: '2026 - 36. Hafta Ligi',
  });
});

describe('closeAndRotateLeague', () => {
  it('açık lig yoksa hiçbir şey yazmaz', async () => {
    repository.findCurrentOpenLeague.mockResolvedValue(undefined);

    const sonuc = await closeAndRotateLeague();

    expect(sonuc.totalRanked).toBe(0);
    /*
      ⚠️ Asıl iddia: dönem OLUŞTURULMUYOR. Erken çıkış olmasaydı
      fonksiyon "kapatılacak lig yok" durumunda bile yeni bir dönem
      açardı — biriken 77 dönemin bir kaynağı tam olarak bu şekilde
      tekrarlanan üretimdi.
    */
    expect(repository.createLeaguePeriod).not.toHaveBeenCalled();
    expect(repository.updateLeaguePeriodStatus).not.toHaveBeenCalled();
  });

  it('kapatmadan ÖNCE sıralamayı tazeler', async () => {
    await closeAndRotateLeague();

    /*
      ⚠️ SIRA ÖNEMLİ, VARLIK DEĞİL. Mühürleme önce yapılsaydı dereceler
      bayat TWR'ye göre yazılırdı: hafta boyunca yükselen kullanıcı eski
      sırasıyla mühürlenirdi ve bu bir daha düzelmezdi — mühür kalıcı.

      `invocationCallOrder` ile iki çağrının gerçek sırası
      karşılaştırılıyor; ikisinin de "çağrıldı" olması yetmez.
    */
    const sirala = twr.syncAllLeagueEntriesAndRanks.mock.invocationCallOrder[0]!;
    const muhurle = repository.updateLeaguePeriodStatus.mock.invocationCallOrder[0]!;

    expect(sirala).toBeLessThan(muhurle);
  });

  it('dereceleri 1’den başlayarak sırayla mühürler', async () => {
    repository.getLeaderboardByLeagueId.mockResolvedValue([
      { userId: 'u-a' },
      { userId: 'u-b' },
      { userId: 'u-c' },
    ]);

    const sonuc = await closeAndRotateLeague();

    expect(repository.updateEntryRank).toHaveBeenNthCalledWith(1, 'period-1', 'u-a', 1);
    expect(repository.updateEntryRank).toHaveBeenNthCalledWith(2, 'period-1', 'u-b', 2);
    expect(repository.updateEntryRank).toHaveBeenNthCalledWith(3, 'period-1', 'u-c', 3);
    expect(sonuc.totalRanked).toBe(3);
  });

  it('yeni dönem, kapananın bitişinden hemen SONRA başlar', async () => {
    await closeAndRotateLeague();

    const arg = repository.createLeaguePeriod.mock.calls[0]![0];

    /*
      ⚠️ Boşluk bırakılmamalı: yeni dönem eskisinin bitişinden 1 saniye
      sonra başlıyor. Arada boşluk kalsaydı o aralıkta hiçbir açık lig
      olmaz, `ensureCurrentLeaguePeriod` devreye girip ÜÇÜNCÜ bir dönem
      üretirdi.
    */
    expect(arg.startsAt.getTime()).toBe(ACIK_LIG.endsAt.getTime() + 1000);
    expect(arg.status).toBe('open');
    expect(arg.endsAt.getTime()).toBeGreaterThan(arg.startsAt.getTime());
  });

  it('kapanan ve açılan dönemin kimliklerini döndürür', async () => {
    const sonuc = await closeAndRotateLeague();

    expect(sonuc.closedLeagueId).toBe('period-1');
    expect(sonuc.newLeagueId).toBe('period-2');
    expect(sonuc.closedLeagueId).not.toBe(sonuc.newLeagueId);
  });
});
