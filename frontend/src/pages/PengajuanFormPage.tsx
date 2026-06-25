import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pengajuanService, type PengajuanPayload } from '../services/pengajuan.service';
import { dokumenService } from '../services/dokumen.service';
import { blockchainService } from '../services/blockchain.service';
import type { Dokumen } from '../types/api';
import {
  getCertificateCheckStatus,
  getTransactionHelperText,
  type CertificateCheckStatus,
} from '../utils/certificate-flow';

const initialPayload: PengajuanPayload = {
  nomor_sertifikat: '',
  nib: '',
  lokasi_tanah: '',
  luas_tanah: 0,
  nomor_akta: '',
  tanggal_akta: '',
  jenis_transaksi: 'JUAL_BELI',
  data_sertifikat: { jenis_hak: 'SHM', keterangan: '' },
  pihak_transaksi: [
    { peran: 'PEMILIK_LAMA', nama: '', nomor_identitas: '', alamat: '' },
    { peran: 'PEMILIK_BARU', nama: '', nomor_identitas: '', alamat: '' },
  ],
};

interface SelectedDocumentFile {
  jenisDokumen: string;
  file: File;
}

const REQUIRED_DOCUMENT_TYPES: Record<string, string[]> = {
  JUAL_BELI: ['SERTIFIKAT_TANAH', 'AKTA_JUAL_BELI', 'IDENTITAS_PENJUAL', 'IDENTITAS_PEMBELI'],
  HIBAH: ['SERTIFIKAT_TANAH', 'AKTA_HIBAH', 'IDENTITAS_PEMBERI', 'IDENTITAS_PENERIMA'],
  WARIS: ['SERTIFIKAT_TANAH', 'AKTA_WARIS', 'IDENTITAS_PEWARIS', 'IDENTITAS_AHLI_WARIS'],
  PEMECAHAN: ['SERTIFIKAT_TANAH', 'AKTA_PEMECAHAN', 'IDENTITAS_PEMILIK'],
  PENGGABUNGAN: ['SERTIFIKAT_TANAH', 'AKTA_PENGGABUNGAN', 'IDENTITAS_PEMILIK'],
};

const DOCUMENT_LABELS: Record<string, string> = {
  SERTIFIKAT_TANAH: 'Sertifikat Tanah',
  AKTA_JUAL_BELI: 'Akta Jual Beli',
  IDENTITAS_PENJUAL: 'Identitas Penjual',
  IDENTITAS_PEMBELI: 'Identitas Pembeli',
  AKTA_HIBAH: 'Akta Hibah',
  IDENTITAS_PEMBERI: 'Identitas Pemberi',
  IDENTITAS_PENERIMA: 'Identitas Penerima',
  AKTA_WARIS: 'Akta Waris',
  IDENTITAS_PEWARIS: 'Identitas Pewaris',
  IDENTITAS_AHLI_WARIS: 'Identitas Ahli Waris',
  AKTA_PEMECAHAN: 'Akta Pemecahan',
  AKTA_PENGGABUNGAN: 'Akta Penggabungan',
  IDENTITAS_PEMILIK: 'Identitas Pemilik',
};

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getPengajuanId = (value: unknown) => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nested = record.pengajuan && typeof record.pengajuan === 'object'
    ? record.pengajuan as Record<string, unknown>
    : {};
  const id = record.id_pengajuan ?? record.id ?? nested.id_pengajuan ?? nested.id;
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeCreatedDocuments = (rows: unknown): Dokumen[] => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return {
      idDokumen: record.idDokumen as string | number ?? record.id_dokumen as string | number,
      idPengajuan: Number(record.idPengajuan ?? record.id_pengajuan ?? 0),
      jenisDokumen: String(record.jenisDokumen ?? record.jenis_dokumen ?? ''),
      namaFileAsli: record.namaFileAsli as string | null ?? record.nama_file_asli as string | null ?? null,
      mimeType: record.mimeType as string | null ?? record.mime_type as string | null ?? null,
      ukuranFile: Number(record.ukuranFile ?? record.ukuran_file ?? 0) || null,
      statusUpload: String(record.statusUpload ?? record.status_upload ?? 'PENDING') as Dokumen['statusUpload'],
      tanggalUpload: record.tanggalUpload as string | null ?? record.tanggal_upload as string | null ?? null,
      isActive: record.isActive as boolean ?? record.is_active as boolean ?? true,
    };
  }).filter((row) => row.idDokumen !== undefined && row.jenisDokumen);
};

