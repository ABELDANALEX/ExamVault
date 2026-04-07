const { getUserFromSessionToken, pruneExpiredSessions } = require('../services/authService');
const { setFlash } = require('../utils/flash');

function loadCurrentUser(req, res, next) {
  pruneExpiredSessions();
  const token = req.signedCookies.examvault_session;
  req.currentUser = getUserFromSessionToken(token);
  next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    setFlash(res, 'warning', 'Please sign in to continue.');
    return res.redirect('/login');
  }

  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      setFlash(res, 'warning', 'Please sign in to continue.');
      return res.redirect('/login');
    }

    if (!roles.includes(req.currentUser.role)) {
      setFlash(res, 'danger', 'You do not have permission to access that page.');
      return res.redirect('/dashboard');
    }

    return next();
  };
}

module.exports = {
  loadCurrentUser,
  requireAuth,
  requireRole
};
