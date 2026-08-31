import {
  getActiveFortuneAssets,
  getActiveFortuneLines,
  type FortuneCategory,
  type FortuneLine,
} from './repository.js';

const FORTUNE_TIMEZONE = 'Europe/Istanbul';

export type FortuneResult = {
  date: string;
  content: string;
  asset: { symbol: string; name: string };
  cached: boolean;
};

export class FortuneContentUnavailableError extends Error {
  constructor() {
    super('Fal içerikleri veya aktif varlıklar henüz hazır değil.');
  }
}

/** Türkiye gününü UTC yerine İstanbul saatine göre hesaplar. */
export function getFortuneDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FORTUNE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');

  if (!year || !month || !day) throw new Error('Fal tarihi oluşturulamadı.');
  return `${year}-${month}-${day}`;
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new FortuneContentUnavailableError();
  return item;
}

function chooseMainCategory(random: () => number): FortuneCategory {
  const roll = random();
  if (roll < 0.6) return 'main';
  if (roll < 0.85) return 'cautious';
  return 'playful';
}

export function composeFortune(input: {
  asset: { symbol: string; name: string };
  lines: FortuneLine[];
  random?: () => number;
}): string {
  const random = input.random ?? Math.random;
  const category = chooseMainCategory(random);
  const mainLines = input.lines.filter((line) => line.category === category);
  const primary = pickOne(mainLines, random).text.replaceAll('{asset}', input.asset.name);
  const parts = [primary];

  if (random() < 0.5) {
    const specificLines = input.lines.filter(
      (line) =>
        line.category === 'asset_specific' && line.assetKey === input.asset.symbol,
    );
    if (specificLines.length > 0) parts.push(pickOne(specificLines, random).text);
  }

  if (random() < 0.2) {
    const closingLines = input.lines.filter((line) => line.category === 'closing');
    if (closingLines.length > 0) parts.push(pickOne(closingLines, random).text);
  }

  return parts.join(' ');
}

/**
 * ⚠️ `_userId` — parametre KULLANILMIYOR ama imzadan ÇIKARILMADI.
 *
 * Günlük fal önbelleği test için devre dışı bırakılmış (bkz. silinen
 * `cached` satırı); önbellek geri gelince kullanıcı kimliği yine
 * gerekecek. Parametreyi silmek çağıran tarafları da değiştirmek
 * demekti — alt çizgi, TypeScript'e "bilerek kullanılmıyor" diyor.
 */
export async function getTodayFortune(_userId: string): Promise<FortuneResult> {
  const fortuneDate = getFortuneDate();

  const [assets, lines] = await Promise.all([
    getActiveFortuneAssets(),
    getActiveFortuneLines(),
  ]);
  if (assets.length === 0 || lines.length === 0) {
    throw new FortuneContentUnavailableError();
  }

  const asset = pickOne(assets, Math.random);
  const content = composeFortune({ asset, lines });
  // TEST: DB kaydı kapatıldı
  const stored = { date: fortuneDate, content, asset };

  return {
    date: stored.date,
    content: stored.content,
    asset: stored.asset,
    cached: false,
  };
}


