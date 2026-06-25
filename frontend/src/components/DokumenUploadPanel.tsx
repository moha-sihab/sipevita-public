import { useRef, useState } from 'react';
import { dokumenService } from '../services/dokumen.service';
import type { PengajuanDokumenRow } from '../types/api';

const JENIS_DOKUMEN_OPTIONS = [
  { value: 'SERTIFIKAT_TANAH', label: 'Sertifikat Tanah' },
  { value: 'AKTA_JUAL_BELI', label: 'Akta Jual Beli' },
  { value: 'AKTA_HIBAH', label: 'Akta Hibah' },
  { value: 'AKTA_WARIS', label: 'Akta Waris' },
  { value: 'KTP', label: 'KTP / Identitas' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface RowSelection {
  idDokumen: string | number;
  label: string;
  jenisDokumen: string;
  jenisDokumenLocked: boolean;
  file: File | null;
  fileError: string;
  currentStatus: string | null;
}

interface Props {
  idPengajuan: number;
  dokumen: PengajuanDokumenRow[];
  onSuccess: () => void;
}

const isUploadable = (row: PengajuanDokumenRow) => {
  const s = row.status_upload;
  return !s || s === 'PENDING' || s === 'FAILED';
};

const statusLabel = (s: string | null | undefined) => {
  if (!s) return 'Menunggu';
  const map: Record<string, string> = {
    PENDING: 'Menunggu',
    UPLOADING: 'Mengunggah',
    UPLOADED: 'Tersedia',
    FAILED: 'Gagal',
    SUPERSEDED: 'Digantikan',
  };
  return map[s] ?? s;
};

const statusClass = (s: string | null | undefined) => {
  if (!s || s === 'PENDING') return 'warning';
  if (s === 'UPLOADED') return 'success';
  if (s === 'FAILED') return 'danger';
  return '';
};

export function DokumenUploadPanel({ idPengajuan, dokumen, onSuccess }: Props) {
  const uploadableRows = dokumen.filter(isUploadable);

  const [rows, setRows] = useState<RowSelection[]>(() =>
    uploadableRows.map((d) => ({
      idDokumen: d.id_dokumen,
      label: d.nama_file ?? `Dokumen ${String(d.id_dokumen).slice(0, 8)}`,
      jenisDokumen: d.jenis_dokumen ?? JENIS_DOKUMEN_OPTIONS[0].value,
      jenisDokumenLocked: !!d.jenis_dokumen,
      file: null,
      fileError: '',
      currentStatus: d.status_upload ?? null,
    }))
  );

  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const updateRow = (idDokumen: string | number, patch: Partial<RowSelection>) => {
    setRows((prev) =>
      prev.map((r) => (r.idDokumen === idDokumen ? { ...r, ...patch } : r))
    );
  };

  const handleFileChange = (idDokumen: string | number, file: File | null) => {
    if (!file) {
      updateRow(idDokumen, { file: null, fileError: '' });
      return;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      updateRow(idDokumen, { file: null, fileError: 'Hanya PDF, JPEG, PNG yang diizinkan.' });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateRow(idDokumen, { file: null, fileError: `Ukuran maksimum ${formatBytes(MAX_FILE_SIZE_BYTES)}.` });
      return;
    }
    updateRow(idDokumen, { file, fileError: '' });
  };

  const selectedRows = rows.filter((r) => r.file !== null);
  const hasSelection = selectedRows.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSelection || uploading) return;

    setUploading(true);
    setSubmitError('');
    setSuccess(false);

    const formData = new FormData();
    const metadata: Array<{ idDokumen: string; jenisDokumen: string }> = [];

    for (const row of selectedRows) {
      if (row.file) {
        formData.append('files', row.file, row.file.name);
        metadata.push({ idDokumen: String(row.idDokumen), jenisDokumen: row.jenisDokumen });
      }
    }
    formData.append('documentMetadata', JSON.stringify(metadata));

    try {
      await dokumenService.uploadFiles(idPengajuan, formData);
      setSuccess(true);
      // Clear file selections
      setRows((prev) => prev.map((r) => ({ ...r, file: null, fileError: '' })));
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploading(false);
    }
  };

  if (uploadableRows.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 18 }}>Unggah Dokumen</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Pilih file untuk setiap dokumen yang ingin diunggah, lalu klik tombol Unggah.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dokumen (Slot)</th>
                <th>Jenis Dokumen</th>
                <th>Status</th>
                <th>File Terpilih</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = String(row.idDokumen);
                return (
                  <tr key={key}>
                    <td style={{ maxWidth: 200, wordBreak: 'break-word' }}>{row.label}</td>
                    <td>
                      <select
                        value={row.jenisDokumen}
                        disabled={uploading || row.jenisDokumenLocked}
                        onChange={(e) =>
                          updateRow(row.idDokumen, { jenisDokumen: e.target.value })
                        }
                        style={{ width: '100%', minWidth: 140 }}
                        title={row.jenisDokumenLocked ? 'Jenis dokumen sudah ditetapkan' : undefined}
                      >
                        {JENIS_DOKUMEN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass(row.currentStatus)}`}>
                        {statusLabel(row.currentStatus)}
                      </span>
                    </td>
                    <td>
                      {row.file ? (
                        <span style={{ fontSize: 13 }}>
                          {row.file.name}{' '}
                          <span className="muted">({formatBytes(row.file.size)})</span>
                        </span>
                      ) : row.fileError ? (
                        <span style={{ color: 'var(--danger)', fontSize: 13 }}>{row.fileError}</span>
                      ) : (
                        <span className="muted" style={{ fontSize: 13 }}>
                          Belum dipilih
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        ref={(el) => {
                          fileInputRefs.current[key] = el;
                        }}
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          handleFileChange(row.idDokumen, f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
                        disabled={uploading}
                        onClick={() => fileInputRefs.current[key]?.click()}
                      >
                        Pilih File
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {success && (
          <div className="alert success" style={{ marginTop: 12 }}>
            Dokumen berhasil diunggah.
          </div>
        )}
        {submitError && (
          <div className="alert danger" style={{ marginTop: 12 }}>
            {submitError}
          </div>
        )}

        <div className="button-row" style={{ marginTop: 16 }}>
          <button
            type="submit"
            className="primary-button"
            disabled={!hasSelection || uploading}
          >
            {uploading
              ? 'Mengunggah...'
              : `Unggah ${selectedRows.length > 0 ? `${selectedRows.length} ` : ''}Dokumen`}
          </button>
        </div>
      </form>
    </div>
  );
}
