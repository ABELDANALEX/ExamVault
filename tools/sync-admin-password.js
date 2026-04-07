const bcrypt = require('bcrypt');

require('../src/loadEnv');

const { db } = require('../src/db');

const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
const admin = db
  .prepare(`SELECT id, email FROM Users WHERE role = 'admin' AND email = ? LIMIT 1`)
  .get('admin@examvault.local');

if (!admin) {
  console.error('Default admin account not found.');
  process.exitCode = 1;
} else {
  const passwordHash = bcrypt.hashSync(adminPassword, 12);
  db.prepare(`
    UPDATE Users
    SET password_hash = ?
    WHERE id = ?
  `).run(passwordHash, admin.id);

  console.log(`Default admin password synced from .env for ${admin.email}.`);
}
