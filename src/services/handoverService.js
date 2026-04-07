const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');

const { db, now } = require('../db');
const { getExamCellTargets } = require('./configService');
const { sendAdminKeyNotification } = require('./emailService');
const { sendExamCellSmsNotification } = require('./smsService');

function getServerKey() {
  return createHash('sha256')
    .update(process.env.HANDOVER_SECRET || 'examvault-handover-secret')
    .digest();
}

function maskTarget(target) {
  const value = String(target || '').trim();
  if (!value) {
    return '';
  }

  if (value.includes('@')) {
    const [localPart, domain] = value.split('@');
    const maskedLocal = localPart.length <= 2 ? `${localPart[0] || '*'}*` : `${localPart.slice(0, 2)}***`;
    return `${maskedLocal}@${domain}`;
  }

  const visibleTail = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${visibleTail}`;
}

function encryptAccessKey(accessKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getServerKey(), iv);
  const encrypted = Buffer.concat([cipher.update(accessKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptAccessKey(encryptedValue) {
  const payload = Buffer.from(encryptedValue, 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getServerKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function queueAccessKeyHandover(paperId, accessKey, notificationContext = {}) {
  db.prepare(`
    INSERT INTO KeyHandovers (paper_id, encrypted_key, created_at)
    VALUES (?, ?, ?)
  `).run(paperId, encryptAccessKey(accessKey), now());

  const targets = getExamCellTargets();

  if (targets.length === 0) {
    db.prepare(`
      INSERT INTO KeyDispatchLogs (paper_id, channel_type, channel_target, status, delivery_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(paperId, 'unconfigured', 'No Exam Cell target configured', 'PENDING_CONFIG', 'Configure Exam Cell email or phone.', now());
    return [];
  }

  const insertStatement = db.prepare(`
    INSERT INTO KeyDispatchLogs (paper_id, channel_type, channel_target, status, delivery_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Store the raw (unmasked) target in DB so dispatch can actually use it later.
  // Masking is applied only on the UI-facing return value below.
  targets.forEach((target) => {
    insertStatement.run(
      paperId,
      target.channelType,
      target.channelTarget,
      'READY_FOR_EXAM_CELL',
      'Key must be handed over outside the faculty channel.',
      now()
    );
  });

  const result = targets.map((target) => ({
    ...target,
    maskedTarget: maskTarget(target.channelTarget)
  }));

  // Dispatch notifications per channel — all non-blocking so a delivery
  // failure never crashes the paper generation response.

  // Email: notify the admin inbox with full key details.
  sendAdminKeyNotification({
    accessKey,
    paperId,
    handoverTargets: result,
    ...notificationContext
  }).catch((err) => {
    console.error('[emailService] sendAdminKeyNotification failed:', err);
  });

  // SMS: send the key directly to each configured phone target.
  const phoneTargets = targets.filter((t) => t.channelType === 'phone');
  phoneTargets.forEach((target) => {
    sendExamCellSmsNotification({
      toNumber: target.channelTarget,
      accessKey,
      paperId,
      ...notificationContext
    }).catch((err) => {
      console.error('[smsService] sendExamCellSmsNotification failed:', err);
    });
  });

  return result;
}

function revealAccessKeyForExamCell(paperId, adminId) {
  const handover = db.prepare(`
    SELECT *
    FROM KeyHandovers
    WHERE paper_id = ?
    LIMIT 1
  `).get(paperId);

  if (!handover) {
    throw new Error('No key handover is registered for that paper.');
  }

  if (handover.revealed_at) {
    throw new Error('This single-use access key has already been revealed.');
  }

  const accessKey = decryptAccessKey(handover.encrypted_key);
  const revealedAt = now();

  db.exec('BEGIN');

  try {
    db.prepare(`
      UPDATE KeyHandovers
      SET revealed_at = ?, revealed_by = ?
      WHERE id = ?
    `).run(revealedAt, adminId, handover.id);
    db.prepare(`
      UPDATE KeyDispatchLogs
      SET status = 'REVEALED_FOR_EXAM_CELL', dispatched_at = ?
      WHERE paper_id = ?
    `).run(revealedAt, paperId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return accessKey;
}

function listPendingKeyHandovers() {
  return db.prepare(`
    SELECT
      gp.id AS paper_id,
      gp.generated_at,
      gp.exam_date,
      s.code AS subject_code,
      s.name AS subject_name,
      u.name AS faculty_name,
      u.email AS faculty_email,
      kh.revealed_at,
      GROUP_CONCAT(kdl.channel_type || ': ' || kdl.channel_target, ' | ') AS channels
    FROM KeyHandovers kh
    INNER JOIN GeneratedPapers gp ON gp.id = kh.paper_id
    INNER JOIN Subjects s ON s.id = gp.subject_id
    INNER JOIN Users u ON u.id = gp.generated_by
    LEFT JOIN KeyDispatchLogs kdl ON kdl.paper_id = gp.id
    GROUP BY gp.id
    ORDER BY gp.generated_at DESC
    LIMIT 25
  `).all();
}

module.exports = {
  listPendingKeyHandovers,
  queueAccessKeyHandover,
  revealAccessKeyForExamCell
};
