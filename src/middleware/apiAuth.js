function requireApiAuth(req, res, next) {
  if (!req.currentUser) {
    return res.status(401).json({
      error: 'Please sign in to continue.',
      code: 'UNAUTHORIZED'
    });
  }

  return next();
}

function requireApiRole(...roles) {
  return (req, res, next) => {
    if (!req.currentUser) {
      return res.status(401).json({
        error: 'Please sign in to continue.',
        code: 'UNAUTHORIZED'
      });
    }

    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({
        error: 'You do not have permission to access that resource.',
        code: 'FORBIDDEN'
      });
    }

    return next();
  };
}

module.exports = {
  requireApiAuth,
  requireApiRole
};
