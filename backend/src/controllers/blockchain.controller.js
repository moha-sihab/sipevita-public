const blockchainService = require('../services/blockchain.service');
const certificateHistoryService = require('../services/certificate-history.service');
const networkStatusService = require('../services/network-status.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const getCertificateNumber = (value) => {
  const nomorSertifikat = typeof value === 'string' ? value.trim() : '';

  if (!nomorSertifikat) {
    throw new AppError('Nomor sertifikat wajib diisi.', 400);
  }

  return nomorSertifikat;
};

const verifyLand = async (req, res, next) => {
  try {
    const result = await blockchainService.verifyLand(
      getCertificateNumber(req.params.nomorSertifikat),
    );
    return successResponse(res, 'Data verifikasi blockchain berhasil diambil.', result);
  } catch (error) {
    return next(error);
  }
};

const getLandHistory = async (req, res, next) => {
  try {
    const nomorSertifikat = getCertificateNumber(req.params.nomorSertifikat);
    const result = await certificateHistoryService.getCertificateHistory(nomorSertifikat, {
      includePrivateFields: true,
    });
    const message = result.count > 0
      ? 'Riwayat blockchain berhasil diambil.'
      : 'Belum ada riwayat aset pada blockchain.';

    return successResponse(res, message, result);
  } catch (error) {
    return next(error);
  }
};

const getNetworkStatus = async (req, res, next) => {
  try {
    const status = await networkStatusService.getNetworkStatus();
    return successResponse(res, 'Status jaringan blockchain berhasil diambil.', status);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  verifyLand,
  getLandHistory,
  getNetworkStatus,
};
