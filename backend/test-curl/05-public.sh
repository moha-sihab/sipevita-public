#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${NOMOR_SERTIFIKAT_ENCODED:?Atur NOMOR_SERTIFIKAT_ENCODED yang sudah dikodekan untuk URL}"

curl -sS -i "$API_BASE_URL/api/public/verify?nomor_sertifikat=$NOMOR_SERTIFIKAT_ENCODED"
printf '\n'
curl -sS -i "$API_BASE_URL/api/public/history?nomor_sertifikat=$NOMOR_SERTIFIKAT_ENCODED"
printf '\n'
