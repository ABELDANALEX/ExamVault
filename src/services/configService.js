const path = require('node:path');
const { db, now, setSystemConfig } = require('../db');

const DEFAULTS = {
  global_lookback_months: '6',
  global_lookback_exam_count: '3',
  pdf_university_name: 'ExamVault University',
  pdf_header_text: 'Confidential Question Paper',
  pdf_footer_text: 'Generated securely by ExamVault for authorized exam use only.',
  pdf_logo_path: '',
  exam_cell_email: '',
  exam_cell_phone: '',
  handover_mode: 'admin_reveal'
};

function getSystemConfig() {
  const rows = db.prepare(`SELECT key, value_text FROM SystemConfig`).all();
  const config = { ...DEFAULTS };

  rows.forEach((row) => {
    config[row.key] = row.value_text;
  });

  return {
    ...config,
    globalLookbackMonths: Number.parseInt(config.global_lookback_months || DEFAULTS.global_lookback_months, 10),
    globalLookbackExamCount: Number.parseInt(
      config.global_lookback_exam_count || DEFAULTS.global_lookback_exam_count,
      10
    ),
    pdfLogoPath: config.pdf_logo_path
      ? path.isAbsolute(config.pdf_logo_path)
        ? config.pdf_logo_path
        : path.resolve(path.join(__dirname, '..', '..'), config.pdf_logo_path)
      : ''
  };
}

const VALID_HANDOVER_MODES = ['admin_reveal', 'direct_dispatch'];

function updateSystemConfiguration(payload, userId) {
  const globalLookbackMonths = Number.parseInt(String(payload.globalLookbackMonths || '6'), 10);
  const globalLookbackExamCount = Number.parseInt(String(payload.globalLookbackExamCount || '3'), 10);

  if (Number.isNaN(globalLookbackMonths) || globalLookbackMonths < 0) {
    throw new Error('Global lookback months must be zero or greater.');
  }

  if (Number.isNaN(globalLookbackExamCount) || globalLookbackExamCount < 0) {
    throw new Error('Global lookback exam count must be zero or greater.');
  }

  const entries = {
    global_lookback_months: String(globalLookbackMonths),
    global_lookback_exam_count: String(globalLookbackExamCount),
    pdf_university_name: String(payload.pdfUniversityName || '').trim() || DEFAULTS.pdf_university_name,
    pdf_header_text: String(payload.pdfHeaderText || '').trim() || DEFAULTS.pdf_header_text,
    pdf_footer_text: String(payload.pdfFooterText || '').trim() || DEFAULTS.pdf_footer_text,
    pdf_logo_path: String(payload.pdfLogoPath || '').trim(),
    exam_cell_email: String(payload.examCellEmail || '').trim(),
    exam_cell_phone: String(payload.examCellPhone || '').trim(),
    handover_mode: VALID_HANDOVER_MODES.includes(String(payload.handoverMode || '').trim())
      ? String(payload.handoverMode).trim()
      : 'admin_reveal'
  };

  Object.entries(entries).forEach(([key, value]) => {
    setSystemConfig(key, value, userId);
  });

  return getSystemConfig();
}

function getLookbackSettings() {
  const config = getSystemConfig();
  return {
    months: config.globalLookbackMonths,
    examCount: config.globalLookbackExamCount
  };
}

function getExamCellTargets() {
  const config = getSystemConfig();
  const targets = [];

  if (config.exam_cell_email) {
    targets.push({ channelType: 'email', channelTarget: config.exam_cell_email });
  }

  if (config.exam_cell_phone) {
    targets.push({ channelType: 'phone', channelTarget: config.exam_cell_phone });
  }

  return targets;
}

module.exports = {
  getExamCellTargets,
  getLookbackSettings,
  getSystemConfig,
  updateSystemConfiguration
};
