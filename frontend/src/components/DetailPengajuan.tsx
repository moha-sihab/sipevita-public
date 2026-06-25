import type { ReactNode } from 'react';
import {
  ArrowLeft,
  FileText,
  MapPin,
  Paperclip,
  Shield,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Pengajuan } from '../types/api';
import { formatDate, formatDateTime, getStatus } from '../utils/format';
import { StatusBadge } from './StatusBadge';

type DetailMode = 'ppat' | 'reviewer';

interface DetailPengajuanProps {
  item: Pengajuan;
  mode: DetailMode;
  actionArea?: ReactNode;
  dokumenSlot?: ReactNode;
}

const pick = (record: Record<string, unknown> | undefined, ...keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const display = (value: unknown, fallback = '-') =>
  value === undefined || value === null || value === '' ? fallback : String(value);

function DetailRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="detail-pengajuan-row">
      <dt>{label}</dt>
      <dd className={muted ? 'detail-pengajuan-muted' : undefined}>{value}</dd>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-pengajuan-card">
      <header className="detail-pengajuan-card-header">
        {icon}
        <h2>{title}</h2>
      </header>
      <div className="detail-pengajuan-card-body">{children}</div>
    </section>
  );
}

function PartyCard({
  label,
  party,
}: {
  label: string;
  party?: Record<string, unknown>;
}) {
  return (
    <article className="detail-pengajuan-party">
      <div className="detail-pengajuan-party-label">
        <UserRound size={14} />
        <span>{label}</span>
      </div>
      <strong>{pick(party, 'nama_lengkap', 'nama', 'nama_pihak') || 'Belum tersedia'}</strong>
      <small>No. Identitas: {pick(party, 'nomor_identitas', 'no_identitas') || '-'}</small>
      <small>Alamat: {pick(party, 'alamat') || '-'}</small>
    </article>
  );
}

