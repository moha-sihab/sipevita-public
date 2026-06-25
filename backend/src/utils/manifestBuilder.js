const AppError = require('./app-error');


const buildManifest = (idPengajuan, documents) => {
  if (!idPengajuan) {
    throw new AppError('ID pengajuan wajib tersedia untuk membuat manifest.', 500);
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new AppError(
      'Manifest tidak dapat dibuat karena belum ada dokumen yang diunggah.',
      409,
      { code: 'MANIFEST_NOT_AVAILABLE' }
    );
  }

  const eligible = documents.filter(
    (d) =>
      d.is_active &&
      d.status_upload === 'UPLOADED' &&
      d.cid_ipfs &&
      d.sha256
  );

  if (eligible.length === 0) {
    throw new AppError(
      'Manifest tidak dapat dibuat karena belum ada dokumen yang berhasil diunggah.',
      409,
      { code: 'MANIFEST_NOT_AVAILABLE' }
    );
  }

  const sorted = [...eligible].sort((a, b) => {
    const jA = (a.jenis_dokumen || '').localeCompare(b.jenis_dokumen || '');
    if (jA !== 0) return jA;
    return String(a.id_dokumen).localeCompare(String(b.id_dokumen));
  });

  return {
    schemaVersion: '1.0',
    application: 'SIPEVITA',
    idPengajuan: String(idPengajuan),
    createdAt: new Date().toISOString(),
    documentCount: sorted.length,
    documents: sorted.map((d) => ({
      documentId: String(d.id_dokumen),
      documentType: d.jenis_dokumen || null,
      originalName: d.nama_file_asli || d.nama_file || null,
      mimeType: d.mime_type || null,
      size: d.ukuran_file || null,
      cid: d.cid_ipfs,
      sha256: d.sha256,
    })),
  };
};

module.exports = { buildManifest };
