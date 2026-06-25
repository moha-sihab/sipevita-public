const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');
const {
  REQUIRED_DOCUMENT_TYPES,
  checkRequiredDocuments,
} = require('../config/requiredDocuments');
const { createLogActivity } = require('./log.service');

const PENGAJUAN_DETAIL_FIELDS = [
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
  'manifest_cid',
  'tanggal_pengajuan',
  'catatan_reviewer',
  'created_at',
  'updated_at',
].join(', ');

const PENGAJUAN_LIST_FIELDS = [
  'id_pengajuan',
  'nomor_sertifikat',
  'nib',
  'lokasi_tanah',
  'luas_tanah',
  'nomor_akta',
  'tanggal_akta',
  'jenis_transaksi',
  'status',
  'manifest_cid',
  'tanggal_pengajuan',
  'catatan_reviewer',
  'created_at',
  'updated_at',
].join(', ');

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
const EDITABLE_STATUSES = new Set(['MENUNGGU_VERIFIKASI', 'DIAJUKAN', 'DITOLAK']);

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

const createPengajuan = async (payload, currentUser, ipAddress) => {
  ensureSupabaseConfigured();

  const tanggalPengajuan = new Date().toISOString();
  const { pihak_transaksi: parties } = payload;
  const requiredDocumentTypes = REQUIRED_DOCUMENT_TYPES[payload.jenis_transaksi] || [];

  const { data: pengajuan, error: pengajuanError } = await supabase
    .from('pengajuan')
    .insert({
      id_notaris: currentUser.id_pengguna,
      id_reviewer: null,
      nomor_sertifikat: payload.nomor_sertifikat.trim(),
      nib: payload.nib || null,
      lokasi_tanah: payload.lokasi_tanah || null,
      luas_tanah: payload.luas_tanah ?? null,
      nomor_akta: payload.nomor_akta || null,
      tanggal_akta: payload.tanggal_akta || null,
      jenis_transaksi: payload.jenis_transaksi,
      data_sertifikat: payload.data_sertifikat || null,
      status: 'DIAJUKAN',
      tanggal_pengajuan: tanggalPengajuan,
      catatan_reviewer: null,
    })
    .select(PENGAJUAN_DETAIL_FIELDS)
    .single();

  ensureQuerySucceeded(pengajuanError, 'Gagal membuat pengajuan.');

  const { data: createdParties, error: partiesError } = await supabase
    .from('pihak_transaksi')
    .insert(
      parties.map((party) => ({
        id_pengajuan: pengajuan.id_pengajuan,
        peran: party.peran,
        nama: party.nama.trim(),
        nomor_identitas: party.nomor_identitas || null,
        alamat: party.alamat || null,
      }))
    )
    .select(PIHAK_FIELDS);

  ensureQuerySucceeded(partiesError, 'Pengajuan berhasil dibuat, tetapi data pihak transaksi gagal disimpan.');

  const { data: createdDocuments, error: documentsError } = await supabase
    .from('dokumen')
    .insert(
      requiredDocumentTypes.map((jenisDokumen) => ({
        id_pengajuan: pengajuan.id_pengajuan,
        nama_file: jenisDokumen,
        hash_file: 'PENDING_UPLOAD',
        cid_ipfs: null,
        jenis_dokumen: jenisDokumen,
        status_upload: 'PENDING',
      }))
    )
    .select(DOKUMEN_FIELDS);

  ensureQuerySucceeded(documentsError, 'Pengajuan berhasil dibuat, tetapi data dokumen terkait gagal disimpan.');

  await createLogActivity({
    id_pengguna: currentUser.id_pengguna,
    jenis_aksi: 'CREATE_PENGAJUAN',
    ip_address: ipAddress,
    detail_aksi: `PPAT membuat pengajuan untuk nomor sertifikat ${pengajuan.nomor_sertifikat}.`,
  });

  return {
    pengajuan,
    pihak_transaksi: createdParties,
    dokumen: createdDocuments,
    documents: (createdDocuments || []).map((document) => ({
      idDokumen: document.id_dokumen,
      idPengajuan: document.id_pengajuan,
      jenisDokumen: document.jenis_dokumen,
      statusUpload: document.status_upload,
      namaFileAsli: document.nama_file_asli,
      mimeType: document.mime_type,
      ukuranFile: document.ukuran_file,
    })),
  };
};

const getPengajuanList = async (idNotaris, filters) => {
  ensureSupabaseConfigured();

  let query = supabase
    .from('pengajuan')
    .select(PENGAJUAN_LIST_FIELDS)
    .eq('id_notaris', idNotaris)
    .order('tanggal_pengajuan', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.nomor_sertifikat) {
    query = query.ilike('nomor_sertifikat', `%${filters.nomor_sertifikat}%`);
  }

  const { data, error } = await query;
  ensureQuerySucceeded(error, 'Gagal mengambil daftar pengajuan.');

  return data || [];
};

