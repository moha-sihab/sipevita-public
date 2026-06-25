#!/usr/bin/env bash
# inspect-network.sh — Safe read-only inspection of the SIPEVITA Raft network.
# Phase dependency: Phase 13. Network must be running (Phase 8+).
# Read-only: never modifies containers, volumes, chaincode, or ledger state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRYPTO_BASE="${PROJECT_ROOT}/organizations"
LOG_DIR="${PROJECT_ROOT}/logs"
CHANNEL_NAME="${CHANNEL_NAME:-mychannel}"
CHAINCODE_NAME="${CHAINCODE_NAME:-sipevita}"

DRY_RUN=false
OUTPUT_JSON=false
LOG_FILE=""

EXPECTED_PEERS=(
    "peer0.org1.sipevita.example.com"
    "peer0.org2.sipevita.example.com"
    "peer0.org3.sipevita.example.com"
    "peer0.org4.sipevita.example.com"
)
EXPECTED_ORDERERS=(
    "orderer1.sipevita.example.com"
    "orderer2.sipevita.example.com"
    "orderer3.sipevita.example.com"
)
DOCKER_NETWORK="sipevita_raft"

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

Read-only inspection of the SIPEVITA Raft network state.

Checks:
  - Container status (peers and orderers)
  - Channel membership and block height
  - Chaincode deployment status
  - Orderer cluster health (Raft)
  - Docker resource usage

This script never modifies network state. All operations are queries only.
Output is safe to share; private keys and certificate bodies are never printed.

Options:
  --json          Emit a JSON summary at the end (for scripted consumers).
  --log FILE      Also write output to FILE (default: no log file).
  --dry-run       Report what would be checked without connecting to Fabric.
  --help          Show this help message.

Environment:
  CHANNEL_NAME    (default: mychannel)
  CHAINCODE_NAME  (default: sipevita)
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help)    usage ;;
        --json)    OUTPUT_JSON=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --log)     LOG_FILE="$2"; shift 2 ;;
        *)         error "Unknown argument: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guard
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

# ---------------------------------------------------------------------------
# Optional log tee
# ---------------------------------------------------------------------------
if [ -n "${LOG_FILE}" ]; then
    mkdir -p "${LOG_DIR}"
    exec > >(tee -a "${LOG_FILE}") 2>&1
    info "Logging to: ${LOG_FILE}"
fi

info "SIPEVITA Raft Network — inspect-network"
info "Project root: ${PROJECT_ROOT}"
info "Channel:      ${CHANNEL_NAME}"
info "Chaincode:    ${CHAINCODE_NAME}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no Fabric CLI calls)"

# ---------------------------------------------------------------------------
# Results accumulation (for JSON output)
# ---------------------------------------------------------------------------
CONTAINERS_OK=0
CONTAINERS_DOWN=0
CHANNEL_HEIGHT="unknown"
CHAINCODE_STATUS="unknown"
ORDERER_HEALTH="unknown"

# ---------------------------------------------------------------------------
# Section 1: Docker container status
# ---------------------------------------------------------------------------
info ""
info "=== Section 1: Container Status ==="

if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running. Cannot inspect containers."
    exit 1
fi

for PEER in "${EXPECTED_PEERS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        info "[dry-run] Would check: ${PEER}"
        continue
    fi
    if docker ps --filter "name=${PEER}" --filter 'status=running' -q 2>/dev/null | grep -q .; then
        STATUS="$(docker inspect --format '{{.State.Status}}' "${PEER}" 2>/dev/null || echo unknown)"
        HEALTH="$(docker inspect --format '{{.State.Health.Status}}' "${PEER}" 2>/dev/null || echo none)"
        success "RUNNING: ${PEER} (status=${STATUS}, health=${HEALTH})"
        CONTAINERS_OK=$(( CONTAINERS_OK + 1 ))
    else
        fail "NOT RUNNING: ${PEER}"
        CONTAINERS_DOWN=$(( CONTAINERS_DOWN + 1 ))
    fi
done

