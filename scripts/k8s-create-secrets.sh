#!/usr/bin/env bash
# Create Kubernetes secrets from .env and .env.splunk (gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
SPLUNK_ENV_FILE="${SPLUNK_ENV_FILE:-.env.splunk}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.example"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

SPLUNK_REALM="${SPLUNK_REALM:-us1}"
SPLUNK_ACCESS_TOKEN="${SPLUNK_ACCESS_TOKEN:-not-configured}"
SPLUNK_INGEST_URL="${SPLUNK_INGEST_URL:-https://ingest.us1.signalfx.com}"
SPLUNK_API_URL="${SPLUNK_API_URL:-https://api.us1.signalfx.com}"

if [[ -f "$SPLUNK_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SPLUNK_ENV_FILE"
fi

SPLUNK_INGEST_URL="${SPLUNK_INGEST_URL%/}"
SPLUNK_LOG_INGEST_URL="${SPLUNK_LOG_INGEST_URL:-${SPLUNK_INGEST_URL}/v1/log}"
SPLUNK_OPAMP_URL="${SPLUNK_OPAMP_URL:-${SPLUNK_INGEST_URL}/v1/opamp}"
SPLUNK_RUM_ACCESS_TOKEN="${SPLUNK_RUM_ACCESS_TOKEN:-}"

if [[ ${#SPLUNK_ACCESS_TOKEN} -le 25 ]]; then
  echo "WARNING: SPLUNK_ACCESS_TOKEN is only ${#SPLUNK_ACCESS_TOKEN} characters."
  echo "         It may still be the example placeholder. Use a real ingest token from"
  echo "         Splunk O11y → Organization Settings → Access Tokens (ingest scope)."
fi

kubectl create namespace banking --dry-run=client -o yaml | kubectl apply -f -

kubectl -n banking create secret generic banking-secrets \
  --from-literal=JWT_SECRET="${JWT_SECRET:-change_me_jwt_secret_min_32_chars_long}" \
  --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-change_me_refresh_secret_min_32_chars}" \
  --from-literal=INTERNAL_SERVICE_SECRET="${INTERNAL_SERVICE_SECRET:-change_me_internal_service_secret}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-bank_dev_password_change_me}" \
  --from-literal=SPLUNK_REALM="${SPLUNK_REALM}" \
  --from-literal=SPLUNK_ACCESS_TOKEN="${SPLUNK_ACCESS_TOKEN}" \
  --from-literal=SPLUNK_INGEST_URL="${SPLUNK_INGEST_URL}" \
  --from-literal=SPLUNK_LOG_INGEST_URL="${SPLUNK_LOG_INGEST_URL}" \
  --from-literal=SPLUNK_OPAMP_URL="${SPLUNK_OPAMP_URL}" \
  --from-literal=SPLUNK_API_URL="${SPLUNK_API_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n banking patch configmap banking-config --type merge -p "{
  \"data\": {
    \"VITE_SPLUNK_REALM\": \"${SPLUNK_REALM}\",
    \"VITE_SPLUNK_RUM_ACCESS_TOKEN\": \"${SPLUNK_RUM_ACCESS_TOKEN}\"
  }
}" 2>/dev/null || echo "==> banking-config not found yet — run after kubectl apply -k"

echo "==> Secret banking-secrets applied in namespace banking"
echo "==> ConfigMap banking-config patched with RUM token (VITE_SPLUNK_RUM_ACCESS_TOKEN)"
echo "==> Log Observer endpoint: ${SPLUNK_LOG_INGEST_URL}"
echo "==> Fleet Management (OpAMP): ${SPLUNK_OPAMP_URL}"
if [[ -z "${SPLUNK_RUM_ACCESS_TOKEN}" ]]; then
  echo "WARNING: SPLUNK_RUM_ACCESS_TOKEN is empty — browser RUM will be disabled until set in .env.splunk"
fi
