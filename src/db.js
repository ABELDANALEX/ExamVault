const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');

require('./loadEnv');

const DB_PATH = path.join(__dirname, '..', 'data', 'examvault.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

function now() {
  return new Date().toISOString();
}

function tableExists(tableName) {
  return Boolean(
    db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`).get(tableName)
  );
}

function getColumnNames(tableName) {
  if (!tableExists(tableName)) {
    return [];
  }

  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function ensureColumn(tableName, columnDefinition) {
  const columnName = columnDefinition.split(/\s+/)[0];
  const existingColumns = getColumnNames(tableName);

  if (!existingColumns.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

function setSystemConfig(key, value, updatedBy = null) {
  db.prepare(`
    INSERT INTO SystemConfig (key, value_text, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_text = excluded.value_text,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(key, value, now(), updatedBy);
}

function initializeBaseSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'faculty')),
      department_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES Departments (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES Departments (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      module INTEGER NOT NULL CHECK (module BETWEEN 1 AND 5),
      marks INTEGER NOT NULL CHECK (marks > 0),
      difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
      blooms_level TEXT NOT NULL CHECK (blooms_level IN ('K1', 'K2', 'K3', 'K4', 'K5', 'K6')),
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES Subjects (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES Users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Blueprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      name TEXT NOT NULL,
      structure_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES Subjects (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES Users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS GeneratedPapers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      blueprint_id INTEGER NOT NULL,
      generated_by INTEGER NOT NULL,
      total_marks INTEGER NOT NULL,
      encrypted_path TEXT NOT NULL,
      key_fingerprint TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES Subjects (id) ON DELETE CASCADE,
      FOREIGN KEY (blueprint_id) REFERENCES Blueprints (id) ON DELETE CASCADE,
      FOREIGN KEY (generated_by) REFERENCES Users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ExamHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      exam_date TEXT NOT NULL,
      paper_id INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES Questions (id) ON DELETE CASCADE,
      FOREIGN KEY (paper_id) REFERENCES GeneratedPapers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AuditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE SET NULL
    );
  `);
}

function runSchemaUpgrades() {
  ensureColumn('Departments', 'parent_department_id INTEGER REFERENCES Departments(id) ON DELETE SET NULL');

  ensureColumn('Users', "status TEXT NOT NULL DEFAULT 'active'");
  ensureColumn('Users', 'approved_by INTEGER REFERENCES Users(id) ON DELETE SET NULL');
  ensureColumn('Users', 'approved_at TEXT');
  ensureColumn('Users', 'revoked_at TEXT');
  ensureColumn('Users', 'last_login_at TEXT');

  ensureColumn('Questions', "difficulty_code TEXT NOT NULL DEFAULT 'L1'");
  ensureColumn('Questions', "question_type TEXT NOT NULL DEFAULT 'Theory'");
  ensureColumn('Questions', 'version INTEGER NOT NULL DEFAULT 1');
  ensureColumn('Questions', 'is_active INTEGER NOT NULL DEFAULT 1');
  ensureColumn('Questions', 'archived_at TEXT');

  db.exec(`
    UPDATE Questions
    SET difficulty_code = CASE difficulty
      WHEN 'Hard' THEN 'L3'
      WHEN 'Medium' THEN 'L2'
      ELSE 'L1'
    END
    WHERE difficulty_code IS NULL OR TRIM(difficulty_code) = '';

    UPDATE Questions SET question_type = 'Theory' WHERE question_type IS NULL OR TRIM(question_type) = '';
    UPDATE Questions SET version = 1 WHERE version IS NULL OR version < 1;
    UPDATE Questions SET is_active = 1 WHERE is_active IS NULL;

    UPDATE Users SET status = 'active' WHERE status IS NULL OR TRIM(status) = '';
    UPDATE Users
    SET approved_at = created_at
    WHERE approved_at IS NULL AND status = 'active';
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS FacultySubjectAssignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      approved_by INTEGER,
      approved_at TEXT,
      revoked_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES Users (id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES Subjects (id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES Users (id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_faculty_subject_assignment_active
      ON FacultySubjectAssignments (user_id, subject_id)
      WHERE is_active = 1;

    CREATE TABLE IF NOT EXISTS QuestionVersions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      module INTEGER NOT NULL,
      marks INTEGER NOT NULL,
      difficulty_code TEXT NOT NULL,
      blooms_level TEXT NOT NULL,
      question_type TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      snapshot_reason TEXT NOT NULL,
      snapshot_by INTEGER,
      snapshot_at TEXT NOT NULL,
      FOREIGN KEY (question_id) REFERENCES Questions (id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES Subjects (id) ON DELETE CASCADE,
      FOREIGN KEY (snapshot_by) REFERENCES Users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS SystemConfig (
      key TEXT PRIMARY KEY,
      value_text TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by INTEGER,
      FOREIGN KEY (updated_by) REFERENCES Users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS SecurityAlerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by INTEGER,
      FOREIGN KEY (resolved_by) REFERENCES Users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS KeyHandovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL UNIQUE,
      encrypted_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revealed_at TEXT,
      revealed_by INTEGER,
      FOREIGN KEY (paper_id) REFERENCES GeneratedPapers (id) ON DELETE CASCADE,
      FOREIGN KEY (revealed_by) REFERENCES Users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS KeyDispatchLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL,
      channel_type TEXT NOT NULL,
      channel_target TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_note TEXT,
      created_at TEXT NOT NULL,
      dispatched_at TEXT,
      FOREIGN KEY (paper_id) REFERENCES GeneratedPapers (id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_departments_parent ON Departments (parent_department_id);
    CREATE INDEX IF NOT EXISTS idx_questions_subject_module ON Questions (subject_id, module);
    CREATE INDEX IF NOT EXISTS idx_questions_creator_active ON Questions (created_by, is_active);
    CREATE INDEX IF NOT EXISTS idx_blueprints_creator ON Blueprints (created_by);
    CREATE INDEX IF NOT EXISTS idx_generated_papers_subject ON GeneratedPapers (subject_id, generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_generated_papers_generator ON GeneratedPapers (generated_by, generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exam_history_question ON ExamHistory (question_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON Sessions (token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON AuditLogs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON SecurityAlerts (resolved_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_question_versions_question ON QuestionVersions (question_id, version_number DESC);
    CREATE INDEX IF NOT EXISTS idx_dispatch_logs_paper ON KeyDispatchLogs (paper_id, created_at DESC);
  `);
}

function seedDefaults() {
  const adminCountRow = db.prepare(`SELECT COUNT(*) AS count FROM Users WHERE role = 'admin'`).get();
  const adminCount = Number(adminCountRow.count || 0);

  if (adminCount === 0) {
    const timestamp = now();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
    const passwordHash = bcrypt.hashSync(adminPassword, 12);
    const result = db.prepare(`
      INSERT INTO Users (name, email, password_hash, role, department_id, status, approved_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('System Admin', 'admin@examvault.local', passwordHash, 'admin', null, 'active', timestamp, timestamp);
    const adminId = Number(result.lastInsertRowid);

    db.prepare(`
      INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'SYSTEM_SEEDED_DEFAULT_ADMIN',
      'Users',
      adminId,
      JSON.stringify({ email: 'admin@examvault.local' }),
      timestamp
    );
  }

  const defaults = {
    global_lookback_months: '6',
    global_lookback_exam_count: '3',
    pdf_university_name: 'ExamVault University',
    pdf_header_text: 'Confidential Question Paper',
    pdf_footer_text: 'Generated securely by ExamVault for authorized exam use only.',
    pdf_logo_path: '',
    exam_cell_email: 'examcell@example.edu',
    exam_cell_phone: '+910000000000',
    handover_mode: 'admin_reveal'
  };

  Object.entries(defaults).forEach(([key, value]) => {
    if (!db.prepare(`SELECT key FROM SystemConfig WHERE key = ? LIMIT 1`).get(key)) {
      setSystemConfig(key, value, null);
    }
  });
}

function initDatabase() {
  initializeBaseSchema();
  runSchemaUpgrades();
  seedDefaults();
}

initDatabase();

module.exports = {
  db,
  now,
  DB_PATH,
  setSystemConfig
};
