const bcrypt = require('bcrypt');
const { randomBytes, createHash } = require('node:crypto');

const { db, now } = require('../db');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function findUserByEmail(email) {
  return (
    db.prepare(`SELECT * FROM Users WHERE email = ? LIMIT 1`).get(normalizeEmail(email)) || null
  );
}

function verifyPassword(user, password) {
  if (!user) {
    return false;
  }

  return bcrypt.compareSync(String(password || ''), user.password_hash);
}

function authenticateUser(email, password) {
  const user = findUserByEmail(email);

  if (!user || !verifyPassword(user, password)) {
    return null;
  }

  if (user.status !== 'active') {
    return null;
  }

  return user;
}

function createUser({
  name,
  email,
  password,
  role,
  departmentId = null,
  status = 'active',
  approvedBy = null,
  approvedAt = null
}) {
  const normalizedEmail = normalizeEmail(email);
  const timestamp = now();
  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO Users (name, email, password_hash, role, department_id, status, approved_by, approved_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    normalizedEmail,
    passwordHash,
    role,
    departmentId || null,
    status,
    approvedBy,
    approvedAt || (status === 'active' ? timestamp : null),
    timestamp
  );

  return Number(result.lastInsertRowid);
}

function registerFacultyUser({ name, email, password, departmentId = null }) {
  return createUser({
    name,
    email,
    password,
    role: 'faculty',
    departmentId,
    status: 'pending'
  });
}

function pruneExpiredSessions() {
  db.prepare(`DELETE FROM Sessions WHERE expires_at <= ?`).run(now());
}

function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO Sessions (user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, tokenHash, expiresAt, now());

  db.prepare(`UPDATE Users SET last_login_at = ? WHERE id = ?`).run(now(), userId);

  return { token, expiresAt };
}

function getUserFromSessionToken(token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  return (
    db.prepare(`
      SELECT u.*
      FROM Sessions s
      INNER JOIN Users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      LIMIT 1
    `).get(tokenHash, now()) || null
  );
}

function destroySession(token) {
  if (!token) {
    return;
  }

  db.prepare(`DELETE FROM Sessions WHERE token_hash = ?`).run(hashToken(token));
}

module.exports = {
  authenticateUser,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  getUserFromSessionToken,
  normalizeEmail,
  pruneExpiredSessions,
  registerFacultyUser,
  verifyPassword
};
