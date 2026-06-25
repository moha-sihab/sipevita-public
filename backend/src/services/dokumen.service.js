'use strict';

const AppError = require('../utils/app-error');
const {
  getPengajuanById,
  getDocumentsByPengajuanId,
  getDocumentByIdAndPengajuanId,
} = require('../repositories/dokumen.repository');
const { createPrivateAccessLink } = require('./pinata.service');
const { createLogActivity } = require('./log.service');
const env = require('../config/env');

const assertDocumentAccess = (pengajuan, userId, peran) => {
  if (!pengajuan) {
    throw new AppError('Pengajuan tidak ditemukan.', 404, { code: 'PENGAJUAN_NOT_FOUND' });
  }
  if (peran === 'PPAT') {
    if (pengajuan.id_notaris !== userId) {
      throw new AppError(
        'Anda tidak memiliki akses ke pengajuan ini.',
        403,
        { code: 'DOCUMENT_ACCESS_FORBIDDEN' }
      );
    }
  } else if (peran === 'ATR_BPN') {
    if (pengajuan.id_reviewer === null) {
      throw new AppError(
        'Pengajuan belum memiliki pemeriksa yang ditugaskan. Lakukan klaim terlebih dahulu.',
        403,
        { code: 'PENGAJUAN_REVIEWER_NOT_ASSIGNED' }
      );
    }
    if (pengajuan.id_reviewer !== userId) {
      throw new AppError(
        'Anda tidak ditugaskan sebagai pemeriksa pengajuan ini.',
        403,
        { code: 'PENGAJUAN_REVIEWER_MISMATCH' }
      );
    }
  } else {
    throw new AppError(
      'Peran Anda tidak diizinkan mengakses dokumen.',
      403,
      { code: 'DOCUMENT_ACCESS_FORBIDDEN' }
    );
  }
};

const toPublicDocumentShape = (d) => ({
  idDokumen: d.id_dokumen,
  idPengajuan: d.id_pengajuan,
  jenisDokumen: d.jenis_dokumen,
  namaFileAsli: d.nama_file_asli,
  mimeType: d.mime_type,
  ukuranFile: d.ukuran_file,
  statusUpload: d.status_upload,
  tanggalUpload: d.tanggal_upload,
  isActive: d.is_active,
});

const listDocuments = async ({ idPengajuan, userId, peran, ipAddress }) => {
  const pengajuan = await getPengajuanById(idPengajuan);
  assertDocumentAccess(pengajuan, userId, peran);

  const documents = await getDocumentsByPengajuanId(idPengajuan);

  await createLogActivity({
    id_pengguna: userId,
    jenis_aksi: 'DOCUMENT_LIST_VIEWED',
    ip_address: ipAddress,
    detail_aksi: `Daftar dokumen dilihat untuk pengajuan ${idPengajuan}.`,
  });

  return documents.map(toPublicDocumentShape);
};

const getSignedDocumentUrl = async ({ idPengajuan, idDokumen, userId, peran, ipAddress, purpose }) => {
  const pengajuan = await getPengajuanById(idPengajuan);
  assertDocumentAccess(pengajuan, userId, peran);

  const doc = await getDocumentByIdAndPengajuanId(idDokumen, idPengajuan);

  if (!doc) {
    throw new AppError('Dokumen tidak ditemukan.', 404, { code: 'DOCUMENT_NOT_FOUND' });
  }

  if (doc.status_upload !== 'UPLOADED' || !doc.cid_ipfs) {
    throw new AppError(
      'Dokumen belum tersedia untuk diakses.',
      409,
      { code: 'DOCUMENT_NOT_UPLOADED' }
    );
  }

  const url = await createPrivateAccessLink(doc.cid_ipfs);

  const jenis_aksi = purpose === 'preview' ? 'DOCUMENT_PREVIEWED' : 'DOCUMENT_DOWNLOADED';
  await createLogActivity({
    id_pengguna: userId,
    jenis_aksi,
    ip_address: ipAddress,
    detail_aksi: `Dokumen ${idDokumen} ${purpose === 'preview' ? 'dipratinjau' : 'diunduh'} untuk pengajuan ${idPengajuan}.`,
  });

  return {
    idDokumen: doc.id_dokumen,
    namaFile: doc.nama_file_asli,
    mimeType: doc.mime_type,
    expiresIn: env.pinataSignedUrlExpiresSeconds,
    url,
  };
};

module.exports = { listDocuments, getSignedDocumentUrl };
