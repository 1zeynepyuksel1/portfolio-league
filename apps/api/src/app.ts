import cors from 'cors';
import express from 'express';
import { authRouter } from './auth/router.js';
import { meRouter } from './auth/me.router.js';
import { usersRouter } from './users/router.js';
import { bonusRouter } from './bonus/router.js';
import { friendsRouter } from './friends/router.js';
import { leaguesRouter } from './leagues/router.js';
import { marketRouter } from './market/router.js';
import { ordersRouter } from './orders/router.js';
import { portfolioRouter } from './portfolio/router.js';
import { whatIfRouter } from './what-if/router.js';

export const app = express();

// Web tarayıcısından (localhost:8081) gelen isteklere izin ver (CORS)
app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/users', usersRouter);
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
