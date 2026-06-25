const env = require('../config/env');
const AppError = require('../utils/app-error');

const adapters = {
  fabric: () => require('./blockchain.fabric.service'),
  mock: () => require('./blockchain.mock.service'),
};

const getAdapter = () => {
  const loadAdapter = adapters[env.blockchainMode];

  if (!loadAdapter) {
    throw new AppError('Mode blockchain tidak valid.', 503, {
      message: 'BLOCKCHAIN_MODE harus bernilai fabric atau mock.',
    });
  }

  return loadAdapter();
};

const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new AppError('Data transaksi blockchain tidak valid.', 422, {
      message: `Field wajib belum diisi: ${missing.join(', ')}.`,
    });
  }
};

const callAdapter = async (method, ...args) => {
  try {
    return await getAdapter()[method](...args);
  } catch (error) {
    if (error instanceof AppError) throw error;

    const safePrefixes = [
      'Konfigurasi Fabric belum lengkap:',
      'Path connection profile Fabric tidak ditemukan.',
      'Path wallet Fabric tidak ditemukan.',
    ];
    const safeMessage = safePrefixes.some((prefix) => error.message?.startsWith(prefix))
      ? error.message
      : 'Operasi Fabric gagal.';

    throw new AppError('Transaksi blockchain gagal diproses. Silakan coba kembali.', 503, {
      message: safeMessage,
    });
  }
};

module.exports = {
  recordLand: (payload) => {
    requireFields(payload, [
      'nomor_sertifikat',
      'hash_pemilik',
      'hash_dokumen',
      'luas_tanah',
      'lokasi_hash',
      'cid_ipfs',
    ]);
    return callAdapter('recordLand', payload);
  },
  transferOwnership: (payload) => {
    requireFields(payload, [
      'nomor_sertifikat',
      'hash_pemilik_baru',
      'hash_dokumen_baru',
      'cid_ipfs_baru',
    ]);
    return callAdapter('transferOwnership', payload);
  },
  verifyLand: (nomorSertifikat) => {
    requireFields({ nomor_sertifikat: nomorSertifikat }, ['nomor_sertifikat']);
    return callAdapter('verifyLand', nomorSertifikat);
  },
  getLandHistory: (nomorSertifikat) => {
    requireFields({ nomor_sertifikat: nomorSertifikat }, ['nomor_sertifikat']);
    return callAdapter('getLandHistory', nomorSertifikat);
  },
  validateHash: (payload) => {
    requireFields(payload, ['nomor_sertifikat', 'hash_dokumen']);
    return callAdapter('validateHash', payload);
  },
};
