const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const supabase = require('../config/supabase');
const env = require('../config/env');
const fabricConfig = require('../config/fabric');
const { testPinataAuthentication } = require('../services/pinata.service');
const { successResponse, errorResponse } = require('../utils/response');

const router = express.Router();

const getSafeSupabaseError = (error) => ({
  message: error.message || null,
  code: error.code || null,
  details: error.details || null,
  hint: error.hint || null,
});

router.get('/', (req, res) =>
  successResponse(res, 'Backend SIPEVITA berjalan.', {
    status: 'ok',
  })
);

router.get('/supabase', async (req, res) => {
  if (!supabase) {
    return errorResponse(
      res,
      'Klien Supabase belum dikonfigurasi.',
      'Konfigurasi SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum lengkap.',
      503
    );
  }

  try {
    const { data, error } = await supabase.from('pengguna').select('id_pengguna').limit(1);

    if (error) {
      return errorResponse(
        res,
        'Koneksi Supabase gagal.',
        getSafeSupabaseError(error),
        503
      );
    }

    return successResponse(res, 'Koneksi Supabase berhasil.', {
      status: 'connected',
      rowCount: data.length,
    });
  } catch {
    return errorResponse(res, 'Koneksi Supabase gagal.', 'Gagal menjalankan kueri Supabase.', 503);
  }
});

router.get('/fabric', (req, res) => {
  const isFabricMode = env.blockchainMode === 'fabric';
  const validation = fabricConfig.validateFabricConfig();

  const identityLabel = fabricConfig.identity || 'appUser';
  const identityFile = fabricConfig.walletPath
    ? path.join(fabricConfig.walletPath, `${identityLabel}.id`)
    : null;
  const identityExists = identityFile ? fs.existsSync(identityFile) : false;

  const ready =
    isFabricMode &&
    validation.configured &&
    validation.ready &&
    identityExists;

  const status = {
    configured: validation.configured && isFabricMode,
    ready,
    mode: env.blockchainMode,
    channel: fabricConfig.channelName || null,
    chaincode: fabricConfig.chaincodeName || null,
    connectionProfileExists: validation.connectionProfileExists,
    walletExists: validation.walletPathExists,
    identityExists,
    identity: identityLabel,
    ...(validation.missing.length > 0 && { missing: validation.missing }),
    ...(validation.unavailable.length > 0 && { unavailable: validation.unavailable }),
  };

  if (!ready) {
    return errorResponse(res, 'Fabric belum siap digunakan.', status, 503);
  }

  return successResponse(res, 'Konfigurasi Fabric siap digunakan.', status);
});

router.get('/pinata', async (req, res) => {
  let status;
  try {
    const result = await Promise.race([
      testPinataAuthentication(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ]);
    status = result;
  } catch {
    status = { configured: true, reachable: false };
  }

  if (!status.configured) {
    return errorResponse(
      res,
      'Pinata belum dikonfigurasi.',
      { code: 'PINATA_CONFIG_INVALID' },
      503
    );
  }

  if (!status.reachable) {
    return errorResponse(res, 'Autentikasi Pinata gagal.', { code: 'PINATA_AUTH_FAILED' }, 502);
  }

  return successResponse(res, 'Koneksi Pinata berhasil.', {
    configured: true,
    reachable: true,
  });
});

module.exports = router;
