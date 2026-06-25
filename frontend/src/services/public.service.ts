import { apiRequest, buildQuery } from '../api/client';

interface PublicLookupPayload {
  nomor_sertifikat: string;
  turnstile_token?: string;
}

const lookup = (path: string, nomorSertifikat: string, turnstileToken?: string) => {
  if (turnstileToken) {
    return apiRequest<Record<string, unknown>>(path, {
      auth: false,
      method: 'POST',
      body: JSON.stringify({
        nomor_sertifikat: nomorSertifikat,
        turnstile_token: turnstileToken,
      } satisfies PublicLookupPayload),
    });
  }

  return apiRequest<Record<string, unknown>>(
    `${path}${buildQuery({ nomor_sertifikat: nomorSertifikat })}`,
    { auth: false },
  );
};

export const publicService = {
  verify: (nomorSertifikat: string, turnstileToken?: string) =>
    lookup('/api/public/verify', nomorSertifikat, turnstileToken),
  history: (nomorSertifikat: string, turnstileToken?: string) =>
    lookup('/api/public/history', nomorSertifikat, turnstileToken),
};
