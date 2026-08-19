import express from 'express';
import { authRouter } from './auth/router.js';
import { meRouter } from './auth/me.router.js';
import { bonusRouter } from './bonus/router.js';
import { friendsRouter } from './friends/router.js';
import { leaguesRouter } from './leagues/router.js';
import { marketRouter } from './market/router.js';
import { whatIfRouter } from './what-if/router.js';

export const app = express();

app.use(express.json());

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/bonus', bonusRouter);
app.use('/friends', friendsRouter);
app.use('/leagues', leaguesRouter);
app.use('/assets', marketRouter);
app.use('/what-if', whatIfRouter);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});
