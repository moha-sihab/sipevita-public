import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Search, ShieldCheck, XCircle } from 'lucide-react';
import { publicService } from '../services/public.service';
import { ErrorState, LoadingState } from '../components/State';
import { formatDate, formatStatus } from '../utils/format';
import { asRecord, displayValue } from '../utils/history';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../components/TurnstileWidget';
import { TURNSTILE_ENABLED } from '../config/env';

interface VerificationResult {
  nomor_sertifikat?: string;
  nib?: string;
  lokasi_tanah?: string;
  luas_tanah?: number | string;
  status_tanah?: string;
  jenis_transaksi_terakhir?: string;
  status_verifikasi?: string;
  blockchain_verification?: {
    status?: string;
    source?: string;
    message?: string;
  };
  updated_at?: string;
  [key: string]: unknown;
}

type VerificationTone = 'success' | 'danger' | 'warning' | 'info';

const normalizeVerification = (value: unknown): VerificationResult => asRecord(value) as VerificationResult;

const getVerificationTone = (status: unknown): VerificationTone => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'VALID') return 'success';
  if (normalized.includes('TIDAK_VALID')) return 'danger';
  if (normalized.includes('TIDAK_DITEMUKAN') || normalized.includes('NOT_FOUND')) return 'warning';
  return 'info';
};

const getVerificationCopy = (status: unknown) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'VALID') {
    return 'Sertifikat tanah ini terdaftar dan telah diverifikasi pada sistem blockchain.';
  }
  if (normalized.includes('TIDAK_VALID')) {
    return 'Data sertifikat ditemukan, tetapi tidak cocok dengan catatan blockchain.';
  }
  if (normalized.includes('TIDAK_DITEMUKAN')) {
    return 'Nomor sertifikat belum ditemukan pada basis data SIPEVITA.';
  }
  return 'Data sertifikat ditemukan, tetapi status blockchain belum dapat dipastikan saat ini.';
};

const getStatusIcon = (tone: VerificationTone) => {
  if (tone === 'success') return <CheckCircle2 size={28} />;
  if (tone === 'danger') return <XCircle size={28} />;
  if (tone === 'warning') return <AlertTriangle size={28} />;
  return <Info size={28} />;
};

