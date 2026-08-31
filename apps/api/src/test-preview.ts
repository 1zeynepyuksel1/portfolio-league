import { db } from './db/client.js';
import { getPortfolioPreview } from './posts/service.js';

async function test() {
  try {
    const users: any = await db.execute('SELECT id FROM users LIMIT 1');
    const rows = Array.isArray(users) ? users : users.rows;
    if (rows.length === 0) {
      console.log('No users found.');
      return;
    }
    const userId = rows[0].id;
    console.log('Testing with user: ' + userId);
    
    const preview = await getPortfolioPreview(userId);
    console.log('Preview success:', preview);
  } catch (err) {
    console.error('Error generating preview:', err);
  } finally {
    process.exit(0);
  }
}

test();
