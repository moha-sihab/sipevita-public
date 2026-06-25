import { apiRequest, tokenStore } from '../api/client';
import { API_BASE_URL } from '../config/env';
import type { ApiResponse, Dokumen, SignedDownloadLink, SignedPreviewLink, UploadDocumentResult } from '../types/api';

export const dokumenService = {
  list: (idPengajuan: number): Promise<Dokumen[]> =>
    apiRequest<Dokumen[]>(`/api/pengajuan/${idPengajuan}/dokumen`),

  download: (idPengajuan: number, idDokumen: string | number): Promise<SignedDownloadLink> =>
    apiRequest<SignedDownloadLink>(`/api/pengajuan/${idPengajuan}/dokumen/${idDokumen}/download`),

  preview: (idPengajuan: number, idDokumen: string | number): Promise<SignedPreviewLink> =>
    apiRequest<SignedPreviewLink>(`/api/pengajuan/${idPengajuan}/dokumen/${idDokumen}/preview`),

  // FormData upload: don't use apiRequest so browser sets multipart Content-Type with boundary
  uploadFiles: async (idPengajuan: number, formData: FormData): Promise<UploadDocumentResult> => {
    const token = tokenStore.get();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/api/pengajuan/${idPengajuan}/dokumen/upload`,
      { method: 'POST', headers, body: formData }
    );
    const payload = (await response.json().catch(() => null)) as ApiResponse<UploadDocumentResult> | null;

    if (!response.ok || !payload?.success) {
      const message =
        payload?.message ||
        (typeof payload?.error === 'string' ? payload.error : null) ||
        `Upload gagal dengan status ${response.status}`;
      throw new Error(message);
    }

    return payload.data as UploadDocumentResult;
  },
};
