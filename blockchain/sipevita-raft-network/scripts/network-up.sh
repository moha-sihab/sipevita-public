#!/usr/bin/env bash
# network-up.sh — Start the SIPEVITA Raft network containers.
# Phase dependency: Phase 8. Requires Phase 5 (crypto), Phase 7 (compose files).
# Do NOT run this script until Phases 5 and 7 are complete.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_DIR="${PROJECT_ROOT}/compose"
LOG_DIR="${PROJECT_ROOT}/logs"

DRY_RUN=false
STOP_CURRENT=false
WAIT_TIMEOUT=60

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

Start the SIPEVITA Raft network (4 peers + 3 orderers).

REQUIRES:
  - Crypto material in organizations/ (Phase 5)
  - Channel artifacts in channel-artifacts/ (Phase 6)
  - Docker Compose files in compose/ (Phase 7)
  - Docker daemon running

Options:
  --dry-run               Show what would be done without starting containers.
  --stop-current-network  Stop the test-network before starting (requires confirmation).
  --help                  Show this help message.

WARNING: This starts 7 Fabric containers. Ensure Docker has >= 8 GB RAM allocated.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --help)                 usage ;;
        --dry-run)              DRY_RUN=true ;;
        --stop-current-network) STOP_CURRENT=true ;;
        *)                      error "Unknown argument: $arg"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guard
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

info "SIPEVITA Raft Network — network-up"
info "Project root: ${PROJECT_ROOT}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no containers will be started)"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker Desktop first."
    exit 1
fi
success "Docker daemon: reachable"

# Locate compose file
COMPOSE_FILES=(
    "${COMPOSE_DIR}/compose-raft.yaml"
)
COMPOSE_ARGS=()
for CF in "${COMPOSE_FILES[@]}"; do
    if [ -f "$CF" ]; then
        COMPOSE_ARGS+=("-f" "$CF")
    else
        warn "Compose file not found (will be created in Phase 7): $CF"
    fi
done

