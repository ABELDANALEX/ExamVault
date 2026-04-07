const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');

const { db } = require('../src/db');

const STORAGE_DIRECTORY = path.join(__dirname, '..', 'storage', 'papers');

const TABLES_TO_CLEAR = [
  'Sessions',
  'KeyDispatchLogs',
  'KeyHandovers',
  'SecurityAlerts',
  'AuditLogs',
  'ExamHistory',
  'GeneratedPapers',
  'QuestionVersions',
  'Blueprints',
  'Questions',
  'FacultySubjectAssignments',
  'Subjects',
  'Departments'
];

const SEQUENCES_TO_RESET = [
  ...TABLES_TO_CLEAR,
  'Users'
];

function ensureStorageDirectory() {
  fs.rmSync(STORAGE_DIRECTORY, { recursive: true, force: true });
  fs.mkdirSync(STORAGE_DIRECTORY, { recursive: true });
}

function resetData() {
  ensureStorageDirectory();

  db.exec('BEGIN IMMEDIATE');

  try {
    TABLES_TO_CLEAR.forEach((tableName) => {
      db.prepare(`DELETE FROM ${tableName}`).run();
    });

    db.prepare(`DELETE FROM Users WHERE role = 'faculty'`).run();

    const placeholders = SEQUENCES_TO_RESET.map(() => '?').join(', ');
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...SEQUENCES_TO_RESET);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function syncDefaultAdminPassword() {
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
  const admin = db
    .prepare(`SELECT id FROM Users WHERE role = 'admin' AND email = ? LIMIT 1`)
    .get('admin@examvault.local');

  if (!admin) {
    return false;
  }

  db.prepare(`
    UPDATE Users
    SET password_hash = ?
    WHERE id = ?
  `).run(bcrypt.hashSync(adminPassword, 12), admin.id);

  return true;
}

function summarizeState() {
  return {
    admins: db.prepare(`SELECT COUNT(*) AS count FROM Users WHERE role = 'admin'`).get().count,
    faculty: db.prepare(`SELECT COUNT(*) AS count FROM Users WHERE role = 'faculty'`).get().count,
    departments: db.prepare(`SELECT COUNT(*) AS count FROM Departments`).get().count,
    subjects: db.prepare(`SELECT COUNT(*) AS count FROM Subjects`).get().count,
    questions: db.prepare(`SELECT COUNT(*) AS count FROM Questions`).get().count,
    blueprints: db.prepare(`SELECT COUNT(*) AS count FROM Blueprints`).get().count,
    generatedPapers: db.prepare(`SELECT COUNT(*) AS count FROM GeneratedPapers`).get().count,
    examHistory: db.prepare(`SELECT COUNT(*) AS count FROM ExamHistory`).get().count,
    auditLogs: db.prepare(`SELECT COUNT(*) AS count FROM AuditLogs`).get().count,
    securityAlerts: db.prepare(`SELECT COUNT(*) AS count FROM SecurityAlerts`).get().count,
    keyHandovers: db.prepare(`SELECT COUNT(*) AS count FROM KeyHandovers`).get().count,
    keyDispatchLogs: db.prepare(`SELECT COUNT(*) AS count FROM KeyDispatchLogs`).get().count,
    sessions: db.prepare(`SELECT COUNT(*) AS count FROM Sessions`).get().count,
    configEntries: db.prepare(`SELECT COUNT(*) AS count FROM SystemConfig`).get().count
  };
}

try {
  resetData();
  syncDefaultAdminPassword();
  console.log('ExamVault data reset complete.');
  console.log('Preserved: admin account(s) and system configuration.');
  console.log('Synced: default admin password from .env (or fallback).');
  console.log(JSON.stringify(summarizeState(), null, 2));
} catch (error) {
  console.error('Failed to reset ExamVault data.');
  console.error(error.message);
  process.exitCode = 1;
}
