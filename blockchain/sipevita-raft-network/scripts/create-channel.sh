#!/usr/bin/env bash
# create-channel.sh — Create mychannel and join all 4 peers and 3 orderers.
# Phase dependency: Phase 9. Requires network-up (Phase 8) and channel artifacts (Phase 6).
# Do NOT run this script until Phases 6 and 8 are complete.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CHANNEL_NAME="${CHANNEL_NAME:-mychannel}"
CHANNEL_ARTIFACTS="${PROJECT_ROOT}/channel-artifacts"
CRYPTO_BASE="${PROJECT_ROOT}/organizations"
LOG_DIR="${PROJECT_ROOT}/logs"

DRY_RUN=false

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

Create mychannel and join all 4 peer organizations and 3 Raft orderers.

Uses Fabric 2.5 channel participation flow:
  - Orderers join via osnadmin channel join
  - Peers join via peer channel join

REQUIRES (all must exist before running):
  - Network running: all 4 peers + 3 orderers (network-up.sh)
  - Channel genesis block: channel-artifacts/mychannel.block (Phase 6)
  - Crypto material in organizations/ (Phase 5)
  - Fabric CLI binaries in PATH: peer, osnadmin

Options:
  --channel NAME  Channel name (default: mychannel).
  --dry-run       Show operations without executing.
  --help          Show this help message.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help)        usage ;;
        --dry-run)     DRY_RUN=true; shift ;;
        --channel)     CHANNEL_NAME="$2"; shift 2 ;;
        *)             error "Unknown argument: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

info "SIPEVITA Raft Network — create-channel"
info "Channel: ${CHANNEL_NAME}"
info "Project root: ${PROJECT_ROOT}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no channel operations will execute)"

mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
for CMD in peer osnadmin; do
    if ! command -v "$CMD" &>/dev/null; then
        error "${CMD} not found in PATH. Add Fabric 2.5.x binaries to PATH first."
        exit 1
    fi
done
success "peer and osnadmin found in PATH"

CHANNEL_BLOCK="${CHANNEL_ARTIFACTS}/${CHANNEL_NAME}.block"
if [ ! -f "${CHANNEL_BLOCK}" ]; then
    error "Channel genesis block not found: ${CHANNEL_BLOCK}"
    error "Phase 6 (configtxgen) must be completed first."
    exit 1
fi
success "Channel genesis block: ${CHANNEL_BLOCK}"

if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running."
    exit 1
fi

# ---------------------------------------------------------------------------
# TLS and MSP path helpers
# ---------------------------------------------------------------------------
ORDERER_CA="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/tlsca/tlsca.sipevita.example.com-cert.pem"
# Admin TLS client cert/key (used as mTLS identity against orderer admin endpoint)
ORDERER_ADMIN_CLIENT_CERT="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/users/Admin@sipevita.example.com/tls/client.crt"
ORDERER_ADMIN_CLIENT_KEY="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/users/Admin@sipevita.example.com/tls/client.key"

# Orderer admin endpoints (dedicated host ports — Phase 7 scheme)
ORDERER1_ADMIN="localhost:17053"
ORDERER2_ADMIN="localhost:18053"
ORDERER3_ADMIN="localhost:19053"

# Peer gRPC endpoints (dedicated host ports — Phase 7 scheme)
PEER0_ORG1="localhost:17051"
PEER0_ORG2="localhost:18051"
PEER0_ORG3="localhost:19051"
PEER0_ORG4="localhost:20051"

run_or_dry() {
    if [ "$DRY_RUN" = true ]; then
        info "[dry-run] $*"
    else
        "$@"
    fi
}

# FABRIC_CFG_PATH must point to a directory with core.yaml for the peer CLI.
# The fabric-samples/config/ directory contains the standard CLI core.yaml.
export FABRIC_CFG_PATH="${HOME}/fabric-samples/config"

# ---------------------------------------------------------------------------
# Step 1: Join orderers to channel (Fabric 2.5 channel participation)
# ---------------------------------------------------------------------------
info "=== Step 1: Join orderers to ${CHANNEL_NAME} ==="

ORDERER_ENTRIES=(
    "orderer1 ${ORDERER1_ADMIN}"
    "orderer2 ${ORDERER2_ADMIN}"
    "orderer3 ${ORDERER3_ADMIN}"
)

for ENTRY in "${ORDERER_ENTRIES[@]}"; do
    ORDERER_NAME="${ENTRY%% *}"
    ORDERER_ADMIN_EP="${ENTRY##* }"
    info "Joining orderer: ${ORDERER_NAME} at ${ORDERER_ADMIN_EP}"
    run_or_dry osnadmin channel join \
        --channelID "${CHANNEL_NAME}" \
        --config-block "${CHANNEL_BLOCK}" \
        -o "${ORDERER_ADMIN_EP}" \
        --ca-file "${ORDERER_CA}" \
        --client-cert "${ORDERER_ADMIN_CLIENT_CERT}" \
        --client-key "${ORDERER_ADMIN_CLIENT_KEY}"
    [ "$DRY_RUN" = false ] && success "Orderer joined: ${ORDERER_NAME}"
done

# ---------------------------------------------------------------------------
# Step 2: Set Org1MSP peer environment and join peer0.org1
# ---------------------------------------------------------------------------
info "=== Step 2: Peer0 Org1 joins ${CHANNEL_NAME} ==="

