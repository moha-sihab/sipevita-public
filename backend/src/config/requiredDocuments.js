'use strict';

const REQUIRED_DOCUMENT_TYPES = {
  JUAL_BELI: [
    'SERTIFIKAT_TANAH',
    'AKTA_JUAL_BELI',
    'IDENTITAS_PENJUAL',
    'IDENTITAS_PEMBELI',
  ],
  HIBAH: [
    'SERTIFIKAT_TANAH',
    'AKTA_HIBAH',
    'IDENTITAS_PEMBERI',
    'IDENTITAS_PENERIMA',
  ],
  WARIS: [
    'SERTIFIKAT_TANAH',
    'AKTA_WARIS',
    'IDENTITAS_PEWARIS',
    'IDENTITAS_AHLI_WARIS',
  ],
  PEMECAHAN: [
    'SERTIFIKAT_TANAH',
    'AKTA_PEMECAHAN',
    'IDENTITAS_PEMILIK',
  ],
  PENGGABUNGAN: [
    'SERTIFIKAT_TANAH',
    'AKTA_PENGGABUNGAN',
    'IDENTITAS_PEMILIK',
  ],
};

/**
 * Digunakan untuk memvalidasi nilai jenis_dokumen saat upload.
 */
const ALL_VALID_DOCUMENT_TYPES = new Set(
  Object.values(REQUIRED_DOCUMENT_TYPES).flat()
);


const checkRequiredDocuments = (jenis_transaksi, activeDocs) => {
  const requiredTypes = REQUIRED_DOCUMENT_TYPES[jenis_transaksi];

  if (!requiredTypes) {
    return { ok: true, missing: [] };
  }

  const uploadedTypes = new Set(
    activeDocs
      .filter((d) => d.is_active !== false && d.status_upload === 'UPLOADED' && d.cid_ipfs)
      .map((d) => d.jenis_dokumen)
  );

  const missing = requiredTypes.filter((type) => !uploadedTypes.has(type));
  return { ok: missing.length === 0, missing };
};

module.exports = {
  REQUIRED_DOCUMENT_TYPES,
  ALL_VALID_DOCUMENT_TYPES,
  checkRequiredDocuments,
};