for ORDERER in "${EXPECTED_ORDERERS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        info "[dry-run] Would check: ${ORDERER}"
        continue
    fi
    if docker ps --filter "name=${ORDERER}" --filter 'status=running' -q 2>/dev/null | grep -q .; then
        STATUS="$(docker inspect --format '{{.State.Status}}' "${ORDERER}" 2>/dev/null || echo unknown)"
        success "RUNNING: ${ORDERER} (status=${STATUS})"
        CONTAINERS_OK=$(( CONTAINERS_OK + 1 ))
    else
        fail "NOT RUNNING: ${ORDERER}"
        CONTAINERS_DOWN=$(( CONTAINERS_DOWN + 1 ))
    fi
done

# Docker network
if [ "$DRY_RUN" = false ]; then
    if docker network inspect "${DOCKER_NETWORK}" &>/dev/null 2>&1; then
        CONTAINER_COUNT="$(docker network inspect "${DOCKER_NETWORK}" --format '{{len .Containers}}' 2>/dev/null || echo unknown)"
        success "Docker network '${DOCKER_NETWORK}' active with ${CONTAINER_COUNT} containers"
    else
        warn "Docker network '${DOCKER_NETWORK}' not found"
    fi
fi

# ---------------------------------------------------------------------------
# Section 2: Docker resource usage
# ---------------------------------------------------------------------------
info ""
info "=== Section 2: Docker Resource Usage ==="

if [ "$DRY_RUN" = false ]; then
    DOCKER_MEM_BYTES="$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
    DOCKER_MEM_GB=$(( DOCKER_MEM_BYTES / 1024 / 1024 / 1024 ))
    info "Docker allocated memory: ~${DOCKER_MEM_GB} GB"
    [ "${DOCKER_MEM_GB}" -lt 8 ] && warn "Less than 8 GB allocated. Performance may be degraded."

    # Container resource summary (no private data)
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        2>/dev/null | grep -E "(sipevita|orderer|peer)" || true
else
    info "[dry-run] Would show docker stats for sipevita containers"
fi

# ---------------------------------------------------------------------------
# Section 3: Channel status
# ---------------------------------------------------------------------------
info ""
info "=== Section 3: Channel Status ==="

ORDERER_CA="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/tlsca/tlsca.sipevita.example.com-cert.pem"
ORG1_MSP="${CRYPTO_BASE}/peerOrganizations/org1.sipevita.example.com"
ORG1_TLS_CA="${ORG1_MSP}/peers/peer0.org1.sipevita.example.com/tls/ca.crt"
ORG1_ADMIN_MSP="${ORG1_MSP}/users/Admin@org1.sipevita.example.com/msp"

if ! command -v peer &>/dev/null; then
    warn "peer not in PATH — skipping channel/chaincode checks."
    info "Add Fabric 2.5.x binaries to PATH to enable Fabric CLI checks."
elif [ "$DRY_RUN" = true ]; then
    info "[dry-run] Would run: peer channel list (Org1MSP)"
    info "[dry-run] Would run: peer channel getinfo -c ${CHANNEL_NAME}"
    info "[dry-run] Would run: peer lifecycle chaincode querycommitted -C ${CHANNEL_NAME}"
