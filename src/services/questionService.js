const path = require('node:path');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');

const { db, now } = require('../db');
const { BLOOMS_LEVELS, DIFFICULTY_CODES, QUESTION_TYPES } = require('../utils/blueprint');
const { facultyHasSubjectAccess } = require('./facultyAccessService');

const DIFFICULTY_LABELS = {
  L1: 'Easy',
  L2: 'Medium',
  L3: 'Hard'
};

function normalizeDifficultyCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const aliases = {
    EASY: 'L1',
    MEDIUM: 'L2',
    HARD: 'L3'
  };
  const resolved = aliases[normalized] || normalized;

  if (!DIFFICULTY_CODES.includes(resolved)) {
    throw new Error(`Difficulty must be one of: ${DIFFICULTY_CODES.join(', ')}.`);
  }

  return resolved;
}

function normalizeBloomsLevel(value) {
  const normalized = String(value || '').trim().toUpperCase();

  if (!BLOOMS_LEVELS.includes(normalized)) {
    throw new Error(`Bloom's level must be one of: ${BLOOMS_LEVELS.join(', ')}.`);
  }

  return normalized;
}

function normalizeQuestionType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const resolved = normalized === 'mcq' ? 'MCQ' : normalized === 'theory' ? 'Theory' : value;

  if (!QUESTION_TYPES.includes(resolved)) {
    throw new Error(`Question type must be one of: ${QUESTION_TYPES.join(', ')}.`);
  }

  return resolved;
}

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

function validateQuestionPayload(input, userId) {
  const subjectId = Number.parseInt(String(input.subjectId || ''), 10);
  const moduleNumber = Number.parseInt(String(input.module || ''), 10);
  const marks = Number.parseInt(String(input.marks || ''), 10);
  const text = String(input.text || '').trim();

  if (!subjectId) {
    throw new Error('Subject is required.');
  }

  if (!text) {
    throw new Error('Question text is required.');
  }

  if (Number.isNaN(moduleNumber) || moduleNumber < 1 || moduleNumber > 5) {
    throw new Error('Module number must be between 1 and 5.');
  }

  if (![2, 5, 10].includes(marks)) {
    throw new Error('Marks must be one of 2, 5, or 10.');
  }

  ensureSubjectAccess(subjectId, userId);

  const difficultyCode = normalizeDifficultyCode(input.difficultyCode || input.difficulty);

  return {
    subjectId,
    text,
    module: moduleNumber,
    marks,
    difficultyCode,
    difficultyLabel: DIFFICULTY_LABELS[difficultyCode],
    bloomsLevel: normalizeBloomsLevel(input.bloomsLevel),
    questionType: normalizeQuestionType(input.questionType)
  };
}

function listQuestionsForFaculty(userId) {
  return db.prepare(`
    SELECT
      q.*,
      s.code AS subject_code,
      s.name AS subject_name,
      (
        SELECT COUNT(*)
        FROM QuestionVersions qv
        WHERE qv.question_id = q.id
      ) AS version_archive_count
    FROM Questions q
    INNER JOIN Subjects s ON s.id = q.subject_id
    WHERE q.created_by = ? AND q.is_active = 1
    ORDER BY s.code ASC, q.module ASC, q.id DESC
  `).all(userId);
}

function getQuestionForFaculty(questionId, userId) {
  return (
    db.prepare(`
      SELECT q.*, s.code AS subject_code, s.name AS subject_name
      FROM Questions q
      INNER JOIN Subjects s ON s.id = q.subject_id
      WHERE q.id = ? AND q.created_by = ? AND q.is_active = 1
      LIMIT 1
    `).get(questionId, userId) || null
  );
}

