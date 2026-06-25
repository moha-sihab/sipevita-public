#!/usr/bin/env bash
# generate-crypto.sh — Generate MSP and TLS material for all organizations using cryptogen.
# Phase dependency: Phase 5. Requires crypto-config.yaml (created in Phase 5).
# Do NOT run this script until Phase 5 is complete.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRYPTO_CONFIG="${PROJECT_ROOT}/organizations/cryptogen/crypto-config.yaml"
CRYPTO_OUTPUT="${PROJECT_ROOT}/organizations"

DRY_RUN=false
FORCE=false
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

Generate MSP and TLS crypto material for all 4 peer organizations and the
orderer organization using cryptogen.

REQUIRES: organizations/cryptogen/crypto-config.yaml (created in Phase 5)
WRITES TO: organizations/peerOrganizations/ and organizations/ordererOrganizations/

Options:
  --dry-run   Show what would be done without executing.
  --force     Overwrite existing crypto material (use with caution).
  --help      Show this help message.

WARNING: Generated material contains private keys. The organizations/ directory
is gitignored. Never commit private keys or MSP material.
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
        --force)   FORCE=true ;;
        *)         error "Unknown argument: $arg"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guard: never operate on test-network
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

info "SIPEVITA Raft Network — generate-crypto"
info "Project root: ${PROJECT_ROOT}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no files will be written)"
[ "$FORCE"   = true ] && warn "(--force: existing crypto material will be overwritten)"

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------
if ! command -v cryptogen &>/dev/null; then
    # Defect fix (Phase 5): check fabric-samples/bin fallback before failing.
    # cryptogen is not always in PATH on macOS; fabric-samples/bin is the standard install location.
    FABRIC_BIN="${HOME}/fabric-samples/bin"
    if [ -x "${FABRIC_BIN}/cryptogen" ]; then
        export PATH="${FABRIC_BIN}:${PATH}"
        info "cryptogen not in PATH; added ${FABRIC_BIN} temporarily"
    else
        error "cryptogen not found in PATH or ${FABRIC_BIN}."
        error "Install Fabric 2.5.x binaries: https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html"
        exit 1
    fi
fi
success "cryptogen: $(command -v cryptogen)"

CRYPTOGEN_VERSION="$(cryptogen version 2>/dev/null | grep 'Version:' | awk '{print $2}' || echo 'unknown')"
info "cryptogen version: ${CRYPTOGEN_VERSION}"
if [[ "${CRYPTOGEN_VERSION}" == 2.5.* ]] || [[ "${CRYPTOGEN_VERSION}" == v2.5.* ]]; then
    success "cryptogen version is in Fabric 2.5.x line"
else
    warn "cryptogen version '${CRYPTOGEN_VERSION}' may not be in expected 2.5.x line"
fi

if [ ! -f "${CRYPTO_CONFIG}" ]; then
    error "crypto-config.yaml not found: ${CRYPTO_CONFIG}"
    error "Phase 5 must be completed first (create organizations/cryptogen/crypto-config.yaml)."
    exit 1
fi
success "crypto-config.yaml found"

# ---------------------------------------------------------------------------
# Check for existing material
# ---------------------------------------------------------------------------
PEER_ORGS_DIR="${CRYPTO_OUTPUT}/peerOrganizations"
ORDERER_ORGS_DIR="${CRYPTO_OUTPUT}/ordererOrganizations"

if [ -d "${PEER_ORGS_DIR}" ] || [ -d "${ORDERER_ORGS_DIR}" ]; then
    if [ "$FORCE" = false ]; then
        error "Existing crypto material found in ${CRYPTO_OUTPUT}."
        error "Pass --force to overwrite. Existing: $(ls "${CRYPTO_OUTPUT}" 2>/dev/null | tr '\n' ' ')"
        exit 1
    else
        warn "Removing existing crypto material (--force passed)."
        if [ "$DRY_RUN" = false ]; then
            rm -rf "${PEER_ORGS_DIR}" "${ORDERER_ORGS_DIR}"
        else
            info "[dry-run] Would remove: ${PEER_ORGS_DIR} ${ORDERER_ORGS_DIR}"
        fi
    fi
