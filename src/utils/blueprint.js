const BLOOMS_LEVELS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];
const DIFFICULTY_CODES = ['L1', 'L2', 'L3'];
const QUESTION_TYPES = ['MCQ', 'Theory'];
const HIGHER_ORDER_LEVELS = ['K4', 'K5', 'K6'];

function parseInteger(value, fieldName, { min = 0, allowZero = true } = {}) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if ((!allowZero && parsed === 0) || parsed < min) {
    throw new Error(`${fieldName} must be ${allowZero ? 'at least' : 'greater than'} ${min}.`);
  }

  return parsed;
}

function clampPercentage(value, fieldName) {
  const parsed = parseInteger(value || '0', fieldName, { min: 0 });
  if (parsed > 100) {
    throw new Error(`${fieldName} cannot exceed 100.`);
  }

  return parsed;
}

function arrayify(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'undefined' || value === null || value === '') {
    return [];
  }

  return [value];
}

function normalizeUniqueList(values) {
  return [...new Set(values)];
}

function parseModules(value, sectionLabel) {
  const modules = normalizeUniqueList(
    arrayify(value).map((entry) => parseInteger(entry, `${sectionLabel} modules`, { min: 1, allowZero: false }))
  );

  if (modules.some((moduleNumber) => moduleNumber < 1 || moduleNumber > 5)) {
    throw new Error(`${sectionLabel} modules must stay between 1 and 5.`);
  }

  return modules.sort((left, right) => left - right);
}

function parseBloomLevels(value, sectionLabel) {
  const levels = normalizeUniqueList(
    arrayify(value).map((entry) => String(entry || '').trim().toUpperCase())
  );

  if (levels.some((level) => !BLOOMS_LEVELS.includes(level))) {
    throw new Error(`${sectionLabel} Bloom's levels must be between K1 and K6.`);
  }

  return levels.length > 0 ? levels : [...BLOOMS_LEVELS];
}

function parseDifficultyCodes(value, sectionLabel) {
  const codes = normalizeUniqueList(
    arrayify(value).map((entry) => String(entry || '').trim().toUpperCase())
  );

  if (codes.some((code) => !DIFFICULTY_CODES.includes(code))) {
    throw new Error(`${sectionLabel} difficulty values must be L1, L2, or L3.`);
  }

  return codes.length > 0 ? codes : [...DIFFICULTY_CODES];
}

function parseQuestionTypes(value, sectionLabel) {
  const types = normalizeUniqueList(
    arrayify(value).map((entry) => {
      const normalized = String(entry || '').trim().toLowerCase();
      return normalized === 'mcq' ? 'MCQ' : normalized === 'theory' ? 'Theory' : entry;
    })
  );

  if (types.some((type) => !QUESTION_TYPES.includes(type))) {
    throw new Error(`${sectionLabel} question types must be MCQ or Theory.`);
  }

  return types.length > 0 ? types : [...QUESTION_TYPES];
}

function buildBlueprintStructure(body) {
  const totalMarks = parseInteger(body.totalMarks, 'Total marks', { min: 1, allowZero: false });
  const sections = [];

  for (let index = 1; index <= 4; index += 1) {
    const title = String(body[`section_${index}_title`] || '').trim();
    const questionCountRaw = String(body[`section_${index}_questionCount`] || '').trim();
    const marksPerQuestionRaw = String(body[`section_${index}_marksPerQuestion`] || '').trim();

    if (!title && !questionCountRaw && !marksPerQuestionRaw) {
      continue;
    }

    const sectionLabel = `Section ${index}`;
    const questionCount = parseInteger(questionCountRaw || '0', `${sectionLabel} question count`, {
      min: 1,
      allowZero: false
    });
    const marksPerQuestion = parseInteger(
      marksPerQuestionRaw || '0',
      `${sectionLabel} marks per question`,
      { min: 1, allowZero: false }
    );
    const higherOrderPercentage = clampPercentage(
      body[`section_${index}_higherOrderPercentage`] || '0',
      `${sectionLabel} higher-order percentage`
    );
    const modules = parseModules(body[`section_${index}_modules`], sectionLabel);
    const allowedBloomLevels = parseBloomLevels(body[`section_${index}_blooms`], sectionLabel);
    const difficultyCodes = parseDifficultyCodes(body[`section_${index}_difficulties`], sectionLabel);
    const questionTypes = parseQuestionTypes(body[`section_${index}_types`], sectionLabel);

    if (!modules.length) {
      throw new Error(`${sectionLabel} must target at least one module.`);
    }

    if (higherOrderPercentage > 0) {
      const supportsHigherOrder = allowedBloomLevels.some((level) => HIGHER_ORDER_LEVELS.includes(level));
      if (!supportsHigherOrder) {
        throw new Error(`${sectionLabel} requires higher-order Bloom's levels but they are not allowed in the filter.`);
      }
    }

    sections.push({
      title: title || `Section ${String.fromCharCode(64 + index)}`,
      questionCount,
      marksPerQuestion,
      totalMarks: questionCount * marksPerQuestion,
      allowedModules: modules,
      allowedBloomLevels,
      allowedDifficultyCodes: difficultyCodes,
      allowedQuestionTypes: questionTypes,
      higherOrderPercentage
    });
  }

  if (!sections.length) {
    throw new Error('At least one blueprint section is required.');
  }

  const computedTotal = sections.reduce((sum, section) => sum + section.totalMarks, 0);
  if (computedTotal !== totalMarks) {
    throw new Error('Section marks must add up exactly to the paper total before the blueprint can be saved.');
  }

  return {
    paperTitle: String(body.paperTitle || 'University Examination').trim() || 'University Examination',
    instructions:
      String(body.instructions || 'Answer all questions. Figures to the right indicate full marks.').trim() ||
      'Answer all questions. Figures to the right indicate full marks.',
    totalMarks,
    examDurationMinutes: parseInteger(body.examDurationMinutes || '180', 'Exam duration', {
      min: 30,
      allowZero: false
    }),
    sections
  };
}

function upgradeLegacyStructure(structure) {
  if (Array.isArray(structure.sections) && structure.sections.length > 0) {
    return structure;
  }

  if (!Array.isArray(structure.moduleMarks)) {
    return structure;
  }

  return {
    paperTitle: structure.paperTitle || 'University Examination',
    instructions: structure.instructions || 'Answer all questions.',
    totalMarks: structure.totalMarks || structure.moduleMarks.reduce((sum, entry) => sum + entry.marks, 0),
    examDurationMinutes: structure.examDurationMinutes || 180,
    sections: structure.moduleMarks.map((moduleEntry, index) => ({
      title: `Module ${moduleEntry.moduleNumber} Section ${String.fromCharCode(65 + index)}`,
      questionCount: 1,
      marksPerQuestion: moduleEntry.marks,
      totalMarks: moduleEntry.marks,
      allowedModules: [moduleEntry.moduleNumber],
      allowedBloomLevels: [...BLOOMS_LEVELS],
      allowedDifficultyCodes: [...DIFFICULTY_CODES],
      allowedQuestionTypes: [...QUESTION_TYPES],
      higherOrderPercentage: 0
    }))
  };
}

function parseBlueprintRow(row) {
  return {
    ...row,
    structure: upgradeLegacyStructure(JSON.parse(row.structure_json))
  };
}

module.exports = {
  BLOOMS_LEVELS,
  DIFFICULTY_CODES,
  QUESTION_TYPES,
  HIGHER_ORDER_LEVELS,
  buildBlueprintStructure,
  parseBlueprintRow,
  parseInteger
};
