import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from '../db/schema.js';

export const postTypeEnum = pgEnum('post_type', ['pnl_share', 'wheel_share', 'horoscope_share', 'crown_share', 'what_if_share']);
export const postScopeEnum = pgEnum('post_scope', ['single_asset', 'portfolio']);
export const postVisibilityEnum = pgEnum('post_visibility', ['public', 'friends_only']);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: postTypeEnum('type').notNull(),
  scope: postScopeEnum('scope'),
  payload: jsonb('payload').notNull(),
  caption: text('caption'),
  visibility: postVisibilityEnum('visibility').default('public').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
