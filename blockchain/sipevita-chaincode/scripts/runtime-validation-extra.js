'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Gateway, Wallets } = require('fabric-network');

const projectRoot = path.resolve(__dirname, '..');
const defaults = {
    connectionProfilePath: path.join(
        os.homedir(),
        'fabric-samples',
        'test-network',
        'organizations',
        'peerOrganizations',
        'org1.example.com',
        'connection-org1.json'
    ),
    walletPath: path.join(projectRoot, 'wallet'),
    identity: 'appUser',
    channelName: 'mychannel',
    chaincodeName: 'sipevita',
};

function envOrDefault(name, defaultValue) {
    return process.env[name] || defaultValue;
}

function parseResult(buffer) {
    const text = Buffer.from(buffer).toString('utf8');
    if (!text) {
        return null;
    }

    return JSON.parse(text);
}

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function printPass(message) {
    console.log(`PASS ${message}`);
}

function printFail(message) {
    console.error(`FAIL ${message}`);
}

async function main() {
    const config = {
        connectionProfilePath: envOrDefault(
            'FABRIC_CONNECTION_PROFILE_PATH',
            defaults.connectionProfilePath
        ),
        walletPath: envOrDefault('FABRIC_WALLET_PATH', defaults.walletPath),
        identity: envOrDefault('FABRIC_IDENTITY', defaults.identity),
        channelName: envOrDefault('FABRIC_CHANNEL_NAME', defaults.channelName),
        chaincodeName: envOrDefault('FABRIC_CHAINCODE_NAME', defaults.chaincodeName),
    };

    assertCondition(
        fs.existsSync(config.connectionProfilePath),
        `Connection profile not found: ${config.connectionProfilePath}`
    );
    assertCondition(
        fs.existsSync(config.walletPath),
        `Fabric wallet path does not exist: ${config.walletPath}`
    );

    const connectionProfile = JSON.parse(
        fs.readFileSync(config.connectionProfilePath, 'utf8')
    );
    const wallet = await Wallets.newFileSystemWallet(config.walletPath);
    const identity = await wallet.get(config.identity);
    assertCondition(
        identity,
        `Fabric identity "${config.identity}" not found in wallet`
    );

    const gateway = new Gateway();
    try {
        await gateway.connect(connectionProfile, {
            wallet,
            identity: config.identity,
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork(config.channelName);
        const contract = network.getContract(config.chaincodeName);
        const timestamp = Date.now();
        const nomorSertifikat = `SHM-TRANSFER-TEST-${timestamp}`;

        const original = {
            nomor_sertifikat: nomorSertifikat,
            hash_pemilik: 'hash-pemilik-lama-test',
            hash_dokumen: 'hash-dokumen-lama-test',
            luas_tanah: '120.5',
            lokasi_hash: 'lokasi-hash-test',
            cid_ipfs: 'cid-ipfs-lama-test',
        };

        const transfer = {
            hash_pemilik_baru: 'hash-pemilik-baru-test',
            hash_dokumen_baru: 'hash-dokumen-baru-test',
            cid_ipfs_baru: 'cid-ipfs-baru-test',
        };

        const recorded = parseResult(await contract.submitTransaction(
            'recordLand',
            original.nomor_sertifikat,
            original.hash_pemilik,
            original.hash_dokumen,
            original.luas_tanah,
            original.lokasi_hash,
            original.cid_ipfs
        ));
        assertCondition(
            recorded.nomor_sertifikat === nomorSertifikat,
            'recordLand returned unexpected certificate number'
        );
        assertCondition(
            recorded.hash_pemilik === original.hash_pemilik,
            'recordLand returned unexpected owner hash'
        );
        printPass(`recordLand created ${nomorSertifikat}`);

        const transferred = parseResult(await contract.submitTransaction(
            'transferOwnership',
            nomorSertifikat,
            transfer.hash_pemilik_baru,
            transfer.hash_dokumen_baru,
            transfer.cid_ipfs_baru
        ));
        assertCondition(
            transferred.nomor_sertifikat === nomorSertifikat,
            'transferOwnership returned unexpected certificate number'
        );
        assertCondition(
            transferred.hash_pemilik === transfer.hash_pemilik_baru,
            'transferOwnership did not update owner hash'
        );
        assertCondition(
            transferred.hash_dokumen === transfer.hash_dokumen_baru,
            'transferOwnership did not update document hash'
        );
        assertCondition(
            transferred.cid_ipfs === transfer.cid_ipfs_baru,
            'transferOwnership did not update IPFS CID'
        );
        printPass('transferOwnership updated owner/document fields');

        const asset = parseResult(await contract.evaluateTransaction(
            'getLandAsset',
            nomorSertifikat
        ));
        assertCondition(
            asset.nomor_sertifikat === nomorSertifikat,
            'getLandAsset returned unexpected certificate number'
        );
        assertCondition(
            asset.hash_pemilik === transfer.hash_pemilik_baru,
            'getLandAsset did not include updated owner hash'
        );
        assertCondition(
            asset.hash_dokumen === transfer.hash_dokumen_baru,
            'getLandAsset did not include updated document hash'
        );
        assertCondition(asset.status === 'ACTIVE', 'getLandAsset returned unexpected status');
        assertCondition(
            asset.cid_ipfs === transfer.cid_ipfs_baru,
            'getLandAsset returned unexpected IPFS CID'
        );
        printPass('getLandAsset returned complete updated asset');

        const allAssets = parseResult(
            await contract.evaluateTransaction('getAllLandAssets')
        );
        assertCondition(Array.isArray(allAssets), 'getAllLandAssets did not return an array');
        assertCondition(
            allAssets.some((item) => item.key === nomorSertifikat),
            'getAllLandAssets did not include dummy certificate'
        );
        printPass('getAllLandAssets returned list containing dummy asset');

        const history = parseResult(await contract.evaluateTransaction(
            'getLandHistory',
            nomorSertifikat
        ));
        assertCondition(Array.isArray(history), 'getLandHistory did not return an array');
        assertCondition(
            history.length >= 2,
            'getLandHistory did not include record and transfer entries'
        );
        assertCondition(
            history.some((entry) => (
                entry.value && entry.value.hash_pemilik === original.hash_pemilik
            )),
            'getLandHistory did not include original owner hash entry'
        );
        assertCondition(
            history.some((entry) => (
                entry.value && entry.value.hash_pemilik === transfer.hash_pemilik_baru
            )),
            'getLandHistory did not include transferred owner hash entry'
        );
        printPass('getLandHistory contains record and transfer entries');

        printPass(`runtime extra validation completed for ${nomorSertifikat}`);
    } finally {
        gateway.disconnect();
    }
}

main().catch((error) => {
    printFail(error.message);
    process.exitCode = 1;
});
