const fs = require('node:fs');
const path = require('node:path');
const { createDecipheriv, scryptSync } = require('node:crypto');

const MAGIC_HEADER = Buffer.from('EVLT02', 'utf8');

function printUsage() {
  console.log('Usage: node tools/decrypt-vault.js <input.vault> <base64url-key> [output.pdf]');
}

function main() {
  const [, , inputPath, keyText, outputPathArg] = process.argv;

  if (!inputPath || !keyText) {
    printUsage();
    process.exit(1);
  }

  const inputBuffer = fs.readFileSync(inputPath);
  const header = inputBuffer.subarray(0, MAGIC_HEADER.length);

  if (!header.equals(MAGIC_HEADER)) {
    throw new Error('Unrecognized vault format.');
  }

  const salt = inputBuffer.subarray(MAGIC_HEADER.length, MAGIC_HEADER.length + 16);
  const iv = inputBuffer.subarray(MAGIC_HEADER.length + 16, MAGIC_HEADER.length + 28);
  const authTag = inputBuffer.subarray(MAGIC_HEADER.length + 28, MAGIC_HEADER.length + 44);
  const ciphertext = inputBuffer.subarray(MAGIC_HEADER.length + 44);
  const key = scryptSync(keyText, salt, 32);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const pdfBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const outputPath =
    outputPathArg ||
    path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.pdf`);

  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Decrypted PDF written to ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Vault decryption failed: ${error.message}`);
  process.exit(1);
}
