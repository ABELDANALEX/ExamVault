const nodemailer = require('nodemailer');

let cachedTransporter = null;

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (parseBoolean(process.env.EMAIL_JSON_TRANSPORT)) {
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true
    });
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const service = process.env.SMTP_SERVICE;

  if (!host && !service) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: host || undefined,
    service: service || undefined,
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseBoolean(process.env.SMTP_SECURE),
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        : undefined
  });

  return cachedTransporter;
}

async function sendAdminKeyNotification({
  accessKey,
  paperId,
  subject,
  blueprintName,
  examDate,
  faculty,
  handoverTargets = []
}) {
  const adminEmail = String(process.env.ADMIN_NOTIFY_EMAIL || '').trim();
  const fromAddress =
    String(process.env.SMTP_FROM || '').trim() || 'no-reply@examvault.local';
  const transporter = getTransporter();

  if (!adminEmail) {
    return {
      status: 'skipped',
      reason: 'ADMIN_NOTIFY_EMAIL is not configured.'
    };
  }

  if (!transporter) {
    return {
      status: 'skipped',
      reason: 'SMTP transport is not configured.'
    };
  }

  const handoverText =
    handoverTargets.length === 0
      ? 'No Exam Cell handover targets are configured.'
      : handoverTargets
          .map((target) => `${target.channelType.toUpperCase()}: ${target.maskedTarget || target.channelTarget}`)
          .join('\n');

  const mail = await transporter.sendMail({
    from: fromAddress,
    to: adminEmail,
    subject: `ExamVault Key Dispatch | ${subject.code} | Paper #${paperId}`,
    text: [
      'ExamVault generated a new encrypted paper.',
      '',
      `Paper ID: ${paperId}`,
      `Subject: ${subject.code} - ${subject.name}`,
      `Blueprint: ${blueprintName}`,
      `Exam Date: ${examDate}`,
      `Faculty: ${faculty.name} (${faculty.email})`,
      '',
      `Decryption Key: ${accessKey}`,
      '',
      'Exam Cell Targets:',
      handoverText,
      '',
      'Handle this key through your authorized exam process only.'
    ].join('\n')
  });

  return {
    status: 'sent',
    adminEmail,
    messageId: mail.messageId || null
  };
}

module.exports = {
  sendAdminKeyNotification
};
