const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');
const blockchainService = require('./blockchain.service');
const certificateHistoryService = require('./certificate-history.service');
const { createLogActivity } = require('./log.service');

const ASSET_FIELDS = [
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'status_tanah',
  'hash_dokumen_aktif',
  'id_pengajuan_terakhir',
  'updated_at',
].join(', ');

const ensureSupabaseConfigured = () => {
  if (!supabase) {
    throw new AppError('Layanan verifikasi publik sementara tidak tersedia.', 503);
  }
};

const ensureQuerySucceeded = (error, message) => {
  if (error) {
    throw new AppError(message, 503);
  }
};

const createPublicLog = (jenisAksi, nomorSertifikat, ipAddress) =>
  createLogActivity({
    id_pengguna: null,
    jenis_aksi: jenisAksi,
    ip_address: ipAddress,
    detail_aksi: `Permintaan publik untuk nomor sertifikat ${nomorSertifikat}.`,
  });

const getBlockchainVerification = async (asset) => {
  try {
    const result = await blockchainService.verifyLand(asset.nomor_sertifikat);

    if (!result || result.status === 'NOT_FOUND') {
      return {
        statusVerifikasi: 'TIDAK_VALID',
        blockchainVerification: {
          status: 'NOT_FOUND',
          source: 'Hyperledger Fabric',
        },
      };
    }

    const matched =
      result.nomor_sertifikat === asset.nomor_sertifikat &&
      result.hash_dokumen === asset.hash_dokumen_aktif;

    return {
      statusVerifikasi: matched ? 'VALID' : 'TIDAK_VALID',
      blockchainVerification: {
        status: matched ? 'MATCHED' : 'MISMATCH',
        source: 'Hyperledger Fabric',
      },
    };
  } catch {
    return {
      statusVerifikasi: 'VALID_OFFCHAIN',
      blockchainVerification: {
        status: 'UNAVAILABLE',
        message: 'Verifikasi blockchain sementara tidak tersedia.',
      },
    };
  }
};

const getLatestTransactionType = async (idPengajuan) => {
  if (!idPengajuan) return null;

  const { data, error } = await supabase
    .from('pengajuan')
    .select('jenis_transaksi')
    .eq('id_pengajuan', idPengajuan)
    .eq('status', 'DISETUJUI')
    .maybeSingle();

  ensureQuerySucceeded(error, 'Layanan verifikasi publik sementara tidak tersedia');
  return data?.jenis_transaksi || null;
};

const verifyCertificate = async (nomorSertifikat, ipAddress) => {
  ensureSupabaseConfigured();

  const { data: asset, error } = await supabase
    .from('aset_tanah')
    .select(ASSET_FIELDS)
    .eq('nomor_sertifikat', nomorSertifikat)
    .maybeSingle();

  ensureQuerySucceeded(error, 'Layanan verifikasi publik sementara tidak tersedia');
  await createPublicLog('PUBLIC_VERIFY_CERTIFICATE', nomorSertifikat, ipAddress);

  if (!asset) {
    return {
      message: 'Data sertifikat tidak ditemukan.',
      data: {
        nomor_sertifikat: nomorSertifikat,
        status_verifikasi: 'TIDAK_DITEMUKAN',
      },
    };
  }

  const [verification, latestTransactionType] = await Promise.all([
    getBlockchainVerification(asset),
    getLatestTransactionType(asset.id_pengajuan_terakhir),
  ]);
  const message =
    verification.blockchainVerification.status === 'UNAVAILABLE'
      ? 'Data sertifikat ditemukan, tetapi verifikasi blockchain sementara tidak tersedia.'
      : 'Data sertifikat ditemukan.';

  return {
    message,
    data: {
      nomor_sertifikat: asset.nomor_sertifikat,
      nib: asset.nib,
      lokasi_tanah: asset.lokasi_tanah,
      luas_tanah: asset.luas_tanah,
      status_tanah: asset.status_tanah,
      jenis_transaksi_terakhir: latestTransactionType,
      status_verifikasi: verification.statusVerifikasi,
      blockchain_verification: verification.blockchainVerification,
      updated_at: asset.updated_at,
    },
  };
};

const getCertificateHistory = async (nomorSertifikat, ipAddress) => {
  const result = await certificateHistoryService.getCertificateHistory(nomorSertifikat, {
    includePrivateFields: false,
  });

  await createPublicLog('PUBLIC_VIEW_HISTORY', nomorSertifikat, ipAddress);

  return result;
};

module.exports = {
  verifyCertificate,
  getCertificateHistory,
};
