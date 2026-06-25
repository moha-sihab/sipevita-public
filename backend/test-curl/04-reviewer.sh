#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${BPN_TOKEN:?Atur BPN_TOKEN}"

curl -sS -i "$API_BASE_URL/api/reviewer/pengajuan?status=MENUNGGU_VERIFIKASI" \
  -H "Authorization: Bearer $BPN_TOKEN"
printf '\n'

if [ -n "${PENGAJUAN_ID:-}" ]; then
  curl -sS -i "$API_BASE_URL/api/reviewer/pengajuan/$PENGAJUAN_ID" \
    -H "Authorization: Bearer $BPN_TOKEN"
  printf '\n'
fi

printf '%s\n' "Persetujuan/penolakan tetap dilakukan manual untuk mencegah perubahan data yang tidak disengaja."