export function DetailPengajuan({ item, mode, actionArea, dokumenSlot }: DetailPengajuanProps) {
  const parties = Array.isArray(item.pihak_transaksi) ? item.pihak_transaksi : [];
  const oldParty =
    parties.find((party) =>
      pick(party, 'jenis_pihak', 'peran', 'tipe').toUpperCase().includes('LAMA'),
    ) || parties[0];
  const newParty =
    parties.find((party) =>
      pick(party, 'jenis_pihak', 'peran', 'tipe').toUpperCase().includes('BARU'),
    ) || parties[1];
  const documents = Array.isArray(item.dokumen) ? item.dokumen : [];
  const blockchain = asRecord(item.transaksi_blockchain);
  const dataSertifikat = asRecord(item.data_sertifikat);
  const backTo = mode === 'reviewer' ? '/admin/dashboard' : '/ppat/dashboard';
  const id = item.id_pengajuan;
  const reviewerNote = item.catatan_reviewer;

  return (
    <div className="detail-pengajuan">
      <style>{detailPengajuanStyles}</style>

      <Link className="detail-pengajuan-back" to={backTo}>
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>

      <div className="detail-pengajuan-heading">
        <div>
          <h1>Detail Pengajuan</h1>
          <p>Nomor Pengajuan: #{display(id)}</p>
        </div>
        <StatusBadge status={getStatus(item)} />
      </div>

      <DetailSection icon={<FileText size={18} />} title="Informasi Pengajuan">
        <dl>
          <DetailRow label="Nomor Sertifikat" value={display(item.nomor_sertifikat)} />
          <DetailRow label="NIB" value={display(item.nib)} />
          <DetailRow label="Jenis Transaksi" value={display(item.jenis_transaksi)} />
          <DetailRow label="Nomor Akta" value={display(item.nomor_akta)} />
          <DetailRow label="Tanggal Akta" value={formatDate(item.tanggal_akta)} />
          <DetailRow
            label="Tanggal Pengajuan"
            value={formatDateTime(item.tanggal_pengajuan || item.created_at)}
          />
          <DetailRow
            label="Catatan Reviewer"
            value={reviewerNote || 'Belum ada catatan'}
            muted={!reviewerNote}
          />
        </dl>
      </DetailSection>

      <DetailSection icon={<MapPin size={18} />} title="Data Tanah">
        <dl>
          <DetailRow label="Lokasi Tanah" value={display(item.lokasi_tanah)} />
          <DetailRow
            label="Luas Tanah"
            value={item.luas_tanah ? `${item.luas_tanah} m²` : '-'}
          />
          <DetailRow
            label="Jenis Hak"
            value={display(item.jenis_hak || pick(dataSertifikat, 'jenis_hak'))}
          />
          <DetailRow
            label="Keterangan"
            value={item.keterangan || pick(dataSertifikat, 'keterangan') || 'Tidak ada keterangan'}
            muted={!item.keterangan && !pick(dataSertifikat, 'keterangan')}
          />
        </dl>
      </DetailSection>

      <DetailSection icon={<UsersRound size={18} />} title="Pihak Transaksi">
        <div className="detail-pengajuan-parties">
          <PartyCard label="PEMILIK LAMA" party={oldParty} />
          <PartyCard label="PEMILIK BARU" party={newParty} />
        </div>
      </DetailSection>

      <DetailSection icon={<Paperclip size={18} />} title="Dokumen Terlampir">
        {dokumenSlot ?? (documents.length > 0 ? (
          <div className="detail-pengajuan-documents">
            {documents.map((document, index) => (
              <article className="detail-pengajuan-document" key={pick(document, 'id_dokumen') || index}>
                <span className="detail-pengajuan-document-icon">
                  <FileText size={18} />
                </span>
                <div className="detail-pengajuan-document-main">
                  <strong>{pick(document, 'nama_dokumen', 'nama_file', 'jenis_dokumen') || `Dokumen ${index + 1}`}</strong>
                  <small>
                    {pick(document, 'nama_file_asli')
                      ? pick(document, 'nama_file_asli')
                      : 'Berkas pendukung'}
                  </small>
                  <small>Terakhir diperbarui: {formatDateTime(pick(document, 'uploaded_at', 'created_at', 'tanggal_upload'))}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="detail-pengajuan-empty">Belum ada dokumen terlampir.</p>
        ))}
      </DetailSection>

      <DetailSection icon={<Shield size={18} />} title="Status Pencatatan">
        {blockchain ? (
          <dl>
            <DetailRow label="Status" value="Tercatat" />
            <DetailRow label="Waktu Pencatatan" value={formatDateTime(pick(blockchain, 'created_at', 'timestamp'))} />
          </dl>
        ) : (
          <div className="detail-pengajuan-blockchain-empty">
            <span><Shield size={28} /></span>
            <strong>Belum Tercatat</strong>
            <small>Pengajuan akan dicatat setelah disetujui oleh ATR/BPN.</small>
          </div>
        )}
      </DetailSection>

      {actionArea}
    </div>
  );
}

const detailPengajuanStyles = `
  .detail-pengajuan { display: grid; gap: 20px; color: #172033; }
  .detail-pengajuan-back { display: inline-flex; align-items: center; gap: 7px; width: fit-content; font-size: 13px; }
  .detail-pengajuan-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0 6px; }
  .detail-pengajuan-heading h1 { margin: 0 0 3px; font-size: 24px; line-height: 1.25; }
  .detail-pengajuan-heading p { margin: 0; color: #667085; font-size: 13px; }
  .detail-pengajuan-card { overflow: hidden; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; box-shadow: 0 2px 5px rgba(16, 24, 40, .08); }
  .detail-pengajuan-card-header { display: flex; align-items: center; gap: 9px; padding: 17px 22px; color: #004aad; background: #edf3ff; }
  .detail-pengajuan-card-header h2 { margin: 0; font-size: 16px; }
  .detail-pengajuan-card-body { padding: 20px 22px; }
  .detail-pengajuan-card dl { margin: 0; }
  .detail-pengajuan-row { display: grid; grid-template-columns: minmax(130px, 24%) 1fr; gap: 18px; padding: 10px 0; border-bottom: 1px solid #f0f2f5; font-size: 13px; }
  .detail-pengajuan-row:last-child { border-bottom: 0; }
  .detail-pengajuan-row dt { color: #667085; }
  .detail-pengajuan-row dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; }
  .detail-pengajuan-muted { color: #98a2b3; font-style: italic; font-weight: 500 !important; }
  .detail-pengajuan-parties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .detail-pengajuan-party { display: grid; gap: 5px; padding: 16px; border: 1px solid #d9e0ec; border-radius: 9px; background: #f9fafb; }
  .detail-pengajuan-party-label { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; color: #004aad; font-size: 11px; font-weight: 750; }
  .detail-pengajuan-party strong { font-size: 14px; }
  .detail-pengajuan-party small, .detail-pengajuan-document small { color: #667085; }
  .detail-pengajuan-documents { display: grid; gap: 12px; }
  .detail-pengajuan-document { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px; padding: 13px; border: 1px solid #d9e0ec; border-radius: 9px; }
  .detail-pengajuan-document-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; color: #004aad; background: #edf3ff; }
  .detail-pengajuan-document-main { display: grid; gap: 2px; min-width: 0; font-size: 12px; }
  .detail-pengajuan-empty { margin: 8px 0; color: #667085; text-align: center; }
  .detail-pengajuan-blockchain-empty { display: grid; justify-items: center; gap: 8px; min-height: 140px; align-content: center; text-align: center; }
  .detail-pengajuan-blockchain-empty span { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; color: #98a2b3; background: #f2f4f7; }
  .detail-pengajuan-blockchain-empty small { color: #98a2b3; }
  .detail-pengajuan-actions { display: grid; gap: 15px; padding: 20px; border: 1px solid #e4e7ec; border-radius: 12px; background: #fff; }
  .detail-pengajuan-actions h2, .detail-pengajuan-actions p { margin: 0; }
  @media (max-width: 760px) {
    .detail-pengajuan { gap: 14px; }
    .detail-pengajuan-heading { align-items: flex-start; }
    .detail-pengajuan-card-header, .detail-pengajuan-card-body { padding: 15px; }
    .detail-pengajuan-parties { grid-template-columns: 1fr; }
    .detail-pengajuan-document { grid-template-columns: auto 1fr; }
  }
  @media (max-width: 520px) {
    .detail-pengajuan-heading { display: grid; }
    .detail-pengajuan-row { grid-template-columns: 1fr; gap: 3px; }
    .detail-pengajuan-document { grid-template-columns: 1fr; }
    .detail-pengajuan-document-icon { grid-column: 1; justify-items: start; }
  }
`;
