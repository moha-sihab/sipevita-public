const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');
const { createLogActivity } = require('./log.service');
const blockchainService = require('./blockchain.service');
const { generatePengajuanIntegrityHashes } = require('./hash.service');
const dokumenRepository = require('../repositories/dokumen.repository');
const { checkRequiredDocuments } = require('../config/requiredDocuments');

const PENGAJUAN_FIELDS = [
  'id_pengajuan',
  'id_notaris',
  'id_reviewer',
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'nomor_akta',
  'tanggal_akta',
  'jenis_transaksi',
  'data_sertifikat',
  'status',
  'tanggal_pengajuan',
  'catatan_reviewer',
  'manifest_cid',
  'created_at',
  'updated_at',
].join(', ');

const PENGAJUAN_LIST_FIELDS = [
  'id_pengajuan',
  'id_notaris',
  'id_reviewer',
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'nomor_akta',
  'tanggal_akta',
  'jenis_transaksi',
  'status',
  'tanggal_pengajuan',
  'catatan_reviewer',
  'created_at',
  'updated_at',
].join(', ');

const USER_FIELDS = 'id_pengguna, username, nama_lengkap, peran, status_aktif';
const PIHAK_FIELDS =
  'id_pihak, id_pengajuan, peran, nama, nomor_identitas, alamat, created_at';
const DOKUMEN_FIELDS = [
  'id_dokumen',
  'id_pengajuan',
  'nama_file',
  'hash_file',
  'cid_ipfs',
  'tanggal_unggah',
  'jenis_dokumen',
  'status_upload',
  'nama_file_asli',
  'mime_type',
  'ukuran_file',
  'tanggal_upload',
  'is_active',
].join(', ');
const BLOCKCHAIN_FIELDS =
  'id_transaksi, id_pengajuan, id_blok, status_konfirmasi, hash_transaksi, timestamp_blockchain, created_at';
