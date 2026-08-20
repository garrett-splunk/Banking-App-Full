#!/usr/bin/env bash
# Run API + browser RUM traffic (APM backend + linked RUM sessions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=demo-lib.sh
source "${ROOT}/scripts/demo-lib.sh"

MODE="${1:-all}"

demo_cd_root

case "$MODE" in
  all)
    demo_wait_http "http://localhost:8080/health" "api-gateway"
    echo "==> API traffic (APM backend)"
    npm run traffic
    echo ""
    demo_wait_http "${FRONTEND_URL:-http://localhost:5173}/login" "frontend"
    echo "==> Browser traffic (RUM + linked APM via Server-Timing)"
    npm run traffic:rum
    ;;
  api)
    demo_wait_http "http://localhost:8080/health" "api-gateway"
    npm run traffic
    ;;
  rum)
    demo_wait_http "${FRONTEND_URL:-http://localhost:5173}/login" "frontend"
    npm run traffic:rum
    ;;
  *)
    echo "Usage: $0 [all|api|rum]" >&2
    exit 1
    ;;
esac