else
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
    export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
    export CORE_PEER_ADDRESS="localhost:7051"

    # Channel list
    CHANNEL_LIST="$(peer channel list 2>/dev/null || echo ERROR)"
    if echo "${CHANNEL_LIST}" | grep -q "${CHANNEL_NAME}"; then
        success "Org1MSP peer is member of ${CHANNEL_NAME}"
    else
        fail "Org1MSP peer is NOT member of ${CHANNEL_NAME}"
    fi

    # Channel block height
    CHANNEL_INFO="$(peer channel getinfo -c "${CHANNEL_NAME}" 2>/dev/null || echo ERROR)"
    if [ "${CHANNEL_INFO}" != "ERROR" ]; then
        CHANNEL_HEIGHT="$(echo "${CHANNEL_INFO}" | grep -o 'height:[0-9]*' | head -1 | cut -d: -f2 || echo unknown)"
        success "Channel '${CHANNEL_NAME}' block height: ${CHANNEL_HEIGHT}"
    else
        warn "Could not retrieve channel info for ${CHANNEL_NAME}"
    fi

    # Per-org channel membership check
    for ORG_NUM in 2 3 4; do
        ORG_DOMAIN="org${ORG_NUM}.sipevita.example.com"
        ORG_MSP="${CRYPTO_BASE}/peerOrganizations/${ORG_DOMAIN}"
        ORG_HOST_PORTS=("" "7051" "8051" "9051" "10051")
        export CORE_PEER_LOCALMSPID="Org${ORG_NUM}MSP"
        export CORE_PEER_TLS_ROOTCERT_FILE="${ORG_MSP}/peers/peer0.${ORG_DOMAIN}/tls/ca.crt"
        export CORE_PEER_MSPCONFIGPATH="${ORG_MSP}/users/Admin@${ORG_DOMAIN}/msp"
        export CORE_PEER_ADDRESS="localhost:${ORG_HOST_PORTS[${ORG_NUM}]}"

        ORG_CHANNELS="$(peer channel list 2>/dev/null || echo ERROR)"
        if echo "${ORG_CHANNELS}" | grep -q "${CHANNEL_NAME}"; then
            success "Org${ORG_NUM}MSP peer is member of ${CHANNEL_NAME}"
        else
            warn "Org${ORG_NUM}MSP peer may not be on ${CHANNEL_NAME} (check separately)"
        fi
    done
fi

# ---------------------------------------------------------------------------
# Section 4: Chaincode status
# ---------------------------------------------------------------------------
info ""
info "=== Section 4: Chaincode Deployment Status ==="

if command -v peer &>/dev/null && [ "$DRY_RUN" = false ]; then
    # Reset to Org1MSP
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"
    export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
    export CORE_PEER_ADDRESS="localhost:7051"

    CC_COMMITTED="$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" 2>/dev/null || echo ERROR)"
    if echo "${CC_COMMITTED}" | grep -q "${CHAINCODE_NAME}"; then
        CC_VERSION="$(echo "${CC_COMMITTED}" | grep -o "Version: [^,]*" | head -1 || echo unknown)"
        CC_SEQUENCE="$(echo "${CC_COMMITTED}" | grep -o "Sequence: [^,]*" | head -1 || echo unknown)"
        success "Chaincode committed: ${CHAINCODE_NAME} (${CC_VERSION}, ${CC_SEQUENCE})"
        CHAINCODE_STATUS="committed"
    else
        info "Chaincode '${CHAINCODE_NAME}' not yet committed on ${CHANNEL_NAME}"
        CHAINCODE_STATUS="not-committed"
    fi
elif [ "$DRY_RUN" = true ]; then
    info "[dry-run] Would run: peer lifecycle chaincode querycommitted -C ${CHANNEL_NAME} -n ${CHAINCODE_NAME}"
fi

# ---------------------------------------------------------------------------
# Section 5: Orderer Raft health
# ---------------------------------------------------------------------------
info ""
info "=== Section 5: Orderer Raft Cluster Health ==="

