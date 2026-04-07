const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { db, now } = require('../db');
const { requireApiAuth, requireApiRole } = require('../middleware/apiAuth');
const {
  authenticateUser,
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  registerFacultyUser,
  verifyPassword
} = require('../services/authService');
const { logAudit } = require('../services/auditService');
const { listSecurityAlerts, maybeCreateGenerationSpikeAlert, resolveAlert } = require('../services/alertService');
const {
  createBlueprint,
  deleteBlueprint,
  getBlueprintForFaculty,
  listBlueprintsForFaculty,
  updateBlueprint
} = require('../services/blueprintService');
const { getSystemConfig, updateSystemConfiguration } = require('../services/configService');
const {
  approveFacultyAccount,
  getAssignedSubjectsForFaculty,
  listFacultyUsers,
  replaceFacultySubjectAssignments,
  revokeFacultyAccount
} = require('../services/facultyAccessService');
const { generatePaperSelection, persistGeneratedPaper } = require('../services/genEngine');
const { listPendingKeyHandovers, queueAccessKeyHandover, revealAccessKeyForExamCell } = require('../services/handoverService');
const {
  createQuestion,
  deleteQuestion,
  getQuestionForFaculty,
  importQuestionsFromWorkbook,
  listQuestionsForFaculty,
  updateQuestion
} = require('../services/questionService');
const { encryptPdfBuffer, renderPdfBuffer, saveEncryptedPaper } = require('../services/vaultService');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function arrayify(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'undefined' || value === null || value === '') {
    return [];
  }

  return [value];
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    departmentId: user.department_id
  };
}

function getDepartments() {
  return db.prepare(`
    SELECT d.*, parent.name AS parent_name
    FROM Departments d
    LEFT JOIN Departments parent ON parent.id = d.parent_department_id
    ORDER BY COALESCE(parent.name, d.name), d.name
  `).all();
}

function getSubjects() {
  return db.prepare(`
    SELECT s.*, d.name AS department_name
    FROM Subjects s
    LEFT JOIN Departments d ON d.id = s.department_id
    ORDER BY s.code ASC
  `).all();
}

function getAdminMetrics() {
  return {
    departments: Number(db.prepare(`SELECT COUNT(*) AS count FROM Departments`).get().count || 0),
    subjects: Number(db.prepare(`SELECT COUNT(*) AS count FROM Subjects`).get().count || 0),
    activeFaculty: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM Users WHERE role = 'faculty' AND status = 'active'`).get().count || 0
    ),
    pendingFaculty: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM Users WHERE role = 'faculty' AND status = 'pending'`).get().count || 0
    ),
    alerts: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM SecurityAlerts WHERE resolved_at IS NULL`).get().count || 0
    ),
    generatedPapers: Number(db.prepare(`SELECT COUNT(*) AS count FROM GeneratedPapers`).get().count || 0)
  };
}

function getAuditLogs() {
  return db.prepare(`
    SELECT a.*, u.name AS user_name, u.email AS user_email
    FROM AuditLogs a
    LEFT JOIN Users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all().map((row) => ({
    ...row,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null
  }));
}

function getGeneratedPapersForAdmin() {
  return db.prepare(`
    SELECT
      gp.*,
      s.code AS subject_code,
      s.name AS subject_name,
      u.name AS faculty_name,
      u.email AS faculty_email,
      b.name AS blueprint_name
    FROM GeneratedPapers gp
    INNER JOIN Subjects s ON s.id = gp.subject_id
    INNER JOIN Users u ON u.id = gp.generated_by
    INNER JOIN Blueprints b ON b.id = gp.blueprint_id
    ORDER BY gp.generated_at DESC
    LIMIT 50
  `).all();
}

