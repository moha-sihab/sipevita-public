'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Wallets } = require('fabric-network');

const identityLabel = 'appUser';
const mspId = 'Org1MSP';
const chaincodeRoot = path.resolve(__dirname, '..');
const walletPath = path.join(chaincodeRoot, 'wallet');
const mspPath = path.join(
    os.homedir(),
    'fabric-samples',
    'test-network',
    'organizations',
    'peerOrganizations',
    'org1.example.com',
    'users',
    'User1@org1.example.com',
    'msp'
);
const certDirectoryPath = path.join(mspPath, 'signcerts');
const keyDirectoryPath = path.join(mspPath, 'keystore');

async function getFirstFile(directoryPath, description) {
    const files = (await fs.readdir(directoryPath))
        .filter((fileName) => !fileName.startsWith('.'))
        .sort();

    if (!files[0]) {
        throw new Error(`No ${description} found in ${directoryPath}`);
    }

    return path.join(directoryPath, files[0]);
}

async function main() {
    const shouldOverwrite = process.argv.includes('--force');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const existingIdentity = await wallet.get(identityLabel);
    if (existingIdentity && !shouldOverwrite) {
        console.log(`Wallet identity "${identityLabel}" already exists. No changes made.`);
        console.log(`Wallet path: ${walletPath}`);
        console.log('Use npm run wallet:create -- --force only if you intentionally want to replace it.');
        return;
    }

    const certPath = await getFirstFile(certDirectoryPath, 'User1 certificate');
    const keyPath = await getFirstFile(keyDirectoryPath, 'User1 private key');

    const certificate = await fs.readFile(certPath, 'utf8');
    const privateKey = await fs.readFile(keyPath, 'utf8');

    const identity = {
        credentials: {
            certificate,
            privateKey,
        },
        mspId,
        type: 'X.509',
    };

    await wallet.put(identityLabel, identity);

    console.log(`Wallet identity "${identityLabel}" created successfully.`);
    console.log(`Wallet path: ${walletPath}`);
    console.log(`MSP ID: ${mspId}`);
}

main().catch((error) => {
    console.error(`Failed to create wallet identity: ${error.message}`);
    process.exitCode = 1;
});
