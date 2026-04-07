const { db, now } = require('../db');

function logAudit({ userId = null, action, entityType, entityId = null, metadata = null }) {
  db.prepare(`
    INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, now());
}

module.exports = {
  logAudit
};