if [ ${#COMPOSE_ARGS[@]} -eq 0 ]; then
    error "No Docker Compose files found in ${COMPOSE_DIR}."
    error "Phase 7 (create Docker Compose topology) must be completed first."
    exit 1
fi

# Crypto material
CRYPTO_BASE="${PROJECT_ROOT}/organizations"
if [ ! -d "${CRYPTO_BASE}/peerOrganizations" ] || [ ! -d "${CRYPTO_BASE}/ordererOrganizations" ]; then
    error "Crypto material not found in ${CRYPTO_BASE}."
    error "Phase 5 (generate-crypto.sh) must be completed first."
    exit 1
fi
success "Crypto material: found"

# Channel artifacts
CHANNEL_ARTIFACTS="${PROJECT_ROOT}/channel-artifacts"
if [ ! -d "${CHANNEL_ARTIFACTS}" ] || [ -z "$(ls -A "${CHANNEL_ARTIFACTS}" 2>/dev/null)" ]; then
    error "Channel artifacts not found in ${CHANNEL_ARTIFACTS}."
    error "Phase 6 (configtx / channel artifact generation) must be completed first."
    exit 1
fi
success "Channel artifacts: found"

# ---------------------------------------------------------------------------
# Port check
# ---------------------------------------------------------------------------
CRITICAL_PORTS=(17051 17050 18051 18050 19051 19050 20051 17053 18053 19053)
PORT_CONFLICTS=()
for PORT in "${CRITICAL_PORTS[@]}"; do
    if lsof -iTCP:"${PORT}" -sTCP:LISTEN &>/dev/null 2>&1; then
        PORT_CONFLICTS+=("${PORT}")
    fi
done

if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
    warn "Port conflicts detected on: ${PORT_CONFLICTS[*]}"
    warn "Conflicting ports may indicate test-network is running."
fi

# ---------------------------------------------------------------------------
# test-network detection
# ---------------------------------------------------------------------------
TEST_NETWORK_CONTAINERS="$(docker ps --filter 'name=org1.example.com' --filter 'status=running' -q 2>/dev/null | wc -l | tr -d ' ')"
if [ "${TEST_NETWORK_CONTAINERS}" -gt 0 ]; then
    if [ "$STOP_CURRENT" = false ]; then
        warn "test-network containers appear to be running (${TEST_NETWORK_CONTAINERS} found)."
        warn "Running both networks may cause port conflicts and resource exhaustion."
        warn "Pass --stop-current-network to stop it automatically, or stop it manually:"
        warn "  cd ~/fabric-samples/test-network && ./network.sh down"
    else
        warn "Stopping test-network (--stop-current-network passed)..."
        if [ "$DRY_RUN" = false ]; then
            TEST_NET_DIR="${HOME}/fabric-samples/test-network"
            if [ -f "${TEST_NET_DIR}/network.sh" ]; then
                (cd "${TEST_NET_DIR}" && ./network.sh down)
                success "test-network stopped"
            else
                error "test-network/network.sh not found at expected path. Stop manually."
                exit 1
            fi
        else
            info "[dry-run] Would stop test-network."
        fi
    fi
fi

# ---------------------------------------------------------------------------
# Docker resource warning
# ---------------------------------------------------------------------------
DOCKER_MEM_BYTES="$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0)"
DOCKER_MEM_GB=$(( DOCKER_MEM_BYTES / 1024 / 1024 / 1024 ))
info "Docker total memory: ~${DOCKER_MEM_GB} GB"
if [ "${DOCKER_MEM_GB}" -lt 8 ]; then
    warn "Docker has less than 8 GB. 7 Fabric containers may be resource-constrained."
fi

# ---------------------------------------------------------------------------
# Start network
# ---------------------------------------------------------------------------
mkdir -p "${LOG_DIR}"

if [ "$DRY_RUN" = false ]; then
    info "Starting SIPEVITA Raft network..."
    docker compose "${COMPOSE_ARGS[@]}" up -d 2>&1 | tee -a "${LOG_DIR}/network-up.log"
    success "Docker Compose services started"

    # Wait for containers
    info "Waiting for containers to be ready (timeout: ${WAIT_TIMEOUT}s)..."
    ELAPSED=0
    READY=0
    EXPECTED_COUNT=$(( ${#EXPECTED_PEERS[@]} + ${#EXPECTED_ORDERERS[@]} ))
    while [ "${ELAPSED}" -lt "${WAIT_TIMEOUT}" ]; do
        RUNNING="$(docker ps --filter "network=${DOCKER_NETWORK}" --filter 'status=running' -q 2>/dev/null | wc -l | tr -d ' ')"
        if [ "${RUNNING}" -ge "${EXPECTED_COUNT}" ]; then
            READY=1
            break
        fi
        sleep 3
        ELAPSED=$(( ELAPSED + 3 ))
    done

    if [ "$READY" -eq 1 ]; then
        success "All expected containers are running"
    else
        fail "Timeout waiting for containers. Check: docker ps and docker compose logs"
        exit 1
    fi

    # Verify expected containers
    info "Verifying peer containers..."
    for PEER in "${EXPECTED_PEERS[@]}"; do
        if docker ps --filter "name=${PEER}" --filter 'status=running' -q 2>/dev/null | grep -q .; then
            success "Peer running: ${PEER}"
        else
            fail "Peer not running: ${PEER}"
        fi
    done

    info "Verifying orderer containers..."
    for ORDERER in "${EXPECTED_ORDERERS[@]}"; do
        if docker ps --filter "name=${ORDERER}" --filter 'status=running' -q 2>/dev/null | grep -q .; then
            success "Orderer running: ${ORDERER}"
        else
            fail "Orderer not running: ${ORDERER}"
        fi
    done

    info "---"
    success "Network is up. Run create-channel.sh next."
else
    info "[dry-run] Would start: docker compose ${COMPOSE_ARGS[*]} up -d"
    info "[dry-run] Would verify: 4 peers + 3 orderers in network ${DOCKER_NETWORK}"
fi
