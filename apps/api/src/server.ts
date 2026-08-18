import 'dotenv/config';
import { app } from './app.js';
import { startPriceCron } from './market/scheduler.js';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Fiyat çekme işi sunucuyla aynı süreçte, dakikada bir çalışır.
  startPriceCron();
});
