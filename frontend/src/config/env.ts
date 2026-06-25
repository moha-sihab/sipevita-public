export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3001';

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

export const TURNSTILE_ENABLED =
  parseBoolean(import.meta.env.VITE_TURNSTILE_ENABLED, Boolean(TURNSTILE_SITE_KEY));