function recordQuestionSnapshot(question, reason, userId) {
  db.prepare(`
    INSERT INTO QuestionVersions (
      question_id,
      subject_id,
      text,
      module,
      marks,
      difficulty_code,
      blooms_level,
      question_type,
      version_number,
      snapshot_reason,
      snapshot_by,
      snapshot_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    question.id,
    question.subject_id,
    question.text,
    question.module,
    question.marks,
    question.difficulty_code,
    question.blooms_level,
    question.question_type,
    question.version,
    reason,
    userId,
    now()
  );
}

function createQuestion(payload, userId) {
  const validated = validateQuestionPayload(payload, userId);
  const timestamp = now();
  const result = db.prepare(`
    INSERT INTO Questions (
      subject_id,
      text,
      module,
      marks,
      difficulty,
      difficulty_code,
      blooms_level,
      question_type,
      created_by,
      version,
      is_active,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `).run(
    validated.subjectId,
    validated.text,
    validated.module,
    validated.marks,
    validated.difficultyLabel,
    validated.difficultyCode,
    validated.bloomsLevel,
    validated.questionType,
    userId,
    timestamp,
    timestamp
  );

  return Number(result.lastInsertRowid);
}

function updateQuestion(questionId, payload, userId) {
  const existing = getQuestionForFaculty(questionId, userId);
  if (!existing) {
    throw new Error('Question not found.');
  }

  const validated = validateQuestionPayload(payload, userId);
  recordQuestionSnapshot(existing, 'UPDATE', userId);
  db.prepare(`
    UPDATE Questions
    SET
      subject_id = ?,
      text = ?,
      module = ?,
      marks = ?,
      difficulty = ?,
      difficulty_code = ?,
      blooms_level = ?,
      question_type = ?,
      version = version + 1,
      updated_at = ?
    WHERE id = ? AND created_by = ?
  `).run(
    validated.subjectId,
    validated.text,
    validated.module,
    validated.marks,
    validated.difficultyLabel,
    validated.difficultyCode,
    validated.bloomsLevel,
    validated.questionType,
    now(),
    questionId,
    userId
  );
}

function deleteQuestion(questionId, userId) {
  const existing = getQuestionForFaculty(questionId, userId);
  if (!existing) {
    throw new Error('Question not found.');
  }

  recordQuestionSnapshot(existing, 'ARCHIVE', userId);
  db.prepare(`
    UPDATE Questions
    SET is_active = 0, archived_at = ?, updated_at = ?
    WHERE id = ? AND created_by = ?
  `).run(now(), now(), questionId, userId);
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findRowValue(row, variants) {
  for (const [key, value] of Object.entries(row)) {
    if (variants.includes(normalizeHeader(key))) {
      return value;
    }
  }

  return '';
}

async function parseRowsFromFile(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (extension === '.csv') {
    return parse(file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  if (extension !== '.xlsx') {
    throw new Error('Only .csv and .xlsx files are supported for bulk import.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values;
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record = {};
    let hasValue = false;

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const header = headers[columnNumber];
      if (!header) {
        return;
      }

      const value = String(cell.text || '').trim();
      if (value) {
        hasValue = true;
      }
      record[String(header)] = value;
    });

    if (hasValue) {
      rows.push(record);
    }
  });

  return rows;
}

async function importQuestionsFromWorkbook(file, userId) {
  if (!file || !file.buffer) {
    throw new Error('Please upload a CSV or Excel file.');
  }

  const rows = await parseRowsFromFile(file);
  if (rows.length === 0) {
    throw new Error('The uploaded file does not contain any question rows.');
  }

  const subjects = db.prepare(`
    SELECT s.id, s.code
    FROM Subjects s
    INNER JOIN FacultySubjectAssignments fsa ON fsa.subject_id = s.id AND fsa.user_id = ? AND fsa.is_active = 1
  `).all(userId);
  const subjectIdByCode = new Map(
    subjects.map((subject) => [String(subject.code).trim().toUpperCase(), subject.id])
  );
  const validatedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    try {
      const subjectCode = String(
        findRowValue(row, ['subjectcode', 'subject', 'subjectid', 'subjectname'])
      )
        .trim()
        .toUpperCase();
      const subjectId = subjectIdByCode.get(subjectCode);

      if (!subjectId) {
        throw new Error(`Unknown or unassigned subject code "${subjectCode}".`);
      }

      const validated = validateQuestionPayload(
        {
          subjectId,
          text: findRowValue(row, ['questiontext', 'text', 'question']),
          module: findRowValue(row, ['modulenumber', 'module']),
          marks: findRowValue(row, ['marks', 'mark']),
          difficultyCode: findRowValue(row, ['difficulty', 'difficultylevel', 'difficultycode']),
          bloomsLevel: findRowValue(row, ['bloomslevel', 'bloomlevel', 'blooms']),
          questionType: findRowValue(row, ['questiontype', 'type'])
        },
        userId
      );

      validatedRows.push(validated);
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error.message}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Import rejected. ${errors.slice(0, 5).join(' | ')}`);
  }

  const insertStatement = db.prepare(`
    INSERT INTO Questions (
      subject_id,
      text,
      module,
      marks,
      difficulty,
      difficulty_code,
      blooms_level,
      question_type,
      created_by,
      version,
      is_active,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `);

  db.exec('BEGIN');

  try {
    validatedRows.forEach((validated) => {
      const timestamp = now();
      insertStatement.run(
        validated.subjectId,
        validated.text,
        validated.module,
        validated.marks,
        validated.difficultyLabel,
        validated.difficultyCode,
        validated.bloomsLevel,
        validated.questionType,
        userId,
        timestamp,
        timestamp
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { inserted: validatedRows.length };
}

module.exports = {
  createQuestion,
  deleteQuestion,
  getQuestionForFaculty,
  importQuestionsFromWorkbook,
  listQuestionsForFaculty,
  updateQuestion
};
