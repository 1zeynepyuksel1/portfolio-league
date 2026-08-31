const { db } = require('./apps/api/dist/db/index.js');
const { posts, users } = require('./apps/api/dist/db/schema.js');

async function test() {
  const allPosts = await db.select({
    id: posts.id,
    userId: posts.userId,
    username: users.username,
    createdAt: posts.createdAt
  }).from(posts).leftJoin(users, posts.userId === users.id).orderBy(posts.createdAt);
  
  console.log(allPosts);
  process.exit(0);
}
test();
