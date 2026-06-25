#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${BPN_TOKEN:?Atur BPN_TOKEN}"

curl -sS -i "$API_BASE_URL/api/logs?page=1&limit=20" \
  -H "Authorization: Bearer $BPN_TOKEN"
printf '\n'

if [ -n "${LOG_ID:-}" ]; then
  curl -sS -i "$API_BASE_URL/api/logs/$LOG_ID" \
    -H "Authorization: Bearer $BPN_TOKEN"
  printf '\n'
fi
