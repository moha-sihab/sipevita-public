import { apiRequest, buildQuery } from '../api/client';
import type { ListResponse, Pengajuan } from '../types/api';
import { normalizePengajuan, normalizePengajuanList } from '../utils/pengajuan';

export interface PengajuanPayload {
  nomor_sertifikat: string;
  nib?: string;
  lokasi_tanah?: string;
  luas_tanah?: number;
  nomor_akta?: string;
  tanggal_akta?: string;
  jenis_transaksi: string;
  data_sertifikat?: Record<string, unknown>;
  pihak_transaksi: Array<Record<string, unknown>>;
  dokumen?: Array<Record<string, unknown>>;
}

export const pengajuanService = {
  list: async (filters: { status?: string; nomor_sertifikat?: string } = {}) =>
    normalizePengajuanList(
      await apiRequest<ListResponse<Pengajuan>>(`/api/pengajuan${buildQuery(filters)}`),
    ),
  detail: async (id: string | number) =>
    normalizePengajuan(await apiRequest<Pengajuan>(`/api/pengajuan/${id}`)),
  create: async (payload: PengajuanPayload) =>
    normalizePengajuan(await apiRequest<Pengajuan>('/api/pengajuan', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  submit: async (id: string | number) =>
    normalizePengajuan(await apiRequest<Pengajuan>(`/api/pengajuan/${id}/submit`, {
      method: 'POST',
    })),
};
