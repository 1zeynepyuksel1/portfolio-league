const fs = require('fs');
const path = 'src/leagues/twr-engine.ts';
let code = fs.readFileSync(path, 'utf8');
if (!code.includes('export async function calculateTwrForPeriod')) {
  code = code.replace(
    /export async function calculateTwrForUser\([\s\S]*?userId: string,[\s\S]*?_leagueId\?: string,[\s\S]*?\): Promise<\{/m,
    export async function calculateTwrForPeriod(\n  userId: string,\n  startsAt: Date,\n  endsAt: Date,\n): Promise<{
  );
  code = code.replace(
    const league = await ensureCurrentLeaguePeriod();\n\n  // 1. Kullanıcı,
    // 1. Kullanıcı
  );
  code = code.replace(/league\.startsAt/g, 'startsAt');
  code = code.replace(/league\.endsAt/g, 'endsAt');
  const wrapperFunc = 
/**
 * Belirli bir kullanıcı için aktif ligdeki TWR oranını hesaplar.
 */
export async function calculateTwrForUser(
  userId: string,
  _leagueId?: string,
): Promise<{
  twrPct: string;
  twrFloat: number;
  startValueCents: bigint;
  endValueCents: bigint;
}> {
  const league = await ensureCurrentLeaguePeriod();
  return calculateTwrForPeriod(userId, league.startsAt, league.endsAt);
}
;
  code = code + '\n' + wrapperFunc;
  fs.writeFileSync(path, code, 'utf8');
}