const getCreateDocuments = (value: unknown) => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return normalizeCreatedDocuments(record.documents ?? record.dokumen);
};

export function PengajuanFormPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<PengajuanPayload>(initialPayload);
  const [loading, setLoading] = useState(false);
  const [submittingPengajuan, setSubmittingPengajuan] = useState(false);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createdPengajuanId, setCreatedPengajuanId] = useState<number | null>(null);
  const [createdDocuments, setCreatedDocuments] = useState<Dokumen[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<SelectedDocumentFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [certificateCheckStatus, setCertificateCheckStatus] =
    useState<CertificateCheckStatus>('unchecked');

  const requiredDocuments = REQUIRED_DOCUMENT_TYPES[payload.jenis_transaksi] || [];
  const selectedByType = new Map(selectedDocuments.map((item) => [item.jenisDokumen, item.file]));
  const uploadedTypes = new Set(
    createdDocuments
      .filter((document) => document.statusUpload === 'UPLOADED')
      .map((document) => document.jenisDokumen || '')
  );
  const allRequiredUploaded =
    requiredDocuments.length > 0 && requiredDocuments.every((type) => uploadedTypes.has(type));

  const setField = (key: keyof PengajuanPayload, value: unknown) => {
    setPayload((current) => ({ ...current, [key]: value }));
    if (key === 'nomor_sertifikat') setCertificateCheckStatus('unchecked');
    if (key === 'jenis_transaksi') {
      setSelectedDocuments([]);
      setFileErrors({});
      setCreatedPengajuanId(null);
      setCreatedDocuments([]);
      setSuccessMessage('');
    }
  };

  const setParty = (index: number, key: string, value: string) => {
    setPayload((current) => ({
      ...current,
      pihak_transaksi: current.pihak_transaksi.map((party, partyIndex) =>
        partyIndex === index ? { ...party, [key]: value } : party,
      ),
    }));
  };

  const checkCertificate = async () => {
    const nomorSertifikat = payload.nomor_sertifikat.trim();
    if (!nomorSertifikat) {
      setCertificateCheckStatus('unchecked');
      return 'unchecked' as const;
    }

    setCertificateCheckStatus('checking');
    try {
      const verification = await blockchainService.verify(nomorSertifikat);
      const status = getCertificateCheckStatus(verification);
      setCertificateCheckStatus(status);
      return status;
    } catch {
      setCertificateCheckStatus('error');
      return 'error' as const;
    }
  };

  const handleFileChange = (jenisDokumen: string, file: File | null) => {
    setSuccessMessage('');
    setMessage('');

    if (!file) {
      setSelectedDocuments((current) =>
        current.filter((item) => item.jenisDokumen !== jenisDokumen)
      );
      setFileErrors((current) => ({ ...current, [jenisDokumen]: '' }));
      return;
    }

    if (!ALLOWED_MIME.has(file.type)) {
      setFileErrors((current) => ({
        ...current,
        [jenisDokumen]: 'Hanya PDF, JPEG, atau PNG yang diizinkan.',
      }));
      setSelectedDocuments((current) =>
        current.filter((item) => item.jenisDokumen !== jenisDokumen)
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileErrors((current) => ({
        ...current,
        [jenisDokumen]: `Ukuran maksimum ${formatBytes(MAX_FILE_SIZE_BYTES)}.`,
      }));
      setSelectedDocuments((current) =>
        current.filter((item) => item.jenisDokumen !== jenisDokumen)
      );
      return;
    }

    setFileErrors((current) => ({ ...current, [jenisDokumen]: '' }));
    setSelectedDocuments((current) => [
      ...current.filter((item) => item.jenisDokumen !== jenisDokumen),
      { jenisDokumen, file },
    ]);
  };

  const saveAndUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setSuccessMessage('');
    let pendingPengajuanId = createdPengajuanId;
    try {
      if (certificateCheckStatus === 'unchecked' || certificateCheckStatus === 'error') {
        await checkCertificate();
      }

      const missingFiles = requiredDocuments.filter((type) => !selectedByType.has(type));
      if (missingFiles.length > 0) {
        throw new Error(
          `Pilih file untuk: ${missingFiles.map((type) => DOCUMENT_LABELS[type] || type).join(', ')}`
        );
      }

      let idPengajuan = createdPengajuanId;
      let documents = createdDocuments;

      if (!idPengajuan) {
        const created = await pengajuanService.create(payload);
        idPengajuan = getPengajuanId(created);
        if (!idPengajuan) {
          throw new Error('Backend tidak mengembalikan idPengajuan.');
        }
        pendingPengajuanId = idPengajuan;

        documents = getCreateDocuments(created);
        if (documents.length === 0) {
          documents = await dokumenService.list(idPengajuan);
        }

        setCreatedPengajuanId(idPengajuan);
        setCreatedDocuments(documents);
      }

      const documentByType = new Map(documents.map((document) => [document.jenisDokumen, document]));
      const missingRows = requiredDocuments.filter((type) => !documentByType.get(type)?.idDokumen);
      if (missingRows.length > 0) {
        throw new Error(
          `Row dokumen belum tersedia untuk: ${missingRows.map((type) => DOCUMENT_LABELS[type] || type).join(', ')}`
        );
      }

      const formData = new FormData();
      const metadata: Array<{ idDokumen: string; jenisDokumen: string }> = [];

      for (const jenisDokumen of requiredDocuments) {
        const file = selectedByType.get(jenisDokumen);
        const row = documentByType.get(jenisDokumen);
        if (file && row) {
          formData.append('files', file, file.name);
          metadata.push({ idDokumen: String(row.idDokumen), jenisDokumen });
        }
      }
      formData.append('documentMetadata', JSON.stringify(metadata));

      await dokumenService.uploadFiles(idPengajuan, formData);
      const refreshedDocuments = await dokumenService.list(idPengajuan);

      setCreatedDocuments(refreshedDocuments);
      setSuccessMessage('Pengajuan tersimpan dan dokumen berhasil diunggah.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan dan mengunggah dokumen');
      if (pendingPengajuanId) {
        dokumenService
          .list(pendingPengajuanId)
          .then(setCreatedDocuments)
          .catch(() => undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitPengajuan = async () => {
    if (!createdPengajuanId || !allRequiredUploaded || submittingPengajuan) return;

    setSubmittingPengajuan(true);
    setMessage('');
    try {
      await pengajuanService.submit(createdPengajuanId);
      navigate('/ppat/dashboard');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal mengirim pengajuan');
    } finally {
      setSubmittingPengajuan(false);
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Pengajuan Sertifikat</h1>
          <p>Isi data sertifikat, para pihak, dan pilih dokumen pendukung.</p>
        </div>
      </div>

      <form className="card form-grid wide" onSubmit={saveAndUpload}>
        <h2>Informasi Sertifikat</h2>
        <div className="two-col">
          <label>
            Nomor Sertifikat
            <div className="certificate-check-field">
              <input
                value={payload.nomor_sertifikat}
                onChange={(e) => setField('nomor_sertifikat', e.target.value)}
                required
              />
              <button
                type="button"
                className="secondary-button"
                disabled={!payload.nomor_sertifikat.trim() || certificateCheckStatus === 'checking'}
                onClick={() => void checkCertificate()}
              >
                {certificateCheckStatus === 'checking' ? 'Memeriksa...' : 'Cek Sertifikat'}
              </button>
            </div>
          </label>
          <label>
            NIB
            <input value={payload.nib} onChange={(e) => setField('nib', e.target.value)} />
          </label>
          <label>
            Lokasi Tanah
            <input value={payload.lokasi_tanah} onChange={(e) => setField('lokasi_tanah', e.target.value)} />
          </label>
          <label>
            Luas Tanah
            <input type="number" value={payload.luas_tanah} onChange={(e) => setField('luas_tanah', Number(e.target.value))} />
          </label>
          <label>
            Nomor Akta
            <input value={payload.nomor_akta} onChange={(e) => setField('nomor_akta', e.target.value)} />
          </label>
          <label>
            Tanggal Akta
            <input type="date" value={payload.tanggal_akta} onChange={(e) => setField('tanggal_akta', e.target.value)} />
          </label>
          <label>
            Jenis Transaksi
            <select value={payload.jenis_transaksi} onChange={(e) => setField('jenis_transaksi', e.target.value)}>
              <option value="JUAL_BELI">Jual Beli</option>
              <option value="HIBAH">Hibah</option>
              <option value="WARIS">Waris</option>
              <option value="PEMECAHAN">Pemecahan</option>
              <option value="PENGGABUNGAN">Penggabungan</option>
            </select>
            <small className="transaction-helper">
              {getTransactionHelperText(payload.jenis_transaksi)}
            </small>
          </label>
        </div>

        {certificateCheckStatus !== 'unchecked' && certificateCheckStatus !== 'checking' && (
          <div
            className={`certificate-flow-banner ${
              certificateCheckStatus === 'exists'
                ? 'certificate-flow-existing'
                : certificateCheckStatus === 'not_found'
                  ? 'certificate-flow-new'
                  : 'certificate-flow-error'
            }`}
          >
            <strong>
              {certificateCheckStatus === 'exists'
                ? 'Pembaruan Sertifikat Existing'
                : certificateCheckStatus === 'not_found'
                  ? 'Pencatatan Sertifikat Baru'
                  : 'Status Sertifikat Belum Terverifikasi'}
            </strong>
            <span>
              {certificateCheckStatus === 'exists'
                ? 'Sertifikat sudah tercatat. Pengajuan ini akan diproses sebagai pembaruan data setelah disetujui ATR/BPN.'
                : certificateCheckStatus === 'not_found'
                  ? 'Sertifikat belum tercatat di sistem. Pengajuan ini akan diproses sebagai pendaftaran data baru setelah disetujui ATR/BPN.'
                  : 'Status sertifikat belum dapat diverifikasi. ATR/BPN perlu melakukan pengecekan ulang saat proses approval.'}
            </span>
          </div>
        )}

        <h2>Data Para Pihak</h2>
        <div className="two-col">
          {payload.pihak_transaksi.map((party, index) => (
            <fieldset key={String(party.peran)}>
              <legend>{party.peran === 'PEMILIK_LAMA' ? 'Pemilik Lama' : 'Pemilik Baru'}</legend>
              <label>
                Nama
                <input value={String(party.nama || '')} onChange={(e) => setParty(index, 'nama', e.target.value)} required />
              </label>
              <label>
                Nomor Identitas
                <input value={String(party.nomor_identitas || '')} onChange={(e) => setParty(index, 'nomor_identitas', e.target.value)} />
              </label>
              <label>
                Alamat
                <textarea value={String(party.alamat || '')} onChange={(e) => setParty(index, 'alamat', e.target.value)} />
              </label>
            </fieldset>
          ))}
        </div>

        <h2>Dokumen Pendukung</h2>
        <div className="document-picker-list">
          {requiredDocuments.map((jenisDokumen) => {
            const selectedFile = selectedByType.get(jenisDokumen);
            const uploadedDocument = createdDocuments.find(
              (document) => document.jenisDokumen === jenisDokumen
            );
            const status = uploadedDocument?.statusUpload;

            return (
              <div className="document-picker-row" key={jenisDokumen}>
                <div>
                  <strong>{DOCUMENT_LABELS[jenisDokumen] || jenisDokumen}</strong>
                  <span className="muted">{jenisDokumen}</span>
                </div>
                <div>
                  {selectedFile ? (
                    <span>
                      {selectedFile.name}{' '}
                      <span className="muted">({formatBytes(selectedFile.size)})</span>
                    </span>
                  ) : (
                    <span className="muted">Belum dipilih</span>
                  )}
                  {fileErrors[jenisDokumen] && (
                    <small className="file-error">{fileErrors[jenisDokumen]}</small>
                  )}
                </div>
                <div>
                  <span className={`status-badge ${status === 'UPLOADED' ? 'success' : 'warning'}`}>
                    {status === 'UPLOADED' ? 'Dokumen lengkap' : 'Menunggu berkas'}
                  </span>
                </div>
                <label className="file-picker-button">
                  Pilih File
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={loading || allRequiredUploaded}
                    onChange={(e) =>
                      handleFileChange(jenisDokumen, e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
        <p className="muted">
          Pilih semua dokumen wajib, lalu simpan untuk mengunggah berkas pendukung.
        </p>

        {message && <div className="alert danger">{message}</div>}
        {successMessage && <div className="alert success">{successMessage}</div>}
        <div className="button-row">
          <button className="primary-button" disabled={loading || allRequiredUploaded}>
            {loading
              ? 'Menyimpan dan mengunggah...'
              : createdPengajuanId
                ? 'Unggah Dokumen'
                : 'Simpan Draft dan Unggah Dokumen'}
          </button>
          {createdPengajuanId && (
            <button
              type="button"
              className="secondary-button"
              disabled={!allRequiredUploaded || submittingPengajuan}
              onClick={() => void submitPengajuan()}
            >
              {submittingPengajuan ? 'Mengirim...' : 'Submit Pengajuan'}
            </button>
          )}
        </div>
      </form>
      <style>{pengajuanFlowStyles}</style>
    </section>
  );
}

const pengajuanFlowStyles = `
  .certificate-check-field { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
  .certificate-check-field .secondary-button { align-self: stretch; white-space: nowrap; }
  .transaction-helper { display: block; margin-top: 7px; color: #667085; line-height: 1.45; }
  .certificate-flow-banner { display: grid; gap: 6px; padding: 14px 16px; border: 1px solid; border-radius: 10px; }
  .certificate-flow-banner strong { font-size: 14px; }
  .certificate-flow-banner span, .certificate-flow-banner small { line-height: 1.5; }
  .certificate-flow-existing { border-color: #b2ccff; color: #1849a9; background: #eff4ff; }
  .certificate-flow-new { border-color: #abefc6; color: #067647; background: #ecfdf3; }
  .certificate-flow-error { border-color: #fedf89; color: #b54708; background: #fffaeb; }
  .document-picker-list { display: grid; gap: 10px; }
  .document-picker-row {
    display: grid;
    grid-template-columns: minmax(150px, 1.1fr) minmax(180px, 1.5fr) minmax(130px, auto) auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    background: #fff;
  }
  .document-picker-row strong,
  .document-picker-row span,
  .document-picker-row small { display: block; }
  .file-error { color: var(--danger); margin-top: 4px; }
  .file-picker-button {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px 12px;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    background: #fff;
    color: #344054;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .file-picker-button input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .file-picker-button:has(input:disabled) {
    cursor: not-allowed;
    opacity: 0.6;
  }
  @media (max-width: 620px) {
    .certificate-check-field { grid-template-columns: 1fr; }
    .document-picker-row { grid-template-columns: 1fr; align-items: stretch; }
  }
`;
