const { errorResponse } = require('../utils/response');

const notFoundHandler = (req, res) =>
  errorResponse(res, `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`, null, 404);

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500
    ? 'Terjadi kesalahan pada server. Silakan coba kembali.'
    : err.message;
  const details = statusCode === 500 ? null : err.details || null;

  return errorResponse(res, message, details, statusCode);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
