import type { ReactNode } from 'react';
import { Clock3, Database, Fingerprint, History, Link as LinkIcon } from 'lucide-react';
import type { BlockchainHistoryResponse } from '../types/api';
import { formatDateTime } from '../utils/format';
import { displayValue, getHistoryTxId, getHistoryValue, isHistoryDelete, maskHash } from '../utils/history';
import { EmptyState } from './State';

interface OwnershipHistoryResultProps {
  history: BlockchainHistoryResponse;
  isPublic: boolean;
  certificateInfo?: {
    lokasi_tanah?: unknown;
    luas_tanah?: unknown;
  };
}

const statusMap: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: 'Aktif', tone: 'success' },
  AKTIF: { label: 'Aktif', tone: 'success' },
  DISETUJUI: { label: 'Disetujui', tone: 'success' },
  INACTIVE: { label: 'Tidak Aktif', tone: 'danger' },
  TIDAK_AKTIF: { label: 'Tidak Aktif', tone: 'danger' },
  TRANSFERRED: { label: 'Dialihkan', tone: 'info' },
};

const getStatus = (value: unknown) => {
  const normalized = String(value || '').trim().toUpperCase();
  return statusMap[normalized] || { label: 'Status tidak diketahui', tone: 'warning' };
};

function HistoryStatusBadge({ value }: { value: unknown }) {
  const status = getStatus(value);
  return <span className={`status-badge ${status.tone}`}>{status.label}</span>;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ownership-history-card">
      <header className="ownership-history-card-header">
        {icon}
        <h2>{title}</h2>
      </header>
      <div className="ownership-history-card-body">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="ownership-history-row">
      <dt>{label}</dt>
      <dd className={mono ? 'ownership-history-mono' : undefined}>{value}</dd>
    </div>
  );
}

const getSensitiveDisplay = (value: unknown, isPublic: boolean) => {
  if (value === undefined || value === null || value === '') {
    return isPublic ? 'Tidak ditampilkan untuk akses publik' : '-';
  }
  return maskHash(value, isPublic);
};

const ownerDisplay = (value: unknown, isPublic: boolean) =>
  isPublic ? 'Tidak ditampilkan untuk akses publik' : displayValue(value);

