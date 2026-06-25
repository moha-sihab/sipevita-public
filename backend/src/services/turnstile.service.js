const crypto = require('node:crypto');
const env = require('../config/env');
const AppError = require('../utils/app-error');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const verifyToken = async (token, remoteIp) => {
  if (!env.turnstileEnabled) return { success: true, skipped: true };

  if (!env.turnstileSecretKey) {
    throw new AppError('Verifikasi Turnstile belum dikonfigurasi.', 503, {
      code: 'TURNSTILE_NOT_CONFIGURED',
    });
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new AppError('Verifikasi CAPTCHA wajib diselesaikan.', 400, {
      code: 'TURNSTILE_TOKEN_REQUIRED',
    });
  }

  const body = new URLSearchParams({
    secret: env.turnstileSecretKey,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });

  if (remoteIp) body.set('remoteip', remoteIp);

  let response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new AppError('Verifikasi CAPTCHA sementara tidak tersedia.', 503, {
      code: 'TURNSTILE_UNAVAILABLE',
    });
  }

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.success !== true) {
    throw new AppError('Verifikasi CAPTCHA tidak valid.', 403, {
      code: 'TURNSTILE_INVALID',
    });
  }

  return { success: true };
};

module.exports = {
  verifyToken,
};
