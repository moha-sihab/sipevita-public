#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${BPN_TOKEN:?Atur BPN_TOKEN}"
: "${NOMOR_SERTIFIKAT_ENCODED:?Atur NOMOR_SERTIFIKAT_ENCODED yang sudah dikodekan untuk URL}"

curl -sS -i "$API_BASE_URL/api/blockchain/verify/$NOMOR_SERTIFIKAT_ENCODED" \
  -H "Authorization: Bearer $BPN_TOKEN"
printf '\n'
curl -sS -i "$API_BASE_URL/api/blockchain/history/$NOMOR_SERTIFIKAT_ENCODED" \
  -H "Authorization: Bearer $BPN_TOKEN"
printf '\n'
