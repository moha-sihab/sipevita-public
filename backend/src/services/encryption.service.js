const crypto = require('crypto');
const env = require('../config/env');
const { canonicalStringify } = require('../utils/canonicalJson');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  if (!env.encryptionKey) {
    throw new Error('ENCRYPTION_KEY belum dikonfigurasi.');
  }

  if (/^[0-9a-fA-F]{64}$/.test(env.encryptionKey)) {
    return Buffer.from(env.encryptionKey, 'hex');
  }

  const rawKey = Buffer.from(env.encryptionKey, 'utf8');

  if (rawKey.length === 32) {
    return rawKey;
  }

  throw new Error(
    'ENCRYPTION_KEY harus berupa string hex 64 karakter atau string mentah 32 byte.',
  );
};

const isEncryptedPayload = (value) =>
  value !== null &&
  typeof value === 'object' &&
  value.algorithm === ALGORITHM &&
  typeof value.iv === 'string' &&
  typeof value.tag === 'string' &&
  typeof value.ciphertext === 'string';

const encryptJson = (value) => {
  const plaintext = canonicalStringify(value);

  if (plaintext === undefined) {
    throw new TypeError('Input enkripsi harus kompatibel dengan JSON.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

const decryptJson = (payload) => {
  if (!isEncryptedPayload(payload)) {
    throw new Error('Payload terenkripsi tidak valid.');
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(payload.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  } catch (error) {
    if (error.message.startsWith('ENCRYPTION_KEY')) {
      throw error;
    }

    throw new Error('Payload terenkripsi gagal didekripsi.');
  }
};

module.exports = {
  encryptJson,
  decryptJson,
  isEncryptedPayload,
};
