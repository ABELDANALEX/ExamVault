const { db, now } = require('../db');
const { buildBlueprintStructure, parseBlueprintRow } = require('../utils/blueprint');
const { facultyHasSubjectAccess } = require('./facultyAccessService');

function ensureSubjectAccess(subjectId, userId) {
  const subject = db.prepare(`SELECT * FROM Subjects WHERE id = ? LIMIT 1`).get(subjectId);
  if (!subject) {
    throw new Error('Selected subject does not exist.');
  }

  if (!facultyHasSubjectAccess(userId, subjectId)) {
    throw new Error('You are not assigned to that subject.');
  }

  return subject;
}

function listBlueprintsForFaculty(userId) {
  const rows = db.prepare(`
    SELECT b.*, s.code AS subject_code, s.name AS subject_name
    FROM Blueprints b
    INNER JOIN Subjects s ON s.id = b.subject_id
    WHERE b.created_by = ?
    ORDER BY b.updated_at DESC
  `).all(userId);

  return rows.map(parseBlueprintRow);
}

function getBlueprintForFaculty(blueprintId, userId) {
  const row =
    db.prepare(`
      SELECT b.*, s.code AS subject_code, s.name AS subject_name
      FROM Blueprints b
      INNER JOIN Subjects s ON s.id = b.subject_id
      WHERE b.id = ? AND b.created_by = ?
      LIMIT 1
    `).get(blueprintId, userId) || null;

  return row ? parseBlueprintRow(row) : null;
}

function createBlueprint(body, userId) {
  const subjectId = Number.parseInt(String(body.subjectId || ''), 10);
  if (!subjectId) {
    throw new Error('Subject is required.');
  }

  ensureSubjectAccess(subjectId, userId);

  const structure = buildBlueprintStructure(body);
  const name = String(body.name || '').trim() || 'Untitled Blueprint';
  const timestamp = now();
  const result = db.prepare(`
    INSERT INTO Blueprints (subject_id, created_by, name, structure_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(subjectId, userId, name, JSON.stringify(structure), timestamp, timestamp);

  return Number(result.lastInsertRowid);
}

function updateBlueprint(blueprintId, body, userId) {
  const existing = getBlueprintForFaculty(blueprintId, userId);
  if (!existing) {
    throw new Error('Blueprint not found.');
  }

  const subjectId = Number.parseInt(String(body.subjectId || ''), 10);
  if (!subjectId) {
    throw new Error('Subject is required.');
  }

  ensureSubjectAccess(subjectId, userId);

  const structure = buildBlueprintStructure(body);
  const name = String(body.name || '').trim() || 'Untitled Blueprint';
  db.prepare(`
    UPDATE Blueprints
    SET subject_id = ?, name = ?, structure_json = ?, updated_at = ?
    WHERE id = ? AND created_by = ?
  `).run(subjectId, name, JSON.stringify(structure), now(), blueprintId, userId);
}

function deleteBlueprint(blueprintId, userId) {
  const existing = getBlueprintForFaculty(blueprintId, userId);
  if (!existing) {
    throw new Error('Blueprint not found.');
  }

  db.prepare(`DELETE FROM Blueprints WHERE id = ? AND created_by = ?`).run(blueprintId, userId);
}

module.exports = {
  createBlueprint,
  deleteBlueprint,
  getBlueprintForFaculty,
  listBlueprintsForFaculty,
  updateBlueprint
};
