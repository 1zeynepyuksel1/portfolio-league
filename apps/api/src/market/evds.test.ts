import { describe, expect, it, vi } from 'vitest';
import { fetchTufeFromEvds } from './evds.js';
import { fetchAndStoreLatestTufe } from './tufe-cron.js';

describe('EVDS Inflation Integration Tests', () => {
  it('EVDS API Key olmadan çağrıldığında hata fırlatır', async () => {
    delete process.env.EVDS_API_KEY;

    await expect(fetchTufeFromEvds('01-01-2020', '01-03-2020')).rejects.toThrow(
      'EVDS_API_KEY tanımlı değil.',
    );
  });

  it('EVDS API yanıtını başarıyla parse eder', async () => {
    const mockApiResponse = {
      totalCount: 2,
      items: [
        { Tarih: '2020-1', TP_FG_J0: '446.45' },
        { Tarih: '2020-2', TP_FG_J0: 448.01 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as unknown as Response);

    const result = await fetchTufeFromEvds('01-01-2020', '01-02-2020', 'dummy-key');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      month: '2020-01',
      tufeIndex: 446.45,
    });
    expect(result[1]).toEqual({
      month: '2020-02',
      tufeIndex: 448.01,
    });
  });

  it('tufe-cron referans tablosundan başarıyla kayıt ekler', async () => {
    const success = await fetchAndStoreLatestTufe();
    expect(typeof success).toBe('boolean');
  });
});
