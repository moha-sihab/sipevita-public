import { apiRequest, buildQuery } from '../api/client';

export const logService = {
  list: (
    filters: {
      page?: number;
      limit?: number;
      jenis_aksi?: string;
      search?: string;
      id_pengguna?: string;
      start_date?: string;
      end_date?: string;
    } = {},
  ) => apiRequest<Record<string, unknown>>(`/api/logs${buildQuery(filters)}`),
  detail: (id: string | number) => apiRequest<{ log: Record<string, unknown> }>(`/api/logs/${id}`),
};