const ASET_FIELDS = [
  'id_aset',
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

const getUserProfiles = async (ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('pengguna')
    .select(USER_FIELDS)
    .in('id_pengguna', uniqueIds);

  ensureQuerySucceeded(error, 'Gagal mengambil profil pengguna.');
  return new Map((data || []).map((user) => [user.id_pengguna, user]));
};

const getPengajuanOrThrow = async (idPengajuan) => {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from('pengajuan')
    .select(PENGAJUAN_FIELDS)
    .eq('id_pengajuan', idPengajuan)
    .maybeSingle();

  ensureQuerySucceeded(error, 'Gagal mengambil data pengajuan.');

  if (!data) {
    throw new AppError('Pengajuan tidak ditemukan.', 404);
  }

  return data;
};

const getPengajuanList = async (filters) => {
  ensureSupabaseConfigured();

  let query = supabase
    .from('pengajuan')
    .select(PENGAJUAN_LIST_FIELDS)
    .order('tanggal_pengajuan', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.nomor_sertifikat) {
    query = query.ilike('nomor_sertifikat', `%${filters.nomor_sertifikat}%`);
  }

  if (filters.jenis_transaksi) {
    query = query.eq('jenis_transaksi', filters.jenis_transaksi);
  }

  if (filters.id_notaris) {
    query = query.eq('id_notaris', filters.id_notaris);
  }

  const { data, error } = await query;
  ensureQuerySucceeded(error, 'Gagal mengambil daftar pengajuan pemeriksa.');

  const items = data || [];
  const profiles = await getUserProfiles(items.map((item) => item.id_notaris));

  return items.map((item) => ({
    ...item,
    notaris: profiles.get(item.id_notaris) || null,
  }));
};

const claimPengajuanForReview = async (idPengajuan, reviewerId) => {
  // Attempt atomic claim: only matches when status=MENUNGGU_VERIFIKASI AND id_reviewer IS NULL.
  // Using .select().maybeSingle() so we can detect whether the row was actually updated —
  // a null return means 0 rows matched (wrong status, already claimed, or RLS block).
  const { data, error } = await supabase
    .from('pengajuan')
    .update({ id_reviewer: reviewerId, updated_at: new Date().toISOString() })
    .eq('id_pengajuan', idPengajuan)
    .eq('status', 'MENUNGGU_VERIFIKASI')
    .is('id_reviewer', null)
    .select(PENGAJUAN_FIELDS)
    .maybeSingle();

  if (error) {
    throw new AppError('Gagal mengklaim pengajuan untuk diperiksa.', 503, { code: 'CLAIM_FAILED' });
  }

  if (data) {
    return { claimed: true, pengajuan: data };
  }

  // 0 rows updated — check why
  const current = await getPengajuanOrThrow(idPengajuan);

  if (current.status !== 'MENUNGGU_VERIFIKASI') {
    throw new AppError(
      'Pengajuan belum dikirim ke antrean verifikasi ATR/BPN.',
      409,
      { code: 'PENGAJUAN_NOT_REVIEWABLE', status: current.status }
    );
  }

  if (current.id_reviewer === reviewerId) {
    return { claimed: false, alreadyOwnedByCurrentReviewer: true, pengajuan: current };
  }

  throw new AppError(
    'Pengajuan sedang ditangani pemeriksa lain.',
    409,
    { code: 'REVIEW_ALREADY_CLAIMED' }
  );
};

const getPengajuanDetail = async (idPengajuan) => {
  const pengajuan = await getPengajuanOrThrow(idPengajuan);

  const [partiesResult, documentsResult, blockchainResult, profiles] = await Promise.all([
    supabase.from('pihak_transaksi').select(PIHAK_FIELDS).eq('id_pengajuan', idPengajuan),
    supabase.from('dokumen').select(DOKUMEN_FIELDS).eq('id_pengajuan', idPengajuan),
    supabase
      .from('transaksi_blockchain')
      .select(BLOCKCHAIN_FIELDS)
      .eq('id_pengajuan', idPengajuan)
      .maybeSingle(),
    getUserProfiles([pengajuan.id_notaris, pengajuan.id_reviewer]),
  ]);

  ensureQuerySucceeded(partiesResult.error, 'Gagal mengambil data pihak transaksi.');
  ensureQuerySucceeded(documentsResult.error, 'Gagal mengambil data dokumen terkait.');
  ensureQuerySucceeded(
    blockchainResult.error,
    'Gagal mengambil referensi transaksi blockchain.'
  );

  return {
    pengajuan,
    pihak_transaksi: partiesResult.data || [],
    dokumen: documentsResult.data || [],
    transaksi_blockchain: blockchainResult.data || null,
    notaris: profiles.get(pengajuan.id_notaris) || null,
    reviewer: profiles.get(pengajuan.id_reviewer) || null,
  };
};

const updateReviewStatus = async (idPengajuan, reviewerId, status, note) => {
  const { data, error } = await supabase
    .from('pengajuan')
    .update({
      status,
      id_reviewer: reviewerId,
      catatan_reviewer: note,
    })
    .eq('id_pengajuan', idPengajuan)
    .select(PENGAJUAN_FIELDS)
    .single();

  ensureQuerySucceeded(error, 'Gagal memperbarui status pemeriksaan pengajuan.');
  return data;
};

const assertReadyForReview = (pengajuan) => {
  if (pengajuan.status !== 'MENUNGGU_VERIFIKASI') {
    throw new AppError(
      'Pengajuan belum dikirim ke antrean verifikasi ATR/BPN.',
      409,
      { code: 'PENGAJUAN_NOT_READY_FOR_REVIEW', status: pengajuan.status }
    );
  }
};

const saveBlockchainTransaction = async (idPengajuan, values) => {
  const { data, error } = await supabase
    .from('transaksi_blockchain')
    .upsert(
      {
        id_pengajuan: idPengajuan,
        ...values,
      },
      { onConflict: 'id_pengajuan' }
    )
    .select(BLOCKCHAIN_FIELDS)
    .single();

  ensureQuerySucceeded(error, 'Gagal menyimpan referensi transaksi blockchain.');
  return data;
};

const rejectPengajuan = async (idPengajuan, reviewer, note, ipAddress) => {
  const current = await getPengajuanOrThrow(idPengajuan);

  if (current.status === 'DISETUJUI') {
    throw new AppError('Pengajuan yang sudah disetujui tidak dapat ditolak.', 409);
  }

  assertReadyForReview(current);

  const pengajuan = await updateReviewStatus(
    idPengajuan,
    reviewer.id_pengguna,
    'DITOLAK',
    note
  );

  await createLogActivity({
    id_pengguna: reviewer.id_pengguna,
    jenis_aksi: 'REJECT_PENGAJUAN',
    ip_address: ipAddress,
    detail_aksi: `ATR/BPN menolak pengajuan ${idPengajuan}.`,
  });

  return { pengajuan };
};

const approvePengajuan = async (idPengajuan, reviewer, note, ipAddress) => {
  const detail = await getPengajuanDetail(idPengajuan);
  const current = detail.pengajuan;

  if (current.status === 'DISETUJUI') {
    throw new AppError('Pengajuan sudah disetujui.', 409);
  }

  assertReadyForReview(current);

  if (current.status === 'DITOLAK') {
    throw new AppError('Pengajuan yang sudah ditolak tidak dapat disetujui.', 409);
  }

  if (detail.transaksi_blockchain?.status_konfirmasi === 'PENDING') {
    throw new AppError('Transaksi blockchain untuk pengajuan ini sedang diproses.', 409);
  }

  // Phase 6: approval must use manifest_cid, not individual document CIDs
  if (!current.manifest_cid) {
    throw new AppError(
      'Manifest dokumen belum tersedia. Unggah semua dokumen terlebih dahulu sebelum persetujuan.',
      422,
      { code: 'MANIFEST_NOT_AVAILABLE' }
    );
  }

  const activeNonUploadedDocs = detail.dokumen.filter(
    (d) => d.is_active !== false && d.status_upload !== 'UPLOADED'
  );
  if (activeNonUploadedDocs.length > 0) {
    const isInProgress = activeNonUploadedDocs.some((d) => d.status_upload === 'UPLOADING');
    throw new AppError(
      isInProgress
        ? 'Unggah dokumen sedang berlangsung. Tunggu hingga selesai sebelum melakukan persetujuan.'
        : 'Seluruh dokumen aktif harus selesai diunggah sebelum persetujuan.',
      409,
      { code: isInProgress ? 'DOCUMENT_UPLOAD_IN_PROGRESS' : 'DOCUMENT_UPLOAD_INCOMPLETE' }
    );
  }

  const { ok: requiredOk, missing } = checkRequiredDocuments(
    current.jenis_transaksi,
    detail.dokumen
  );
  if (!requiredOk) {
    throw new AppError(
      `Dokumen wajib belum lengkap: ${missing.join(', ')}.`,
      422,
      { code: 'REQUIRED_DOCUMENT_MISSING', missingTypes: missing }
    );
  }

  const cidIpfs = current.manifest_cid;

  const integrityHashes = generatePengajuanIntegrityHashes(detail);
  let transaksiBlockchain = detail.transaksi_blockchain;
  const shouldSubmitBlockchain =
    !transaksiBlockchain || transaksiBlockchain.status_konfirmasi === 'GAGAL';

  if (shouldSubmitBlockchain) {
    let blockchainResult;

    // Record submission as in-progress before making the Fabric call.
    // This activates the concurrent-request guard and ensures a traceable
    // record exists even if the process is interrupted during submission.
    transaksiBlockchain = await saveBlockchainTransaction(idPengajuan, {
      id_blok: null,
      status_konfirmasi: 'PENDING',
      hash_transaksi: null,
      timestamp_blockchain: null,
    });

    try {
      // Check whether the certificate already exists on the ledger.
      // verifyLand returns { status: 'NOT_FOUND' } (no throw) for unknown keys.
      const existingAsset = await blockchainService.verifyLand(current.nomor_sertifikat);
      const certificateExists = existingAsset?.status !== 'NOT_FOUND';

      if (certificateExists) {
        blockchainResult = await blockchainService.transferOwnership({
          nomor_sertifikat: current.nomor_sertifikat,
          hash_pemilik_baru: integrityHashes.hash_pemilik,
          hash_dokumen_baru: integrityHashes.hash_dokumen,
          cid_ipfs_baru: cidIpfs,
        });
      } else {
        blockchainResult = await blockchainService.recordLand({
          nomor_sertifikat: current.nomor_sertifikat,
          hash_pemilik: integrityHashes.hash_pemilik,
          hash_dokumen: integrityHashes.hash_dokumen,
          luas_tanah: current.luas_tanah,
          lokasi_hash: integrityHashes.lokasi_hash,
          cid_ipfs: cidIpfs,
        });
      }

      if (!blockchainResult?.transactionId) {
        throw new Error('Transaksi Fabric tidak mengembalikan ID transaksi yang valid.');
      }
    } catch (error) {
      await createLogActivity({
        id_pengguna: reviewer.id_pengguna,
        jenis_aksi: 'BLOCKCHAIN_RECORD_FAILED',
        ip_address: ipAddress,
        detail_aksi: `Pencatatan blockchain gagal untuk pengajuan ${idPengajuan}.`,
      });

      try {
        transaksiBlockchain = await saveBlockchainTransaction(idPengajuan, {
          id_blok: null,
          status_konfirmasi: 'GAGAL',
          hash_transaksi: null,
          timestamp_blockchain: null,
        });
      } catch {
        // Preserve the original Fabric error if failure metadata cannot be saved.
      }

      throw error;
    }

    await createLogActivity({
      id_pengguna: reviewer.id_pengguna,
      jenis_aksi: 'BLOCKCHAIN_RECORD_SUCCESS',
      ip_address: ipAddress,
      detail_aksi: `Pencatatan blockchain berhasil untuk pengajuan ${idPengajuan}.`,
    });

    transaksiBlockchain = await saveBlockchainTransaction(idPengajuan, {
      id_blok: blockchainResult.blockNumber || null,
      status_konfirmasi: 'TERKONFIRMASI',
      hash_transaksi: blockchainResult.transactionId,
      timestamp_blockchain: new Date().toISOString(),
    });
  }

  const { data: asetTanah, error: assetError } = await supabase
    .from('aset_tanah')
    .upsert(
      {
        nomor_sertifikat: current.nomor_sertifikat,
        nib: current.nib,
        lokasi_tanah: current.lokasi_tanah,
        luas_tanah: current.luas_tanah,
        status_tanah: 'AKTIF',
        hash_pemilik_aktif: integrityHashes.hash_pemilik,
        hash_dokumen_aktif: integrityHashes.hash_dokumen,
        lokasi_hash: integrityHashes.lokasi_hash,
        cid_ipfs_aktif: cidIpfs,
        id_pengajuan_terakhir: current.id_pengajuan,
      },
      { onConflict: 'nomor_sertifikat' }
    )
    .select(ASET_FIELDS)
    .single();

  ensureQuerySucceeded(
    assetError,
    'Transaksi blockchain berhasil, tetapi data aset tanah aktif gagal disimpan.',
  );

  const pengajuan = await updateReviewStatus(
    idPengajuan,
    reviewer.id_pengguna,
    'DISETUJUI',
    note || 'Dokumen valid dan disetujui',
  );

  await createLogActivity({
    id_pengguna: reviewer.id_pengguna,
    jenis_aksi: 'APPROVE_PENGAJUAN',
    ip_address: ipAddress,
    detail_aksi: `ATR/BPN menyetujui pengajuan ${idPengajuan} dan mencatat CID manifest.`,
  });

  const lockedDocs = await dokumenRepository.lockDocumentsForApprovedPengajuan(idPengajuan);

  await createLogActivity({
    id_pengguna: reviewer.id_pengguna,
    jenis_aksi: 'DOCUMENT_LOCKED',
    ip_address: ipAddress,
    detail_aksi: `${lockedDocs.length} dokumen dikunci untuk pengajuan ${idPengajuan} yang disetujui.`,
  });

  return {
    pengajuan,
    transaksi_blockchain: transaksiBlockchain,
    aset_tanah: asetTanah,
    integrity_hashes: integrityHashes,
  };
};

module.exports = {
  getPengajuanList,
  getPengajuanDetail,
  claimPengajuanForReview,
  rejectPengajuan,
  approvePengajuan,
};
