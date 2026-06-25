import { useCallback, useRef, useState } from 'react';
import { blockchainService } from '../services/blockchain.service';
import { publicService } from '../services/public.service';
import { ErrorState, LoadingState } from '../components/State';
import { OwnershipHistoryResult } from '../components/OwnershipHistoryResult';
import { useAuth } from '../contexts/AuthContext';
import type { BlockchainHistoryResponse } from '../types/api';
import { asRecord, normalizeHistoryResponse } from '../utils/history';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../components/TurnstileWidget';
import { TURNSTILE_ENABLED } from '../config/env';

interface CertificateInfo {
  lokasi_tanah?: unknown;
  luas_tanah?: unknown;
}

export function RiwayatPage() {
  const { user } = useAuth();
  const [nomorSertifikat, setNomorSertifikat] = useState('');
  const [history, setHistory] = useState<BlockchainHistoryResponse | null>(null);
  const [certificateInfo, setCertificateInfo] = useState<CertificateInfo | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const resetTurnstile = useCallback(() => {
    turnstileRef.current?.reset();
  }, []);

  const handleTurnstileError = useCallback(() => {
    setError('Verifikasi CAPTCHA gagal. Coba muat ulang halaman atau ulangi pencarian.');
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user && TURNSTILE_ENABLED && !turnstileToken.trim()) {
      setError('Selesaikan verifikasi CAPTCHA terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setHistory(null);
    setCertificateInfo(null);
    try {
      const data = user
        ? await blockchainService.history(nomorSertifikat)
        : await publicService.history(nomorSertifikat, turnstileToken);
      const normalizedHistory = normalizeHistoryResponse(data);
      const latestItem = normalizedHistory.items[normalizedHistory.items.length - 1];
      const latestValue = asRecord(latestItem?.value);

      setHistory(normalizedHistory);
      setCertificateInfo({
        lokasi_tanah: latestValue.lokasi_tanah,
        luas_tanah: latestValue.luas_tanah,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil riwayat');
    } finally {
      setLoading(false);
      if (!user) resetTurnstile();
    }
  };

  const turnstileRequired = !user && TURNSTILE_ENABLED;
  const turnstileVerified = !turnstileRequired || Boolean(turnstileToken.trim());
  const canSubmit = Boolean(nomorSertifikat.trim()) && turnstileVerified && !loading;

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Riwayat Kepemilikan</h1>
          <p>Cari riwayat kepemilikan berdasarkan nomor sertifikat.</p>
        </div>
      </div>
      <form className="search-card" onSubmit={submit}>
        <label>
          Nomor Sertifikat
          <input value={nomorSertifikat} onChange={(event) => setNomorSertifikat(event.target.value)} required />
        </label>
        {!user && (
          <TurnstileWidget
            ref={turnstileRef}
            action="public_history"
            disabled={loading}
            onTokenChange={setTurnstileToken}
            onExpired={resetTurnstile}
            onError={handleTurnstileError}
          />
        )}
        <button
          className="primary-button"
          disabled={!canSubmit}
        >
          Cari Riwayat
        </button>
      </form>
      {loading && <LoadingState label="Mengambil riwayat kepemilikan..." />}
      {error && <ErrorState message={error} />}
      {history !== null && (
        <OwnershipHistoryResult
          history={history}
          isPublic={!user}
          certificateInfo={certificateInfo || undefined}
        />
      )}
    </section>
  );
}
