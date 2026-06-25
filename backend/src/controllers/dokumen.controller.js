'use strict';

const { uploadDocuments } = require('../services/upload.service');
const { listDocuments, getSignedDocumentUrl } = require('../services/dokumen.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const parseDocumentMetadata = (raw) => {
  if (!raw) {
    throw new AppError(
      'Metadata dokumen wajib diisi.',
      400,
      { code: 'DOCUMENT_METADATA_MISMATCH' }
    );
  }

  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new AppError(
          'Metadata dokumen harus berupa array JSON.',
          400,
          { code: 'DOCUMENT_METADATA_MISMATCH' }
        );
      }
      return parsed;
    } catch (e) {
      if (e.name === 'AppError') throw e;
      throw new AppError(
        'Metadata dokumen harus berupa JSON yang valid.',
        400,
        { code: 'DOCUMENT_METADATA_MISMATCH' }
      );
    }
  }

  throw new AppError(
    'Metadata dokumen harus berupa array JSON.',
    400,
    { code: 'DOCUMENT_METADATA_MISMATCH' }
  );
};

const parsePengajuanId = (raw) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('ID pengajuan tidak valid.', 400, { code: 'PENGAJUAN_NOT_FOUND' });
  }
  return id;
};

const uploadDokumen = async (req, res, next) => {
  try {
    const idPengajuan = parsePengajuanId(req.params.idPengajuan);
    const files = req.files || [];
    const documentMetadata = parseDocumentMetadata(req.body?.documentMetadata);

    const result = await uploadDocuments({
      idPengajuan,
      files,
      documentMetadata,
      userId: req.user.id_pengguna,
      ipAddress: req.ip,
    });

    return successResponse(res, 'Dokumen berhasil diunggah.', {
      idPengajuan: result.idPengajuan,
      manifestCid: result.manifestCid,
      documents: result.documents,
    }, 200);
  } catch (error) {
    return next(error);
  }
};

const listDokumen = async (req, res, next) => {
  try {
    const idPengajuan = parsePengajuanId(req.params.idPengajuan);

    const documents = await listDocuments({
      idPengajuan,
      userId: req.user.id_pengguna,
      peran: req.user.peran,
      ipAddress: req.ip,
    });

    return successResponse(res, 'Daftar dokumen berhasil diambil.', documents, 200);
  } catch (error) {
    return next(error);
  }
};

const downloadDokumen = async (req, res, next) => {
  try {
    const idPengajuan = parsePengajuanId(req.params.idPengajuan);
    const { idDokumen } = req.params;

    const result = await getSignedDocumentUrl({
      idPengajuan,
      idDokumen,
      userId: req.user.id_pengguna,
      peran: req.user.peran,
      ipAddress: req.ip,
      purpose: 'download',
    });

    return successResponse(res, 'URL unduhan berhasil dibuat.', {
      idDokumen: result.idDokumen,
      namaFile: result.namaFile,
      mimeType: result.mimeType,
      expiresIn: result.expiresIn,
      downloadUrl: result.url,
    }, 200);
  } catch (error) {
    return next(error);
  }
};

const previewDokumen = async (req, res, next) => {
  try {
    const idPengajuan = parsePengajuanId(req.params.idPengajuan);
    const { idDokumen } = req.params;

    const result = await getSignedDocumentUrl({
      idPengajuan,
      idDokumen,
      userId: req.user.id_pengguna,
      peran: req.user.peran,
      ipAddress: req.ip,
      purpose: 'preview',
    });

    return successResponse(res, 'URL pratinjau berhasil dibuat.', {
      idDokumen: result.idDokumen,
      namaFile: result.namaFile,
      mimeType: result.mimeType,
      expiresIn: result.expiresIn,
      previewUrl: result.url,
    }, 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = { uploadDokumen, listDokumen, downloadDokumen, previewDokumen };
