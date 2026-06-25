#!/usr/bin/env bash
# network-down.sh — Stop and remove only the SIPEVITA Raft network resources.
# Phase dependency: Any phase after network-up. Safe to run at any time.
# NEVER modifies test-network resources.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_DIR="${PROJECT_ROOT}/compose"
LOG_DIR="${PROJECT_ROOT}/logs"

DRY_RUN=false
REMOVE_VOLUMES=false
REMOVE_ARTIFACTS=false
AUTO_YES=false
DOCKER_NETWORK="sipevita_raft"

NAMED_VOLUMES=(
    "peer0_org1_data"
    "peer0_org2_data"
    "peer0_org3_data"
    "peer0_org4_data"
    "orderer1_data"
    "orderer2_data"
    "orderer3_data"
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
info()    { echo "[INFO]  $*"; }
warn()    { echo "[WARN]  $*" >&2; }
error()   { echo "[ERROR] $*" >&2; }
success() { echo "[PASS]  $*"; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Stop and remove SIPEVITA Raft network resources. Never touches test-network.

Options:
  --dry-run           Show what would be done without removing anything.
  --remove-volumes    Also remove named ledger and orderer data volumes.
  --remove-artifacts  Also remove generated channel artifacts and crypto material.
  --yes               Skip confirmation prompts (use with caution in CI).
  --help              Show this help message.

Volumes managed (only with --remove-volumes):
$(printf '  %s\n' "${NAMED_VOLUMES[@]}")

FORBIDDEN: docker system prune, docker volume prune, docker network prune.
This script only removes explicitly named project resources.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --help)             usage ;;
        --dry-run)          DRY_RUN=true ;;
        --remove-volumes)   REMOVE_VOLUMES=true ;;
        --remove-artifacts) REMOVE_ARTIFACTS=true ;;
        --yes)              AUTO_YES=true ;;
        *)                  error "Unknown argument: $arg"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------
if [[ "${PROJECT_ROOT}" == *"test-network"* ]]; then
    error "PROJECT_ROOT resolves inside test-network. Refusing to continue."
    exit 1
fi

info "SIPEVITA Raft Network — network-down"
info "Project root: ${PROJECT_ROOT}"
[ "$DRY_RUN" = true ] && info "(dry-run mode — no resources will be removed)"

# ---------------------------------------------------------------------------
# Confirmation for destructive flags
# ---------------------------------------------------------------------------
if { [ "$REMOVE_VOLUMES" = true ] || [ "$REMOVE_ARTIFACTS" = true ]; } && [ "$AUTO_YES" = false ] && [ "$DRY_RUN" = false ]; then
    warn "Destructive options are enabled:"
    [ "$REMOVE_VOLUMES"   = true ] && warn "  --remove-volumes will delete ledger and orderer data"
    [ "$REMOVE_ARTIFACTS" = true ] && warn "  --remove-artifacts will delete channel-artifacts and organizations/"
    echo -n "Are you sure? [y/N] "
    read -r CONFIRM
    if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then
        info "Aborted."
        exit 0
    fi
fi

# ---------------------------------------------------------------------------
# Locate compose file
# ---------------------------------------------------------------------------
COMPOSE_FILES=(
    "${COMPOSE_DIR}/compose-raft.yaml"
)
COMPOSE_ARGS=()
for CF in "${COMPOSE_FILES[@]}"; do
    [ -f "$CF" ] && COMPOSE_ARGS+=("-f" "$CF")
done

# ---------------------------------------------------------------------------
# Stop containers
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = false ]; then
    if [ ${#COMPOSE_ARGS[@]} -gt 0 ]; then
        info "Stopping Docker Compose services..."
        docker compose "${COMPOSE_ARGS[@]}" down --remove-orphans 2>/dev/null || true
        success "Compose services stopped"
    else
        info "No compose files found. Attempting direct container stop by name..."
        CONTAINERS=(
            "peer0.org1.sipevita.example.com"
            "peer0.org2.sipevita.example.com"
            "peer0.org3.sipevita.example.com"
            "peer0.org4.sipevita.example.com"
            "orderer1.sipevita.example.com"
            "orderer2.sipevita.example.com"
            "orderer3.sipevita.example.com"
        )
        for C in "${CONTAINERS[@]}"; do
            if docker ps -q --filter "name=${C}" 2>/dev/null | grep -q .; then
                docker stop "${C}" 2>/dev/null && docker rm "${C}" 2>/dev/null || true
                info "Stopped: ${C}"
            fi
        done
    fi

    # Remove Docker network
    if docker network inspect "${DOCKER_NETWORK}" &>/dev/null 2>&1; then
        docker network rm "${DOCKER_NETWORK}" 2>/dev/null || true
        success "Removed Docker network: ${DOCKER_NETWORK}"
    else
        info "Docker network not found (already removed): ${DOCKER_NETWORK}"
    fi
else
    info "[dry-run] Would stop containers and remove network: ${DOCKER_NETWORK}"
    if [ ${#COMPOSE_ARGS[@]} -gt 0 ]; then
        info "[dry-run] Compose args: ${COMPOSE_ARGS[*]}"
    fi
fi

# ---------------------------------------------------------------------------
# Remove named volumes (explicit, scoped)
# ---------------------------------------------------------------------------
if [ "$REMOVE_VOLUMES" = true ]; then
    if [ "$DRY_RUN" = false ]; then
        for VOL in "${NAMED_VOLUMES[@]}"; do
            if docker volume inspect "${VOL}" &>/dev/null 2>&1; then
                docker volume rm "${VOL}" 2>/dev/null && success "Removed volume: ${VOL}" || warn "Could not remove volume: ${VOL}"
            else
                info "Volume not found (already removed): ${VOL}"
            fi
        done
    else
        info "[dry-run] Would remove volumes: ${NAMED_VOLUMES[*]}"
    fi
else
    info "Ledger volumes preserved (pass --remove-volumes to delete)"
fi

# ---------------------------------------------------------------------------
# Remove generated artifacts (optional)
# ---------------------------------------------------------------------------
if [ "$REMOVE_ARTIFACTS" = true ]; then
    ARTIFACTS_TO_REMOVE=(
        "${PROJECT_ROOT}/channel-artifacts"
        "${PROJECT_ROOT}/organizations/peerOrganizations"
        "${PROJECT_ROOT}/organizations/ordererOrganizations"
    )
    if [ "$DRY_RUN" = false ]; then
        for ARTIFACT in "${ARTIFACTS_TO_REMOVE[@]}"; do
            if [ -e "$ARTIFACT" ]; then
                rm -rf "${ARTIFACT}"
                success "Removed artifact directory: $(basename "${ARTIFACT}")"
            else
                info "Artifact not found (already clean): ${ARTIFACT}"
            fi
        done
    else
        info "[dry-run] Would remove artifact directories:"
        for A in "${ARTIFACTS_TO_REMOVE[@]}"; do
            info "  $A"
        done
    fi
else
    info "Artifacts preserved (pass --remove-artifacts to delete)"
fi

# ---------------------------------------------------------------------------
# Wallet is always preserved
# ---------------------------------------------------------------------------
info "Wallet preserved: ${PROJECT_ROOT}/wallet-raft/"
info "Logs preserved:   ${LOG_DIR}/"

# ---------------------------------------------------------------------------
# Final guard: never prune broadly
# ---------------------------------------------------------------------------
# Explicitly forbidden:
#   docker system prune
#   docker volume prune
#   docker network prune
# These are never called by this script.

info "---"
success "SIPEVITA Raft network resources removed."
info "test-network resources were NOT touched."
