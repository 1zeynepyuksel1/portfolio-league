import express from 'express';
import { authRouter } from './auth/router.js';
import { meRouter } from './auth/me.router.js';
import { bonusRouter } from './bonus/router.js';
import { friendsRouter } from './friends/router.js';
import { marketRouter } from './market/router.js';

export const app = express();

app.use(express.json());

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/bonus', bonusRouter);
app.use('/friends', friendsRouter);
app.use('/assets', marketRouter);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});