function getFacultyDashboard(userId) {
  return {
    assignedSubjects: getAssignedSubjectsForFaculty(userId),
    questionCount: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM Questions WHERE created_by = ? AND is_active = 1`).get(userId).count || 0
    ),
    blueprintCount: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM Blueprints WHERE created_by = ?`).get(userId).count || 0
    ),
    generatedPaperCount: Number(
      db.prepare(`SELECT COUNT(*) AS count FROM GeneratedPapers WHERE generated_by = ?`).get(userId).count || 0
    ),
    recentPapers: db.prepare(`
      SELECT gp.*, s.code AS subject_code, s.name AS subject_name, b.name AS blueprint_name
      FROM GeneratedPapers gp
      INNER JOIN Subjects s ON s.id = gp.subject_id
      INNER JOIN Blueprints b ON b.id = gp.blueprint_id
      WHERE gp.generated_by = ?
      ORDER BY gp.generated_at DESC
      LIMIT 10
    `).all(userId),
    recentBlueprints: listBlueprintsForFaculty(userId).slice(0, 10)
  };
}

function getPaperForFaculty(paperId, userId) {
  return (
    db.prepare(`
      SELECT gp.*, s.code AS subject_code, s.name AS subject_name, b.name AS blueprint_name
      FROM GeneratedPapers gp
      INNER JOIN Subjects s ON s.id = gp.subject_id
      INNER JOIN Blueprints b ON b.id = gp.blueprint_id
      WHERE gp.id = ? AND gp.generated_by = ?
      LIMIT 1
    `).get(paperId, userId) || null
  );
}

router.get('/session', (req, res) => {
  if (!req.currentUser) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: serializeUser(req.currentUser)
  });
});

router.get('/public/bootstrap', (req, res) => {
  return res.json({
    departments: getDepartments()
  });
});

