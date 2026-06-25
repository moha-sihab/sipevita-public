const { calculateSha256 } = require('../utils/checksum');
const { sanitizeFilename, validateFiles, validateDocumentMetadata } = require('../utils/fileValidator');
const { uploadPrivateFile, uploadPrivateJsonManifest } = require('./pinata.service');
const {
  getPengajuanById,
  getDocumentsByIds,
  markDocumentUploading,
  markDocumentUploaded,
  markDocumentFailed,
  getActiveUploadedDocuments,
  updatePengajuanManifestCid,
} = require('../repositories/dokumen.repository');
const { buildManifest } = require('../utils/manifestBuilder');
const { createLogActivity } = require('./log.service');
const AppError = require('../utils/app-error');

const EDITABLE_STATUSES = new Set(['MENUNGGU_VERIFIKASI', 'DIAJUKAN', 'DITOLAK']);

const assertEditablePengajuan = (pengajuan, idNotaris) => {
  if (!pengajuan) {
    throw new AppError('Pengajuan tidak ditemukan.', 404, { code: 'PENGAJUAN_NOT_FOUND' });
  }
  if (pengajuan.id_notaris !== idNotaris) {
    throw new AppError(
      'Anda tidak memiliki akses ke pengajuan ini.',
      403,
      { code: 'DOCUMENT_ACCESS_FORBIDDEN' }
    );
  }
  if (!EDITABLE_STATUSES.has(pengajuan.status)) {
    throw new AppError(
      `Pengajuan berstatus "${pengajuan.status}" dan tidak dapat dimodifikasi.`,
      409,
      { code: 'PENGAJUAN_NOT_EDITABLE', status: pengajuan.status }
    );
  }
};

/**
 * Full upload flow:
 *  1. Validate pengajuan ownership and editable status.
 *  2. Validate files (count, size, MIME).
 *  3. Validate documentMetadata (idDokumen + jenisDokumen per file).
 *  4. Verify every idDokumen belongs to this pengajuan.
 *  5. For each file: mark UPLOADING → compute SHA-256 → upload private → mark UPLOADED.
 *  6. Query all UPLOADED docs → build manifest → upload manifest → save manifest_cid.
 *
 * Files are uploaded sequentially to avoid Pinata rate limits.
 * Temp buffers live only in memory (multer memoryStorage); no disk cleanup needed.
 */