if command -v osnadmin &>/dev/null && [ "$DRY_RUN" = false ]; then
    ORDERER_CA_PATH="${ORDERER_CA}"
    ORDERER_ENTRIES=(
        "orderer1 localhost:7053"
        "orderer2 localhost:8053"
        "orderer3 localhost:9053"
    )
    ORDERERS_HEALTHY=0
    for ENTRY in "${ORDERER_ENTRIES[@]}"; do
        ORDERER_NAME="${ENTRY%% *}"
        ORDERER_ADMIN_EP="${ENTRY##* }"
        ORDERER_TLS_CERT="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/orderers/${ORDERER_NAME}.sipevita.example.com/tls/server.crt"
        ORDERER_TLS_KEY="${CRYPTO_BASE}/ordererOrganizations/sipevita.example.com/orderers/${ORDERER_NAME}.sipevita.example.com/tls/server.key"

        CHANNEL_LIST_OUT="$(osnadmin channel list \
            -o "${ORDERER_ADMIN_EP}" \
            --ca-file "${ORDERER_CA_PATH}" \
            --client-cert "${ORDERER_TLS_CERT}" \
            --client-key "${ORDERER_TLS_KEY}" 2>/dev/null || echo ERROR)"

        if echo "${CHANNEL_LIST_OUT}" | grep -q "${CHANNEL_NAME}"; then
            success "Orderer ${ORDERER_NAME}: participating in ${CHANNEL_NAME}"
            ORDERERS_HEALTHY=$(( ORDERERS_HEALTHY + 1 ))
        else
            warn "Orderer ${ORDERER_NAME}: not responding or not on ${CHANNEL_NAME}"
        fi
    done

    if [ "${ORDERERS_HEALTHY}" -ge 2 ]; then
        success "Raft quorum: ${ORDERERS_HEALTHY}/3 orderers healthy (quorum requirement: 2)"
        ORDERER_HEALTH="quorum-ok"
    else
        fail "Raft quorum: only ${ORDERERS_HEALTHY}/3 orderers healthy — QUORUM LOST"
        ORDERER_HEALTH="quorum-lost"
    fi
elif [ "$DRY_RUN" = true ]; then
    info "[dry-run] Would check osnadmin channel list on all 3 orderers (admin ports 7053, 8053, 9053)"
elif ! command -v osnadmin &>/dev/null; then
    warn "osnadmin not in PATH — skipping orderer health check"
fi

# ---------------------------------------------------------------------------
# Section 6: Port reachability
# ---------------------------------------------------------------------------
info ""
info "=== Section 6: Port Reachability ==="

declare -A PORT_MAP=(
    ["7051"]="peer0.org1 (gRPC)"
    ["8051"]="peer0.org2 (gRPC)"
    ["9051"]="peer0.org3 (gRPC)"
    ["10051"]="peer0.org4 (gRPC)"
    ["7050"]="orderer1 (gRPC)"
    ["8050"]="orderer2 (gRPC)"
    ["9050"]="orderer3 (gRPC)"
    ["7053"]="orderer1 (admin)"
    ["8053"]="orderer2 (admin)"
    ["9053"]="orderer3 (admin)"
)

if [ "$DRY_RUN" = false ]; then
    for PORT in "${!PORT_MAP[@]}"; do
        LABEL="${PORT_MAP[$PORT]}"
        if lsof -iTCP:"${PORT}" -sTCP:LISTEN &>/dev/null 2>&1; then
            success "LISTENING: ${PORT} (${LABEL})"
        else
            warn "NOT LISTENING: ${PORT} (${LABEL})"
        fi
    done
else
    info "[dry-run] Would check lsof on ports: ${!PORT_MAP[*]}"
fi

# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------
if [ "$OUTPUT_JSON" = true ]; then
    info ""
    info "=== JSON Summary ==="
    cat <<JSON
{
  "network": "sipevita-raft",
  "channel": "${CHANNEL_NAME}",
  "chaincode": "${CHAINCODE_NAME}",
  "containers": {
    "running": ${CONTAINERS_OK},
    "down":    ${CONTAINERS_DOWN},
    "expected": 7
  },
  "channel_block_height": "${CHANNEL_HEIGHT}",
  "chaincode_status": "${CHAINCODE_STATUS}",
  "orderer_health":   "${ORDERER_HEALTH}"
}
JSON
fi

info ""
info "---"
if [ "$DRY_RUN" = false ]; then
    if [ "${CONTAINERS_DOWN}" -eq 0 ]; then
        success "Inspection complete. All expected containers are running."
    else
        fail "Inspection complete. ${CONTAINERS_DOWN} container(s) are NOT running."
    fi
else
    success "Dry-run inspection complete. No Fabric CLI calls were made."
fi
info "test-network was NOT inspected or modified."
