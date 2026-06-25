const supabase = require('../config/supabase');
const AppError = require('../utils/app-error');

const DOKUMEN_FIELDS = [
  'id_dokumen',
  'id_pengajuan',
  'nama_file',
  'hash_file',
  'cid_ipfs',
  'jenis_dokumen',
  'nama_file_asli',
  'mime_type',
  'ukuran_file',
  'sha256',
  'pinata_file_id',
  'status_upload',
  'tanggal_upload',
  'diunggah_oleh',
  'is_active',
].join(', ');

const ensureSupabase = () => {
  if (!supabase) throw new AppError('Layanan basis data belum dikonfigurasi.', 503);
};

const ensureOk = (error, message) => {
  if (error) throw new AppError(message, 503);
};

const getDocumentByIdAndPengajuanId = async (idDokumen, idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .select(DOKUMEN_FIELDS)
    .eq('id_dokumen', idDokumen)
    .eq('id_pengajuan', idPengajuan)
    .eq('is_active', true)
    .maybeSingle();
  ensureOk(error, 'Gagal mengambil data dokumen.');
  return data;
};

const getDocumentsByIds = async (idDokumenList, idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .select(DOKUMEN_FIELDS)
    .in('id_dokumen', idDokumenList)
    .eq('id_pengajuan', idPengajuan)
    .eq('is_active', true);
  ensureOk(error, 'Gagal mengambil data dokumen.');
  return data || [];
};

const getDocumentsByPengajuanId = async (idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .select(DOKUMEN_FIELDS)
    .eq('id_pengajuan', idPengajuan)
    .eq('is_active', true)
    .order('jenis_dokumen', { ascending: true });
  ensureOk(error, 'Gagal mengambil data dokumen.');
  return data || [];
};

const getActiveUploadedDocuments = async (idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .select(DOKUMEN_FIELDS)
    .eq('id_pengajuan', idPengajuan)
    .eq('is_active', true)
    .eq('status_upload', 'UPLOADED')
    .order('jenis_dokumen', { ascending: true })
    .order('id_dokumen', { ascending: true });
  ensureOk(error, 'Gagal mengambil data dokumen yang sudah diunggah.');
  return data || [];
};

const markDocumentUploading = async (idDokumen) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .update({ status_upload: 'UPLOADING', updated_at: new Date().toISOString() })
    .eq('id_dokumen', idDokumen)
    .select(DOKUMEN_FIELDS)
    .single();
  ensureOk(error, 'Gagal memperbarui status dokumen.');
  return data;
};

const markDocumentUploaded = async (idDokumen, meta) => {
  ensureSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('dokumen')
    .update({
      cid_ipfs: meta.cid,
      sha256: meta.sha256,
      pinata_file_id: meta.pinataFileId,
      mime_type: meta.mimeType,
      ukuran_file: meta.size,
      nama_file_asli: meta.namaFileAsli,
      jenis_dokumen: meta.jenisDokumen,
      status_upload: 'UPLOADED',
      tanggal_upload: now,
      diunggah_oleh: meta.uploadedBy,
      updated_at: now,
    })
    .eq('id_dokumen', idDokumen)
    .select(DOKUMEN_FIELDS)
    .single();
  ensureOk(error, 'Gagal memperbarui metadata dokumen.');
  return data;
};

const markDocumentFailed = async (idDokumen, errorCode) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .update({
      status_upload: 'FAILED',
      updated_at: new Date().toISOString(),
    })
    .eq('id_dokumen', idDokumen)
    .select(DOKUMEN_FIELDS)
    .single();
  ensureOk(error, 'Gagal menandai dokumen sebagai gagal.');
  return data;
};

const updatePengajuanManifestCid = async (idPengajuan, manifestCid) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('pengajuan')
    .update({ manifest_cid: manifestCid, updated_at: new Date().toISOString() })
    .eq('id_pengajuan', idPengajuan)
    .select('id_pengajuan, manifest_cid')
    .single();
  ensureOk(error, 'Gagal memperbarui CID manifest pada pengajuan.');
  return data;
};


const lockDocumentsForApprovedPengajuan = async (idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('dokumen')
    .update({ updated_at: new Date().toISOString() })
    .eq('id_pengajuan', idPengajuan)
    .eq('is_active', true)
    .eq('status_upload', 'UPLOADED')
    .select('id_dokumen');
  ensureOk(error, 'Gagal mencatat waktu audit dokumen yang dikunci.');
  return data || [];
};

const getPengajuanById = async (idPengajuan) => {
  ensureSupabase();
  const { data, error } = await supabase
    .from('pengajuan')
    .select('id_pengajuan, id_notaris, id_reviewer, status, manifest_cid')
    .eq('id_pengajuan', idPengajuan)
    .maybeSingle();
  ensureOk(error, 'Gagal mengambil data pengajuan.');
  return data;
};

module.exports = {
  getDocumentByIdAndPengajuanId,
  getDocumentsByIds,
  getDocumentsByPengajuanId,
  getActiveUploadedDocuments,
  markDocumentUploading,
  markDocumentUploaded,
  markDocumentFailed,
  updatePengajuanManifestCid,
  lockDocumentsForApprovedPengajuan,
  getPengajuanById,
};
