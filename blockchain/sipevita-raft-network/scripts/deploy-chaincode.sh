#!/usr/bin/env bash
# deploy-chaincode.sh — Package and deploy the SIPEVITA chaincode using Fabric 2.5 lifecycle.
# Phase dependency: Phase 10. Requires channel to be created (Phase 9).
# Do NOT run until Phases 8 and 9 are complete and InitLedger blocker is resolved.
#
# BLOCKER (Phase 2 finding): InitLedger uses new Date() — non-deterministic in multi-endorser
# context. Confirm resolution before executing this script on the Raft network.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHAINCODE_SRC="${CHAINCODE_SRC:-$(cd "${PROJECT_ROOT}/../sipevita-chaincode" && pwd)}"
CRYPTO_BASE="${PROJECT_ROOT}/organizations"
LOG_DIR="${PROJECT_ROOT}/logs"

CHANNEL_NAME="${CHANNEL_NAME:-mychannel}"
CHAINCODE_NAME="${CHAINCODE_NAME:-sipevita}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-1.0}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-1}"
CHAINCODE_LANG="node"
CHAINCODE_LABEL="${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
PACKAGE_FILE="${PROJECT_ROOT}/channel-artifacts/chaincode/${CHAINCODE_NAME}.tar.gz"

ENDORSEMENT_POLICY="OutOf(3, 'Org1MSP.peer', 'Org2MSP.peer', 'Org3MSP.peer', 'Org4MSP.peer')"

DRY_RUN=false
INIT_OK=false

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
info()    { echo "[INFO]  $*"; }
warn()    { echo "[WARN]  $*" >&2; }
error()   { echo "[ERROR] $*" >&2; }
success() { echo "[PASS]  $*"; }
fail()    { echo "[FAIL]  $*" >&2; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Package and deploy the SIPEVITA chaincode to all 4 organizations.
Uses Fabric 2.5 peer lifecycle commands.

Chaincode source: ${CHAINCODE_SRC}
Endorsement policy: ${ENDORSEMENT_POLICY}

BLOCKER: Resolve InitLedger non-determinism before running on Raft network.
         See CHAINCODE_COMPATIBILITY_REVIEW.md — Contradiction 8.

Options:
  --name NAME         Chaincode name (default: sipevita).
  --version VERSION   Chaincode version (default: 1.0).
  --sequence NUM      Chaincode sequence (default: 1).
  --channel NAME      Channel name (default: mychannel).
  --dry-run           Show operations without executing.
  --help              Show this help message.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help)     usage ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --init-ok)  INIT_OK=true; shift ;;
        --name)     CHAINCODE_NAME="$2"; shift 2 ;;
        --version)  CHAINCODE_VERSION="$2"; shift 2 ;;
        --sequence) CHAINCODE_SEQUENCE="$2"; shift 2 ;;
        --channel)  CHANNEL_NAME="$2"; shift 2 ;;
        *)          error "Unknown argument: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

info "SIPEVITA Raft Network — deploy-chaincode"
info "Chaincode: ${CHAINCODE_NAME} v${CHAINCODE_VERSION} seq ${CHAINCODE_SEQUENCE}"
info "Channel:   ${CHANNEL_NAME}"
info "Policy:    ${ENDORSEMENT_POLICY}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no lifecycle operations will execute)"

# ---------------------------------------------------------------------------
# InitLedger blocker check
# ---------------------------------------------------------------------------
if [ "$INIT_OK" = false ] && [ "$DRY_RUN" = false ]; then
    warn "BLOCKER CHECK: InitLedger in lib/sipevitaContract.js uses new Date() directly."
    warn "This is non-deterministic in a 3-of-4 endorsement setup."
    warn "Confirm this has been resolved before proceeding."
    warn "See CHAINCODE_COMPATIBILITY_REVIEW.md — Open Decision OD-9."
    echo -n "Has the InitLedger non-determinism been resolved? [y/N] "
    read -r CONFIRM
    if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
        info "Aborted. Resolve the InitLedger blocker first."
        exit 1
    fi
elif [ "$INIT_OK" = true ]; then
    info "InitLedger blocker confirmed resolved via --init-ok flag."
