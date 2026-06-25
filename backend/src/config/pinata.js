const { PinataSDK } = require('pinata');
const env = require('./env');
const AppError = require('../utils/app-error');

const isPlaceholder = (value) =>
  !value ||
  value.includes('your_') ||
  value.includes('placeholder') ||
  value.includes('dummy') ||
  value.includes('<your');

const validatePinataConfig = () => {
  const missing = [];
  if (isPlaceholder(env.pinataJwt)) missing.push('PINATA_JWT');
  if (!env.pinataGateway || isPlaceholder(env.pinataGateway)) missing.push('PINATA_GATEWAY');

  const networkValid = env.pinataNetwork === 'private';

  return { configured: missing.length === 0 && networkValid, missing, networkValid };
};

const getPinataConfig = () => ({
  network: env.pinataNetwork,
  signedUrlExpiresSeconds: env.pinataSignedUrlExpiresSeconds,
  maxFileSizeMb: env.documentMaxFileSizeMb,
  maxFiles: env.documentMaxFiles,
  allowedMimeTypes: env.documentAllowedMimeTypes,
});

let _client = null;

const getPinataClient = () => {
  if (!_client) {
    const { configured, missing, networkValid } = validatePinataConfig();

    if (!networkValid) {
      throw new AppError('Konfigurasi private Pinata belum lengkap.', 503, {
        code: 'PINATA_CONFIG_INVALID',
        message: 'PINATA_NETWORK harus bernilai "private". Unggah ke public IPFS tidak diizinkan.',
      });
    }

    if (!configured) {
      throw new AppError('Konfigurasi private Pinata belum lengkap.', 503, {
        code: 'PINATA_CONFIG_INVALID',
        missingCount: missing.length,
      });
    }

    _client = new PinataSDK({
      pinataJwt: env.pinataJwt,
      pinataGateway: env.pinataGateway,
    });
  }
  return _client;
};

module.exports = { validatePinataConfig, getPinataConfig, getPinataClient };
