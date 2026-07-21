#!/usr/bin/env bash
# Port-forward banking services to localhost (same URLs as Docker Compose).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${ROOT}/.minikube-port-forward.pids"

stop_forwards() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}

case "${1:-start}" in
  stop)
    stop_forwards
    echo "Port-forwards stopped"
    exit 0
    ;;
  start)
    stop_forwards
    ;;
  *)
    echo "Usage: $0 [start|stop]"
    exit 1
    ;;
esac

FORWARDS=(
  "frontend:5173:5173"
  "api-gateway:8080:8080"
  "workshop-site:8090:80"
  "mailpit:8025:8025"
  "otel-collector:13133:13133"
)

: > "$PID_FILE"

for spec in "${FORWARDS[@]}"; do
  IFS=':' read -r svc local remote <<< "$spec"
  kubectl -n banking port-forward "svc/${svc}" "${local}:${remote}" &>/dev/null &
  echo $! >> "$PID_FILE"
  echo "==> localhost:${local} -> ${svc}:${remote}"
done

sleep 1
echo ""
echo "Port-forwards running. Stop with: npm run minikube:port-forward -- stop"