fi

# FABRIC_CFG_PATH must point to a directory with core.yaml for the peer CLI.
export FABRIC_CFG_PATH="${HOME}/fabric-samples/config"
# Ensure Fabric CLI binaries are in PATH
FABRIC_BIN="${HOME}/fabric-samples/bin"
if [[ ":${PATH}:" != *":${FABRIC_BIN}:"* ]]; then
    export PATH="${FABRIC_BIN}:${PATH}"
fi

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
if ! command -v peer &>/dev/null; then
    error "peer not found in PATH."
    exit 1
fi
success "peer CLI found"

if [ ! -d "${CHAINCODE_SRC}" ]; then
    error "Chaincode source not found: ${CHAINCODE_SRC}"
    exit 1
fi
success "Chaincode source: ${CHAINCODE_SRC}"

if [ ! -f "${CHAINCODE_SRC}/package.json" ]; then
    error "Chaincode package.json not found."
    exit 1
fi

mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# TLS paths
# ---------------------------------------------------------------------------
ORDERER_CA="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/tlsca/tlsca.sipevita.example.com-cert.pem"
ORDERER_ADDRESS="localhost:17050"
ORDERER_HOST_ALIAS="orderer1.sipevita.example.com"

PEER_HOST_PORTS=("17051" "18051" "19051" "20051")

run_or_dry() {
    if [ "$DRY_RUN" = true ]; then
        info "[dry-run] $*"
    else
        "$@"
    fi
}

set_peer_env() {
    local ORG_NUM="$1"
    local MSP_ID="Org${ORG_NUM}MSP"
    local ORG_DOMAIN="org${ORG_NUM}.sipevita.example.com"
    local PEER_HOST="peer0.${ORG_DOMAIN}"
    local ORG_MSP="${CRYPTO_BASE}/peerOrganizations/${ORG_DOMAIN}"
    local HOST_PORT="${PEER_HOST_PORTS[$((ORG_NUM - 1))]}"

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="${MSP_ID}"
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG_MSP}/peers/${PEER_HOST}/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${ORG_MSP}/users/Admin@${ORG_DOMAIN}/msp"
    export CORE_PEER_ADDRESS="localhost:${HOST_PORT}"
}

# ---------------------------------------------------------------------------
# Step 1: Package chaincode (done once, used by all orgs)
# ---------------------------------------------------------------------------
info "=== Step 1: Package chaincode ==="
set_peer_env 1
run_or_dry peer lifecycle chaincode package "${PACKAGE_FILE}" \
    --path "${CHAINCODE_SRC}" \
    --lang "${CHAINCODE_LANG}" \
    --label "${CHAINCODE_LABEL}"
[ "$DRY_RUN" = false ] && success "Chaincode packaged: ${PACKAGE_FILE}"

# ---------------------------------------------------------------------------
# Step 2: Install on all 4 peers
# ---------------------------------------------------------------------------
info "=== Step 2: Install on all 4 peers ==="
for ORG_NUM in 1 2 3 4; do
    set_peer_env "${ORG_NUM}"
    info "Installing on Org${ORG_NUM}MSP peer..."
    run_or_dry peer lifecycle chaincode install "${PACKAGE_FILE}"
    [ "$DRY_RUN" = false ] && success "Installed on Org${ORG_NUM}MSP"
done

# ---------------------------------------------------------------------------
# Step 3: Query installed to get PACKAGE_ID
# ---------------------------------------------------------------------------
info "=== Step 3: Query installed package ID ==="
set_peer_env 1
if [ "$DRY_RUN" = false ]; then
    INSTALLED_OUTPUT="$(peer lifecycle chaincode queryinstalled 2>/dev/null)"
    echo "${INSTALLED_OUTPUT}" | tee -a "${LOG_DIR}/chaincode-install.log"
    PACKAGE_ID="$(echo "${INSTALLED_OUTPUT}" | grep "${CHAINCODE_LABEL}" | awk '{print $3}' | tr -d ',')"
    if [ -z "${PACKAGE_ID}" ]; then
        error "Could not extract Package ID for label: ${CHAINCODE_LABEL}"
        exit 1
    fi
    success "Package ID: [not printed for safety — see logs/chaincode-install.log]"
    info "Package ID saved to: ${LOG_DIR}/chaincode-packageid.txt"
    echo "${PACKAGE_ID}" > "${LOG_DIR}/chaincode-packageid.txt"
