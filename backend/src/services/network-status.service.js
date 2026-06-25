'use strict';

const fs = require('node:fs');
const yaml = require('js-yaml');
const fabricConfig = require('../config/fabric');
const blockchainService = require('./blockchain.service');


const PLATFORM = 'Hyperledger Fabric';
const CONSENSUS = 'etcdraft';
const REQUIRED_ENDORSEMENTS = 3;


const READINESS_PROBE_ID = 'PHASE20-STATUS-READINESS';

const parseConnectionProfile = () => {
  const profilePath = fabricConfig.connectionProfilePath;
  if (!profilePath || !fs.existsSync(profilePath)) return null;
  try {
    return yaml.load(fs.readFileSync(profilePath, 'utf8'));
  } catch {
    return null;
  }
};

const getNetworkStatus = async () => {
  const profile = parseConnectionProfile();
  const channelName = fabricConfig.channelName || null;


  const channelOrderers = profile?.channels?.[channelName]?.orderers;
  const configuredOrderers = Array.isArray(channelOrderers)
    ? channelOrderers.length
    : Object.keys(profile?.orderers ?? {}).length;

  // Quorum: ⌊N/2⌋ + 1  (for N=3 → 2)
  const requiredQuorum = configuredOrderers > 0
    ? Math.floor(configuredOrderers / 2) + 1
    : null;


  const configuredPeerOrganizations = Object.values(profile?.organizations ?? {})
    .filter(org => Array.isArray(org.peers) && org.peers.length > 0)
    .length;


  const clientOrg = profile?.client?.organization ?? null;
  const identityMspId = (clientOrg && profile?.organizations?.[clientOrg]?.mspid) || null;



  let gatewayReady = false;
  try {
    await blockchainService.verifyLand(READINESS_PROBE_ID);
    gatewayReady = true;
  } catch {
    gatewayReady = false;
  }

  return {
    network: profile?.name ?? 'sipevita-raft',
    platform: PLATFORM,
    consensus: CONSENSUS,
    configuredOrderers,
    requiredQuorum,
    configuredPeerOrganizations,
    requiredEndorsements: REQUIRED_ENDORSEMENTS,
    channel: channelName,
    chaincode: fabricConfig.chaincodeName || null,
    identityMspId,
    gatewayReady,
    readinessScope: 'gateway-read',
    checkedAt: new Date().toISOString(),
  };
};

module.exports = { getNetworkStatus };
