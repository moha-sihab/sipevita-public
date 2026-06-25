import { apiRequest, buildQuery } from '../api/client';
import type { ListResponse, Pengajuan } from '../types/api';
import { normalizePengajuan, normalizePengajuanList } from '../utils/pengajuan';

export interface ClaimResult {
  idPengajuan: number;
  idReviewer: number;
  status: string;
  claimed: boolean;
  alreadyOwnedByCurrentReviewer?: boolean;
}

export const reviewerService = {
  list: (
    filters: {
      status?: string;
      nomor_sertifikat?: string;
      jenis_transaksi?: string;
      id_notaris?: string;
    } = {},
  ) =>
    apiRequest<ListResponse<Pengajuan>>(`/api/reviewer/pengajuan${buildQuery(filters)}`)
      .then(normalizePengajuanList),
  detail: async (id: string | number) =>
    normalizePengajuan(await apiRequest<Pengajuan>(`/api/reviewer/pengajuan/${id}`)),
  claim: (id: string | number) =>
    apiRequest<ClaimResult>(`/api/reviewer/pengajuan/${id}/claim`, { method: 'POST' }),
  reject: (id: string | number, catatan_reviewer: string) =>
    apiRequest<Pengajuan>(`/api/reviewer/pengajuan/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ catatan_reviewer }),
    }),
  approve: (id: string | number, catatan_reviewer: string) =>
    apiRequest<Pengajuan>(`/api/reviewer/pengajuan/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ catatan_reviewer }),
    }),
};
