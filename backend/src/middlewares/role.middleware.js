const { errorResponse } = require('../utils/response');

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.peran)) {
    return errorResponse(res, 'Anda tidak memiliki izin untuk melakukan tindakan ini.', null, 403);
  }

  return next();
};

module.exports = authorizeRoles;
