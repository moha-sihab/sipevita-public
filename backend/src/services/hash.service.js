const crypto = require('crypto');
const { canonicalStringify } = require('../utils/canonicalJson');

const generateSha256 = (input) => {
  if (typeof input !== 'string' && typeof input !== 'object') {
    throw new TypeError('Input hash harus berupa string atau objek.');
  }

  const content = typeof input === 'string' ? input : canonicalStringify(input);

  if (content === undefined) {
    throw new TypeError('Input hash harus kompatibel dengan JSON.');
  }

  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
};

const generateOwnerHash = (ownerData) => generateSha256(ownerData);

const generateDocumentHash = (documentData) => generateSha256(documentData);

const generateLocationHash = (locationData) => generateSha256(locationData);

const generateCertificateDataHash = (certificateData) =>
  generateSha256(certificateData);

const selectOwnerFields = (party) => ({
  alamat: party?.alamat ?? null,
  nama: party?.nama ?? null,
  nomor_identitas: party?.nomor_identitas ?? null,
  peran: party?.peran ?? null,
});

const selectDocumentFields = (document) => ({
  cid_ipfs: document?.cid_ipfs ?? null,
  hash_file: document?.hash_file ?? null,
  nama_file: document?.nama_file ?? null,
});

const generatePengajuanIntegrityHashes = (payload = {}) => {
  const pengajuan = payload.pengajuan || payload;
  const parties = Array.isArray(payload.pihak_transaksi)
    ? payload.pihak_transaksi
    : [];
  const documents = Array.isArray(payload.dokumen) ? payload.dokumen : [];
  const newOwner = parties.find((party) => party?.peran === 'PEMILIK_BARU');
  const ownerData = newOwner
    ? selectOwnerFields(newOwner)
    : parties.map(selectOwnerFields);
  const documentData = documents.map(selectDocumentFields);

  return {
    hash_pemilik: generateOwnerHash(ownerData),
    hash_dokumen: generateDocumentHash(documentData),
    lokasi_hash: generateLocationHash({
      lokasi_tanah: pengajuan.lokasi_tanah ?? null,
      luas_tanah: pengajuan.luas_tanah ?? null,
      nib: pengajuan.nib ?? null,
    }),
    hash_data_sertifikat: generateCertificateDataHash(
      pengajuan.data_sertifikat ?? null,
    ),
  };
};

module.exports = {
  generateSha256,
  generateOwnerHash,
  generateDocumentHash,
  generateLocationHash,
  generateCertificateDataHash,
  generatePengajuanIntegrityHashes,
};