const getPengajuanDetail = async (idPengajuan, idNotaris) => {
  ensureSupabaseConfigured();

  const { data: pengajuan, error: pengajuanError } = await supabase
    .from('pengajuan')
    .select(PENGAJUAN_DETAIL_FIELDS)
    .eq('id_pengajuan', idPengajuan)
    .eq('id_notaris', idNotaris)
    .maybeSingle();

  ensureQuerySucceeded(pengajuanError, 'Gagal mengambil detail pengajuan.');

  if (!pengajuan) {
    throw new AppError('Pengajuan tidak ditemukan.', 404);
  }

  const [partiesResult, documentsResult, blockchainResult] = await Promise.all([
    supabase.from('pihak_transaksi').select(PIHAK_FIELDS).eq('id_pengajuan', idPengajuan),
    supabase.from('dokumen').select(DOKUMEN_FIELDS).eq('id_pengajuan', idPengajuan),
    supabase
      .from('transaksi_blockchain')
      .select(BLOCKCHAIN_FIELDS)
      .eq('id_pengajuan', idPengajuan)
      .maybeSingle(),
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
  };
};

const submitPengajuan = async (idPengajuan, currentUser, ipAddress) => {
  ensureSupabaseConfigured();

  const { data: pengajuan, error: pengajuanError } = await supabase
    .from('pengajuan')
    .select(PENGAJUAN_DETAIL_FIELDS)
    .eq('id_pengajuan', idPengajuan)
    .eq('id_notaris', currentUser.id_pengguna)
    .maybeSingle();

  ensureQuerySucceeded(pengajuanError, 'Gagal mengambil detail pengajuan.');

  if (!pengajuan) {
    throw new AppError('Pengajuan tidak ditemukan.', 404);
  }

  if (!EDITABLE_STATUSES.has(pengajuan.status)) {
    throw new AppError(
      `Pengajuan berstatus "${pengajuan.status}" dan tidak dapat dikirim.`,
      409,
      { code: 'PENGAJUAN_NOT_EDITABLE', status: pengajuan.status }
    );
  }

  const { data: documents, error: documentsError } = await supabase
    .from('dokumen')
    .select(DOKUMEN_FIELDS)
    .eq('id_pengajuan', idPengajuan);

  ensureQuerySucceeded(documentsError, 'Gagal mengambil data dokumen terkait.');

  const activeDocuments = (documents || []).filter((document) => document.is_active !== false);
  const nonUploaded = activeDocuments.filter(
    (document) => document.status_upload !== 'UPLOADED' || !document.cid_ipfs
  );

  if (nonUploaded.length > 0) {
    throw new AppError(
      'Seluruh dokumen wajib harus selesai diunggah sebelum pengajuan dikirim.',
      409,
      {
        code: 'DOCUMENT_UPLOAD_INCOMPLETE',
        pendingDocuments: nonUploaded.map((document) => ({
          idDokumen: document.id_dokumen,
          jenisDokumen: document.jenis_dokumen,
          statusUpload: document.status_upload,
        })),
      }
    );
  }

  const requiredCheck = checkRequiredDocuments(pengajuan.jenis_transaksi, activeDocuments);
  if (!requiredCheck.ok) {
    throw new AppError(
      'Dokumen wajib belum lengkap.',
      422,
      { code: 'REQUIRED_DOCUMENT_MISSING', missingTypes: requiredCheck.missing }
    );
  }

  if (!pengajuan.manifest_cid) {
    throw new AppError(
      'Manifest dokumen belum tersedia. Unggah semua dokumen terlebih dahulu.',
      422,
      { code: 'MANIFEST_NOT_AVAILABLE' }
    );
  }

  const { data: submitted, error: submitError } = await supabase
    .from('pengajuan')
    .update({ status: 'MENUNGGU_VERIFIKASI', updated_at: new Date().toISOString() })
    .eq('id_pengajuan', idPengajuan)
    .eq('id_notaris', currentUser.id_pengguna)
    .select(PENGAJUAN_DETAIL_FIELDS)
    .single();

  ensureQuerySucceeded(submitError, 'Gagal mengirim pengajuan.');

  await createLogActivity({
    id_pengguna: currentUser.id_pengguna,
    jenis_aksi: 'SUBMIT_PENGAJUAN',
    ip_address: ipAddress,
    detail_aksi: `PPAT mengirim pengajuan ${idPengajuan} untuk verifikasi.`,
  });

  return {
    pengajuan: submitted,
    dokumen: activeDocuments,
  };
};

module.exports = {
  createPengajuan,
  getPengajuanList,
  getPengajuanDetail,
  submitPengajuan,
};
