import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgrespassword@127.0.0.1:5433/portfolio_league';

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient);
