const pengajuanService = require('../services/pengajuan.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const TRANSACTION_TYPES = new Set([
  'JUAL_BELI',
  'HIBAH',
  'WARIS',
  'PEMECAHAN',
  'PENGGABUNGAN',
]);
const PARTY_ROLES = new Set(['PEMILIK_LAMA', 'PEMILIK_BARU']);
const PENGAJUAN_STATUSES = new Set([
  'DIAJUKAN',
  'MENUNGGU_VERIFIKASI',
  'DISETUJUI',
  'DITOLAK',
]);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const validateCreatePayload = (body) => {
  if (!isNonEmptyString(body.nomor_sertifikat)) {
    throw new AppError('Nomor sertifikat wajib diisi.', 400);
  }

  if (!TRANSACTION_TYPES.has(body.jenis_transaksi)) {
    throw new AppError('Jenis transaksi tidak valid.', 400);
  }

  if (!Array.isArray(body.pihak_transaksi) || body.pihak_transaksi.length === 0) {
    throw new AppError('Pihak transaksi wajib berisi minimal satu data.', 400);
  }

  for (const party of body.pihak_transaksi) {
    if (!party || typeof party !== 'object' || !PARTY_ROLES.has(party.peran)) {
      throw new AppError('Peran setiap pihak transaksi harus valid.', 400);
    }

    if (!isNonEmptyString(party.nama)) {
      throw new AppError('Nama setiap pihak transaksi wajib diisi.', 400);
    }
  }
};

const createPengajuan = async (req, res, next) => {
  try {
    const payload = req.body || {};
    validateCreatePayload(payload);
    const result = await pengajuanService.createPengajuan(payload, req.user, req.ip);
    return successResponse(res, 'Pengajuan berhasil dibuat.', result, 201);
  } catch (error) {
    return next(error);
  }
};

const getPengajuanList = async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const nomorSertifikat =
      typeof req.query.nomor_sertifikat === 'string'
        ? req.query.nomor_sertifikat.trim()
        : '';

    if (status && !PENGAJUAN_STATUSES.has(status)) {
      throw new AppError('Filter status tidak valid.', 400);
    }

    const items = await pengajuanService.getPengajuanList(req.user.id_pengguna, {
      status,
      nomor_sertifikat: nomorSertifikat,
    });

    return successResponse(res, 'Daftar pengajuan berhasil diambil.', {
      items,
      count: items.length,
    });
  } catch (error) {
    return next(error);
  }
};

const getPengajuanDetail = async (req, res, next) => {
  try {
    const idPengajuan = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(idPengajuan) || idPengajuan <= 0) {
      throw new AppError('ID pengajuan tidak valid.', 400);
    }

    const result = await pengajuanService.getPengajuanDetail(
      idPengajuan,
      req.user.id_pengguna
    );

    return successResponse(res, 'Detail pengajuan berhasil diambil.', result);
  } catch (error) {
    return next(error);
  }
};

const submitPengajuan = async (req, res, next) => {
  try {
    const idPengajuan = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(idPengajuan) || idPengajuan <= 0) {
      throw new AppError('ID pengajuan tidak valid.', 400);
    }

    const result = await pengajuanService.submitPengajuan(
      idPengajuan,
      req.user,
      req.ip
    );

    return successResponse(res, 'Pengajuan berhasil dikirim.', result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPengajuan,
  getPengajuanList,
  getPengajuanDetail,
  submitPengajuan,
};
