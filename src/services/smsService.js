'use strict';

/**
 * smsService.js
 *
 * Sends an SMS notification to the Exam Cell phone number when a new
 * encrypted paper is generated and an access key is queued for handover.
 *
 * Provider: Twilio (https://www.twilio.com)
 * Required env vars:
 *   TWILIO_ACCOUNT_SID  – Twilio Account SID (starts with "AC")
 *   TWILIO_AUTH_TOKEN   – Twilio Auth Token
 *   TWILIO_FROM_NUMBER  – Your Twilio phone number in E.164 format, e.g. +15550001234
 *
 * The Twilio SDK is loaded lazily so that the rest of the application starts
 * normally even when the package is not installed or env vars are missing.
 * A missing / unconfigured Twilio setup returns a "skipped" result rather
 * than throwing, keeping behaviour consistent with emailService.js.
 */

function getTwilioClient() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

  if (!accountSid || !authToken) {
    return null;
  }

  try {
    // Require lazily so a missing optional dependency doesn't crash startup.
    // Run `npm install twilio` to enable SMS dispatch.
    const twilio = require('twilio'); // eslint-disable-line global-require
    return twilio(accountSid, authToken);
  } catch {
    return null;
  }
}

/**
 * Send an SMS to the Exam Cell phone target notifying them that a new
 * paper access key is waiting for handover.
 *
 * @param {object} opts
 * @param {string}   opts.toNumber        – Destination phone in E.164 format
 * @param {string}   opts.accessKey       – Plain-text decryption key
 * @param {number}   opts.paperId
 * @param {object}   opts.subject         – { code, name }
 * @param {string}   opts.blueprintName
 * @param {string}   opts.examDate
 * @param {object}   opts.faculty         – { name, email }
 * @returns {Promise<{status: string, [key: string]: any}>}
 */
async function sendExamCellSmsNotification({
  toNumber,
  accessKey,
  paperId,
  subject = {},
  blueprintName = '',
  examDate = '',
  faculty = {}
}) {
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER || '').trim();
  const client = getTwilioClient();

  if (!client) {
    return {
      status: 'skipped',
      reason:
        'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER, then run npm install twilio.'
    };
  }

  if (!fromNumber) {
    return {
      status: 'skipped',
      reason: 'TWILIO_FROM_NUMBER is not configured.'
    };
  }

  if (!toNumber) {
    return {
      status: 'skipped',
      reason: 'No destination phone number provided.'
    };
  }

  const body = [
    `[ExamVault] New paper key ready for handover.`,
    `Paper #${paperId} | ${subject.code || ''} - ${subject.name || ''}`,
    `Blueprint: ${blueprintName}`,
    `Exam Date: ${examDate}`,
    `Faculty: ${faculty.name || ''} (${faculty.email || ''})`,
    ``,
    `Decryption Key: ${accessKey}`,
    ``,
    `Handle via your authorized exam process only.`
  ].join('\n');

  const message = await client.messages.create({
    body,
    from: fromNumber,
    to: toNumber
  });

  return {
    status: 'sent',
    toNumber,
    messageSid: message.sid
  };
}

module.exports = {
  sendExamCellSmsNotification
};
