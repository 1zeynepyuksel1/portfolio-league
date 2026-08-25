import './lib/env.js';
import { app } from './app.js';
import { startLeagueClosingCron } from './leagues/cron.js';
import { startPriceCron } from './market/scheduler.js';
import { startTufeCron } from './market/tufe-cron.js';
import { startPortfolioCron } from './portfolio/cron.js';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Fiyat çekme robotu (dakikada bir)
  startPriceCron();
  // Aylık TÜFE çekme robotu (her ayın 3'ünde saat 10:05)
  startTufeCron();
  // Haftalık lig kapanış robotu (her Pazar 23:59:59)
  startLeagueClosingCron();
  // Günlük portföy özetleme robotu (her gün 23:55)
  startPortfolioCron();
});
