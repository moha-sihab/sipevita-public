const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');
const blockchainService = require('./blockchain.service');

const ASSET_FIELDS = [
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'status_tanah',
  'hash_pemilik_aktif',
  'hash_dokumen_aktif',
  'lokasi_hash',
  'cid_ipfs_aktif',
  'id_pengajuan_terakhir',
  'created_at',
  'updated_at',
].join(', ');

const PENGAJUAN_FIELDS = [
  'id_pengajuan',
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'jenis_transaksi',
  'status',
  'tanggal_pengajuan',
  'created_at',
  'updated_at',
].join(', ');

const TRANSACTION_FIELDS =
  'id_pengajuan, hash_transaksi, id_blok, timestamp_blockchain';
const PARTY_FIELDS =
  'id_pengajuan, peran, nama, nomor_identitas, alamat, created_at';

const ensureSupabaseConfigured = () => {
  if (!supabase) {
    throw new AppError('Layanan basis data belum dikonfigurasi.', 503);
  }
};

const ensureQuerySucceeded = (error, message) => {
  if (error) {
    throw new AppError(message, 503);
  }
};

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const getTimestampMs = (item) => {
  const timestamp = typeof item?.timestamp === 'string' ? Date.parse(item.timestamp) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
};

const normalizeFabricHistory = (history) => {
  if (!Array.isArray(history)) {
    throw new AppError('Respons riwayat blockchain tidak valid.', 502, {
      code: 'BLOCKCHAIN_HISTORY_INVALID_JSON',
    });
  }

  return [...history].sort((a, b) => getTimestampMs(a) - getTimestampMs(b));
};

const getTransactionId = (item) =>
  item?.txId || item?.tx_id || item?.transaction_id || item?.hash_transaksi;

const getOwnerParty = (parties = []) =>
  parties.find((party) => party.peran === 'PEMILIK_BARU') ||
  parties.find((party) => party.peran === 'PEMILIK_LAMA') ||
  null;

const getCertificateAsset = async (nomorSertifikat) => {
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from('aset_tanah')
    .select(ASSET_FIELDS)
    .eq('nomor_sertifikat', nomorSertifikat)
    .maybeSingle();

  ensureQuerySucceeded(error, 'Gagal mengambil data aset sertifikat.');
  return data;
};

const getSubmissionMetadata = async (nomorSertifikat, txIds, includeOwner) => {
  ensureSupabaseConfigured();

  let byTxId = new Map();

  if (txIds.length > 0) {
    const { data: transactions, error: transactionError } = await supabase
      .from('transaksi_blockchain')
      .select(TRANSACTION_FIELDS)
      .in('hash_transaksi', txIds);

    ensureQuerySucceeded(transactionError, 'Gagal mengambil metadata transaksi blockchain.');

    const idPengajuanList = [
      ...new Set((transactions || []).map((item) => item.id_pengajuan).filter(Boolean)),
    ];

    let submissionsById = new Map();
    if (idPengajuanList.length > 0) {
      const { data: submissions, error: submissionError } = await supabase
        .from('pengajuan')
        .select(PENGAJUAN_FIELDS)
        .in('id_pengajuan', idPengajuanList)
        .eq('nomor_sertifikat', nomorSertifikat);

      ensureQuerySucceeded(submissionError, 'Gagal mengambil metadata pengajuan sertifikat.');
      submissionsById = new Map((submissions || []).map((item) => [item.id_pengajuan, item]));
    }

    let partiesByPengajuanId = new Map();
    if (includeOwner && idPengajuanList.length > 0) {
      const { data: parties, error: partyError } = await supabase
        .from('pihak_transaksi')
        .select(PARTY_FIELDS)
        .in('id_pengajuan', idPengajuanList);

      ensureQuerySucceeded(partyError, 'Gagal mengambil metadata pemilik sertifikat.');
      partiesByPengajuanId = (parties || []).reduce((map, party) => {
        const list = map.get(party.id_pengajuan) || [];
        list.push(party);
        map.set(party.id_pengajuan, list);
        return map;
      }, new Map());
    }

    for (const transaction of transactions || []) {
      const submission = submissionsById.get(transaction.id_pengajuan);
      if (!submission) continue;

      byTxId.set(transaction.hash_transaksi, {
        transaction,
        submission,
        parties: partiesByPengajuanId.get(transaction.id_pengajuan) || [],
      });
    }
  }

  const byIndex = await getChronologicalSubmissionMetadata(nomorSertifikat, includeOwner);
  return { byTxId, byIndex };
};

