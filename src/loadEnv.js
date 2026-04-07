const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) {
    return;
  }

  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  loaded = true;
}

loadEnv();

module.exports = {
  loadEnv
};
