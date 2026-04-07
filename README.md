# ExamVault

ExamVault is a secure question paper generation system built with Node.js, Express, SQLite, React, Vite, PDFKit, and AES-256-GCM encryption. It focuses on three required concerns:

- Pedagogical compliance using Bloom's Taxonomy metadata and blueprint distributions
- Algorithmic randomness using application-layer Fisher-Yates shuffling
- Data security using bcrypt-hashed credentials and in-memory PDF generation followed by AES-256 encryption

## Included Features

- Admin RBAC for departments, subjects, faculty accounts, and global audit logs
- Faculty registration with admin approval, explicit subject assignment, and instant revocation
- Faculty RBAC for personal question banks, blueprint authoring, paper generation, and encrypted vault downloads
- Question CRUD with required metadata: subject, module, marks, difficulty (`L1`-`L3`), Bloom's level, and question type (`MCQ` / `Theory`)
- Strict CSV and Excel bulk upload that rejects the entire file if any row fails validation
- Question version archiving so edits preserve historical integrity
- Section-based blueprints with real-time mark validation in the UI
- Lookback filtering against `ExamHistory` using global admin-managed configuration
- PDF watermarking on every page using generation date and faculty identity, plus configurable header/footer branding
- Single-use 16-character access key generation, encrypted exam-cell escrow, and no plaintext key storage in the database
- Admin alerting when suspicious paper generation volume is detected
- No unencrypted PDF ever written to server disk

## Default Login

- Email: `admin@examvault.local`
- Password: `Admin@123`

Use the admin account first to create departments, subjects, and faculty users.

If you want a different seeded admin password for a fresh database, create a `.env` file in the project root and set `DEFAULT_ADMIN_PASSWORD`.

Example:

```env
DEFAULT_ADMIN_PASSWORD=YourStrongPassword123!
```

An example template is available at [.env.example](C:/Users/Abel/Documents/SEM6/Software/ExamVault/.env.example).

If the admin account already exists and you later change `.env`, run:

```bash
npm run sync:admin-password
```

That updates the existing default admin account to match the current `.env` password.

## Run Locally

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

`npm start` creates a production React build and then serves the API plus SPA from Express.

## Development Mode

```bash
npm run dev
```

This starts both:

- the Express backend on `http://localhost:3000`
- the Vite React dev client with hot reload

## Frontend Stack

- React with hooks and state-driven dashboards under `client/src`
- React Router for admin, auth, and faculty flows
- Vite for fast local development and production builds
- Express JSON APIs under `src/routes/api.js`

## Utility Commands

Useful project commands beyond normal app startup:

```bash
npm run build
npm run reset:data
npm run sync:admin-password
npm run decrypt:vault -- storage/papers/your-file.vault YOUR_BASE64URL_KEY output.pdf
node tools/generate-sample-question-bank.js
```

What each one does:

- `npm run build`: creates the production React bundle in `client/dist`
- `npm run reset:data`: clears faculty data, subjects, questions, papers, logs, sessions, and stored vault files while keeping system config and the default admin account
- `npm run sync:admin-password`: updates the existing default admin account to match the current `DEFAULT_ADMIN_PASSWORD` value from `.env`
- `npm run decrypt:vault -- ...`: decrypts an encrypted `.vault` paper file into a PDF
- `node tools/generate-sample-question-bank.js`: generates a filled sample CSV question bank with 500 valid rows in `sample-data/`

## Decrypting a Vault File

Each generated paper is stored as an encrypted `.vault` file. To recover the PDF using the single-use access key revealed for the Exam Cell:

```bash
node tools/decrypt-vault.js storage/papers/your-file.vault YOUR_BASE64URL_KEY output.pdf
```

## Resetting App Data

To clear all working data and logs while keeping the seeded admin account and system configuration:

```bash
npm run reset:data
```

This removes faculty accounts, departments, subjects, questions, blueprints, generated papers, sessions, audit/security logs, and stored vault files.

After reset, the default admin account is preserved and its password is synced again from `.env` if `DEFAULT_ADMIN_PASSWORD` is present.

## Sample CSV Generation

To generate a filled sample question-bank CSV for import testing:

```bash
node tools/generate-sample-question-bank.js
```

This creates:

- `sample-data/CSE3001-data-structures-question-bank-500.csv`

Before importing it through the Faculty question bank screen:

- create subject code `CSE3001`
- assign `CSE3001` to the faculty account that will import the CSV

## Stack Notes

- Database: SQLite using Node's built-in `node:sqlite`
- Authentication: custom cookie session tokens stored as SHA-256 hashes
- Encryption: AES-256-GCM with runtime-generated high-entropy keys
- Randomness: Fisher-Yates shuffle implemented in `src/utils/shuffle.js`
- Frontend: React SPA served from `client/dist` in production

Node may print an `ExperimentalWarning` for `node:sqlite` on startup. That warning is expected in this build.