export function OwnershipHistoryResult({ history, isPublic, certificateInfo }: OwnershipHistoryResultProps) {
  if (history.items.length === 0 || history.count === 0) {
    return (
      <EmptyState message="Riwayat kepemilikan tidak ditemukan untuk nomor sertifikat ini." />
    );
  }

  const latestItem = history.items[history.items.length - 1] || history.items[0];
  const latest = getHistoryValue(latestItem);
  const latestLocation = latest.lokasi_tanah || certificateInfo?.lokasi_tanah;
  const latestArea = latest.luas_tanah || certificateInfo?.luas_tanah;

  return (
    <div className="ownership-history">
      <style>{ownershipHistoryStyles}</style>

      <div className="ownership-history-heading">
        <div>
          <h2>Hasil Riwayat Kepemilikan</h2>
          <p>{history.count} riwayat kepemilikan ditemukan.</p>
        </div>
        <HistoryStatusBadge value={latest.status} />
      </div>

      <Section icon={<Database size={18} />} title="Ringkasan Sertifikat">
        <dl>
          <DetailRow label="Nomor Sertifikat" value={displayValue(latest.nomor_sertifikat)} />
          <DetailRow label="Lokasi Tanah" value={displayValue(latestLocation)} />
          {!isPublic && (
            <DetailRow label="Pemilik Sertifikat" value={ownerDisplay(latest.nama_pemilik, isPublic)} />
          )}
          <DetailRow label="Status Aset" value={<HistoryStatusBadge value={latest.status} />} />
          <DetailRow
            label="Luas Tanah"
            value={latestArea ? `${latestArea} m²` : '-'}
          />
          <DetailRow label="Dibuat Pada" value={formatDateTime(latest.created_at)} />
          <DetailRow label="Diperbarui Pada" value={formatDateTime(latest.updated_at)} />
        </dl>
      </Section>

      <Section icon={<Fingerprint size={18} />} title="Kode Verifikasi Data">
        <dl>
          <DetailRow
            label="Kode Pemilik"
            value={getSensitiveDisplay(latest.hash_pemilik, isPublic)}
            mono
          />
          <DetailRow
            label="Kode Dokumen"
            value={getSensitiveDisplay(latest.hash_dokumen, isPublic)}
            mono
          />
          <DetailRow
            label="Kode Lokasi"
            value={getSensitiveDisplay(latest.lokasi_hash, isPublic)}
            mono
          />
        </dl>
        {isPublic && (
          <p className="ownership-history-note">
            Kode verifikasi ditampilkan secara terbatas untuk melindungi data pemilik.
          </p>
        )}
      </Section>

      <Section icon={<Clock3 size={18} />} title="Timeline Riwayat">
        <div className="ownership-history-timeline">
          {[...history.items].reverse().map((item, index) => {
            const value = getHistoryValue(item);
            const eventNumber = history.items.length - index;
            const txId = getHistoryTxId(item);
            const itemLocation = value.lokasi_tanah || certificateInfo?.lokasi_tanah;
            const itemArea = value.luas_tanah || certificateInfo?.luas_tanah;

            return (
              <article className="ownership-history-event" key={`${txId || item.timestamp || eventNumber}`}>
                <span className="ownership-history-dot" />
                <div className="ownership-history-event-card">
                  <header>
                    <div>
                      <strong>Riwayat #{eventNumber}</strong>
                      <small>{formatDateTime(item.timestamp || value.updated_at || value.created_at)}</small>
                    </div>
                    <HistoryStatusBadge value={isHistoryDelete(item) ? 'INACTIVE' : value.status} />
                  </header>
                  <dl>
                    <DetailRow label="Nomor Sertifikat" value={displayValue(value.nomor_sertifikat)} />
                    <DetailRow label="Lokasi Tanah" value={displayValue(itemLocation)} />
                    {!isPublic && (
                      <DetailRow label="Pemilik Sertifikat" value={ownerDisplay(value.nama_pemilik, isPublic)} />
                    )}
                    {Boolean(value.jenis_transaksi) && (
                      <DetailRow label="Jenis Transaksi" value={displayValue(value.jenis_transaksi)} />
                    )}
                    <DetailRow label="Luas Tanah" value={itemArea ? `${itemArea} m²` : '-'} />
                    <DetailRow label="Dibuat Pada" value={formatDateTime(value.created_at)} />
                    <DetailRow label="Diperbarui Pada" value={formatDateTime(value.updated_at)} />
                    {txId && (
                      <DetailRow
                        label="Nomor Pencatatan"
                        value={displayValue(txId)}
                        mono
                      />
                    )}
                    {item.block_number !== undefined && (
                      <DetailRow label="Nomor Urut" value={displayValue(item.block_number)} />
                    )}
                  </dl>
                  {Boolean(value.cid_ipfs) && (
                    <span className="ownership-history-reference">
                      <LinkIcon size={13} />
                      Referensi dokumen tercatat
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Section>

    </div>
  );
}

const ownershipHistoryStyles = `
  .ownership-history { display: grid; gap: 20px; margin-top: 22px; color: #172033; }
  .ownership-history-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .ownership-history-heading h2 { margin: 0 0 4px; font-size: 21px; }
  .ownership-history-heading p { margin: 0; color: #667085; font-size: 13px; }
  .ownership-history-card { overflow: hidden; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; box-shadow: 0 2px 5px rgba(16, 24, 40, .08); }
  .ownership-history-card-header { display: flex; align-items: center; gap: 9px; padding: 17px 22px; color: #004aad; background: #edf3ff; }
  .ownership-history-card-header h2 { margin: 0; font-size: 16px; }
  .ownership-history-card-body { padding: 20px 22px; }
  .ownership-history-card dl { margin: 0; }
  .ownership-history-row { display: grid; grid-template-columns: minmax(150px, 24%) 1fr; gap: 18px; padding: 10px 0; border-bottom: 1px solid #f0f2f5; font-size: 13px; }
  .ownership-history-row:last-child { border-bottom: 0; }
  .ownership-history-row dt { color: #667085; }
  .ownership-history-row dd { min-width: 0; margin: 0; overflow-wrap: anywhere; font-weight: 600; }
  .ownership-history-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
  .ownership-history-note { margin: 14px 0 0; color: #667085; font-size: 12px; }
  .ownership-history-timeline { display: grid; gap: 0; }
  .ownership-history-event { position: relative; display: grid; grid-template-columns: 24px 1fr; gap: 13px; padding-bottom: 18px; }
  .ownership-history-event:not(:last-child)::before { content: ''; position: absolute; top: 17px; bottom: -3px; left: 7px; width: 2px; background: #d7e3f8; }
  .ownership-history-dot { position: relative; z-index: 1; width: 16px; height: 16px; margin-top: 10px; border: 4px solid #dce8fb; border-radius: 50%; background: #1459b8; }
  .ownership-history-event-card { overflow: hidden; border: 1px solid #d9e0ec; border-radius: 10px; background: #f9fafb; }
  .ownership-history-event-card > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid #e4e7ec; background: #fff; }
  .ownership-history-event-card > header div { display: grid; gap: 3px; }
  .ownership-history-event-card > header small { color: #667085; }
  .ownership-history-event-card dl { padding: 5px 16px; }
  .ownership-history-reference { display: inline-flex; align-items: center; gap: 6px; margin: 0 16px 14px; color: #1459b8; font-size: 12px; }
  @media (max-width: 620px) {
    .ownership-history-heading, .ownership-history-event-card > header { align-items: flex-start; }
    .ownership-history-heading { display: grid; }
    .ownership-history-card-header, .ownership-history-card-body { padding: 15px; }
    .ownership-history-row { grid-template-columns: 1fr; gap: 3px; }
    .ownership-history-event { grid-template-columns: 18px 1fr; gap: 8px; }
    .ownership-history-event:not(:last-child)::before { left: 6px; }
    .ownership-history-dot { width: 14px; height: 14px; border-width: 3px; }
  }
`;
