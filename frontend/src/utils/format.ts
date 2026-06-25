const statusLabels: Record<string, string> = {
  DIAJUKAN: 'Draft',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak',
  STATUS_TIDAK_TERSEDIA: 'Status tidak tersedia',
};

export const normalizeStatus = (value?: unknown) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return normalized || 'STATUS_TIDAK_TERSEDIA';
};

export const getStatus = (item: { status_pengajuan?: unknown; status?: unknown }) =>
  normalizeStatus(item.status_pengajuan || item.status);

export const formatStatus = (status: string) => {
  const normalized = normalizeStatus(status);
  return (
    statusLabels[normalized] ||
    normalized
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
  );
};

export const formatDate = (value?: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value?: unknown) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return `${new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)} pukul ${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)} WIB`;
};

export const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
