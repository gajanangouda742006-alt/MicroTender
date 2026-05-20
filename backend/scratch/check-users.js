const db = require('../config/database');

async function run() {
  await db.initDatabase();
  const users = await db.all('SELECT user_id, name, email, role FROM users');
  console.log('📋 CURRENT DATABASE USERS:');
  console.table(users);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
