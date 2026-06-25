const publicService = require('../services/public.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const getCertificateNumber = (value) => {
  const nomorSertifikat = typeof value === 'string' ? value.trim() : '';

  if (!nomorSertifikat) {
    throw new AppError('Nomor sertifikat wajib diisi.', 400);
  }

  return nomorSertifikat;
};

const getRequestValue = (req, key) => req.body?.[key] ?? req.query?.[key];

const verifyCertificate = async (req, res, next) => {
  try {
    const nomorSertifikat = getCertificateNumber(getRequestValue(req, 'nomor_sertifikat'));
    const result = await publicService.verifyCertificate(nomorSertifikat, req.ip);
    return successResponse(res, result.message, result.data);
  } catch (error) {
    return next(error);
  }
};

const getCertificateHistory = async (req, res, next) => {
  try {
    const nomorSertifikat = getCertificateNumber(getRequestValue(req, 'nomor_sertifikat'));
    const result = await publicService.getCertificateHistory(nomorSertifikat, req.ip);
    return successResponse(res, 'Riwayat sertifikat berhasil diambil.', result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  verifyCertificate,
  getCertificateHistory,
};
