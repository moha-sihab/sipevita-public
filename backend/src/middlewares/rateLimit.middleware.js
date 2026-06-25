const { rateLimit } = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) =>
    errorResponse(
      res,
      'Terlalu banyak permintaan verifikasi publik. Silakan coba lagi nanti.',
      null,
      429,
    ),
});

module.exports = {
  publicRateLimit,
};