fi

# ---------------------------------------------------------------------------
# Generate crypto material
# ---------------------------------------------------------------------------
info "Running cryptogen generate..."
if [ "$DRY_RUN" = false ]; then
    cryptogen generate \
        --config="${CRYPTO_CONFIG}" \
        --output="${CRYPTO_OUTPUT}"
    success "cryptogen generate completed"
else
    info "[dry-run] Would run: cryptogen generate --config=${CRYPTO_CONFIG} --output=${CRYPTO_OUTPUT}"
fi

# ---------------------------------------------------------------------------
# Validate output structure
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = false ]; then
    info "Validating generated structure..."

    EXPECTED_PEER_ORGS=(
        "org1.sipevita.example.com"
        "org2.sipevita.example.com"
        "org3.sipevita.example.com"
        "org4.sipevita.example.com"
    )
    for ORG_DOMAIN in "${EXPECTED_PEER_ORGS[@]}"; do
        ORG_DIR="${PEER_ORGS_DIR}/${ORG_DOMAIN}"
        if [ -d "${ORG_DIR}" ]; then
            success "Peer org directory: ${ORG_DOMAIN}"
        else
            fail "Missing peer org directory: ${ORG_DIR}"
        fi
    done

    PEER_ORG_COUNT="$(ls "${PEER_ORGS_DIR}" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${PEER_ORG_COUNT}" -eq 4 ]; then
        success "Peer organization count: ${PEER_ORG_COUNT} (expected 4)"
    else
        fail "Peer organization count: ${PEER_ORG_COUNT} (expected 4)"
    fi

    ORDERER_ORG_DIR="${ORDERER_ORGS_DIR}/sipevita.example.com"
    if [ -d "${ORDERER_ORG_DIR}" ]; then
        success "Orderer org directory: sipevita.example.com"
    else
        fail "Missing orderer org directory: ${ORDERER_ORG_DIR}"
    fi

    EXPECTED_ORDERERS=(
        "orderer1.sipevita.example.com"
        "orderer2.sipevita.example.com"
        "orderer3.sipevita.example.com"
    )
    for ORDERER_HOSTNAME in "${EXPECTED_ORDERERS[@]}"; do
        ORDERER_DIR="${ORDERER_ORG_DIR}/orderers/${ORDERER_HOSTNAME}"
        if [ -d "${ORDERER_DIR}" ]; then
            success "Orderer directory: ${ORDERER_HOSTNAME}"
        else
            fail "Missing orderer directory: ${ORDERER_DIR}"
        fi
    done

    # Verify expected peer hostnames exist
    EXPECTED_PEERS=(
        "org1.sipevita.example.com/peers/peer0.org1.sipevita.example.com"
        "org2.sipevita.example.com/peers/peer0.org2.sipevita.example.com"
        "org3.sipevita.example.com/peers/peer0.org3.sipevita.example.com"
        "org4.sipevita.example.com/peers/peer0.org4.sipevita.example.com"
    )
    for PEER_PATH in "${EXPECTED_PEERS[@]}"; do
        if [ -d "${PEER_ORGS_DIR}/${PEER_PATH}" ]; then
            success "Peer node: $(basename "${PEER_PATH}")"
        else
            fail "Missing peer node directory: ${PEER_ORGS_DIR}/${PEER_PATH}"
        fi
    done
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
info "---"
if [ "${EXIT_CODE}" -eq 0 ]; then
    success "Crypto material generated and validated."
    info "Organizations directory: ${CRYPTO_OUTPUT}"
    info "This directory is gitignored. Do not commit its contents."
else
    error "Crypto generation or validation failed. Check output above."
fi

exit "${EXIT_CODE}"
