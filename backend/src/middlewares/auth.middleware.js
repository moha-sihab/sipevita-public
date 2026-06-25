const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { errorResponse } = require('../utils/response');

const isJwtConfigured = () => {
  const normalized = env.jwtSecret.trim().toLowerCase();

  return (
    normalized &&
    !normalized.includes('your_') &&
    !normalized.includes('placeholder') &&
    !normalized.includes('dummy')
  );
};

const authenticate = (req, res, next) => {
  if (!isJwtConfigured()) {
    return errorResponse(res, 'Autentikasi JWT belum dikonfigurasi.', null, 503);
  }

  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return errorResponse(res, 'Token autentikasi wajib disertakan.', null, 401);
  }

  try {
    const decoded = jwt.verify(match[1], env.jwtSecret);

    if (!decoded.id_pengguna || !decoded.username || !decoded.peran) {
      return errorResponse(res, 'Token autentikasi tidak valid.', null, 401);
    }

    req.user = {
      id_pengguna: decoded.id_pengguna,
      username: decoded.username,
      peran: decoded.peran,
    };

    return next();
  } catch {
    return errorResponse(res, 'Token autentikasi tidak valid atau sesi Anda telah berakhir.', null, 401);
  }
};

module.exports = authenticate;
