const path = require('node:path');
const AppError = require('./app-error');
const env = require('../config/env');

// Only allow filenames that contain no path separators or special shell characters.
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._\- ]+$/;

const sanitizeFilename = (originalname) => {
  const base = path.basename(originalname || 'upload');
  const ext = path.extname(base).toLowerCase();
  if (SAFE_FILENAME_RE.test(base)) return base;
  const safeStem = path
    .basename(base, ext)
    .replace(/[^a-zA-Z0-9._\- ]/g, '_')
    .slice(0, 200);
  return (safeStem || 'upload') + ext;
};

const validateFiles = (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError('Minimal satu dokumen wajib diunggah.', 400, { code: 'FILE_REQUIRED' });
  }

  if (files.length > env.documentMaxFiles) {
    throw new AppError(
      `Maksimal ${env.documentMaxFiles} dokumen dapat diunggah dalam satu permintaan.`,
      400,
      { code: 'TOO_MANY_FILES', limit: env.documentMaxFiles, received: files.length }
    );
  }

  const maxBytes = env.documentMaxFileSizeMb * 1024 * 1024;

  for (const file of files) {
    if (!file.buffer || file.buffer.length === 0) {
      throw new AppError(
        `Dokumen "${file.originalname}" kosong.`,
        400,
        { code: 'FILE_REQUIRED', filename: file.originalname }
      );
    }

    if (file.size > maxBytes) {
      throw new AppError(
        `Ukuran dokumen "${file.originalname}" melebihi batas ${env.documentMaxFileSizeMb} MB.`,
        413,
        { code: 'FILE_TOO_LARGE', limitMb: env.documentMaxFileSizeMb, filename: file.originalname }
      );
    }

    if (!env.documentAllowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(
        `Jenis dokumen "${file.mimetype}" tidak didukung.`,
        415,
        {
          code: 'INVALID_FILE_TYPE',
          received: file.mimetype,
          allowed: env.documentAllowedMimeTypes,
          filename: file.originalname,
        }
      );
    }
  }
};


const validateDocumentMetadata = (files, documentMetadata) => {
  if (!Array.isArray(documentMetadata) || documentMetadata.length === 0) {
    throw new AppError(
      'Metadata dokumen harus berupa array JSON yang tidak kosong.',
      400,
      { code: 'DOCUMENT_METADATA_MISMATCH' }
    );
  }

  if (documentMetadata.length !== files.length) {
    throw new AppError(
      `Metadata dokumen harus memiliki satu data untuk setiap dokumen. Diterima ${documentMetadata.length}, diharapkan ${files.length}.`,
      400,
      {
        code: 'DOCUMENT_METADATA_MISMATCH',
        expected: files.length,
        received: documentMetadata.length,
      }
    );
  }

  for (let i = 0; i < documentMetadata.length; i++) {
    const entry = documentMetadata[i];

    if (!entry || typeof entry !== 'object') {
      throw new AppError(
        `Metadata dokumen indeks ${i} harus berupa objek.`,
        400,
        { code: 'DOCUMENT_METADATA_MISMATCH', index: i }
      );
    }

    if (entry.idDokumen !== undefined && entry.idDokumen !== null) {
      entry.idDokumen = String(entry.idDokumen);
    }

    if (!entry.idDokumen || typeof entry.idDokumen !== 'string' || !entry.idDokumen.trim()) {
      throw new AppError(
        `ID dokumen pada metadata indeks ${i} wajib diisi.`,
        400,
        { code: 'DOCUMENT_METADATA_MISMATCH', index: i, field: 'idDokumen' }
      );
    }

    if (!entry.jenisDokumen || typeof entry.jenisDokumen !== 'string' || !entry.jenisDokumen.trim()) {
      throw new AppError(
        `Jenis dokumen pada metadata indeks ${i} wajib diisi.`,
        400,
        { code: 'DOCUMENT_METADATA_MISMATCH', index: i, field: 'jenisDokumen' }
      );
    }
  }

  // Ensure no duplicate idDokumen within the same request.
  const seen = new Set();
  for (let i = 0; i < documentMetadata.length; i++) {
    const id = documentMetadata[i].idDokumen.trim();
    if (seen.has(id)) {
      throw new AppError(
        `Metadata dokumen memiliki ID dokumen duplikat: "${id}".`,
        400,
        { code: 'DOCUMENT_METADATA_MISMATCH', duplicateId: id }
      );
    }
    seen.add(id);
  }
};

/**
 * @deprecated Use validateDocumentMetadata instead.
 * Kept for backwards compatibility with existing callers that pass string arrays.
 */
const validateDocumentTypes = (files, documentTypes) => {
  if (!Array.isArray(documentTypes)) {
    throw new AppError(
      'Jenis dokumen harus berupa array JSON.',
      400,
      { code: 'DOCUMENT_TYPE_REQUIRED' }
    );
  }

  if (documentTypes.length !== files.length) {
    throw new AppError(
      `Jenis dokumen harus memiliki satu data untuk setiap dokumen. Diterima ${documentTypes.length}, diharapkan ${files.length}.`,
      400,
      { code: 'DOCUMENT_METADATA_MISMATCH', expected: files.length, received: documentTypes.length }
    );
  }

  for (let i = 0; i < documentTypes.length; i++) {
    if (!documentTypes[i] || typeof documentTypes[i] !== 'string' || !documentTypes[i].trim()) {
      throw new AppError(
        `Jenis dokumen pada indeks ${i} wajib diisi.`,
        400,
        { code: 'DOCUMENT_TYPE_REQUIRED', index: i }
      );
    }
  }
};

module.exports = { validateFiles, validateDocumentTypes, validateDocumentMetadata, sanitizeFilename };