else
    PACKAGE_ID="[PACKAGE_ID_NOT_YET_KNOWN]"
    info "[dry-run] Package ID will be determined at runtime"
fi

# ---------------------------------------------------------------------------
# Step 4: Approve chaincode definition for all 4 organizations
# ---------------------------------------------------------------------------
info "=== Step 4: Approve chaincode definition ==="
for ORG_NUM in 1 2 3 4; do
    set_peer_env "${ORG_NUM}"
    info "Approving for Org${ORG_NUM}MSP..."
    run_or_dry peer lifecycle chaincode approveformyorg \
        -o "${ORDERER_ADDRESS}" \
        --ordererTLSHostnameOverride "${ORDERER_HOST_ALIAS}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CHAINCODE_NAME}" \
        --version "${CHAINCODE_VERSION}" \
        --package-id "${PACKAGE_ID}" \
        --sequence "${CHAINCODE_SEQUENCE}" \
        --signature-policy "${ENDORSEMENT_POLICY}" \
        --tls --cafile "${ORDERER_CA}"
    [ "$DRY_RUN" = false ] && success "Approved: Org${ORG_NUM}MSP"
done

# ---------------------------------------------------------------------------
# Step 5: Check commit readiness
# ---------------------------------------------------------------------------
info "=== Step 5: Check commit readiness ==="
set_peer_env 1
run_or_dry peer lifecycle chaincode checkcommitreadiness \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --output json

# ---------------------------------------------------------------------------
# Step 6: Commit chaincode definition
# ---------------------------------------------------------------------------
info "=== Step 6: Commit chaincode definition ==="
set_peer_env 1

ORG1_MSP="${CRYPTO_BASE}/peerOrganizations/org1.sipevita.example.com"
ORG2_MSP="${CRYPTO_BASE}/peerOrganizations/org2.sipevita.example.com"
ORG3_MSP="${CRYPTO_BASE}/peerOrganizations/org3.sipevita.example.com"
ORG4_MSP="${CRYPTO_BASE}/peerOrganizations/org4.sipevita.example.com"

run_or_dry peer lifecycle chaincode commit \
    -o "${ORDERER_ADDRESS}" \
    --ordererTLSHostnameOverride "${ORDERER_HOST_ALIAS}" \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}" \
    --version "${CHAINCODE_VERSION}" \
    --sequence "${CHAINCODE_SEQUENCE}" \
    --signature-policy "${ENDORSEMENT_POLICY}" \
    --tls --cafile "${ORDERER_CA}" \
    --peerAddresses "localhost:17051" --tlsRootCertFiles "${ORG1_MSP}/peers/peer0.org1.sipevita.example.com/tls/ca.crt" \
    --peerAddresses "localhost:18051" --tlsRootCertFiles "${ORG2_MSP}/peers/peer0.org2.sipevita.example.com/tls/ca.crt" \
    --peerAddresses "localhost:19051" --tlsRootCertFiles "${ORG3_MSP}/peers/peer0.org3.sipevita.example.com/tls/ca.crt" \
    --peerAddresses "localhost:20051" --tlsRootCertFiles "${ORG4_MSP}/peers/peer0.org4.sipevita.example.com/tls/ca.crt"
[ "$DRY_RUN" = false ] && success "Chaincode committed on ${CHANNEL_NAME}"

# ---------------------------------------------------------------------------
# Step 7: Verify committed definition
# ---------------------------------------------------------------------------
info "=== Step 7: Verify committed definition ==="
run_or_dry peer lifecycle chaincode querycommitted \
    --channelID "${CHANNEL_NAME}" \
    --name "${CHAINCODE_NAME}"

info "---"
success "Chaincode ${CHAINCODE_NAME} v${CHAINCODE_VERSION} deployed with 3-of-4 endorsement policy."
info "Next: create-wallet.js (Phase 12)"
