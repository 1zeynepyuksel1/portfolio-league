import cors from 'cors';
import express from 'express';
import { authRouter } from './auth/router.js';
import { behaviorRouter } from './behavior/router.js';
import { meRouter } from './auth/me.router.js';
import { bonusRouter } from './bonus/router.js';
import { friendsRouter } from './friends/router.js';
import { leaguesRouter } from './leagues/router.js';
import { marketRouter } from './market/router.js';
import { ordersRouter } from './orders/router.js';
import { portfolioRouter } from './portfolio/router.js';
import { profileRouter } from './profile/router.js';
import { whatIfRouter } from './what-if/router.js';

export const app = express();

// Web tarayıcısından (localhost:8081) gelen isteklere izin ver (CORS)
app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/me', meRouter);
/*
 * ⚠️ AYNI ÖNEKE İKİNCİ ROUTER — ve bu sefer çakışma YOK.
 *
 * Aşağıdaki `/users` notunda anlatılan kaza tam olarak bundan çıkmıştı:
 * iki router aynı YOLU tanımlarsa ilk bağlanan kazanır, ikincisi sessizce
 * ölür. Burada çakışma yok çünkü `meRouter` yalnızca `/` tanımlıyor,
 * `behaviorRouter` ise `/behavior`. Express eşleşmeyen router'ı atlayıp
 * sıradakine geçiyor.
 *
 * Ayrı dosya olmasının sebebi: kimlik ile davranış analizi farklı işler.
 * `me.router.ts` Zeynep'in şeridinde, `behavior/` benim.
 */
app.use('/me', behaviorRouter);
/*
 * ⚠️ İKİ PROFİL UCU YAZILDI — AYNI ADRESE.
 *
 * Aynı gün paralel çalışırken ikimiz de GET /users/:username yazmışız:
 *   users/router.ts   (Zeynep) — kimlik + rank + twr
 *   profile/router.ts (Batuhan) — üstüne varlık DAĞILIMI, pozisyon kârı,
 *                                 bekleyen istek yönü, gizlilik ayarı
 *
 * Express aynı yola bağlı iki router'ı SIRAYLA deniyor: önce bağlanan
 * kazanıyor. İkisi de açık kalsaydı hangisinin cevap verdiği bağlanma
 * sırasına bağlı olurdu — sessiz ve anlaşılması zor bir hata.
 *
 * profile/ bağlı çünkü ProfileScreen onun alanlarına dayanıyor
 * (allocation, pending, friendCount). users/ modülü DURUYOR ve testleri
 * geçiyor — servisi doğrudan test ediliyor, router'ı değil. Zeynep
 * ikisini birleştirmeye ya da silmeye karar verecek.
 */
// app.use('/users', usersRouter);   <- profile/router.js ile çakışıyor
app.use('/users', profileRouter);
app.use('/bonus', bonusRouter);
app.use('/friends', friendsRouter);
app.use('/leagues', leaguesRouter);
app.use('/assets', marketRouter);
app.use('/orders', ordersRouter);
app.use('/portfolio', portfolioRouter);
app.use('/what-if', whatIfRouter);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});
