const FLASH_COOKIE_NAME = 'examvault_flash';

function setFlash(res, type, message) {
  const payload = Buffer.from(JSON.stringify({ type, message }), 'utf8').toString('base64url');
  res.cookie(FLASH_COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: 'lax',
    signed: true,
    maxAge: 60 * 1000
  });
}

function attachFlash(req, res, next) {
  const raw = req.signedCookies[FLASH_COOKIE_NAME];

  if (!raw) {
    req.flash = null;
    return next();
  }

  try {
    req.flash = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch (error) {
    req.flash = null;
  }

  res.clearCookie(FLASH_COOKIE_NAME);
  return next();
}

module.exports = {
  setFlash,
  attachFlash
};
