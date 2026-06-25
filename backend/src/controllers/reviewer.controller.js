const reviewerService = require('../services/reviewer.service');
const AppError = require('../utils/app-error');
const { successResponse } = require('../utils/response');

const PENGAJUAN_STATUSES = new Set([
  'DIAJUKAN',
  'MENUNGGU_VERIFIKASI',
  'DISETUJUI',
  'DITOLAK',
]);
const TRANSACTION_TYPES = new Set([
  'JUAL_BELI',
  'HIBAH',
  'WARIS',
  'PEMECAHAN',
  'PENGGABUNGAN',
]);

const parsePositiveId = (value, fieldName) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${fieldName} tidak valid.`, 400);
  }

  return id;
};

const getPengajuanList = async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const nomorSertifikat =
      typeof req.query.nomor_sertifikat === 'string'
        ? req.query.nomor_sertifikat.trim()
        : '';
    const jenisTransaksi =
      typeof req.query.jenis_transaksi === 'string' ? req.query.jenis_transaksi.trim() : '';
    const idNotaris = req.query.id_notaris
      ? parsePositiveId(req.query.id_notaris, 'id_notaris')
      : null;

    if (status && !PENGAJUAN_STATUSES.has(status)) {
      throw new AppError('Filter status tidak valid.', 400);
    }

    if (jenisTransaksi && !TRANSACTION_TYPES.has(jenisTransaksi)) {
      throw new AppError('Filter jenis transaksi tidak valid.', 400);
    }

    const items = await reviewerService.getPengajuanList({
      status,
      nomor_sertifikat: nomorSertifikat,
      jenis_transaksi: jenisTransaksi,
      id_notaris: idNotaris,
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
    const idPengajuan = parsePositiveId(req.params.id, 'id_pengajuan');
    const result = await reviewerService.getPengajuanDetail(idPengajuan);
    return successResponse(res, 'Detail pengajuan berhasil diambil.', result);
  } catch (error) {
    return next(error);
  }
};

const claimPengajuan = async (req, res, next) => {
  try {
    const idPengajuan = parsePositiveId(req.params.id, 'id_pengajuan');
    const result = await reviewerService.claimPengajuanForReview(idPengajuan, req.user.id_pengguna);

    const message = result.claimed
      ? 'Pengajuan berhasil diklaim untuk diperiksa.'
      : 'Pengajuan sudah diklaim oleh pemeriksa ini.';

    return successResponse(res, message, {
      idPengajuan,
      idReviewer: result.pengajuan.id_reviewer,
      status: result.pengajuan.status,
      claimed: result.claimed,
      ...(result.alreadyOwnedByCurrentReviewer && { alreadyOwnedByCurrentReviewer: true }),
    });
  } catch (error) {
    return next(error);
  }
};

const rejectPengajuan = async (req, res, next) => {
  try {
    const idPengajuan = parsePositiveId(req.params.id, 'id_pengajuan');
    const note =
      typeof req.body?.catatan_reviewer === 'string' ? req.body.catatan_reviewer.trim() : '';

    if (!note) {
      throw new AppError('Catatan pemeriksa wajib diisi.', 400);
    }

    const result = await reviewerService.rejectPengajuan(
      idPengajuan,
      req.user,
      note,
      req.ip
    );

    return successResponse(res, 'Pengajuan berhasil ditolak.', result);
  } catch (error) {
    return next(error);
  }
};

const approvePengajuan = async (req, res, next) => {
  try {
    const idPengajuan = parsePositiveId(req.params.id, 'id_pengajuan');
    const note =
      typeof req.body?.catatan_reviewer === 'string' ? req.body.catatan_reviewer.trim() : '';

    const result = await reviewerService.approvePengajuan(
      idPengajuan,
      req.user,
      note,
      req.ip
    );

    return successResponse(res, 'Pengajuan berhasil disetujui.', result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPengajuanList,
  getPengajuanDetail,
  claimPengajuan,
  rejectPengajuan,
  approvePengajuan,
};
