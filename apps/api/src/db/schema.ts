import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Accounts Table (100,000 TL = 10000000n cents)
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  cashCents: bigint('cash_cents', { mode: 'bigint' }).notNull().default(sql`10000000`),
});

// Refresh Tokens Table
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
});

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
  orderId: uuid('order_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
