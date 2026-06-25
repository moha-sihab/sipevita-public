import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { ErrorState, LoadingState } from '../components/State';
import { StatusBadge } from '../components/StatusBadge';
import { reviewerService } from '../services/reviewer.service';
import type { Pengajuan } from '../types/api';
import { formatDate, getStatus } from '../utils/format';

export function ApprovalPage() {
  const [items, setItems] = useState<Pengajuan[]>([]);
  const [status, setStatus] = useState('MENUNGGU_VERIFIKASI');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    reviewerService
      .list({ status })
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil approval'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Approval Pengajuan</h1>
          <p>Daftar pengajuan yang perlu ditinjau ATR/BPN.</p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="MENUNGGU_VERIFIKASI">Menunggu</option>
          <option value="DISETUJUI">Disetujui</option>
          <option value="DITOLAK">Ditolak</option>
        </select>
      </div>
      <div className="card">
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <DataTable
            data={items}
            columns={[
              { key: 'nomor', header: 'Nomor Sertifikat', render: (item) => item.nomor_sertifikat || '-' },
              { key: 'jenis', header: 'Jenis', render: (item) => item.jenis_transaksi || '-' },
              { key: 'tanggal', header: 'Tanggal', render: (item) => formatDate(item.created_at || item.tanggal_pengajuan) },
              { key: 'status', header: 'Status', render: (item) => <StatusBadge status={getStatus(item)} /> },
              {
                key: 'aksi',
                header: 'Aksi',
                render: (item) =>
                  item.id_pengajuan ? <Link to={`/admin/approval/${item.id_pengajuan}`}>Detail</Link> : '-',
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}