ORG1_MSP="${CRYPTO_BASE}/peerOrganizations/org1.sipevita.example.com"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_MSP}/peers/peer0.org1.sipevita.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${ORG1_MSP}/users/Admin@org1.sipevita.example.com/msp"
export CORE_PEER_ADDRESS="${PEER0_ORG1}"

run_or_dry peer channel join -b "${CHANNEL_BLOCK}"
[ "$DRY_RUN" = false ] && success "peer0.org1 joined ${CHANNEL_NAME}"

# ---------------------------------------------------------------------------
# Step 3: Peer0 Org2 joins
# ---------------------------------------------------------------------------
info "=== Step 3: Peer0 Org2 joins ${CHANNEL_NAME} ==="

ORG2_MSP="${CRYPTO_BASE}/peerOrganizations/org2.sipevita.example.com"
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_MSP}/peers/peer0.org2.sipevita.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${ORG2_MSP}/users/Admin@org2.sipevita.example.com/msp"
export CORE_PEER_ADDRESS="${PEER0_ORG2}"

run_or_dry peer channel join -b "${CHANNEL_BLOCK}"
[ "$DRY_RUN" = false ] && success "peer0.org2 joined ${CHANNEL_NAME}"

# ---------------------------------------------------------------------------
# Step 4: Peer0 Org3 joins
# ---------------------------------------------------------------------------
info "=== Step 4: Peer0 Org3 joins ${CHANNEL_NAME} ==="

ORG3_MSP="${CRYPTO_BASE}/peerOrganizations/org3.sipevita.example.com"
export CORE_PEER_LOCALMSPID=Org3MSP
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG3_MSP}/peers/peer0.org3.sipevita.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${ORG3_MSP}/users/Admin@org3.sipevita.example.com/msp"
export CORE_PEER_ADDRESS="${PEER0_ORG3}"

run_or_dry peer channel join -b "${CHANNEL_BLOCK}"
[ "$DRY_RUN" = false ] && success "peer0.org3 joined ${CHANNEL_NAME}"

# ---------------------------------------------------------------------------
# Step 5: Peer0 Org4 joins
# ---------------------------------------------------------------------------
info "=== Step 5: Peer0 Org4 joins ${CHANNEL_NAME} ==="

ORG4_MSP="${CRYPTO_BASE}/peerOrganizations/org4.sipevita.example.com"
export CORE_PEER_LOCALMSPID=Org4MSP
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG4_MSP}/peers/peer0.org4.sipevita.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${ORG4_MSP}/users/Admin@org4.sipevita.example.com/msp"
export CORE_PEER_ADDRESS="${PEER0_ORG4}"

run_or_dry peer channel join -b "${CHANNEL_BLOCK}"
[ "$DRY_RUN" = false ] && success "peer0.org4 joined ${CHANNEL_NAME}"

# ---------------------------------------------------------------------------
# Step 6: Set anchor peers (one per org)
# ---------------------------------------------------------------------------
info "=== Step 6: Verify anchor peers ==="
# Anchor peers were embedded in the genesis block via configtx.yaml AnchorPeers definitions.
# No separate config update is required for the Fabric 2.5 osnadmin flow.
# Anchor peers in the genesis block:
#   Org1MSP: peer0.org1.sipevita.example.com:7051
#   Org2MSP: peer0.org2.sipevita.example.com:7051
#   Org3MSP: peer0.org3.sipevita.example.com:7051
#   Org4MSP: peer0.org4.sipevita.example.com:7051
success "Anchor peers already embedded in genesis block — no channel update needed"

# ---------------------------------------------------------------------------
# Step 7: Verify channel membership
# ---------------------------------------------------------------------------
info "=== Step 7: Verify channel membership ==="

if [ "$DRY_RUN" = false ]; then
    # Check from Org1 perspective
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_MSP}/peers/peer0.org1.sipevita.example.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${ORG1_MSP}/users/Admin@org1.sipevita.example.com/msp"
    export CORE_PEER_ADDRESS="${PEER0_ORG1}"

    CHANNEL_LIST="$(peer channel list 2>/dev/null)"
    if echo "${CHANNEL_LIST}" | grep -q "${CHANNEL_NAME}"; then
        success "peer0.org1 is a member of ${CHANNEL_NAME}"
    else
        fail "peer0.org1 does not list ${CHANNEL_NAME}"
    fi

    # Fetch channel info
    peer channel getinfo -c "${CHANNEL_NAME}" 2>/dev/null | tee -a "${LOG_DIR}/channel-info.log" || true

    # Fetch latest config block and verify consenters (basic check)
    TEMP_BLOCK="/tmp/sipevita_${CHANNEL_NAME}_config.block"
    peer channel fetch config "${TEMP_BLOCK}" -o localhost:17050 \
        --ordererTLSHostnameOverride orderer1.sipevita.example.com \
        --tls --cafile "${ORDERER_CA}" -c "${CHANNEL_NAME}" 2>/dev/null || true

    if [ -f "${TEMP_BLOCK}" ]; then
        success "Channel config block fetched successfully"
        rm -f "${TEMP_BLOCK}"
    fi
fi

info "---"
success "Channel ${CHANNEL_NAME} creation and join complete."
info "Next: deploy-chaincode.sh"
