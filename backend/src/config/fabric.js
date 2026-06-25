const fs = require('node:fs');
const env = require('./env');

const fabricConfig = {
  mode: env.blockchainMode,
  connectionProfilePath: env.fabricConnectionProfilePath,
  walletPath: env.fabricWalletPath,
  identity: env.fabricIdentity,
  channelName: env.fabricChannelName,
  chaincodeName: env.fabricChaincodeName,
};

const validateFabricConfig = () => {
  const missing = [];

  if (!fabricConfig.connectionProfilePath) missing.push('FABRIC_CONNECTION_PROFILE_PATH');
  if (!fabricConfig.walletPath) missing.push('FABRIC_WALLET_PATH');
  if (!fabricConfig.channelName) missing.push('FABRIC_CHANNEL_NAME');
  if (!fabricConfig.chaincodeName) missing.push('FABRIC_CHAINCODE_NAME');

  const connectionProfileExists = Boolean(
    fabricConfig.connectionProfilePath &&
      fs.existsSync(fabricConfig.connectionProfilePath),
  );
  const walletPathExists = Boolean(
    fabricConfig.walletPath && fs.existsSync(fabricConfig.walletPath),
  );
  const unavailable = [];

  if (fabricConfig.connectionProfilePath && !connectionProfileExists) {
    unavailable.push('Path connection profile Fabric tidak ditemukan.');
  }

  if (fabricConfig.walletPath && !walletPathExists) {
    unavailable.push('Path wallet Fabric tidak ditemukan.');
  }

  return {
    configured: missing.length === 0,
    ready: missing.length === 0 && unavailable.length === 0,
    missing,
    unavailable,
    connectionProfileExists,
    walletPathExists,
    channelNameConfigured: Boolean(fabricConfig.channelName),
    chaincodeNameConfigured: Boolean(fabricConfig.chaincodeName),
  };
};

module.exports = Object.freeze({
  ...fabricConfig,
  validateFabricConfig,
});
