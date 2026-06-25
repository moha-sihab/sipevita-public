import { formatStatus } from '../utils/format';

export function StatusBadge({ status }: { status?: string }) {
  const value = status || 'MENUNGGU_VERIFIKASI';
  const normalized = value.toUpperCase();
  const tone =
    normalized.includes('SETUJUI') || normalized.includes('VALID') || normalized === 'ACTIVE'
      ? 'success'
      : normalized.includes('TOLAK') || normalized.includes('INVALID')
        ? 'danger'
        : normalized.includes('OFFCHAIN')
          ? 'info'
          : 'warning';

  return <span className={`status-badge ${tone}`}>{formatStatus(value)}</span>;
}
