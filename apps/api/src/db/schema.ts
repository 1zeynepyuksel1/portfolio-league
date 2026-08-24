import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  username: text('username'),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  verificationCode: text('verification_code'),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Accounts Table (100,000 TL = 10000000n cents, with non-negative check constraint)
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    cashCents: bigint('cash_cents', { mode: 'bigint' })
      .notNull()
      .default(sql`10000000`),
  },
  (table) => [
    check('cash_cents_non_negative', sql`${table.cashCents} >= 0`),
  ],
);

// Refresh Tokens Table
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
});

// Asset Kind Enum
export const assetKindEnum = pgEnum('asset_kind', [
  'crypto',
  'fx',
  'metal',
  'bist',
]);

// Assets Table (Supported tradable instruments: BTC, ETH, USD, EUR, GRAM_ALTIN)
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  symbol: text('symbol').notNull().unique(),
  name: text('name').notNull(),
  kind: assetKindEnum('kind').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Price History Table (Central store for asset prices in TRY)
export const priceHistory = pgTable(
  'price_history',
  {
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    ts: timestamp('ts').notNull(),
    priceTry: numeric('price_try', { precision: 24, scale: 8 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.ts] }),
  ],
);

// Order Side Enum (Buy / Sell)
export const orderSideEnum = pgEnum('order_side', ['buy', 'sell']);

// Orders Table (Executed trade ledger and idempotency tracking)
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    side: orderSideEnum('side').notNull(),
    quantity: numeric('quantity', { precision: 28, scale: 10 }).notNull(),
    priceTry: numeric('price_try', { precision: 24, scale: 8 }).notNull(),
    grossCents: bigint('gross_cents', { mode: 'bigint' }).notNull(),
    feeCents: bigint('fee_cents', { mode: 'bigint' }).notNull(),
    netCents: bigint('net_cents', { mode: 'bigint' }).notNull(),
    note: text('note'),
    idempotencyKey: text('idempotency_key').notNull(),
    executedAt: timestamp('executed_at').defaultNow().notNull(),
  },
  (table) => [
    unique('user_idempotency_idx').on(table.userId, table.idempotencyKey),
  ],
);

// Holdings Table (User portfolio positions)
export const holdings = pgTable(
  'holdings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 28, scale: 10 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.assetId] }),
    check('quantity_non_negative', sql`${table.quantity} >= 0`),
  ],
);

// Cash Movement Kind Enum
export const cashMovementKindEnum = pgEnum('cash_movement_kind', [
  'signup_bonus',
  'daily_bonus',
  'buy',
  'sell',
  'fee',
]);

// Cash Movements Table (Account statement / audit trail for all cash flows)
export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: cashMovementKindEnum('kind').notNull(),
  amountCents: bigint('amount_cents', { mode: 'bigint' }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Friendship Status Enum
export const friendshipStatusEnum = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'blocked',
]);

// Friendships Table
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('requester_addressee_idx').on(table.requesterId, table.addresseeId),
  ],
);

// Portfolio Snapshot Reason Enum
export const portfolioSnapshotReasonEnum = pgEnum('portfolio_snapshot_reason', [
  'daily',
  'pre_flow',
  'post_flow',
  'league',
]);

// Portfolio Snapshots Table (Time-series value history for TWR and charts)
export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ts: timestamp('ts').defaultNow().notNull(),
    totalValueCents: bigint('total_value_cents', { mode: 'bigint' }).notNull(),
    reason: portfolioSnapshotReasonEnum('reason').notNull().default('daily'),
  },
  (table) => [
    index('snapshot_user_ts_idx').on(table.userId, table.ts),
  ],
);

// League Status Enum
export const leagueStatusEnum = pgEnum('league_status', [
  'open',
  'closed',
]);

// League Periods Table (Weekly competitive seasons)
export const leaguePeriods = pgTable('league_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  status: leagueStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// League Entries Table (User participation, computed TWR return, and ranking)
export const leagueEntries = pgTable(
  'league_entries',
  {
    periodId: uuid('period_id')
      .notNull()
      .references(() => leaguePeriods.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startValueCents: bigint('start_value_cents', { mode: 'bigint' }).notNull(),
    endValueCents: bigint('end_value_cents', { mode: 'bigint' }).notNull(),
    twrPct: numeric('twr_pct', { precision: 10, scale: 4 }).notNull().default('0.0000'),
    rank: integer('rank'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.userId] }),
  ],
);

// Inflation Index Table (Monthly Consumer Price Index - TÜFE for real return calculations)
export const inflationIndex = pgTable('inflation_index', {
  month: text('month').primaryKey(), // Format: "YYYY-MM" (Örn: "2020-03")
  tufeIndex: numeric('tufe_index', { precision: 12, scale: 4 }).notNull(), // Örn: 450.5000
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
