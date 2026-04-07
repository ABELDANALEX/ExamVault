const { db, now } = require('../db');
const { fisherYatesShuffle } = require('../utils/shuffle');
const { HIGHER_ORDER_LEVELS } = require('../utils/blueprint');
const { getLookbackSettings } = require('./configService');

function getLookbackQuestionIds(subjectId, lookbackMonths, lookbackExamCount) {
  const restrictedIds = new Set();

  if (lookbackMonths > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - lookbackMonths);
    const rows = db.prepare(`
      SELECT DISTINCT eh.question_id
      FROM ExamHistory eh
      INNER JOIN GeneratedPapers gp ON gp.id = eh.paper_id
      WHERE gp.subject_id = ? AND eh.exam_date >= ?
    `).all(subjectId, cutoff.toISOString());

    rows.forEach((row) => restrictedIds.add(row.question_id));
  }

  if (lookbackExamCount > 0) {
    const papers = db.prepare(`
      SELECT id
      FROM GeneratedPapers
      WHERE subject_id = ?
      ORDER BY generated_at DESC
      LIMIT ?
    `).all(subjectId, lookbackExamCount);

    papers.forEach((paper) => {
      const rows = db.prepare(`SELECT question_id FROM ExamHistory WHERE paper_id = ?`).all(paper.id);
      rows.forEach((row) => restrictedIds.add(row.question_id));
    });
  }

  return restrictedIds;
}

function filterSectionCandidates(allQuestions, section, usedIds) {
  return allQuestions.filter((question) => {
    if (usedIds.has(question.id)) {
      return false;
    }

    return (
      section.allowedModules.includes(question.module) &&
      question.marks === section.marksPerQuestion &&
      section.allowedBloomLevels.includes(question.blooms_level) &&
      section.allowedDifficultyCodes.includes(question.difficulty_code) &&
      section.allowedQuestionTypes.includes(question.question_type)
    );
  });
}

function selectSectionQuestions(section, candidates, lookbackIds) {
  const shuffled = fisherYatesShuffle(candidates);
  const freshCandidates = [];
  const recentCandidates = [];

  shuffled.forEach((candidate) => {
    if (lookbackIds.has(candidate.id)) {
      recentCandidates.push(candidate);
    } else {
      freshCandidates.push(candidate);
    }
  });

  const requiredHigherOrderCount = Math.ceil((section.questionCount * section.higherOrderPercentage) / 100);
  const higherOrderFresh = freshCandidates.filter((question) => HIGHER_ORDER_LEVELS.includes(question.blooms_level));

  if (higherOrderFresh.length < requiredHigherOrderCount) {
    throw new Error(
      `Insufficient unique questions. Please add more higher-order questions to Modules ${section.allowedModules.join(', ')} for ${section.title}.`
    );
  }

  if (freshCandidates.length < section.questionCount) {
    throw new Error(
      `Insufficient unique questions. Please add more questions to Modules ${section.allowedModules.join(', ')} for ${section.title}.`
    );
  }

  const selectedIds = new Set();
  const selectedQuestions = [];

  higherOrderFresh.slice(0, requiredHigherOrderCount).forEach((question) => {
    selectedIds.add(question.id);
    selectedQuestions.push(question);
  });

  freshCandidates.forEach((question) => {
    if (selectedQuestions.length >= section.questionCount) {
      return;
    }

    if (!selectedIds.has(question.id)) {
      selectedIds.add(question.id);
      selectedQuestions.push(question);
    }
  });

  return {
    selectedQuestions: fisherYatesShuffle(selectedQuestions),
    diagnostics: {
      sectionTitle: section.title,
      allowedModules: section.allowedModules,
      candidateCount: candidates.length,
      freshCandidateCount: freshCandidates.length,
      lookbackDeferredCount: recentCandidates.length,
      requiredHigherOrderCount
    }
  };
}

function generatePaperSelection({ subjectId, blueprint, facultyId }) {
  const lookbackSettings = getLookbackSettings();
  const lookbackIds = getLookbackQuestionIds(
    subjectId,
    lookbackSettings.months,
    lookbackSettings.examCount
  );
  const allQuestions = db.prepare(`
    SELECT q.*, s.code AS subject_code, s.name AS subject_name
    FROM Questions q
    INNER JOIN Subjects s ON s.id = q.subject_id
    WHERE q.subject_id = ? AND q.created_by = ? AND q.is_active = 1
    ORDER BY q.id ASC
  `).all(subjectId, facultyId);

  const selectionOrder = blueprint.sections
    .map((section, index) => ({
      section,
      index,
      candidateCount: allQuestions.filter((question) => {
        return (
          section.allowedModules.includes(question.module) &&
          question.marks === section.marksPerQuestion &&
          section.allowedBloomLevels.includes(question.blooms_level) &&
          section.allowedDifficultyCodes.includes(question.difficulty_code) &&
          section.allowedQuestionTypes.includes(question.question_type)
        );
      }).length
    }))
    .sort((left, right) => left.candidateCount - right.candidateCount);

  const usedIds = new Set();
  const sectionSelections = new Array(blueprint.sections.length);
  const diagnostics = [];

  selectionOrder.forEach(({ section, index }) => {
    const candidates = filterSectionCandidates(allQuestions, section, usedIds);
    const sectionSelection = selectSectionQuestions(section, candidates, lookbackIds);
    sectionSelection.selectedQuestions.forEach((question) => usedIds.add(question.id));
    sectionSelections[index] = {
      ...section,
      questions: sectionSelection.selectedQuestions
    };
    diagnostics.push(sectionSelection.diagnostics);
  });

  return {
    sections: sectionSelections,
    selectedQuestions: sectionSelections.flatMap((section) =>
      section.questions.map((question) => ({
        ...question,
        sectionTitle: section.title
      }))
    ),
    diagnostics
  };
}

function persistGeneratedPaper({
  subjectId,
  blueprintId,
  generatedBy,
  totalMarks,
  encryptedPath,
  keyFingerprint,
  examDate,
  selectedQuestions
}) {
  db.exec('BEGIN');

  try {
    const timestamp = now();
    const result = db.prepare(`
      INSERT INTO GeneratedPapers (subject_id, blueprint_id, generated_by, total_marks, encrypted_path, key_fingerprint, generated_at, exam_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, blueprintId, generatedBy, totalMarks, encryptedPath, keyFingerprint, timestamp, examDate);
    const paperId = Number(result.lastInsertRowid);
    const historyStatement = db.prepare(`
      INSERT INTO ExamHistory (question_id, exam_date, paper_id)
      VALUES (?, ?, ?)
    `);

    selectedQuestions.forEach((question) => {
      historyStatement.run(question.id, examDate, paperId);
    });

    db.exec('COMMIT');
    return paperId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  generatePaperSelection,
  persistGeneratedPaper
};
