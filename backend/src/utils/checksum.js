const crypto = require('node:crypto');

/**
 * Calculates SHA-256 of a file buffer.
 *
 * NOTE: This is a local integrity checksum, NOT the same as an IPFS CID.
 * CIDs are computed by the Pinata/IPFS node using a different multihash scheme.
 * Store both; they serve different purposes:
 *   - sha256  → byte-level integrity, computed here before upload
 *   - cid     → IPFS content address, returned by Pinata after upload
 */
const calculateSha256 = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input calculateSha256 harus berupa Buffer.');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = { calculateSha256 };