router.post('/auth/register', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const departmentId = Number.parseInt(String(req.body.departmentId || ''), 10) || null;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account already exists for that email.' });
    }

    const userId = registerFacultyUser({
      name,
      email,
      password,
      departmentId
    });
    logAudit({
      userId,
      action: 'FACULTY_REGISTRATION_SUBMITTED',
      entityType: 'Users',
      entityId: userId,
      metadata: { email }
    });

    return res.status(201).json({
      message: 'Registration submitted. An admin must approve your subjects before you can sign in.'
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/auth/login', (req, res) => {
  const candidate = findUserByEmail(req.body.email);

  if (!candidate || !verifyPassword(candidate, req.body.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (candidate.status === 'pending') {
    return res.status(403).json({ error: 'Your faculty registration is still pending admin approval.' });
  }

  if (candidate.status === 'revoked') {
    return res.status(403).json({ error: 'This account has been revoked. Contact the admin immediately if this is unexpected.' });
  }

  const user = authenticateUser(req.body.email, req.body.password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const session = createSession(user.id);
  res.cookie('examvault_session', session.token, {
    httpOnly: true,
    sameSite: 'lax',
    signed: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  logAudit({
    userId: user.id,
    action: 'USER_LOGGED_IN',
    entityType: 'Users',
    entityId: user.id,
    metadata: { role: user.role }
  });

  return res.json({
    message: `Welcome back, ${user.name}.`,
    user: serializeUser(user)
  });
});

router.post('/auth/logout', requireApiAuth, (req, res) => {
  destroySession(req.signedCookies.examvault_session);
  res.clearCookie('examvault_session');
  return res.json({ message: 'You have been signed out.' });
});

router.get('/admin/dashboard', requireApiAuth, requireApiRole('admin'), (req, res) => {
  const facultyUsers = listFacultyUsers();

  return res.json({
    metrics: getAdminMetrics(),
    departments: getDepartments(),
    subjects: getSubjects(),
    pendingFaculty: facultyUsers.filter((faculty) => faculty.status === 'pending'),
    activeFaculty: facultyUsers.filter((faculty) => faculty.status !== 'pending'),
    systemConfig: getSystemConfig(),
    alerts: listSecurityAlerts(),
    generatedPapers: getGeneratedPapersForAdmin(),
    handovers: listPendingKeyHandovers(),
    auditLogs: getAuditLogs()
  });
});

router.post('/admin/departments', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const parentDepartmentId = Number.parseInt(String(req.body.parentDepartmentId || ''), 10) || null;

    if (!name) {
      return res.status(400).json({ error: 'Department name is required.' });
    }

    const result = db.prepare(`
      INSERT INTO Departments (name, parent_department_id, created_at)
      VALUES (?, ?, ?)
    `).run(name, parentDepartmentId, now());
    const departmentId = Number(result.lastInsertRowid);
    logAudit({
      userId: req.currentUser.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Departments',
      entityId: departmentId,
      metadata: { name, parentDepartmentId }
    });

    return res.status(201).json({ id: departmentId, message: 'Department created successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/subjects', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    const departmentId = Number.parseInt(String(req.body.departmentId || ''), 10) || null;

    if (!code || !name) {
      return res.status(400).json({ error: 'Subject code and subject name are required.' });
    }

    const result = db.prepare(`
      INSERT INTO Subjects (code, name, department_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(code, name, departmentId, now());
    const subjectId = Number(result.lastInsertRowid);
    logAudit({
      userId: req.currentUser.id,
      action: 'SUBJECT_CREATED',
      entityType: 'Subjects',
      entityId: subjectId,
      metadata: { code, name, departmentId }
    });

    return res.status(201).json({ id: subjectId, message: 'Subject created successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/faculty', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const departmentId = Number.parseInt(String(req.body.departmentId || ''), 10) || null;
    const subjectIds = arrayify(req.body.subjectIds);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required to create a faculty account.' });
    }

    if (subjectIds.length === 0) {
      return res.status(400).json({ error: 'Assign at least one subject before activating a faculty account.' });
    }

    const userId = createUser({
      name,
      email,
      password,
      role: 'faculty',
      departmentId,
      status: 'active',
      approvedBy: req.currentUser.id,
      approvedAt: now()
    });
    replaceFacultySubjectAssignments(userId, subjectIds, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'FACULTY_ACCOUNT_CREATED',
      entityType: 'Users',
      entityId: userId,
      metadata: { email, subjectIds }
    });

    return res.status(201).json({ id: userId, message: 'Faculty account created and approved successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/faculty/:id/approve', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const facultyId = Number.parseInt(req.params.id, 10);
    const departmentId = Number.parseInt(String(req.body.departmentId || ''), 10) || null;
    const subjectIds = arrayify(req.body.subjectIds);

    if (subjectIds.length === 0) {
      return res.status(400).json({ error: 'Approval requires at least one assigned subject.' });
    }

    approveFacultyAccount(facultyId, departmentId, subjectIds, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'FACULTY_REGISTRATION_APPROVED',
      entityType: 'Users',
      entityId: facultyId,
      metadata: { departmentId, subjectIds }
    });

    return res.json({ message: 'Faculty registration approved.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/admin/faculty/:id/assignments', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const facultyId = Number.parseInt(req.params.id, 10);
    const subjectIds = arrayify(req.body.subjectIds);

    replaceFacultySubjectAssignments(facultyId, subjectIds, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'FACULTY_SUBJECT_ASSIGNMENTS_UPDATED',
      entityType: 'Users',
      entityId: facultyId,
      metadata: { subjectIds }
    });

    return res.json({ message: 'Faculty subject assignments updated.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/faculty/:id/revoke', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const facultyId = Number.parseInt(req.params.id, 10);
    revokeFacultyAccount(facultyId, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'FACULTY_ACCESS_REVOKED',
      entityType: 'Users',
      entityId: facultyId
    });

    return res.json({ message: 'Faculty access revoked and subject assignments removed.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/faculty/:id/reactivate', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const facultyId = Number.parseInt(req.params.id, 10);
    db.prepare(`
      UPDATE Users
      SET status = 'active', revoked_at = NULL, approved_by = ?, approved_at = ?
      WHERE id = ? AND role = 'faculty'
    `).run(req.currentUser.id, now(), facultyId);
    logAudit({
      userId: req.currentUser.id,
      action: 'FACULTY_ACCESS_REACTIVATED',
      entityType: 'Users',
      entityId: facultyId
    });

    return res.json({ message: 'Faculty account reactivated.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/admin/config', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const config = updateSystemConfiguration(req.body, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'SYSTEM_CONFIGURATION_UPDATED',
      entityType: 'SystemConfig'
    });

    return res.json({ message: 'System configuration updated.', config });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/alerts/:id/resolve', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const alertId = Number.parseInt(req.params.id, 10);
    resolveAlert(alertId, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'SECURITY_ALERT_RESOLVED',
      entityType: 'SecurityAlerts',
      entityId: alertId
    });

    return res.json({ message: 'Alert marked as resolved.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/admin/papers/:id/reveal-key', requireApiAuth, requireApiRole('admin'), (req, res) => {
  try {
    const paperId = Number.parseInt(req.params.id, 10);
    const accessKey = revealAccessKeyForExamCell(paperId, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'EXAM_CELL_ACCESS_KEY_REVEALED',
      entityType: 'GeneratedPapers',
      entityId: paperId
    });

    return res.json({
      message: `Single-use access key revealed for paper #${paperId}.`,
      accessKey
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/faculty/dashboard', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  return res.json(getFacultyDashboard(req.currentUser.id));
});

router.get('/faculty/generate', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  const dashboard = getFacultyDashboard(req.currentUser.id);
  return res.json({
    blueprints: listBlueprintsForFaculty(req.currentUser.id),
    recentPapers: dashboard.recentPapers
  });
});

router.get('/faculty/questions', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  return res.json({
    subjects: getAssignedSubjectsForFaculty(req.currentUser.id),
    questions: listQuestionsForFaculty(req.currentUser.id)
  });
});

router.get('/faculty/questions/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  const question = getQuestionForFaculty(Number.parseInt(req.params.id, 10), req.currentUser.id);

  if (!question) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  return res.json(question);
});

router.post('/faculty/questions', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const questionId = createQuestion(req.body, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'QUESTION_CREATED',
      entityType: 'Questions',
      entityId: questionId
    });

    return res.status(201).json({ id: questionId, message: 'Question added to your bank.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/faculty/questions/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const questionId = Number.parseInt(req.params.id, 10);
    updateQuestion(questionId, req.body, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'QUESTION_UPDATED_ARCHIVE_CREATED',
      entityType: 'Questions',
      entityId: questionId
    });

    return res.json({ message: 'Question updated and previous version archived.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/faculty/questions/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const questionId = Number.parseInt(req.params.id, 10);
    deleteQuestion(questionId, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'QUESTION_ARCHIVED',
      entityType: 'Questions',
      entityId: questionId
    });

    return res.json({ message: 'Question archived successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/faculty/questions/import', requireApiAuth, requireApiRole('faculty'), upload.single('questionFile'), async (req, res) => {
  try {
    const result = await importQuestionsFromWorkbook(req.file, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'QUESTION_BULK_IMPORT_ACCEPTED',
      entityType: 'Questions',
      metadata: { inserted: result.inserted }
    });

    return res.json({ message: `Imported ${result.inserted} questions successfully.`, inserted: result.inserted });
  } catch (error) {
    logAudit({
      userId: req.currentUser.id,
      action: 'QUESTION_BULK_IMPORT_REJECTED',
      entityType: 'Questions',
      metadata: { message: error.message }
    });
    return res.status(400).json({ error: error.message });
  }
});

router.get('/faculty/blueprints', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  return res.json({
    subjects: getAssignedSubjectsForFaculty(req.currentUser.id),
    blueprints: listBlueprintsForFaculty(req.currentUser.id)
  });
});

router.get('/faculty/blueprints/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  const blueprint = getBlueprintForFaculty(Number.parseInt(req.params.id, 10), req.currentUser.id);

  if (!blueprint) {
    return res.status(404).json({ error: 'Blueprint not found.' });
  }

  return res.json(blueprint);
});

router.post('/faculty/blueprints', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const blueprintId = createBlueprint(req.body, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'BLUEPRINT_CREATED',
      entityType: 'Blueprints',
      entityId: blueprintId
    });

    return res.status(201).json({ id: blueprintId, message: 'Blueprint created successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/faculty/blueprints/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const blueprintId = Number.parseInt(req.params.id, 10);
    updateBlueprint(blueprintId, req.body, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'BLUEPRINT_UPDATED',
      entityType: 'Blueprints',
      entityId: blueprintId
    });

    return res.json({ message: 'Blueprint updated successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/faculty/blueprints/:id', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  try {
    const blueprintId = Number.parseInt(req.params.id, 10);
    deleteBlueprint(blueprintId, req.currentUser.id);
    logAudit({
      userId: req.currentUser.id,
      action: 'BLUEPRINT_DELETED',
      entityType: 'Blueprints',
      entityId: blueprintId
    });

    return res.json({ message: 'Blueprint deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/faculty/generate', requireApiAuth, requireApiRole('faculty'), async (req, res) => {
  try {
    const blueprintId = Number.parseInt(String(req.body.blueprintId || ''), 10);
    const examDate = String(req.body.examDate || '').trim();

    if (!blueprintId || !examDate) {
      return res.status(400).json({ error: 'Blueprint and exam date are required.' });
    }

    const blueprintRow = getBlueprintForFaculty(blueprintId, req.currentUser.id);
    if (!blueprintRow) {
      return res.status(404).json({ error: 'Blueprint not found.' });
    }

    const subject = db.prepare(`SELECT * FROM Subjects WHERE id = ? LIMIT 1`).get(blueprintRow.subject_id);
    const selection = generatePaperSelection({
      subjectId: blueprintRow.subject_id,
      blueprint: blueprintRow.structure,
      facultyId: req.currentUser.id
    });
    const pdfBuffer = await renderPdfBuffer({
      subject,
      blueprint: blueprintRow.structure,
      sections: selection.sections,
      examDate,
      faculty: req.currentUser
    });
    const encrypted = encryptPdfBuffer(pdfBuffer);
    const savedPaper = saveEncryptedPaper({
      encryptedBuffer: encrypted.encryptedBuffer,
      subjectCode: subject.code,
      examDate
    });
    const paperId = persistGeneratedPaper({
      subjectId: blueprintRow.subject_id,
      blueprintId: blueprintRow.id,
      generatedBy: req.currentUser.id,
      totalMarks: blueprintRow.structure.totalMarks,
      encryptedPath: savedPaper.filePath,
      keyFingerprint: encrypted.keyFingerprint,
      examDate,
      selectedQuestions: selection.selectedQuestions
    });
    const handoverTargets = await queueAccessKeyHandover(paperId, encrypted.accessKey, {
      subject,
      blueprintName: blueprintRow.name,
      examDate,
      faculty: req.currentUser
    });
    const alertId = maybeCreateGenerationSpikeAlert({
      facultyId: req.currentUser.id,
      subjectId: blueprintRow.subject_id
    });

    logAudit({
      userId: req.currentUser.id,
      action: 'PAPER_GENERATED_AND_EXAM_CELL_HANDOVER_QUEUED',
      entityType: 'GeneratedPapers',
      entityId: paperId,
      metadata: {
        blueprintId: blueprintRow.id,
        keyFingerprint: encrypted.keyFingerprint,
        questionCount: selection.selectedQuestions.length,
        handoverTargets: handoverTargets.map((target) => target.maskedTarget),
        alertId
      }
    });

    return res.status(201).json({
      message: 'Encrypted paper generated successfully.',
      paper: {
        id: paperId,
        blueprintName: blueprintRow.name,
        subjectCode: subject.code,
        subjectName: subject.name,
        examDate,
        totalMarks: blueprintRow.structure.totalMarks,
        fileName: path.basename(savedPaper.filePath)
      },
      handoverTargets,
      sections: selection.sections,
      diagnostics: selection.diagnostics
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/faculty/papers/:id/download', requireApiAuth, requireApiRole('faculty'), (req, res) => {
  const paper = getPaperForFaculty(Number.parseInt(req.params.id, 10), req.currentUser.id);

  if (!paper) {
    return res.status(404).json({ error: 'Encrypted paper not found.' });
  }

  if (!fs.existsSync(paper.encrypted_path)) {
    return res.status(404).json({ error: 'The encrypted vault file is missing from storage.' });
  }

  return res.download(paper.encrypted_path, path.basename(paper.encrypted_path));
});

module.exports = router;
