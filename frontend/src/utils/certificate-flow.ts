export type CertificateCheckStatus = 'unchecked' | 'checking' | 'exists' | 'not_found' | 'error';

const ownershipTransferTypes = new Set(['JUAL_BELI', 'HIBAH', 'WARIS']);

export const getCertificateCheckStatus = (
  verification: Record<string, unknown>,
): Exclude<CertificateCheckStatus, 'unchecked' | 'checking' | 'error'> => {
  const status = String(
    verification.status_verifikasi ||
      verification.verification_status ||
      verification.status ||
      '',
  )
    .trim()
    .toUpperCase();

  return status === 'TIDAK_DITEMUKAN' || status === 'NOT_FOUND' ? 'not_found' : 'exists';
};

export const getTransactionHelperText = (jenisTransaksi: string) =>
  ownershipTransferTypes.has(jenisTransaksi)
    ? 'Transaksi ini berpotensi mengubah kepemilikan sertifikat.'
    : 'Transaksi ini memperbarui data sertifikat/aset yang sudah tercatat.';