export function PublicVerifyPage() {
  const [nomorSertifikat, setNomorSertifikat] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const resetTurnstile = useCallback(() => {
    turnstileRef.current?.reset();
  }, []);

  const handleTurnstileError = useCallback(() => {
    setError('Verifikasi CAPTCHA gagal. Coba muat ulang halaman atau ulangi verifikasi.');
  }, []);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (TURNSTILE_ENABLED && !turnstileToken.trim()) {
      setError('Selesaikan verifikasi CAPTCHA terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const verification = normalizeVerification(await publicService.verify(nomorSertifikat, turnstileToken));
      setResult(verification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal');
    } finally {
      setLoading(false);
      resetTurnstile();
    }
  };

  const status = result?.status_verifikasi || 'STATUS_TIDAK_TERSEDIA';
  const tone = getVerificationTone(status);
  const turnstileRequired = TURNSTILE_ENABLED;
  const turnstileVerified = !turnstileRequired || Boolean(turnstileToken.trim());
  const canSubmit = Boolean(nomorSertifikat.trim()) && turnstileVerified && !loading;

  return (
    <section className="verify-page">
      <style>{verifyPageStyles}</style>

      <div className="verify-heading">
        <div>
          <h1>Verifikasi Sertifikat Tanah</h1>
          <p>Periksa status sertifikat tanpa membuka data sensitif pemilik.</p>
        </div>
        <ShieldCheck size={42} />
      </div>

      <form className="verify-search" onSubmit={verify}>
        <label>
          Nomor Sertifikat
          <input
            value={nomorSertifikat}
            onChange={(event) => setNomorSertifikat(event.target.value)}
            placeholder="Contoh: SHM-001/BOGOR/2026"
            required
          />
        </label>
        <TurnstileWidget
          ref={turnstileRef}
          action="public_verify"
          disabled={loading}
          onTokenChange={setTurnstileToken}
          onExpired={resetTurnstile}
          onError={handleTurnstileError}
        />
        <button
          className="primary-button"
          disabled={!canSubmit}
        >
          <Search size={18} />
          Verifikasi
        </button>
      </form>

      {loading && <LoadingState label="Memeriksa sertifikat..." />}
      {error && <ErrorState message={error} />}

      {result && (
        <div className="verify-results">
          <article className="verify-card">
            <h2>Hasil Verifikasi Sertifikat</h2>
            <div className={`verify-status-box ${tone}`}>
              <div className="verify-status-icon">{getStatusIcon(tone)}</div>
              <div>
                <span>{String(status).replace(/_/g, ' ').toUpperCase()}</span>
                <p>{getVerificationCopy(status)}</p>
              </div>
            </div>

            <h3>Informasi Sertifikat</h3>
            <dl className="verify-details">
              <div>
                <dt>Nomor Sertifikat</dt>
                <dd>{displayValue(result.nomor_sertifikat || nomorSertifikat)}</dd>
              </div>
              <div>
                <dt>Nomor Identifikasi Bidang Tanah (NIB)</dt>
                <dd>{displayValue(result.nib)}</dd>
              </div>
              <div>
                <dt>Wilayah / Kabupaten</dt>
                <dd>{displayValue(result.lokasi_tanah)}</dd>
              </div>
              <div>
                <dt>Luas Tanah</dt>
                <dd>{result.luas_tanah ? `${result.luas_tanah} m²` : '-'}</dd>
              </div>
              <div>
                <dt>Status Sertifikat</dt>
                <dd>{formatStatus(String(result.status_verifikasi || result.status_tanah || '-'))}</dd>
              </div>
              <div>
                <dt>Jenis Transaksi Terakhir</dt>
                <dd>{result.jenis_transaksi_terakhir ? formatStatus(result.jenis_transaksi_terakhir) : '-'}</dd>
              </div>
              <div>
                <dt>Tanggal Pencatatan Blockchain</dt>
                <dd>{formatDate(result.updated_at)}</dd>
              </div>
              <div>
                <dt>Sumber Verifikasi</dt>
                <dd>{displayValue(result.blockchain_verification?.source || 'SIPEVITA')}</dd>
              </div>
            </dl>

            <div className="verify-privacy-note">
              <Info size={16} />
              <p>Untuk melindungi privasi, informasi pemilik sertifikat tidak ditampilkan pada halaman verifikasi publik.</p>
            </div>
          </article>

        </div>
      )}
    </section>
  );
}

const verifyPageStyles = `
  .verify-page {
    width: min(880px, 100%);
    margin: 0 auto;
  }

  .verify-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 18px;
    color: #172033;
  }

  .verify-heading h1 {
    margin-bottom: 5px;
    font-size: 28px;
  }

  .verify-heading p {
    margin: 0;
    color: #667085;
  }

  .verify-heading svg {
    flex: 0 0 auto;
    color: #004aad;
  }

  .verify-search {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: end;
    margin-bottom: 28px;
    padding: 18px;
    border: 1px solid #d9e0ec;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 8px 22px rgba(16, 24, 40, 0.06);
  }

  .turnstile-block,
  .turnstile-message {
    grid-column: 1 / -1;
  }

  .turnstile-block {
    display: flex;
    min-height: 65px;
  }

  .turnstile-message {
    margin: 0;
    color: #b42318;
    font-size: 13px;
  }

  .verify-results {
    display: grid;
    gap: 28px;
  }

  .verify-card {
    overflow: hidden;
    padding: 28px;
    border: 1px solid #e4e7ec;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 14px 28px rgba(16, 24, 40, 0.08);
  }

  .verify-card h2 {
    margin: 0 0 20px;
    font-size: 21px;
  }

  .verify-card h3 {
    margin: 22px 0 10px;
    font-size: 15px;
  }

  .verify-status-box {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
    padding: 18px;
    border-radius: 8px;
    border: 1px solid;
  }

  .verify-status-box span {
    display: inline-flex;
    margin-bottom: 8px;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .02em;
  }

  .verify-status-box p {
    margin: 0;
    color: #344054;
    font-size: 14px;
  }

  .verify-status-icon {
    display: grid;
    place-items: center;
    padding-top: 2px;
  }

  .verify-status-box.success {
    border-color: #86efac;
    background: #ecfdf3;
    color: #067647;
  }

  .verify-status-box.success span {
    background: #d1fadf;
    color: #067647;
  }

  .verify-status-box.danger {
    border-color: #fecdca;
    background: #fef3f2;
    color: #b42318;
  }

  .verify-status-box.danger span {
    background: #fee4e2;
    color: #b42318;
  }

  .verify-status-box.warning {
    border-color: #fedf89;
    background: #fffaeb;
    color: #b54708;
  }

  .verify-status-box.warning span {
    background: #fef0c7;
    color: #b54708;
  }

  .verify-status-box.info {
    border-color: #b2ddff;
    background: #eff8ff;
    color: #175cd3;
  }

  .verify-status-box.info span {
    background: #d1e9ff;
    color: #175cd3;
  }

  .verify-details {
    margin: 0;
  }

  .verify-details > div {
    display: grid;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid #e4e7ec;
  }

  .verify-details > div:last-child {
    border-bottom: 0;
  }

  .verify-details dt,
  .verify-timeline dt {
    margin: 0;
    color: #667085;
    font-size: 12px;
    font-weight: 700;
  }

  .verify-details dd,
  .verify-timeline dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    color: #172033;
    font-weight: 750;
  }

  .verify-privacy-note {
    display: flex;
    gap: 10px;
    margin-top: 18px;
    padding: 14px;
    border: 1px solid #b2ddff;
    border-radius: 8px;
    background: #eff8ff;
    color: #175cd3;
  }

  .verify-privacy-note p {
    margin: 0;
    font-size: 13px;
  }

  .verify-card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .verify-card-title-row h2 {
    margin: 0;
  }

  .verify-card-title-row span {
    border-radius: 999px;
    padding: 4px 10px;
    background: #eff8ff;
    color: #175cd3;
    font-size: 12px;
    font-weight: 800;
  }

  .verify-timeline {
    display: grid;
    gap: 0;
  }

  .verify-timeline-item {
    position: relative;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 14px;
    padding-bottom: 24px;
  }

  .verify-timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 20px;
    bottom: -2px;
    left: 9px;
    width: 2px;
    background: #d7e3f8;
  }

  .verify-timeline-dot {
    position: relative;
    z-index: 1;
    width: 20px;
    height: 20px;
    margin-top: 2px;
    border: 6px solid #004aad;
    border-radius: 50%;
    background: #fff;
  }

  .verify-timeline strong {
    display: block;
    margin-bottom: 2px;
    color: #004aad;
  }

  .verify-timeline p {
    margin: 0 0 4px;
    color: #172033;
    font-weight: 650;
  }

  .verify-timeline small {
    display: block;
    margin-bottom: 12px;
    color: #667085;
  }

  .verify-timeline dl {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 12px;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    background: #f9fafb;
  }

  .verify-empty-history {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    border: 1px dashed #b7c9e8;
    border-radius: 8px;
    color: #667085;
    background: #fbfcff;
  }

  .verify-empty-history p {
    margin: 0;
  }

  @media (max-width: 680px) {
    .verify-page {
      width: 100%;
    }

    .verify-heading {
      align-items: flex-start;
    }

    .verify-search {
      grid-template-columns: 1fr;
      padding: 16px;
    }

    .verify-search button {
      width: 100%;
    }

    .verify-card {
      padding: 20px;
    }

    .verify-status-box {
      grid-template-columns: 1fr;
    }

    .verify-card-title-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
