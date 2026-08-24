import { Router } from 'express';
import { whatIfQuerySchema } from './what-if.schema.js';
import {
  AssetNotFoundError,
  calculateWhatIf,
  calculateMultiples,
  HistoricalPriceNotFoundError,
  InflationIndexNotFoundError,
  LatestPriceNotFoundError,
} from './service.js';

export const whatIfRouter = Router();

/**
 * GET /what-if/multiples?date=YYYY-MM-DD
 *
 * Seçili tarih için TÜM varlıkların "kaç kat" listesi ve enflasyon eşiği.
 *
 * ⚠️ AYRI UÇ, çünkü ekran bunu tarih her değiştiğinde çekiyor ama tutar
 * değiştiğinde çekmiyor. `/what-if` ise tutara bağlı. İkisini birleştirmek
 * tutarı değiştiren her dokunuşta 20 varlıklık sorguyu tekrarlatırdı.
 */
whatIfRouter.get('/multiples', async (req, res) => {
  const date = req.query.date;

  // ⚠️ Sorgu parametresi dizi olarak da gelebilir (?date=a&date=b).
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Geçersiz tarih. Beklenen: YYYY-MM-DD' });
    return;
  }

  try {
    res.json(await calculateMultiples(date));
  } catch (error) {
    if (error instanceof InflationIndexNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error('[GET /what-if/multiples] başarısız:', error);
    res.status(500).json({ error: 'Kat listesi hesaplanamadı.' });
  }
});

// GET /what-if?symbol=BTC&date=2020-03-12&amountKurus=1000000
whatIfRouter.get('/', async (req, res) => {
  const parseResult = whatIfQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Geçersiz sorgu parametreleri.',
      details: parseResult.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await calculateWhatIf(parseResult.data);
    res.json(result);
  } catch (error) {
    if (
      error instanceof AssetNotFoundError ||
      error instanceof HistoricalPriceNotFoundError ||
      error instanceof LatestPriceNotFoundError ||
      error instanceof InflationIndexNotFoundError
    ) {
      res.status(404).json({
        error: error.message,
      });
      return;
    }

    console.error('What-if simülasyon hatası:', error);
    res.status(500).json({
      error: 'Simülasyon hesaplanırken beklenmeyen bir hata oluştu.',
    });
  }
});
