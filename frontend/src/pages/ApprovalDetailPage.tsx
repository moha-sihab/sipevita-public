import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { DetailPengajuan } from '../components/DetailPengajuan';
import { DokumenList } from '../components/DokumenList';
import { ErrorState, LoadingState } from '../components/State';
import { reviewerService } from '../services/reviewer.service';
import type { Pengajuan } from '../types/api';
import { getStatus } from '../utils/format';
import { getBlockchainDetailPresentation } from '../utils/pengajuan';

export function ApprovalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Pengajuan | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [canViewDocuments, setCanViewDocuments] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Pengajuan tidak ditemukan');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Attempt to claim. For MENUNGGU_VERIFIKASI items this must succeed before
        // DokumenList mounts, so id_reviewer is persisted in DB first.
        // For already-processed items (DISETUJUI/DITOLAK), claim fails with 409
        // PENGAJUAN_NOT_REVIEWABLE — we still load the detail for historical viewing
        // but skip DokumenList (access would be denied anyway).
        try {
          await reviewerService.claim(id);
          setCanViewDocuments(true);
        } catch (claimErr) {
          if (claimErr instanceof ApiError && claimErr.status === 409) {
            if (claimErr.message.includes('reviewer lain')) {
              setError('Pengajuan ini sedang ditangani reviewer lain.');
              return;
            }
            // PENGAJUAN_NOT_REVIEWABLE (DISETUJUI/DITOLAK) — fall through, load read-only detail
          } else {
            throw claimErr; // 404 (server not restarted?), 503, network error
          }
        }
        const detail = await reviewerService.detail(id);
        setItem(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal mengambil detail pengajuan');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const action = async (type: 'approve' | 'reject') => {
    if (!id) return;
    setActionLoading(true);
    setError('');
    try {
      if (type === 'approve') await reviewerService.approve(id, note);
      else await reviewerService.reject(id, note);
      navigate('/admin/approval');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Memuat detail pengajuan..." />;
  if (error && !item) {
    return <ErrorState message={error} />;
  }
  if (!item) return <ErrorState message="Pengajuan tidak ditemukan" />;

  const status = getStatus(item).toUpperCase();
  const canReview = status === 'MENUNGGU_VERIFIKASI';
  const blockchain = getBlockchainDetailPresentation(item);

  const pengajuanId = item.id_pengajuan ?? item.id;

  return (
    <>
      {blockchain.notice && (
        <div className={`alert ${blockchain.notice.tone}`}>{blockchain.notice.message}</div>
      )}
      <DetailPengajuan
        item={blockchain.item}
        mode="reviewer"
        dokumenSlot={
          pengajuanId !== undefined && canViewDocuments
            ? <DokumenList idPengajuan={Number(pengajuanId)} embedded />
            : undefined
        }
        actionArea={
          canReview ? (
            <section className="detail-pengajuan-actions">
              <div>
                <h2>Keputusan Reviewer</h2>
                <p>Periksa seluruh informasi sebelum menyetujui atau menolak pengajuan.</p>
              </div>
              <label>
                Catatan Reviewer
                <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              {error && <div className="alert danger">{error}</div>}
              <div className="button-row">
                <button className="danger-button" disabled={actionLoading || !note.trim()} onClick={() => void action('reject')}>
                  {actionLoading ? 'Memproses...' : 'Tolak'}
                </button>
                <button className="success-button" disabled={actionLoading} onClick={() => void action('approve')}>
                  {actionLoading ? 'Memproses...' : 'Setujui'}
                </button>
              </div>
            </section>
          ) : undefined
        }
      />
    </>
  );
}
