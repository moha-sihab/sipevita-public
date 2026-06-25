import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, FileText, Plus, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { ErrorState, LoadingState } from '../components/State';
import { StatusBadge } from '../components/StatusBadge';
import { pengajuanService } from '../services/pengajuan.service';
import type { Pengajuan } from '../types/api';
import { formatDate, getStatus } from '../utils/format';

export function PpatDashboardPage() {
  const [items, setItems] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    pengajuanService
      .list()
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil pengajuan'))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const counts = { total: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((item) => {
      const status = getStatus(item).toUpperCase();
      if (status.includes('SETUJUI')) counts.approved += 1;
      else if (status.includes('TOLAK')) counts.rejected += 1;
      else counts.pending += 1;
    });
    return counts;
  }, [items]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Dashboard PPAT</h1>
          <p>Ringkasan pengajuan dan status sertifikat yang Anda ajukan.</p>
        </div>
        <Link className="primary-button" to="/ppat/pengajuan">
          <Plus size={18} />
          Ajukan Baru
        </Link>
      </div>

      <div className="summary-grid">
        <Summary icon={<FileText />} label="Total Pengajuan" value={summary.total} tone="blue" />
        <Summary icon={<Clock />} label="Menunggu Verifikasi" value={summary.pending} tone="orange" />
        <Summary icon={<CheckCircle />} label="Disetujui" value={summary.approved} tone="green" />
        <Summary icon={<XCircle />} label="Ditolak" value={summary.rejected} tone="red" />
      </div>

      <div className="card">
        <h2>Riwayat Pengajuan Terbaru</h2>
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
                  item.id_pengajuan ? <Link to={`/ppat/pengajuan/${item.id_pengajuan}`}>Detail</Link> : '-',
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
