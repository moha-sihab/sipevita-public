import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { dokumenService } from '../services/dokumen.service';
import type { Dokumen } from '../types/api';

interface Props {
  idPengajuan: number;
  embedded?: boolean;
}

const formatBytes = (bytes: number | null): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatJenis = (jenis: string | null): string => {
  if (!jenis) return '-';
  return jenis.replace(/_/g, ' ');
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  UPLOADING: 'Mengunggah',
  UPLOADED: 'Tersedia',
  FAILED: 'Gagal',
  SUPERSEDED: 'Digantikan',
};

const STATUS_CLASS: Record<string, string> = {
  UPLOADED: 'success',
  FAILED: 'danger',
  UPLOADING: 'warning',
  PENDING: 'warning',
  SUPERSEDED: '',
};

export function DokumenList({ idPengajuan, embedded = false }: Props) {
  const { logout } = useAuth();
  const [docs, setDocs] = useState<Dokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadingId, setLoadingId] = useState<string | number | null>(null);

  useEffect(() => {
    dokumenService
      .list(idPengajuan)
      .then(setDocs)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        setListError(
          err instanceof ApiError && err.status === 403
            ? 'Anda tidak memiliki akses ke dokumen pengajuan ini.'
            : err instanceof Error
              ? err.message
              : 'Gagal memuat daftar dokumen'
        );
      })
      .finally(() => setLoading(false));
  }, [idPengajuan, logout]);

  const handleApiError = (err: unknown, fallback: string): void => {
    if (err instanceof ApiError && err.status === 401) {
      logout();
      return;
    }
    setActionError(
      err instanceof ApiError && err.status === 403
        ? 'Anda tidak memiliki akses ke dokumen ini.'
        : err instanceof Error
          ? `${err.message} — Coba klik tombol sekali lagi untuk mendapatkan tautan baru.`
          : fallback
    );
  };

  const handlePreview = async (idDokumen: string | number) => {
    setLoadingId(idDokumen);
    setActionError('');
    try {
      const result = await dokumenService.preview(idPengajuan, idDokumen);
      window.open(result.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      handleApiError(err, 'Gagal membuat URL pratinjau');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDownload = async (idDokumen: string | number, namaFile: string | null) => {
    setLoadingId(idDokumen);
    setActionError('');
    try {
      const result = await dokumenService.download(idPengajuan, idDokumen);
      // Open in a new tab so the app stays open. Using an anchor click (not
      // window.open) avoids popup-blocker blocks on async-acquired URLs.
      const a = document.createElement('a');
      a.href = result.downloadUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = namaFile ?? 'dokumen';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      handleApiError(err, 'Gagal membuat URL unduhan');
    } finally {
      setLoadingId(null);
    }
  };

  const content = (
    <>
      {actionError && (
        <div className="alert danger" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="muted">Memuat daftar dokumen...</p>
      ) : listError ? (
        <div className="alert danger">{listError}</div>
      ) : docs.length === 0 ? (
        <p className="muted">Belum ada dokumen yang diunggah.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jenis Dokumen</th>
                <th>Nama File</th>
                <th>Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const key = String(doc.idDokumen);
                const isActionLoading = loadingId === doc.idDokumen;
                return (
                  <tr key={key}>
                    <td>{formatJenis(doc.jenisDokumen)}</td>
                    <td>{doc.namaFileAsli ?? '-'}</td>
                    <td>{formatBytes(doc.ukuranFile)}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[doc.statusUpload] ?? ''}`}>
                        {STATUS_LABEL[doc.statusUpload] ?? doc.statusUpload}
                      </span>
                    </td>
                    <td>
                      {doc.statusUpload === 'UPLOADED' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="secondary-button"
                            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
                            disabled={isActionLoading}
                            onClick={() => void handlePreview(doc.idDokumen)}
                          >
                            {isActionLoading ? '...' : 'Pratinjau'}
                          </button>
                          <button
                            className="primary-button"
                            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
                            disabled={isActionLoading}
                            onClick={() => void handleDownload(doc.idDokumen, doc.namaFileAsli)}
                          >
                            {isActionLoading ? '...' : 'Unduh'}
                          </button>
                        </div>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>Dokumen Pengajuan</h2>
      {content}
    </div>
  );
}
