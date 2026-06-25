#!/usr/bin/env bash
# preflight.sh — Validate environment before any Fabric generation or runtime action.
# Phase dependency: Phase 0 baseline. Run before every other script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/preflight.log"

DRY_RUN=false
WRITE_LOG=false
EXIT_CODE=0

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
info()    { echo "[INFO]  $*"; }
warn()    { echo "[WARN]  $*" >&2; }
error()   { echo "[ERROR] $*" >&2; }
success() { echo "[PASS]  $*"; }
fail()    { echo "[FAIL]  $*" >&2; EXIT_CODE=1; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Validate the local environment before running any SIPEVITA Raft network scripts.

Options:
  --dry-run    Print checks that would be performed but do not produce a log file.
  --log        Write output to logs/preflight.log.
  --help       Show this help message.

Exit codes:
  0   All critical checks passed (warnings may be present).
  1   One or more critical checks failed.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --help)    usage ;;
        --dry-run) DRY_RUN=true ;;
        --log)     WRITE_LOG=true ;;
        *)         error "Unknown argument: $arg"; exit 1 ;;
    esac
done

if [ "$WRITE_LOG" = true ] && [ "$DRY_RUN" = false ]; then
    mkdir -p "${LOG_DIR}"
    exec > >(tee -a "${LOG_FILE}") 2>&1
fi

info "SIPEVITA Raft Network — preflight check"
info "Project root: ${PROJECT_ROOT}"
[ "$DRY_RUN" = true ] && info "(dry-run: no log file written)"

# Add fabric-samples/bin to PATH so peer, osnadmin, cryptogen, configtxgen are found
# when not already in the shell PATH (common on macOS without manual PATH export).
FABRIC_BIN="${HOME}/fabric-samples/bin"
if [ -d "${FABRIC_BIN}" ] && [[ ":${PATH}:" != *":${FABRIC_BIN}:"* ]]; then
    export PATH="${FABRIC_BIN}:${PATH}"
    info "Added ${FABRIC_BIN} to PATH for tool discovery"
fi

# ---------------------------------------------------------------------------
# Guard: never operate on test-network
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

# ---------------------------------------------------------------------------
# Helper: check command exists
# ---------------------------------------------------------------------------
check_cmd() {
    local cmd="$1"
    local label="${2:-$1}"
    if command -v "$cmd" &>/dev/null; then
        success "${label}: $(command -v "$cmd")"
    else
        fail "${label}: not found in PATH"
    fi
}

# ---------------------------------------------------------------------------
# 1. Docker CLI
# ---------------------------------------------------------------------------
info "--- Docker ---"
check_cmd docker "docker CLI"

# 2. Docker daemon
if docker info &>/dev/null 2>&1; then
    success "Docker daemon: reachable"
else
    fail "Docker daemon: not running or not accessible"
fi

# 3. Docker Compose
if docker compose version &>/dev/null 2>&1; then
    success "Docker Compose plugin: $(docker compose version --short 2>/dev/null || echo 'available')"
else
    fail "Docker Compose plugin: not available (run: docker compose version)"
fi

# ---------------------------------------------------------------------------
# 4. Fabric CLI binaries
# ---------------------------------------------------------------------------
info "--- Fabric CLI binaries ---"
check_cmd peer       "peer"
check_cmd configtxgen "configtxgen"
check_cmd cryptogen  "cryptogen"
check_cmd osnadmin   "osnadmin"

# Fabric version (if peer is available)
if command -v peer &>/dev/null; then
    PEER_VERSION="$(peer version 2>/dev/null | grep 'Version:' | awk '{print $2}' || echo 'unknown')"
    info "peer version: ${PEER_VERSION}"
    if [[ "${PEER_VERSION}" == 2.5.* ]]; then
        success "peer version is in Fabric 2.5.x line"
    else
        warn "peer version '${PEER_VERSION}' is not in the expected 2.5.x line"
    fi
fi

# ---------------------------------------------------------------------------
# 5. Utility tools
# ---------------------------------------------------------------------------
info "--- Utility tools ---"
check_cmd jq      "jq"
check_cmd openssl "openssl"
check_cmd node    "Node.js"
check_cmd npm     "npm"

# Node.js version
if command -v node &>/dev/null; then
    NODE_VERSION="$(node --version)"
    info "Node.js version: ${NODE_VERSION}"
    NODE_MAJOR="${NODE_VERSION#v}"
    NODE_MAJOR="${NODE_MAJOR%%.*}"
    if [ "${NODE_MAJOR}" -ge 20 ]; then
        success "Node.js version >= 20 (required by sipevita-chaincode)"
    else
        fail "Node.js version ${NODE_VERSION} is below 20 (sipevita-chaincode requires >=20)"
    fi
fi

