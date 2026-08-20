import { Router } from 'express';
import { whatIfQuerySchema } from './what-if.schema.js';
import {
  AssetNotFoundError,
  calculateWhatIf,
  HistoricalPriceNotFoundError,
  InflationIndexNotFoundError,
  LatestPriceNotFoundError,
} from './service.js';

export const whatIfRouter = Router();

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
