const { getPinataClient, validatePinataConfig } = require('../config/pinata');
const AppError = require('../utils/app-error');
const env = require('../config/env');

const normalizePinataError = (error, code = 'PINATA_PRIVATE_UPLOAD_FAILED') => {
  const raw = error?.message || 'Operasi Pinata gagal.';
  const safe = raw
    .replace(/Bearer\s+\S+/gi, '[REDACTED]')
    .replace(/pinataJwt[^,}\s]*/gi, '[REDACTED]')
    .replace(/Authorization[^,}\s]*/gi, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
  return new AppError(safe, 502, { code });
};

const validatePinataConfiguration = () => {
  const { configured, missing, networkValid } = validatePinataConfig();

  if (!networkValid) {
    throw new AppError('Konfigurasi private Pinata belum lengkap.', 503, {
      code: 'PINATA_CONFIG_INVALID',
    });
  }

  if (!configured) {
    throw new AppError('Konfigurasi private Pinata belum lengkap.', 503, {
      code: 'PINATA_CONFIG_INVALID',
      missingCount: missing.length,
    });
  }
};

const testPinataAuthentication = async () => {
  const { configured, missing, networkValid } = validatePinataConfig();

  if (!configured || !networkValid) {
    return { configured: false, reachable: false, missing: missing.length ? missing : undefined };
  }

  try {
    const client = getPinataClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await client.testAuthentication();
    } finally {
      clearTimeout(timer);
    }
    return { configured: true, reachable: true };
  } catch {
    return { configured: true, reachable: false };
  }
};

const uploadPrivateFile = async (buffer, filename, mimeType, metadata = {}) => {
  validatePinataConfiguration();

  try {
    const client = getPinataClient();
    const webFile = new File([buffer], filename, { type: mimeType });

    const keyvalues = { application: 'SIPEVITA', environment: env.nodeEnv };
    if (metadata.id_pengajuan) keyvalues.id_pengajuan = String(metadata.id_pengajuan);
    if (metadata.id_dokumen) keyvalues.id_dokumen = String(metadata.id_dokumen);
    if (metadata.jenis_dokumen) keyvalues.jenis_dokumen = metadata.jenis_dokumen;
    if (metadata.uploaded_by) keyvalues.uploaded_by = String(metadata.uploaded_by);

    const result = await client.upload.private
      .file(webFile)
      .name(filename)
      .keyvalues(keyvalues);

    return {
      pinataFileId: result.id,
      cid: result.cid,
      name: result.name,
      size: result.size,
      mimeType,
    };
  } catch (error) {
    if (error.name === 'AppError') throw error;
    throw normalizePinataError(error, 'PINATA_PRIVATE_UPLOAD_FAILED');
  }
};

const uploadPrivateJsonManifest = async (manifest, metadata = {}) => {
  validatePinataConfiguration();

  try {
    const client = getPinataClient();
    const name = `sipevita-manifest-${metadata.id_pengajuan || 'unknown'}.json`;

    const keyvalues = {
      application: 'SIPEVITA',
      type: 'manifest',
      environment: env.nodeEnv,
    };
    if (metadata.id_pengajuan) keyvalues.id_pengajuan = String(metadata.id_pengajuan);

    const result = await client.upload.private
      .json(manifest)
      .name(name)
      .keyvalues(keyvalues);

    return {
      pinataFileId: result.id,
      cid: result.cid,
    };
  } catch (error) {
    if (error.name === 'AppError') throw error;
    throw normalizePinataError(error, 'MANIFEST_UPLOAD_FAILED');
  }
};

const createPrivateAccessLink = async (cid, options = {}) => {
  validatePinataConfiguration();

  const expires = options.expires ?? env.pinataSignedUrlExpiresSeconds;

  try {
    const client = getPinataClient();
    const url = await client.gateways.private.createAccessLink({ cid, expires });
    return url;
  } catch (error) {
    if (error.name === 'AppError') throw error;
    throw normalizePinataError(error, 'PINATA_SIGNED_URL_FAILED');
  }
};

module.exports = {
  validatePinataConfiguration,
  testPinataAuthentication,
  uploadPrivateFile,
  uploadPrivateJsonManifest,
  createPrivateAccessLink,
  normalizePinataError,
};