const uploadDocuments = async ({ idPengajuan, files, documentMetadata, userId, ipAddress }) => {
  // ── 1. Pengajuan checks ──────────────────────────────────────────────────
  const pengajuan = await getPengajuanById(idPengajuan);
  assertEditablePengajuan(pengajuan, userId);

  // ── 2. File validation ───────────────────────────────────────────────────
  validateFiles(files);

  // ── 3. Metadata validation ───────────────────────────────────────────────
  validateDocumentMetadata(files, documentMetadata);

  // ── 4. Ownership of each idDokumen ───────────────────────────────────────
  const requestedIds = documentMetadata.map((m) => m.idDokumen.trim());
  const dbDocs = await getDocumentsByIds(requestedIds, idPengajuan);

  if (dbDocs.length !== requestedIds.length) {
    const foundIds = new Set(dbDocs.map((d) => String(d.id_dokumen)));
    const missing = requestedIds.filter((id) => !foundIds.has(id));
    throw new AppError(
      'Satu atau lebih dokumen tidak ditemukan pada pengajuan ini.',
      404,
      { code: 'DOCUMENT_NOT_FOUND', missing }
    );
  }

  // Build a lookup map: idDokumen → metadata entry
  const metaByDocId = new Map(documentMetadata.map((m) => [m.idDokumen.trim(), m]));

  await createLogActivity({
    id_pengguna: userId,
    jenis_aksi: 'DOCUMENT_UPLOAD_STARTED',
    ip_address: ipAddress,
    detail_aksi: `Unggah dokumen dimulai untuk pengajuan ${idPengajuan}, ${files.length} file.`,
  });

  // ── 5. Upload each file sequentially ─────────────────────────────────────
  const uploadResults = [];
  const failedIds = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = metaByDocId.get(requestedIds[i]);
    const idDokumen = meta.idDokumen.trim();
    const jenisDokumen = meta.jenisDokumen.trim();
    const safeName = sanitizeFilename(file.originalname);

    await markDocumentUploading(idDokumen);

    let pinataResult;
    try {
      const sha256 = calculateSha256(file.buffer);

      pinataResult = await uploadPrivateFile(file.buffer, safeName, file.mimetype, {
        id_pengajuan: String(idPengajuan),
        id_dokumen: String(idDokumen),
        jenis_dokumen: jenisDokumen,
        uploaded_by: String(userId),
      });

      const updated = await markDocumentUploaded(idDokumen, {
        cid: pinataResult.cid,
        sha256,
        pinataFileId: pinataResult.pinataFileId,
        mimeType: file.mimetype,
        size: file.size,
        namaFileAsli: file.originalname,
        jenisDokumen,
        uploadedBy: userId,
      });

      uploadResults.push({
        idDokumen,
        jenisDokumen,
        namaFile: file.originalname,
        mimeType: file.mimetype,
        ukuranFile: file.size,
        cid: pinataResult.cid,
        sha256,
        statusUpload: 'UPLOADED',
      });

      await createLogActivity({
        id_pengguna: userId,
        jenis_aksi: 'DOCUMENT_UPLOAD_SUCCEEDED',
        ip_address: ipAddress,
        detail_aksi: `Dokumen ${idDokumen} berhasil diunggah untuk pengajuan ${idPengajuan}.`,
      });

      void updated;
    } catch (err) {
      failedIds.push(idDokumen);
      await markDocumentFailed(idDokumen, err?.details?.code || 'PINATA_PRIVATE_UPLOAD_FAILED').catch(() => {});

      await createLogActivity({
        id_pengguna: userId,
        jenis_aksi: 'DOCUMENT_UPLOAD_FAILED',
        ip_address: ipAddress,
        detail_aksi: `Unggah dokumen ${idDokumen} gagal untuk pengajuan ${idPengajuan}: ${err?.details?.code || 'UNKNOWN'}.`,
      });

      throw new AppError(
        err.name === 'AppError' ? err.message : 'Gagal mengunggah dokumen ke Pinata.',
        err.statusCode || 502,
        { code: err?.details?.code || 'PINATA_PRIVATE_UPLOAD_FAILED', idDokumen, failedIds }
      );
    }
  }

  // ── 6. Build and upload manifest ─────────────────────────────────────────
  const allUploaded = await getActiveUploadedDocuments(idPengajuan);
  let manifestCid;

  try {
    const manifest = buildManifest(idPengajuan, allUploaded);

    const manifestResult = await uploadPrivateJsonManifest(manifest, {
      id_pengajuan: String(idPengajuan),
    });

    manifestCid = manifestResult.cid;

    await updatePengajuanManifestCid(idPengajuan, manifestCid);

    await createLogActivity({
      id_pengguna: userId,
      jenis_aksi: 'DOCUMENT_MANIFEST_CREATED',
      ip_address: ipAddress,
      detail_aksi: `Manifest dibuat untuk pengajuan ${idPengajuan} dan CID berhasil disimpan.`,
    });
  } catch (err) {
    // manifest_cid is NOT updated when manifest creation fails
    await createLogActivity({
      id_pengguna: userId,
      jenis_aksi: 'DOCUMENT_UPLOAD_FAILED',
      ip_address: ipAddress,
      detail_aksi: `Unggah manifest gagal untuk pengajuan ${idPengajuan}: ${err?.details?.code || 'MANIFEST_UPLOAD_FAILED'}.`,
    });

    throw new AppError(
      err.name === 'AppError' ? err.message : 'Gagal membuat manifest dokumen.',
      err.statusCode || 502,
      { code: err?.details?.code || 'MANIFEST_UPLOAD_FAILED' }
    );
  }

  return {
    idPengajuan,
    manifestCid,
    documents: uploadResults,
  };
};

module.exports = { uploadDocuments };
