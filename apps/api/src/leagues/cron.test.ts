import { describe, expect, it } from 'vitest';
import { ensureCurrentLeaguePeriod } from './repository.js';
import { closeAndRotateLeague } from './cron.js';

describe('League Closing Cron Unit Tests', () => {
  it('aktif ligi mühürler, yeni haftalık ligi açar ve dönemleri günceller', async () => {
    // 1. Aktif ligin var olduğundan emin ol
    const initialLeague = await ensureCurrentLeaguePeriod();
    expect(initialLeague).toBeDefined();
    expect(initialLeague.status).toBe('open');

    // 2. Ligi kapat ve rotasyon yaptır
    const result = await closeAndRotateLeague();

    expect(result.closedLeagueId).toBe(initialLeague.id);
    expect(result.newLeagueId).toBeDefined();
    expect(result.newLeagueId).not.toBe(initialLeague.id);
  });
});
