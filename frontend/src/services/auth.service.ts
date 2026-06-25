import { apiRequest } from '../api/client';
import type { LoginResponse, User } from '../types/api';

export const authService = {
  login: (username: string, password: string, turnstileToken?: string) =>
    apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username, password, turnstile_token: turnstileToken }),
    }),
  me: () => apiRequest<{ user: User }>('/api/auth/me'),
};
