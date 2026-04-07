const { db, now } = require('../db');

function getAssignedSubjectsForFaculty(userId) {
  return db.prepare(`
    SELECT s.*, d.name AS department_name
    FROM FacultySubjectAssignments fsa
    INNER JOIN Subjects s ON s.id = fsa.subject_id
    LEFT JOIN Departments d ON d.id = s.department_id
    WHERE fsa.user_id = ? AND fsa.is_active = 1
    ORDER BY s.code ASC
  `).all(userId);
}

function facultyHasSubjectAccess(userId, subjectId) {
  return Boolean(
    db.prepare(`
      SELECT fsa.id
      FROM FacultySubjectAssignments fsa
      INNER JOIN Users u ON u.id = fsa.user_id
      WHERE fsa.user_id = ? AND fsa.subject_id = ? AND fsa.is_active = 1 AND u.status = 'active'
      LIMIT 1
    `).get(userId, subjectId)
  );
}

function replaceFacultySubjectAssignments(userId, subjectIds, approvedBy) {
  const uniqueSubjectIds = [...new Set(subjectIds.map((id) => Number.parseInt(String(id), 10)).filter(Boolean))];
  const timestamp = now();
  const existingAssignments = db.prepare(`
    SELECT *
    FROM FacultySubjectAssignments
    WHERE user_id = ? AND is_active = 1
  `).all(userId);
  const existingIds = new Set(existingAssignments.map((assignment) => assignment.subject_id));

  existingAssignments.forEach((assignment) => {
    if (!uniqueSubjectIds.includes(assignment.subject_id)) {
      db.prepare(`
        UPDATE FacultySubjectAssignments
        SET is_active = 0, revoked_at = ?
        WHERE id = ?
      `).run(timestamp, assignment.id);
    }
  });

  uniqueSubjectIds.forEach((subjectId) => {
    if (!existingIds.has(subjectId)) {
      db.prepare(`
        INSERT INTO FacultySubjectAssignments (user_id, subject_id, approved_by, approved_at, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(userId, subjectId, approvedBy, timestamp, timestamp);
    }
  });
}

function revokeFacultyAccount(userId, adminId) {
  const timestamp = now();
  db.exec('BEGIN');

  try {
    db.prepare(`
      UPDATE Users
      SET status = 'revoked', revoked_at = ?, approved_by = ?
      WHERE id = ? AND role = 'faculty'
    `).run(timestamp, adminId, userId);
    db.prepare(`
      UPDATE FacultySubjectAssignments
      SET is_active = 0, revoked_at = ?
      WHERE user_id = ? AND is_active = 1
    `).run(timestamp, userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function approveFacultyAccount(userId, departmentId, subjectIds, adminId) {
  const timestamp = now();
  db.exec('BEGIN');

  try {
    db.prepare(`
      UPDATE Users
      SET status = 'active', department_id = ?, approved_by = ?, approved_at = ?, revoked_at = NULL
      WHERE id = ? AND role = 'faculty'
    `).run(departmentId || null, adminId, timestamp, userId);
    replaceFacultySubjectAssignments(userId, subjectIds, adminId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function listFacultyUsers() {
  return db.prepare(`
    SELECT
      u.*,
      d.name AS department_name,
      GROUP_CONCAT(CASE WHEN fsa.is_active = 1 THEN s.code END, ', ') AS assigned_subject_codes
    FROM Users u
    LEFT JOIN Departments d ON d.id = u.department_id
    LEFT JOIN FacultySubjectAssignments fsa ON fsa.user_id = u.id
    LEFT JOIN Subjects s ON s.id = fsa.subject_id
    WHERE u.role = 'faculty'
    GROUP BY u.id
    ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.name ASC
  `).all();
}

module.exports = {
  approveFacultyAccount,
  facultyHasSubjectAccess,
  getAssignedSubjectsForFaculty,
  listFacultyUsers,
  replaceFacultySubjectAssignments,
  revokeFacultyAccount
};
