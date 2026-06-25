const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const parsePort = (value) => {
  const port = Number.parseInt(value, 10);

  return Number.isInteger(port) && port > 0 ? port : 3000;
};

const parsePositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || '';

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  blockchainMode: (process.env.BLOCKCHAIN_MODE || 'fabric').toLowerCase(),
  fabricConnectionProfilePath: process.env.FABRIC_CONNECTION_PROFILE_PATH || '',
  fabricWalletPath: process.env.FABRIC_WALLET_PATH || '',
  fabricIdentity: process.env.FABRIC_IDENTITY || '',
  fabricChannelName: process.env.FABRIC_CHANNEL_NAME || '',
  fabricChaincodeName: process.env.FABRIC_CHAINCODE_NAME || '',
  pinataJwt: process.env.PINATA_JWT || '',
  pinataGateway: process.env.PINATA_GATEWAY || '',
  pinataNetwork: (process.env.PINATA_NETWORK || 'private').toLowerCase(),
  pinataSignedUrlExpiresSeconds: (() => {
    const raw = parsePositiveInt(process.env.PINATA_SIGNED_URL_EXPIRES_SECONDS, 60);
    if (raw < 30) return 30;
    if (raw > 300) return 300;
    return raw;
  })(),
  documentMaxFileSizeMb: parsePositiveInt(process.env.DOCUMENT_MAX_FILE_SIZE_MB, 10),
  documentMaxFiles: parsePositiveInt(process.env.DOCUMENT_MAX_FILES, 5),
  documentAllowedMimeTypes: (
    process.env.DOCUMENT_ALLOWED_MIME_TYPES || 'application/pdf,image/jpeg,image/png'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  turnstileEnabled: parseBoolean(process.env.TURNSTILE_ENABLED, Boolean(turnstileSecretKey)),
  turnstileSecretKey,
});

module.exports = env;
