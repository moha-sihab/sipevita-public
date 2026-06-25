#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
: "${TEST_USERNAME:?Atur TEST_USERNAME ke ppat_demo atau atr_bpn_demo}"
: "${TEST_PASSWORD:?Atur TEST_PASSWORD ke password test lokal}"

curl -sS -i -X POST "$API_BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}"
printf '\n'

if [ -n "${TEST_TOKEN:-}" ]; then
  curl -sS -i "$API_BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $TEST_TOKEN"
  printf '\n'
else
  printf '%s\n' "Atur TEST_TOKEN untuk menguji /api/auth/me."
fi
