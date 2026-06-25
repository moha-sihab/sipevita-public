const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const yaml = require('js-yaml');
const fabricConfig = require('../config/fabric');

let connection;

const parseResult = (result) => {
  const text = Buffer.from(result).toString('utf8');

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const debugShape = (label, nomorSertifikat, result) => {
  if (process.env.DEBUG_FABRIC_HISTORY_SHAPE !== 'true') return;

  if (Array.isArray(result)) {
    console.debug(label, {
      nomorSertifikat,
      count: result.length,
      firstKeys: result[0] ? Object.keys(result[0]) : [],
      firstValueKeys: result[0]?.value && typeof result[0].value === 'object'
        ? Object.keys(result[0].value)
        : [],
      items: result.map((item) => ({
        txId: item?.txId || item?.tx_id || null,
        timestamp: item?.timestamp || null,
        isDelete: item?.isDelete ?? item?.is_delete ?? null,
        valueType: item?.value === null ? 'null' : typeof item?.value,
        valueKeys: item?.value && typeof item.value === 'object' ? Object.keys(item.value) : [],
      })),
    });
    return;
  }

  console.debug(label, {
    nomorSertifikat,
    keys: result && typeof result === 'object' ? Object.keys(result) : [],
    valueType: result === null ? 'null' : typeof result,
  });
};

const resolveProfilePath = (profilePath, targetPath) =>
  path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(path.dirname(profilePath), targetPath);

const readConnectionProfile = async () => {
  const content = await fs.readFile(fabricConfig.connectionProfilePath, 'utf8');
  return yaml.load(content);
};

const readWalletIdentity = async () => {
  const walletFiles = (await fs.readdir(fabricConfig.walletPath)).filter((file) =>
    file.endsWith('.id'),
  );

  let identityFile;

  if (fabricConfig.identity) {
    identityFile = `${fabricConfig.identity}.id`;

    if (!walletFiles.includes(identityFile)) {
      throw new Error('Identitas Fabric yang dikonfigurasi tidak ditemukan di wallet.');
    }
  } else if (walletFiles.length === 1) {
    [identityFile] = walletFiles;
  } else {
    throw new Error('FABRIC_IDENTITY wajib diisi saat wallet memiliki lebih dari satu identitas.');
  }

  const identity = JSON.parse(
    await fs.readFile(path.join(fabricConfig.walletPath, identityFile), 'utf8'),
  );

  if (
    !identity.mspId ||
    !identity.credentials?.certificate ||
    !identity.credentials?.privateKey
  ) {
    throw new Error('Identitas wallet Fabric tidak valid.');
  }

  return identity;
};

const getPeerConfig = (profile, identity) => {
  const organization = Object.values(profile.organizations || {}).find(
    (item) => item.mspid === identity.mspId,
  );
  const peerName = organization?.peers?.[0];
  const peer = peerName ? profile.peers?.[peerName] : null;

  if (!peerName || !peer?.url) {
    throw new Error('Peer Fabric untuk identitas wallet belum dikonfigurasi.');
  }

  return { peerName, peer };
};

const createGrpcClient = async (profile, identity) => {
  const { peerName, peer } = getPeerConfig(profile, identity);
  const endpoint = peer.url.replace(/^grpcs?:\/\//, '');
  const hostAlias =
    peer.grpcOptions?.['ssl-target-name-override'] ||
    peer.grpcOptions?.hostnameOverride ||
    peerName;
  let credentials;

  if (peer.url.startsWith('grpcs://')) {
    const tlsPem = peer.tlsCACerts?.pem;
    const tlsPath = peer.tlsCACerts?.path;
    const tlsCertificate = tlsPem
      ? Buffer.from(Array.isArray(tlsPem) ? tlsPem.join('\n') : tlsPem)
      : await fs.readFile(resolveProfilePath(fabricConfig.connectionProfilePath, tlsPath));

    credentials = grpc.credentials.createSsl(tlsCertificate);
  } else {
    credentials = grpc.credentials.createInsecure();
  }

  return new grpc.Client(endpoint, credentials, {
    'grpc.ssl_target_name_override': hostAlias,
  });
};

const connectToFabric = async () => {
  if (connection) return connection;

  const validation = fabricConfig.validateFabricConfig();

  if (!validation.configured) {
    throw new Error(`Konfigurasi Fabric belum lengkap: ${validation.missing.join(', ')}.`);
  }

  if (!validation.ready) {
    throw new Error(validation.unavailable.join('; '));
  }

  const [profile, identity] = await Promise.all([
    readConnectionProfile(),
    readWalletIdentity(),
  ]);
  const client = await createGrpcClient(profile, identity);
  const privateKey = crypto.createPrivateKey(identity.credentials.privateKey);
  const gateway = connect({
    client,
    identity: {
      mspId: identity.mspId,
      credentials: Buffer.from(identity.credentials.certificate),
    },
    signer: signers.newPrivateKeySigner(privateKey),
    hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });
  const contract = gateway
    .getNetwork(fabricConfig.channelName)
    .getContract(fabricConfig.chaincodeName);

  connection = { client, gateway, contract };
  return connection;
};

const evaluate = async (transactionName, args) => {
  const { contract } = await connectToFabric();
  const result = await contract.evaluateTransaction(transactionName, ...args.map(String));
  return parseResult(result);
};

const submit = async (transactionName, args) => {
  const { contract } = await connectToFabric();
  const proposal = contract.newProposal(transactionName, {
    arguments: args.map(String),
  });
  const transaction = await proposal.endorse();
  const submitted = await transaction.submit();
  const status = await submitted.getStatus();

  if (!status.successful) {
    throw new Error('Transaksi Fabric dikomit dengan status tidak valid.');
  }

  return {
    transactionId: submitted.getTransactionId(),
    blockNumber: status.blockNumber.toString(),
    result: parseResult(submitted.getResult()),
  };
};

const recordLand = (payload) =>
  submit('recordLand', [
    payload.nomor_sertifikat,
    payload.hash_pemilik,
    payload.hash_dokumen,
    payload.luas_tanah,
    payload.lokasi_hash,
    payload.cid_ipfs,
  ]);

const transferOwnership = (payload) =>
  submit('transferOwnership', [
    payload.nomor_sertifikat,
    payload.hash_pemilik_baru,
    payload.hash_dokumen_baru,
    payload.cid_ipfs_baru,
  ]);

const verifyLand = async (nomorSertifikat) => {
  const result = await evaluate('verifyLand', [nomorSertifikat]);
  debugShape('Fabric verifyLand response shape', nomorSertifikat, result);
  return result;
};

const getLandHistory = async (nomorSertifikat) => {
  const result = await evaluate('getLandHistory', [nomorSertifikat]);
  debugShape('Fabric getLandHistory response shape', nomorSertifikat, result);
  return result;
};

const validateHash = (payload) =>
  evaluate('validateHash', [payload.nomor_sertifikat, payload.hash_dokumen]);

const getAllLandAssets = () => evaluate('getAllLandAssets', []);

const getLandAsset = async (nomorSertifikat) => {
  const result = await evaluate('getLandAsset', [nomorSertifikat]);
  debugShape('Fabric getLandAsset response shape', nomorSertifikat, result);
  return result;
};

const close = () => {
  connection?.gateway.close();
  connection?.client.close();
  connection = null;
};

module.exports = {
  recordLand,
  transferOwnership,
  verifyLand,
  getLandHistory,
  validateHash,
  getAllLandAssets,
  getLandAsset,
  close,
};
