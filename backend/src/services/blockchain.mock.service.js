const crypto = require('node:crypto');

const assets = new Map();
const histories = new Map();
let blockNumber = 0;

const addHistory = (nomorSertifikat, transactionId, value) => {
  const history = histories.get(nomorSertifikat) || [];
  history.push({
    txId: transactionId,
    timestamp: new Date().toISOString(),
    isDelete: false,
    value,
  });
  histories.set(nomorSertifikat, history);
};

const submitResult = (result) => {
  blockNumber += 1;
  return {
    transactionId: crypto.randomUUID().replaceAll('-', ''),
    blockNumber: String(blockNumber),
    result,
  };
};

const recordLand = async (payload) => {
  if (assets.has(payload.nomor_sertifikat)) {
    throw new Error('Data aset tanah sudah ada.');
  }

  const asset = {
    nomor_sertifikat: String(payload.nomor_sertifikat),
    hash_pemilik: String(payload.hash_pemilik),
    hash_dokumen: String(payload.hash_dokumen),
    luas_tanah: String(payload.luas_tanah),
    lokasi_hash: String(payload.lokasi_hash),
    cid_ipfs: String(payload.cid_ipfs),
    status: 'ACTIVE',
    updated_at: new Date().toISOString(),
  };
  const response = submitResult(asset);
  assets.set(asset.nomor_sertifikat, asset);
  addHistory(asset.nomor_sertifikat, response.transactionId, asset);
  return response;
};

const transferOwnership = async (payload) => {
  const current = assets.get(payload.nomor_sertifikat);

  if (!current) throw new Error('Data aset tanah tidak ditemukan.');

  const asset = {
    ...current,
    hash_pemilik: String(payload.hash_pemilik_baru),
    hash_dokumen: String(payload.hash_dokumen_baru),
    cid_ipfs: String(payload.cid_ipfs_baru),
    updated_at: new Date().toISOString(),
  };
  const response = submitResult(asset);
  assets.set(asset.nomor_sertifikat, asset);
  addHistory(asset.nomor_sertifikat, response.transactionId, asset);
  return response;
};

const verifyLand = async (nomorSertifikat) => {
  const asset = assets.get(nomorSertifikat);

  if (!asset) return { nomor_sertifikat: nomorSertifikat, status: 'NOT_FOUND' };

  return {
    nomor_sertifikat: asset.nomor_sertifikat,
    hash_dokumen: asset.hash_dokumen,
    cid_ipfs: asset.cid_ipfs,
    status: asset.status,
    updated_at: asset.updated_at,
  };
};

const getLandHistory = async (nomorSertifikat) => histories.get(nomorSertifikat) || [];

const validateHash = async (payload) => {
  const asset = assets.get(payload.nomor_sertifikat);
  return {
    nomor_sertifikat: payload.nomor_sertifikat,
    valid: Boolean(asset && asset.hash_dokumen === payload.hash_dokumen),
    error: asset ? undefined : 'NOT_FOUND',
  };
};

module.exports = {
  recordLand,
  transferOwnership,
  verifyLand,
  getLandHistory,
  validateHash,
};
