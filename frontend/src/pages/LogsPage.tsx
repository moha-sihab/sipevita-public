import { useEffect, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { ErrorState, LoadingState } from '../components/State';
import { logService } from '../services/log.service';
import { formatDate } from '../utils/format';

export function LogsPage() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    logService
      .list({ page: 1, limit: 20, search })
      .then((data) => {
        const list = (data.items || data.logs || []) as Array<Record<string, unknown>>;
        setItems(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal mengambil log'))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Log Audit</h1>
          <p>Aktivitas sistem read-only untuk ATR/BPN.</p>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari log..." />
      </div>
      <div className="card">
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <DataTable
            data={items}
            columns={[
              { key: 'id', header: 'ID', render: (item) => String(item.id_log || item.id || '-') },
              { key: 'aksi', header: 'Jenis Aksi', render: (item) => String(item.jenis_aksi || '-') },
              { key: 'detail', header: 'Detail', render: (item) => String(item.detail_aksi || '-') },
              { key: 'waktu', header: 'Waktu', render: (item) => formatDate(item.created_at || item.timestamp) },
            ]}
          />
        )}
      </div>
    </section>
  );
}
