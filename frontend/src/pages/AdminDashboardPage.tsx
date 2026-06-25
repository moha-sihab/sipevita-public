import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle, Clock, FileText, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { ErrorState, LoadingState } from '../components/State';
import { StatusBadge } from '../components/StatusBadge';
import { reviewerService } from '../services/reviewer.service';
import { logService } from '../services/log.service';
import type { Pengajuan } from '../types/api';
import { formatDate, getStatus } from '../utils/format';

export function AdminDashboardPage() {
  const [items, setItems] = useState<Pengajuan[]>([]);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      reviewerService.list({ status: 'MENUNGGU_VERIFIKASI' }),
      logService.list({ page: 1, limit: 5 }).catch(() => null),
    ])
      .then(([pengajuan, logs]) => {
        setItems(pengajuan.items || []);
        const count = Number((logs as Record<string, unknown> | null)?.count || (logs as Record<string, unknown> | null)?.total);
        setLogCount(Number.isFinite(count) ? count : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const pending = items.length;
    return { pending, logs: logCount ?? 0 };
  }, [items, logCount]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Dashboard ATR/BPN</h1>
          <p>Monitoring pengajuan, aktivitas sistem, dan kesiapan review.</p>
        </div>
      </div>
      <div className="summary-grid">
        <Summary icon={<FileText />} label="Pengajuan Menunggu" value={summary.pending} tone="orange" />
        <Summary icon={<Activity />} label="Log Aktivitas" value={summary.logs} tone="blue" />
        <Summary icon={<CheckCircle />} label="Transaksi Terverifikasi" value={0} tone="green" />
        <Summary icon={<XCircle />} label="Butuh Tindak Lanjut" value={0} tone="red" />
      </div>

      <div className="card">
        <h2>Pengajuan Menunggu Verifikasi</h2>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <DataTable
            data={items}
            columns={[
              { key: 'nomor', header: 'Nomor Sertifikat', render: (item) => item.nomor_sertifikat || '-' },
              { key: 'jenis', header: 'Jenis Transaksi', render: (item) => item.jenis_transaksi || '-' },
              { key: 'tanggal', header: 'Tanggal', render: (item) => formatDate(item.created_at || item.tanggal_pengajuan) },
              { key: 'status', header: 'Status', render: (item) => <StatusBadge status={getStatus(item)} /> },
              {
                key: 'aksi',
                header: 'Aksi',
                render: (item) =>
                  item.id_pengajuan ? <Link to={`/admin/approval/${item.id_pengajuan}`}>Review</Link> : '-',
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}

function Summary({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="summary-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={`summary-icon ${tone}`}>{icon}</div>
    </div>
  );
}
