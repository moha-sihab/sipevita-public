'use strict';

/**
 * create-wallet.js — Create the appUser identity wallet for the SIPEVITA Raft network.
 *
 * Phase dependency: Phase 12. Requires crypto material (Phase 5).
 * Identity: appUser, MSP: Org1MSP
 * Wallet path: sipevita-raft-network/wallet-raft/
 *
 * This wallet is gitignored. Never commit wallet contents.
 *
 * Usage:
 *   node scripts/create-wallet.js [--dry-run] [--force] [--help]
 *
 * Dependencies: fabric-network (install from sipevita-raft-network or sipevita-chaincode)
 *   From sipevita-raft-network: npm install (if package.json is present)
 *   Or: NODE_PATH=../sipevita-chaincode/node_modules node scripts/create-wallet.js
 */

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

const IDENTITY_LABEL = 'appUser';
const MSP_ID = 'Org1MSP';
const ORG1_DOMAIN = 'org1.sipevita.example.com';

// Wallet path is inside the raft network project (gitignored)
const WALLET_PATH = path.join(PROJECT_ROOT, 'wallet-raft');
const IDENTITY_PATH = path.join(WALLET_PATH, `${IDENTITY_LABEL}.id`);

// Crypto material path for Org1 User1 (generated in Phase 5)
const ORG1_MSP_PATH = path.join(
    PROJECT_ROOT,
    'organizations',
    'peerOrganizations',
    ORG1_DOMAIN,
    'users',
    `User1@${ORG1_DOMAIN}`,
    'msp'
);
const CERT_DIR = path.join(ORG1_MSP_PATH, 'signcerts');
const KEY_DIR  = path.join(ORG1_MSP_PATH, 'keystore');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
const HELP    = args.includes('--help');

if (HELP) {
    console.log(`
Usage: node scripts/create-wallet.js [OPTIONS]

Create the appUser X.509 identity for the SIPEVITA Raft network Org1MSP.

Reads from:  organizations/peerOrganizations/org1.sipevita.example.com/users/User1/msp/
Writes to:   wallet-raft/
Identity:    ${IDENTITY_LABEL}
MSP ID:      ${MSP_ID}

Options:
  --dry-run  Validate paths without creating the wallet.
  --force    Overwrite existing appUser identity.
  --help     Show this help message.

SECURITY: Never print private key contents. Wallet is gitignored.
`);
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function printInfo(msg)    { console.log(`[INFO]  ${msg}`); }
function printPass(msg)    { console.log(`[PASS]  ${msg}`); }
function printWarn(msg)    { console.warn(`[WARN]  ${msg}`); }
function printFail(msg)    { console.error(`[FAIL]  ${msg}`); }

async function getFirstFile(dirPath, description) {
    const files = (await fs.readdir(dirPath))
        .filter((f) => !f.startsWith('.'))
        .sort();
    if (!files[0]) {
        throw new Error(`No ${description} found in: ${dirPath}`);
    }
    return path.join(dirPath, files[0]);
}

// ---------------------------------------------------------------------------
// Guard: never operate on test-network wallet
// ---------------------------------------------------------------------------
if (WALLET_PATH.includes('test-network')) {
    printFail('WALLET_PATH resolves inside test-network. Refusing to continue.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    printInfo('SIPEVITA Raft Network — create-wallet');
    printInfo(`Project root: ${PROJECT_ROOT}`);
    printInfo(`Identity:     ${IDENTITY_LABEL}`);
    printInfo(`MSP ID:       ${MSP_ID}`);
    printInfo(`Wallet path:  ${WALLET_PATH}`);
    if (DRY_RUN) printInfo('(dry-run mode — no wallet file will be written)');
    if (FORCE)   printWarn('(--force: existing identity will be overwritten)');

    // Validate crypto material exists
    if (!fsSync.existsSync(ORG1_MSP_PATH)) {
        printFail(`Org1MSP crypto path not found: ${ORG1_MSP_PATH}`);
        printFail('Phase 5 (generate-crypto.sh) must be completed first.');
        process.exit(1);
    }
    printPass('Org1MSP crypto path found');

    if (!fsSync.existsSync(CERT_DIR)) {
        printFail(`Certificate directory not found: ${CERT_DIR}`);
        process.exit(1);
    }
    if (!fsSync.existsSync(KEY_DIR)) {
        printFail(`Key directory not found: ${KEY_DIR}`);
        process.exit(1);
    }
    printPass('Certificate and key directories found');

    // Load fabric-network
    let Wallets;
    try {
        ({ Wallets } = require('fabric-network'));
    } catch (err) {
        printFail('fabric-network module not found.');
        printFail('Install dependencies: npm install (from sipevita-raft-network directory)');
        printFail(`Or: NODE_PATH=${path.join(PROJECT_ROOT, '..', 'sipevita-chaincode', 'node_modules')} node scripts/create-wallet.js`);
        process.exit(1);
    }

    if (DRY_RUN) {
        const certPath = await getFirstFile(CERT_DIR, 'certificate').catch(() => null);
        const keyPath  = await getFirstFile(KEY_DIR,  'private key').catch(() => null);
        printInfo(`[dry-run] Would read certificate from: ${certPath ?? '(not found)'}`);
        printInfo('[dry-run] Would read private key (not printing path for security)');
        printInfo(`[dry-run] Would write identity "${IDENTITY_LABEL}" to: ${WALLET_PATH}`);
        printPass('Dry-run complete. No files written.');
        return;
    }

    // Create wallet directory
    await fs.mkdir(WALLET_PATH, { recursive: true });

    if (fsSync.existsSync(IDENTITY_PATH) && fsSync.statSync(IDENTITY_PATH).size === 0) {
        printWarn(`Empty placeholder found for "${IDENTITY_LABEL}". It will be replaced locally.`);
        await fs.unlink(IDENTITY_PATH);
    }

    const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

    // Check for existing identity
    const existingIdentity = await wallet.get(IDENTITY_LABEL);
    if (existingIdentity && !FORCE) {
        printWarn(`Identity "${IDENTITY_LABEL}" already exists in wallet.`);
        printWarn('Pass --force to overwrite.');
        printInfo(`Wallet path: ${WALLET_PATH}`);
        return;
    }

    // Read certificate and private key files
    const certPath = await getFirstFile(CERT_DIR, 'User1 certificate');
    const keyPath  = await getFirstFile(KEY_DIR,  'User1 private key');

    const certificate = await fs.readFile(certPath, 'utf8');
    const privateKey  = await fs.readFile(keyPath,  'utf8');

    const identity = {
        credentials: { certificate, privateKey },
        mspId: MSP_ID,
        type:  'X.509',
    };

    await wallet.put(IDENTITY_LABEL, identity);

    // Verify identity was written (do NOT print key or cert content)
    const stored = await wallet.get(IDENTITY_LABEL);
    if (!stored) {
        printFail('Identity was not stored successfully.');
        process.exit(1);
    }

    printPass(`Identity "${IDENTITY_LABEL}" created in wallet.`);
    printInfo(`Wallet path: ${WALLET_PATH}`);
    printInfo(`MSP ID:      ${MSP_ID}`);
    printInfo('Certificate file count in wallet: 1 identity written.');
    printInfo('SECURITY: Private key is stored in wallet-raft/ which is gitignored.');
}

main().catch((err) => {
    printFail(`create-wallet failed: ${err.message}`);
    process.exitCode = 1;
});
