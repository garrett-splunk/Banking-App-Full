#!/usr/bin/env bash
# Tear down SecureBank demo — full stack or specific components.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=demo-lib.sh
source "${ROOT}/scripts/demo-lib.sh"

PROFILE=""
RUNTIME="auto"
STOP_MINIKUBE=false
REMOVE_VOLUMES=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [profile] [options]

Profiles:
  full       Stop everything (default if no .demo-state)
  app        Remove banking app stack
  o11y       Stop Splunk export, keep app running
  workshop   Stop workshop site only
  traffic    No-op (traffic generator is one-shot)

Options:
  --runtime minikube|docker|auto   Default: auto
  --stop-minikube                  Stop Minikube VM after full teardown
  --volumes                        Docker: compose down -v (delete DB volumes)
  -h, --help                       Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    full|app|o11y|workshop|traffic)
      PROFILE="$1"
      shift
      ;;
    --runtime)
      RUNTIME="$2"
      shift 2
      ;;
    --stop-minikube)
      STOP_MINIKUBE=true
      shift
      ;;
    --volumes)
      REMOVE_VOLUMES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

demo_cd_root

if [[ -z "$PROFILE" ]]; then
  PROFILE="$(read_demo_state PROFILE 2>/dev/null || true)"
  PROFILE="${PROFILE:-full}"
fi

if [[ "$PROFILE" == "traffic" ]]; then
  echo "Traffic generator is one-shot — nothing to tear down."
  exit 0
fi

RUNTIME="$(detect_runtime "$RUNTIME")"

down_minikube_full() {
  bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
  bash scripts/minikube-down.sh
  clear_demo_state
  if [[ "$STOP_MINIKUBE" == "true" ]]; then
    minikube stop
    echo "==> Minikube cluster stopped"
  fi
}

down_minikube_app() {
  bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
  bash scripts/minikube-down.sh
  clear_demo_state
}

down_minikube_o11y() {
  if ! banking_namespace_active; then
    echo "Banking namespace not running — nothing to disable."
    remove_demo_state_component o11y
    exit 0
  fi
  k8s_patch_otel_disabled true
  k8s_scale_collector 0
  k8s_restart_app_deployments
  remove_demo_state_component o11y
  echo "==> Splunk O11y export disabled (app still running)"
}

down_minikube_workshop() {
  bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
  if banking_namespace_active && kubectl -n banking get deployment workshop-site &>/dev/null; then
    kubectl -n banking scale deployment/workshop-site --replicas=0 || true
    bash scripts/minikube-port-forward.sh start 2>/dev/null || true
  fi
  docker compose stop workshop-site 2>/dev/null || true
  remove_demo_state_component workshop
  echo "==> Workshop site stopped"
}

down_docker_full() {
  if [[ "$REMOVE_VOLUMES" == "true" ]]; then
    docker compose down -v
  else
    docker compose down
  fi
  clear_demo_state
}

down_docker_app() {
  docker compose stop ${DEMO_DOCKER_ALL}
  docker compose rm -f ${DEMO_DOCKER_ALL} 2>/dev/null || true
  clear_demo_state
}

down_docker_o11y() {
  docker compose stop otel-collector 2>/dev/null || true
  docker_set_otel_disabled true
  remove_demo_state_component o11y
  echo "==> Splunk O11y export disabled (app still running)"
}

down_docker_workshop() {
  docker compose stop workshop-site 2>/dev/null || true
  remove_demo_state_component workshop
  echo "==> Workshop site stopped"
}

case "$PROFILE" in
  full)
    if [[ "$RUNTIME" == "minikube" ]]; then
      down_minikube_full
    else
      down_docker_full
    fi
    ;;
  app)
    if [[ "$RUNTIME" == "minikube" ]]; then
      down_minikube_app
    else
      down_docker_app
    fi
    ;;
  o11y)
    if [[ "$RUNTIME" == "minikube" ]]; then
      down_minikube_o11y
    else
      down_docker_o11y
    fi
    ;;
  workshop)
    if [[ "$RUNTIME" == "minikube" ]]; then
      down_minikube_workshop
    else
      down_docker_workshop
    fi
    ;;
  *)
    echo "Unknown profile: $PROFILE" >&2
    exit 1
    ;;
esac

echo ""
echo "Teardown complete (${PROFILE} / ${RUNTIME})."
