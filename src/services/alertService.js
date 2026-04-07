const { db, now } = require('../db');

function createAlert({ alertType, severity = 'medium', message, metadata = null }) {
  const existing = db.prepare(`
    SELECT id
    FROM SecurityAlerts
    WHERE alert_type = ? AND resolved_at IS NULL AND metadata_json = ?
    LIMIT 1
  `).get(alertType, metadata ? JSON.stringify(metadata) : null);

  if (existing) {
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO SecurityAlerts (alert_type, severity, message, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(alertType, severity, message, metadata ? JSON.stringify(metadata) : null, now());

  return Number(result.lastInsertRowid);
}

function maybeCreateGenerationSpikeAlert({ facultyId, subjectId }) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const countRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM GeneratedPapers
    WHERE generated_by = ? AND subject_id = ? AND generated_at >= ?
  `).get(facultyId, subjectId, oneHourAgo);
  const generationCount = Number(countRow.count || 0);

  if (generationCount < 5) {
    return null;
  }

  const faculty = db.prepare(`SELECT name, email FROM Users WHERE id = ? LIMIT 1`).get(facultyId);
  const subject = db.prepare(`SELECT code, name FROM Subjects WHERE id = ? LIMIT 1`).get(subjectId);

  return createAlert({
    alertType: 'PAPER_GENERATION_SPIKE',
    severity: 'high',
    message: `${faculty.name} generated ${generationCount} papers for ${subject.code} within the last hour.`,
    metadata: {
      facultyId,
      facultyEmail: faculty.email,
      subjectId,
      subjectCode: subject.code
    }
  });
}

function listSecurityAlerts() {
  return db.prepare(`
    SELECT a.*, u.name AS resolved_by_name
    FROM SecurityAlerts a
    LEFT JOIN Users u ON u.id = a.resolved_by
    ORDER BY CASE WHEN a.resolved_at IS NULL THEN 0 ELSE 1 END, a.created_at DESC
    LIMIT 100
  `).all().map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null
  }));
}

function resolveAlert(alertId, adminId) {
  db.prepare(`
    UPDATE SecurityAlerts
    SET resolved_at = ?, resolved_by = ?
    WHERE id = ? AND resolved_at IS NULL
  `).run(now(), adminId, alertId);
}

module.exports = {
  listSecurityAlerts,
  maybeCreateGenerationSpikeAlert,
  resolveAlert
};
