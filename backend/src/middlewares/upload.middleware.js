const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/app-error');

const MAX_BYTES = env.documentMaxFileSizeMb * 1024 * 1024;

const fileFilter = (_req, file, cb) => {
  if (env.documentAllowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Jenis dokumen "${file.mimetype}" tidak didukung. Gunakan jenis dokumen yang diizinkan: ${env.documentAllowedMimeTypes.join(', ')}.`,
        415,
        {
          code: 'INVALID_FILE_TYPE',
          received: file.mimetype,
          allowed: env.documentAllowedMimeTypes,
          filename: file.originalname,
        }
      ),
      false
    );
  }
};

const storage = multer.memoryStorage();

const _multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_BYTES,
    files: env.documentMaxFiles,
  },
  fileFilter,
});

const handleMulterError = (err, req, res, next) => {
  if (!err) return next();

  if (err.code === 'LIMIT_FILE_SIZE') {
    return next(
      new AppError(
        `Ukuran dokumen melebihi batas ${env.documentMaxFileSizeMb} MB.`,
        413,
        { code: 'FILE_TOO_LARGE', limitMb: env.documentMaxFileSizeMb }
      )
    );
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return next(
      new AppError(
        `Maksimal ${env.documentMaxFiles} dokumen dapat diunggah dalam satu permintaan.`,
        400,
        { code: 'TOO_MANY_FILES', limit: env.documentMaxFiles }
      )
    );
  }

  if (err.name === 'AppError') return next(err);

  return next(new AppError('Dokumen gagal diunggah.', 400, { code: 'FILE_REQUIRED' }));
};

const uploadFields = (req, res, next) => {
  _multerInstance.array('files', env.documentMaxFiles)(req, res, (err) => {
    handleMulterError(err, req, res, next);
  });
};

module.exports = { uploadFields };