# ---------------------------------------------------------------------------
# 6. macOS architecture
# ---------------------------------------------------------------------------
info "--- Architecture ---"
ARCH="$(uname -m)"
info "Architecture: ${ARCH}"
if [ "${ARCH}" = "arm64" ]; then
    success "Apple Silicon (arm64) — use arm64-compatible Fabric images"
elif [ "${ARCH}" = "x86_64" ]; then
    success "Intel x86_64"
else
    warn "Unknown architecture: ${ARCH}"
fi

# ---------------------------------------------------------------------------
# 7. Fabric Docker images (only if Docker daemon is running)
# ---------------------------------------------------------------------------
info "--- Fabric Docker images ---"
if docker info &>/dev/null 2>&1; then
    for IMG in hyperledger/fabric-peer hyperledger/fabric-orderer hyperledger/fabric-tools; do
        TAGS="$(docker images --format '{{.Tag}}' "${IMG}" 2>/dev/null | head -5 || echo '')"
        if [ -n "$TAGS" ]; then
            info "Image ${IMG} tags found: $(echo "$TAGS" | tr '\n' ' ')"
        else
            warn "Image ${IMG}: not found locally (will be pulled on first start)"
        fi
    done
else
    warn "Skipping Docker image check (Docker daemon not running)"
fi

# ---------------------------------------------------------------------------
# 8. Required host ports
# ---------------------------------------------------------------------------
info "--- Port availability ---"
PEER_PORTS=(17051 18051 19051 20051 17444 18444 19444 20444)
ORDERER_PORTS=(17050 18050 19050 17053 18053 19053 17443 18443 19443)
ALL_PORTS=("${PEER_PORTS[@]}" "${ORDERER_PORTS[@]}")

PORT_CONFLICTS=()
for PORT in "${ALL_PORTS[@]}"; do
    if lsof -iTCP:"${PORT}" -sTCP:LISTEN &>/dev/null 2>&1; then
        warn "Port ${PORT}: IN USE"
        PORT_CONFLICTS+=("${PORT}")
    fi
done

if [ ${#PORT_CONFLICTS[@]} -eq 0 ]; then
    success "All required ports are available"
else
    fail "Port conflicts detected: ${PORT_CONFLICTS[*]}"
    warn "If test-network is running, ports 7051 and 9051 will conflict with Org1 and Org3 peers."
    warn "Stop test-network before starting sipevita-raft-network."
fi

# ---------------------------------------------------------------------------
# 9. Required project directories
# ---------------------------------------------------------------------------
info "--- Project directories ---"
REQUIRED_DIRS=(
    "${PROJECT_ROOT}/compose"
    "${PROJECT_ROOT}/configtx"
    "${PROJECT_ROOT}/organizations/cryptogen"
    "${PROJECT_ROOT}/channel-artifacts"
    "${PROJECT_ROOT}/connection-profiles"
    "${PROJECT_ROOT}/wallet-raft"
    "${PROJECT_ROOT}/scripts"
    "${PROJECT_ROOT}/logs"
)
for DIR in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$DIR" ]; then
        success "Directory: $(basename "$DIR")"
    else
        fail "Directory missing: $DIR"
    fi
done

# ---------------------------------------------------------------------------
# 10. Required plan and design files
# ---------------------------------------------------------------------------
info "--- Design documents ---"
REQUIRED_DOCS=(
    "${PROJECT_ROOT}/PLAN.txt"
    "${PROJECT_ROOT}/ORGANIZATION_DESIGN.md"
    "${PROJECT_ROOT}/NETWORK_BASELINE.md"
    "${PROJECT_ROOT}/CHAINCODE_COMPATIBILITY_REVIEW.md"
    "${PROJECT_ROOT}/BACKEND_INTEGRATION_CONTRACT.md"
)
for DOC in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$DOC" ]; then
        success "Document: $(basename "$DOC")"
    else
        fail "Document missing: $DOC"
    fi
done

# ---------------------------------------------------------------------------
# 11. Chaincode source
# ---------------------------------------------------------------------------
info "--- Chaincode source ---"
CHAINCODE_SRC="${CHAINCODE_SRC:-$(cd "${PROJECT_ROOT}/../sipevita-chaincode" && pwd)}"
if [ -d "${CHAINCODE_SRC}" ]; then
    success "Chaincode directory: ${CHAINCODE_SRC}"
else
    fail "Chaincode source not found: ${CHAINCODE_SRC}"
fi
if [ -f "${CHAINCODE_SRC}/package.json" ]; then
    success "Chaincode package.json found"
else
    fail "Chaincode package.json missing"
fi
if [ -f "${CHAINCODE_SRC}/lib/sipevitaContract.js" ]; then
    success "Chaincode contract source found"
else
    fail "Chaincode contract source missing: lib/sipevitaContract.js"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
info "---"
if [ "${EXIT_CODE}" -eq 0 ]; then
    success "All critical preflight checks passed."
else
    error "One or more critical checks failed. Review output above before proceeding."
fi

exit "${EXIT_CODE}"
