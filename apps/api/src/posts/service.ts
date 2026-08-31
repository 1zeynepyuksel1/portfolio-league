import { db } from '../db/client.js';
import { posts } from './schema.js';
import { users } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { getPortfolio } from '../portfolio/service.js';

export async function getTradedAssets(userId: string) {
  const result: any = await db.execute(sql`
    SELECT DISTINCT a.symbol, a.name 
    FROM orders o
    JOIN assets a ON o.asset_id = a.id
    WHERE o.user_id = ${userId}
  `);
  // postgres.js returns the array directly, pg returns { rows: [...] }
  return Array.isArray(result) ? result : (result.rows || []);
}

export async function getSingleAssetPreview(userId: string, assetKey: string) {
  const agg = await getPortfolio(userId);
  const position: any = agg.positions.find((p: any) => p.symbol === assetKey || (p.asset && p.asset.symbol === assetKey));
  
  if (!position) throw new Error("Bu varlıkta açık pozisyonunuz yok.");

  const profit = position.metrics ? position.metrics.find((m: any) => m.currency === 'try') : position;

  // Get first buy date for this asset
  const buyRes: any = await db.execute(sql`
    SELECT MIN(o.executed_at) as first_buy
    FROM orders o
    JOIN assets a ON o.asset_id = a.id
    WHERE o.user_id = ${userId} AND a.symbol = ${assetKey} AND o.side = 'buy'
  `);
  
  const rows = Array.isArray(buyRes) ? buyRes : (buyRes.rows || []);
  const firstBuyDate = rows.length > 0 && rows[0].first_buy ? new Date(rows[0].first_buy as string).toISOString() : new Date().toISOString();

  return {
    asset_key: assetKey,
    asset_name: position.name || assetKey,
    entry_price: (profit?.averageCost || position?.costCents || 0).toString(),
    current_price: (profit?.currentPrice || position?.valueCents || 0).toString(),
    pnl_percent: (profit?.profitPct || position?.profitPercent || "0.00"),
    pnl_amount: (profit?.profitCents || position?.profitCents || 0).toString(),
    buy_date: firstBuyDate,
    holding_days: 1
  };
}

export async function getPortfolioPreview(userId: string) {
  // Get all first buy dates for user's assets
  const buyRes: any = await db.execute(sql`
    SELECT a.symbol, MIN(o.executed_at) as first_buy
    FROM orders o
    JOIN assets a ON o.asset_id = a.id
    WHERE o.user_id = ${userId} AND o.side = 'buy'
    GROUP BY a.symbol
  `);
  
  const rows = Array.isArray(buyRes) ? buyRes : (buyRes.rows || []);
  const buyDatesMap = new Map();
  const iconsMap = new Map();
  for (const row of rows) {
    if (row.symbol && row.first_buy) {
      buyDatesMap.set(row.symbol as string, new Date(row.first_buy as string).toISOString());
      
    }
  }

  const agg = await getPortfolio(userId);
  
  const positions = agg.positions.map(p => ({
    symbol: p.symbol,
    name: p.name,
    icon_url: null,
    pnl_percent: p.profitPercent || "0.00",
    pnl_amount: p.profitCents.toString(),
    buy_date: buyDatesMap.get(p.symbol) || new Date().toISOString()
  }));

  return {
    period_label: 'Tüm Zamanlar Portföyü',
    note: 'İlk işlemden bugüne genel durum',
    snapshot_date: new Date().toISOString(),
    total_pnl_percent: agg.profitPercent || "0.00",
    total_pnl_amount: agg.profitCents.toString(),
    positions
  };
}

export async function createPost(userId: string, type: 'pnl_share' | 'wheel_share' | 'horoscope_share', scope: 'single_asset' | 'portfolio' | null, targetKey: string | null, periodParams: any, caption: string, visibility: 'public' | 'friends_only', clientPayload?: any) {
  let payload: any = {};
  
  if (type === 'pnl_share') {
    if (clientPayload?.is_market === true) {
        payload = clientPayload;
      } else if (scope === 'single_asset' && targetKey) {
      payload = await getSingleAssetPreview(userId, targetKey);
    } else if (scope === 'portfolio') {
      payload = await getPortfolioPreview(userId);
    } else {
      throw new Error("Geçersiz paylaşım kapsamı.");
    }
  } else if (type === 'wheel_share' || type === 'horoscope_share') {
    payload = clientPayload || {};
  } else {
    throw new Error("Geçersiz paylaşım tipi.");
  }

  const [newPost] = await db.insert(posts).values({
    userId,
    type,
    scope,
    payload,
    caption: caption.substring(0, 280),
    visibility
  }).returning();

  return newPost;
}

export async function getMyPosts(userId: string, limit = 20, offset = 0) {
  return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
}

export async function getFeed(viewerId: string, limit = 20, offset = 0) {
  const { friendships } = await import('../db/schema.js');
  const { inArray, or, and } = await import('drizzle-orm');

  const asRequester = await db.select({ id: friendships.addresseeId }).from(friendships).where(and(eq(friendships.requesterId, viewerId), eq(friendships.status, 'accepted')));
  const asAddressee = await db.select({ id: friendships.requesterId }).from(friendships).where(and(eq(friendships.addresseeId, viewerId), eq(friendships.status, 'accepted')));
  const friendIds = [...asRequester.map(r => r.id), ...asAddressee.map(r => r.id)];

  let visibilityCondition;
  if (friendIds.length > 0) {
    visibilityCondition = or(
      eq(posts.visibility, 'public'),
      eq(posts.userId, viewerId),
      and(eq(posts.visibility, 'friends_only'), inArray(posts.userId, friendIds))
    )!;
  } else {
    visibilityCondition = or(
      eq(posts.visibility, 'public'),
      eq(posts.userId, viewerId)
    )!;
  }

  const rows = await db.select({
    post: posts,
    user: users
  })
  .from(posts)
  .leftJoin(users, eq(posts.userId, users.id))
  .where(visibilityCondition)
  .orderBy(desc(posts.createdAt))
  .limit(limit)
  .offset(offset);
  
  return rows.map(row => ({
    ...row.post,
    user: {
      username: row.user?.username,
      firstName: row.user?.firstName,
      lastName: row.user?.lastName,
      avatarStyle: row.user?.avatarStyle,
      avatarSeed: row.user?.avatarSeed
    }
  }));
}