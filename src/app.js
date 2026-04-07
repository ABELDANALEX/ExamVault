const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

require('./db');

const apiRoutes = require('./routes/api');
const { loadCurrentUser } = require('./middleware/auth');

const app = express();
const publicDirectory = path.join(__dirname, '..', 'public');
const clientDistDirectory = path.join(__dirname, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistDirectory, 'index.html');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'examvault-local-cookie-secret'));
app.use(loadCurrentUser);

app.use('/api', apiRoutes);
app.use(express.static(publicDirectory));
if (fs.existsSync(clientDistDirectory)) {
  app.use(express.static(clientDistDirectory));
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  if (!fs.existsSync(clientIndexPath)) {
    return res.status(503).send('Frontend build not found. Run "npm run build" before starting the server.');
  }

  return res.sendFile(clientIndexPath);
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (req.path.startsWith('/api')) {
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred.'
    });
  }

  return res.status(500).send('An unexpected error occurred.');
});

module.exports = app;
