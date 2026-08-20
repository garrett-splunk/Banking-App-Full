#!/usr/bin/env bash
# Start SecureBank demo — full stack or specific components.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=demo-lib.sh
source "${ROOT}/scripts/demo-lib.sh"

PROFILE="full"
RUNTIME="auto"
RUN_TRAFFIC=false
NO_OPEN=false
FORCE_SEED=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [profile] [options]

Profiles:
  full      App + OTel + workshop + seed + port-forwards (default)
  app       Banking stack without Splunk export
  o11y      Enable Splunk O11y pipeline (starts app if needed)
  workshop  Static workshop site on :8090 only
  traffic       Generate API + RUM traffic (APM + linked browser sessions)
  traffic-api   API-only traffic (APM backend)
  traffic-rum   Browser-only traffic (RUM + linked APM)

Options:
  --runtime minikube|docker|auto   Default: auto
  --traffic                        Run API + RUM traffic after full startup
  --no-open                        Do not open workshop URL in browser
  --seed                           Force re-seed demo data
  -h, --help                       Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    full|app|o11y|workshop|traffic|traffic-api|traffic-rum)
      PROFILE="$1"
      shift
      ;;
    --runtime)
      RUNTIME="$2"
      shift 2
      ;;
    --traffic)
      RUN_TRAFFIC=true
      shift
      ;;
    --no-open)
      NO_OPEN=true
      shift
      ;;
    --seed)
      FORCE_SEED=true
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
ensure_env_file

if [[ "$PROFILE" != "traffic" && "$PROFILE" != "traffic-api" && "$PROFILE" != "traffic-rum" && "$PROFILE" != "workshop" ]]; then
  RUNTIME="$(detect_runtime "$RUNTIME")"
  check_port_conflicts "$RUNTIME"
fi

run_traffic_if_requested() {
  case "$PROFILE" in
    traffic-api)
      bash scripts/run-demo-traffic.sh api
      ;;
    traffic-rum)
      bash scripts/run-demo-traffic.sh rum
      ;;
    traffic)
      bash scripts/run-demo-traffic.sh all
      ;;
  esac
  if [[ "$RUN_TRAFFIC" == "true" && "$PROFILE" == "full" ]]; then
    bash scripts/run-demo-traffic.sh all
  fi
}

up_minikube_full() {
  check_splunk_env false
  k8s_stop_compose_if_running
  bash scripts/minikube-up.sh
  write_demo_state minikube full full app o11y workshop
}

up_minikube_app() {
  k8s_stop_compose_if_running
  k8s_ensure_minikube_started
  bash scripts/k8s-build-images.sh
  bash scripts/k8s-create-secrets.sh
  kubectl apply -k k8s/overlays/minikube
  k8s_wait_core_rollouts
  k8s_patch_otel_disabled true
  k8s_scale_collector 0
  bash scripts/minikube-seed.sh
  bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
  bash scripts/minikube-port-forward.sh start
  write_demo_state minikube app app workshop
}

up_minikube_o11y() {
  if ! banking_namespace_active; then
    echo "==> Banking stack not running — starting app profile first"
    up_minikube_app
  fi
  check_splunk_env true
  bash scripts/k8s-create-secrets.sh
  k8s_patch_otel_disabled false
  k8s_scale_collector 1
  kubectl -n banking rollout restart deployment/otel-collector
  k8s_restart_app_deployments
  kubectl -n banking rollout status deployment/otel-collector --timeout=300s || true
  bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
  bash scripts/minikube-port-forward.sh start
  merge_demo_state_component o11y minikube
}

up_minikube_workshop() {
  if banking_namespace_active && kubectl -n banking get deployment workshop-site &>/dev/null; then
    bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
    bash scripts/minikube-port-forward.sh start
    merge_demo_state_component workshop minikube
    demo_print_workshop_only
    return 0
  fi

  echo "==> Starting workshop site via Docker Compose"
  docker compose up -d workshop-site
  write_demo_state docker workshop workshop
  demo_print_workshop_only
}

up_docker_full() {
  check_splunk_env false
  if minikube_cluster_running && banking_namespace_active; then
    echo "ERROR: Minikube banking stack is running. Run npm run demo:down first." >&2
    exit 1
  fi
  docker_compose_up_services false ${DEMO_DOCKER_ALL}
  if [[ "$FORCE_SEED" == "true" ]] || should_seed_docker; then
    npm run seed
  fi
  write_demo_state docker full full app o11y workshop
}

up_docker_app() {
  if minikube_cluster_running && banking_namespace_active; then
    echo "ERROR: Minikube banking stack is running. Run npm run demo:down first." >&2
    exit 1
  fi
  docker_compose_up_services true ${DEMO_INFRA} ${DEMO_O11Y} ${DEMO_APP} ${DEMO_WORKSHOP}
  if [[ "$FORCE_SEED" == "true" ]] || should_seed_docker; then
    npm run seed
  fi
  write_demo_state docker app app workshop
}

up_docker_o11y() {
  check_splunk_env true
  if ! docker_compose_active && ! port_in_use 8080; then
    echo "==> Banking stack not running — starting app profile first"
    up_docker_app
  fi
  docker_restart_o11y_stack
  merge_demo_state_component o11y docker
}

up_docker_workshop() {
  docker compose up -d workshop-site
  merge_demo_state_component workshop docker
  demo_print_workshop_only
}

case "$PROFILE" in
  full)
    if [[ "$RUNTIME" == "minikube" ]]; then
      up_minikube_full
    else
      up_docker_full
    fi
    demo_print_urls "$RUNTIME" "$PROFILE"
    run_traffic_if_requested
    ;;
  app)
    if [[ "$RUNTIME" == "minikube" ]]; then
      up_minikube_app
    else
      up_docker_app
    fi
    demo_print_urls "$RUNTIME" "$PROFILE"
    ;;
  o11y)
    if [[ "$RUNTIME" == "minikube" ]]; then
      up_minikube_o11y
    else
      up_docker_o11y
    fi
    demo_print_urls "$RUNTIME" "$PROFILE"
    demo_wait_http "http://localhost:13133/" "otel-collector" 30 || true
    ;;
  workshop)
    RUNTIME="$(detect_runtime "$RUNTIME")"
    if [[ "$RUNTIME" == "minikube" ]]; then
      up_minikube_workshop
    else
      up_docker_workshop
    fi
    if [[ "$NO_OPEN" == "false" ]]; then
      open http://localhost:8090 2>/dev/null || true
    fi
    exit 0
    ;;
  traffic|traffic-api|traffic-rum)
    run_traffic_if_requested
    exit 0
    ;;
esac

if [[ "$NO_OPEN" == "false" && "$PROFILE" != "traffic" && "$PROFILE" != "traffic-api" && "$PROFILE" != "traffic-rum" ]]; then
  open http://localhost:8090 2>/dev/null || true
fi
