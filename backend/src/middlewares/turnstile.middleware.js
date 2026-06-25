const turnstileService = require('../services/turnstile.service');

const getToken = (req) =>
  req.body?.turnstile_token ||
  req.body?.turnstileToken ||
  req.body?.['cf-turnstile-response'] ||
  req.get('X-Turnstile-Token') ||
  req.get('cf-turnstile-response');

const verifyTurnstile = async (req, res, next) => {
  try {
    await turnstileService.verifyToken(getToken(req), req.ip);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  verifyTurnstile,
};
