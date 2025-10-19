#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://staging.example.com}"
SOURCE="${SOURCE:-demo}"
TENANT="${TENANT:-t1}"
SECRET="${WEBHOOK_SECRET:-changeme}"

fail() { echo "[smoke] $1"; exit 1; }

hmac() {
  local raw="$1"
  echo -n "sha256=$(echo -n "$raw" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"
}

# 1. /healthz
curl -sf "$API_URL/healthz" || fail "/healthz failed"

# 2. /metrics
curl -sf "$API_URL/metrics" | grep -q "# HELP" || fail "/metrics failed"

# 3. /pos/:source/ingest
PAYLOAD="{\"sku\":\"SMOKE-TEST\",\"qty\":1,\"price\":999,\"ts\":\"$(date -Iseconds)\"}"
SIG=$(hmac "$PAYLOAD")

resp=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/pos/$SOURCE/ingest" \
  -H "content-type: application/json" \
  -H "x-tenant-id: $TENANT" \
  -H "x-signature: $SIG" \
  --data "$PAYLOAD")

if [[ "$resp" != "201" && "$resp" != "200" && "$resp" != "204" ]]; then
  fail "/pos/$SOURCE/ingest failed: $resp"
fi

echo "[smoke] All checks passed."
exit 0
