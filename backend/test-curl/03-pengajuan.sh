#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${PPAT_TOKEN:?Atur PPAT_TOKEN}"

curl -sS -i "$API_BASE_URL/api/pengajuan" \
  -H "Authorization: Bearer $PPAT_TOKEN"
printf '\n'

if [ -n "${PENGAJUAN_ID:-}" ]; then
  curl -sS -i "$API_BASE_URL/api/pengajuan/$PENGAJUAN_ID" \
    -H "Authorization: Bearer $PPAT_TOKEN"
  printf '\n'
else
  printf '%s\n' "Atur PENGAJUAN_ID untuk menguji detail. Permintaan pembuatan tetap dilakukan manual."
fi
