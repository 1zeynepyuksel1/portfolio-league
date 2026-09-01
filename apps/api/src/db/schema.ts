import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
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
  jsonb,
} from 'drizzle-orm/pg-core';

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  /*
    ⚠️ `notNull` KALDIRILDI — SADECE GOOGLE İLE GİREN KULLANICI İÇİN.

    Yalnızca Google ile kayıt olan birinin şifresi YOKTUR. Eskiden rastgele
    bir şifre üretip hash'lemek de mümkündü ama o "şifresi var" yalanını
    söylerdi: "şifremi unuttum" akışı o hesabı kabul eder, kullanıcı asla
    bilemeyeceği bir şifreyi sıfırlamaya çalışırdı.

    `null` dürüst: bu hesabın şifre yolu yok.

    ⚠️ BUNUN BEDELİ: şifre karşılaştıran HER YER artık null'ı elemek
    zorunda. `auth/service.ts` içindeki giriş ve sıfırlama akışları bunu
    açıkça kontrol ediyor.
  */
  passwordHash: text('password_hash'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  username: text('username').notNull().unique(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  verificationCode: text('verification_code'),

  /*
    ⚠️ ROL: enum DEĞİL, metin — ve bu bilinçli.

    PostgreSQL enum'una değer eklemek ayrı bir migration ister ve enum'u
    SİLMEK bu projede zaten bir kez tabloyu götürdü (0013). Rol listesi
    ileride büyüyebilir ('moderator' gibi); metin + varsayılan, esnek ve
    geri dönüşü kolay.

    ⚠️ VARSAYILAN 'user' VE `notNull` — YETKİ ASLA "belirsiz" OLMAMALI.
    Kolon boş bırakılabilseydi `role === 'admin'` kontrolü null için false
    dönerdi (şans eseri doğru), ama `role !== 'user'` yazan biri yanlışlıkla
    herkesi yetkili sayardı. Belirsizlik yetki kodunda en tehlikeli şey.
  */
  role: text('role').default('user').notNull(),

  /*
    ⚠️ BAN: boolean DEĞİL, ZAMAN DAMGASI.

    `is_banned` boolean olsaydı "ne zaman banlandı" bilgisi kaybolurdu ve
    itiraz geldiğinde bakacak bir şey olmazdı. `null` = banlı değil,
    dolu = o andan itibaren banlı. Aynı kolon hem durumu hem geçmişi
    taşıyor.
  */
  bannedAt: timestamp('banned_at'),
  banReason: text('ban_reason'),

  /*
    ⚠️ GÜVENLİK SORUSU — CEVAP HASH'LENİYOR, DÜZ METİN DEĞİL.

    Cevap ikinci bir şifredir: veritabanı sızarsa düz metin cevaplar hem bu
    uygulamada hem — insanlar aynı cevabı her yerde verdiği için — başka
    servislerde hesap açar. Şifreyle aynı `argon2` fonksiyonundan geçiyor.

    ⚠️ SORU METNİ HASH'LENMİYOR, çünkü kullanıcıya SORULMASI gerekiyor.
    Gizli olan cevap, soru değil.
  */
  securityQuestion: text('security_question'),
  securityAnswerHash: text('security_answer_hash'),

  /*
    ⚠️ GOOGLE KİMLİĞİ — e-posta DEĞİL, Google'ın `sub` alanı.

    E-postaya bağlasaydık, biri Google hesabının e-postasını değiştirdiğinde
    bağ kopardı. `sub` Google'da o kullanıcı için kalıcı ve değişmiyor.

    ⚠️ `unique`: iki yerel hesap aynı Google hesabına bağlanamaz. Olsaydı
    "Google ile giriş" hangi hesabı açacağını bilemezdi.
  */
  googleId: text('google_id').unique(),
  isPublic: boolean('is_public').default(true).notNull(),
    allocationVisibility: text('allocation_visibility').default('private').notNull(),
  avatarSeed: text('avatar_seed'),
  avatarStyle: text('avatar_style'),
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

/**
 * Varlık türü.
 */
export const assetKindEnum = pgEnum('asset_kind', [
  'crypto',
  'fx',
  'metal',
  'bist',
  'stock',
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
    openUsd: numeric('open_usd', { precision: 24, scale: 8 }),
    highUsd: numeric('high_usd', { precision: 24, scale: 8 }),
    lowUsd: numeric('low_usd', { precision: 24, scale: 8 }),
    granularity: text('granularity'),
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
    /*
      ⚠️ "SONUÇ GÖSTERİLDİ Mİ" SUNUCUDA TUTULUYOR, TELEFONDA DEĞİL.

      Telefonun yerel deposunda tutsaydık: uygulamayı silip kuran ya da
      ikinci cihazdan giren kullanıcı aynı kutlamayı tekrar görürdü.
      Daha kötüsü, kutlamayı gördüğünü sunucu bilemezdi.

      Boolean yerine yine zaman damgası: `null` = görmedi, dolu = ne zaman
      gördü. Aynı gerekçe `users.banned_at`'te de var.
    */
    resultSeenAt: timestamp('result_seen_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.periodId, table.userId] }),
  ],
);

// Inflation Index Table (Monthly Consumer Price Index - TÜFE for real return calculations)
export const inflationIndex = pgTable('inflation_index', {
  month: text('month').primaryKey(),
  tufeIndex: numeric('tufe_index', { precision: 12, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Achievements Table (List of all badges in the game)
export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(), // e.g., 'first_place', 'top3_streak_3', 'diamond_hands'
  title: text('title').notNull(),
  description: text('description').notNull(),
  iconName: text('icon_name').notNull(), // Lucide icon name, e.g., 'Award', 'Flame', 'Gem'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User Achievements Table (Which users earned which badges)
export const userAchievements = pgTable('user_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: uuid('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
}, (table) => [
  unique('user_achievement_idx').on(table.userId, table.achievementId),
]);

// Activity Type Enum
export const activityTypeEnum = pgEnum('activity_type', ['trade', 'achievement', 'text']);

// Activities Table (Social feed posts)
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: activityTypeEnum('type').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  profitPct: numeric('profit_pct', { precision: 10, scale: 4 }),
  assetSymbol: text('asset_symbol'),
  metadata: jsonb('metadata'),
  likesCount: integer('likes_count').default(0).notNull(),
  commentsCount: integer('comments_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Reward Type Enum
export const rewardTypeEnum = pgEnum('reward_type', [
  'cash',
  'bonus_multiplier',
  'fee_discount',
  'early_unlock',
  'fee_free_period',
  'avatar_frame',
  'badge',
  'none',
]);

// Wheel Rewards Table
export const wheelRewards = pgTable('wheel_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  rewardType: rewardTypeEnum('reward_type').notNull(),
  rewardValue: jsonb('reward_value'),
  weight: numeric('weight', { precision: 5, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// Wheel Spins Log Table
export const wheelSpins = pgTable('wheel_spins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rewardId: uuid('reward_id').notNull().references(() => wheelRewards.id, { onDelete: 'cascade' }),
  wonAt: timestamp('won_at').defaultNow().notNull(),
});

/** Falcı Abla içerik havuzundaki cümlelerin rolü. */
export const fortuneCategoryEnum = pgEnum('fortune_category', [
  'main',
  'cautious',
  'playful',
  'asset_specific',
  'closing',
]);

/**
 * Düzenlenebilir fal cümleleri. `asset_specific` satırları bir varlığın
 * sembolüne bağlanır; diğer kategorilerde assetKey boş olmalıdır.
 */
export const fortuneLines = pgTable(
  'fortune_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: fortuneCategoryEnum('category').notNull(),
    text: text('text').notNull(),
    assetKey: text('asset_key').references(() => assets.symbol, {
      onDelete: 'cascade',
    }),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    check(
      'fortune_line_asset_category_check',
      sql`(${table.category} = 'asset_specific' AND ${table.assetKey} IS NOT NULL)
        OR (${table.category} <> 'asset_specific' AND ${table.assetKey} IS NULL)`,
    ),
  ],
);

/** Kullanıcıya bir gün boyunca aynı falı döndürmek için günlük cache. */
export const dailyFortunes = pgTable(
  'daily_fortunes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fortuneDate: date('fortune_date', { mode: 'string' }).notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('daily_fortune_user_date_idx').on(table.userId, table.fortuneDate),
    index('daily_fortune_user_date_lookup_idx').on(table.userId, table.fortuneDate),
  ],
);


// IMPORTANT: Include external schemas so drizzle-kit tracks them
export * from '../posts/schema.js';
