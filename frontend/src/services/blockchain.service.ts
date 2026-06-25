import { apiRequest } from '../api/client';
import type { BlockchainHistoryResponse } from '../types/api';

export const blockchainService = {
  verify: (nomorSertifikat: string) =>
    apiRequest<Record<string, unknown>>(
      `/api/blockchain/verify/${encodeURIComponent(nomorSertifikat)}`,
    ),
  history: (nomorSertifikat: string) =>
    apiRequest<BlockchainHistoryResponse>(
      `/api/blockchain/history/${encodeURIComponent(nomorSertifikat)}`,
    ),
};
