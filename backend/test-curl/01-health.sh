#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"

curl -sS -i "$API_BASE_URL/api/health"
printf '\n'
curl -sS -i "$API_BASE_URL/api/health/supabase"
printf '\n'