const getChronologicalSubmissionMetadata = async (nomorSertifikat, includeOwner) => {
  const { data: submissions, error: submissionError } = await supabase
    .from('pengajuan')
    .select(PENGAJUAN_FIELDS)
    .eq('nomor_sertifikat', nomorSertifikat)
    .eq('status', 'DISETUJUI')
    .order('tanggal_pengajuan', { ascending: true });

  ensureQuerySucceeded(submissionError, 'Gagal mengambil metadata pengajuan sertifikat.');

  const idPengajuanList = (submissions || []).map((item) => item.id_pengajuan).filter(Boolean);
  if (idPengajuanList.length === 0) return [];

  const { data: transactions, error: transactionError } = await supabase
    .from('transaksi_blockchain')
    .select(TRANSACTION_FIELDS)
    .in('id_pengajuan', idPengajuanList);

  ensureQuerySucceeded(transactionError, 'Gagal mengambil metadata transaksi blockchain.');

  const transactionByPengajuanId = new Map(
    (transactions || []).map((item) => [item.id_pengajuan, item]),
  );

  let partiesByPengajuanId = new Map();
  if (includeOwner) {
    const { data: parties, error: partyError } = await supabase
      .from('pihak_transaksi')
      .select(PARTY_FIELDS)
      .in('id_pengajuan', idPengajuanList);

    ensureQuerySucceeded(partyError, 'Gagal mengambil metadata pemilik sertifikat.');
    partiesByPengajuanId = (parties || []).reduce((map, party) => {
      const list = map.get(party.id_pengajuan) || [];
      list.push(party);
      map.set(party.id_pengajuan, list);
      return map;
    }, new Map());
  }

  return (submissions || []).map((submission) => ({
    submission,
    transaction: transactionByPengajuanId.get(submission.id_pengajuan) || {},
    parties: partiesByPengajuanId.get(submission.id_pengajuan) || [],
  }));
};

const buildPublicValue = (ledgerValue, submission, asset) => ({
  nomor_sertifikat:
    submission?.nomor_sertifikat || ledgerValue.nomor_sertifikat || asset?.nomor_sertifikat,
  nib: submission?.nib || asset?.nib,
  lokasi_tanah: submission?.lokasi_tanah || asset?.lokasi_tanah,
  luas_tanah: submission?.luas_tanah || ledgerValue.luas_tanah || asset?.luas_tanah,
  status: ledgerValue.status || asset?.status_tanah,
  jenis_transaksi: submission?.jenis_transaksi,
  created_at: ledgerValue.created_at || submission?.tanggal_pengajuan || asset?.created_at,
  updated_at: ledgerValue.updated_at || submission?.updated_at || asset?.updated_at,
});

const buildPrivateValue = (ledgerValue, submission, parties, asset) => {
  const owner = getOwnerParty(parties);

  return {
    ...ledgerValue,
    nib: submission?.nib || asset?.nib,
    lokasi_tanah: submission?.lokasi_tanah || asset?.lokasi_tanah,
    luas_tanah: submission?.luas_tanah || ledgerValue.luas_tanah || asset?.luas_tanah,
    jenis_transaksi: submission?.jenis_transaksi,
    status_pengajuan: submission?.status,
    tanggal_pengajuan: submission?.tanggal_pengajuan,
    nama_pemilik: owner?.nama || null,
    peran_pemilik: owner?.peran || null,
  };
};

const enrichHistoryItem = (item, metadataByTxId, metadataByIndex, index, asset, includePrivateFields) => {
  const txId = getTransactionId(item);
  const metadata = metadataByTxId.get(txId) || metadataByIndex[index] || {};
  const ledgerValue = asObject(item.value);
  const value = includePrivateFields
    ? buildPrivateValue(ledgerValue, metadata.submission, metadata.parties || [], asset)
    : buildPublicValue(ledgerValue, metadata.submission, asset);
  const transaction = metadata.transaction || {};

  return {
    ...item,
    txId,
    tx_id: item.tx_id || txId,
    transaction_id: item.transaction_id || txId,
    hash_transaksi: transaction.hash_transaksi || txId || null,
    id_blok: transaction.id_blok || item.id_blok || null,
    block_number: item.block_number ?? transaction.id_blok ?? null,
    timestamp_blockchain: transaction.timestamp_blockchain || item.timestamp || null,
    tanggal_pengajuan: metadata.submission?.tanggal_pengajuan || null,
    jenis_transaksi: metadata.submission?.jenis_transaksi || null,
    value,
  };
};

const getCertificateHistory = async (nomorSertifikat, options = {}) => {
  const includePrivateFields = options.includePrivateFields === true;
  const rawHistory = await blockchainService.getLandHistory(nomorSertifikat);
  const history = normalizeFabricHistory(rawHistory);
  const txIds = history.map(getTransactionId).filter(Boolean);
  const [asset, metadata] = await Promise.all([
    getCertificateAsset(nomorSertifikat),
    getSubmissionMetadata(nomorSertifikat, txIds, includePrivateFields),
  ]);
  const items = history.map((item, index) =>
    enrichHistoryItem(
      item,
      metadata.byTxId,
      metadata.byIndex,
      index,
      asset,
      includePrivateFields,
    ),
  );

  return {
    nomor_sertifikat: nomorSertifikat,
    total: items.length,
    history: items,
    items,
    count: items.length,
  };
};

module.exports = {
  getCertificateHistory,
  normalizeFabricHistory,
};
