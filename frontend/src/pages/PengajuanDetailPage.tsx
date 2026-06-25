import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailPengajuan } from '../components/DetailPengajuan';
import { DokumenUploadPanel } from '../components/DokumenUploadPanel';
import { ErrorState, LoadingState } from '../components/State';
import { pengajuanService } from '../services/pengajuan.service';
import type { Pengajuan, PengajuanDokumenRow } from '../types/api';
import { getBlockchainDetailPresentation } from '../utils/pengajuan';

const EDITABLE_STATUSES = new Set(['MENUNGGU_VERIFIKASI', 'DIAJUKAN', 'DITOLAK']);

export function PengajuanDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Pengajuan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setError('Pengajuan tidak ditemukan');
      setLoading(false);
      return;
    }
    setLoading(true);
    pengajuanService
      .detail(id)
      .then(setItem)
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil detail'))
      .finally(() => setLoading(false));
  }, [id, refreshKey]);

  if (loading) return <LoadingState label="Memuat detail pengajuan..." />;
  if (error) {
    return <ErrorState message={/not found|tidak ditemukan|404/i.test(error) ? 'Pengajuan tidak ditemukan' : error} />;
  }
  if (!item) return <ErrorState message="Pengajuan tidak ditemukan" />;

  const blockchain = getBlockchainDetailPresentation(item);
  const status = (item.status ?? item.status_pengajuan ?? '').toUpperCase();
  const isEditable = EDITABLE_STATUSES.has(status);
  const pengajuanId = item.id_pengajuan ?? item.id;
  const dokumen = (item.dokumen ?? []) as unknown as PengajuanDokumenRow[];
  const activeDocuments = dokumen.filter((document) => document.is_active !== false);
  const hasIncompleteDocuments = activeDocuments.some(
    (document) => document.status_upload !== 'UPLOADED' || !document.cid_ipfs
  );
  const canSubmit = status === 'DIAJUKAN' && activeDocuments.length > 0 && !hasIncompleteDocuments;

  const submitPengajuan = async () => {
    if (!pengajuanId || !canSubmit || submitting) return;

    setSubmitting(true);
    setActionError('');
    try {
      await pengajuanService.submit(pengajuanId);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengirim pengajuan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {blockchain.notice && (
        <div className={`alert ${blockchain.notice.tone}`}>{blockchain.notice.message}</div>
      )}
      <DetailPengajuan
        item={blockchain.item}
        mode="ppat"
        actionArea={
          status === 'DIAJUKAN' ? (
            <div className="detail-pengajuan-actions">
              <h2>Submit Pengajuan</h2>
              <p className="muted">
                Pengajuan ini belum masuk antrean verifikasi ATR/BPN.
              </p>
              {actionError && <div className="alert danger">{actionError}</div>}
              <button
                type="button"
                className="primary-button"
                disabled={!canSubmit || submitting}
                onClick={() => void submitPengajuan()}
              >
                {submitting ? 'Mengirim...' : 'Submit Pengajuan'}
              </button>
              {!canSubmit && (
                <small className="muted">
                  Lengkapi seluruh dokumen pendukung sebelum mengirim pengajuan.
                </small>
              )}
            </div>
          ) : undefined
        }
      />
      {isEditable && pengajuanId !== undefined && dokumen.length > 0 && (
        <DokumenUploadPanel
          idPengajuan={Number(pengajuanId)}
          dokumen={dokumen}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
