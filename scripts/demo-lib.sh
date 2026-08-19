#!/usr/bin/env bash
# Shared helpers for demo-up.sh and demo-teardown.sh
set -euo pipefail

DEMO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_STATE_FILE="${DEMO_ROOT}/.demo-state"

DEMO_INFRA="postgres mailpit"
DEMO_O11Y="otel-collector"
DEMO_APP="auth-service user-service account-service transaction-service credit-card-service loan-service document-service notification-service admin-service api-gateway frontend"
DEMO_WORKSHOP="workshop-site"
DEMO_DOCKER_ALL="${DEMO_INFRA} ${DEMO_O11Y} ${DEMO_APP} ${DEMO_WORKSHOP}"

DEMO_PORTS=(5173 8080 8090 8025 13133)

K8S_APP_DEPLOYMENTS=(
  auth-service
  user-service
  account-service
  notification-service
  document-service
  transaction-service
  credit-card-service
  loan-service
  admin-service
  api-gateway
  frontend
)

demo_cd_root() {
  cd "$DEMO_ROOT"
}

minikube_cluster_running() {
  command -v minikube &>/dev/null && minikube status &>/dev/null
}

banking_namespace_active() {
  command -v kubectl &>/dev/null \
    && kubectl get namespace banking &>/dev/null \
    && kubectl -n banking get pods --field-selector=status.phase=Running -o name 2>/dev/null | grep -q .
}

docker_compose_active() {
  demo_cd_root
  docker compose ps -q 2>/dev/null | grep -q .
}

port_in_use() {
  local port="$1"
  if command -v lsof &>/dev/null; then
    lsof -iTCP:"$port" -sTCP:LISTEN -P -n &>/dev/null
  else
    nc -z localhost "$port" 2>/dev/null
  fi
}

detect_runtime() {
  local forced="${1:-auto}"

  case "$forced" in
    minikube|docker)
      echo "$forced"
      return 0
      ;;
    auto)
      ;;
    *)
      echo "Invalid runtime: $forced (use minikube, docker, or auto)" >&2
      return 1
      ;;
  esac

  if banking_namespace_active; then
    echo "minikube"
    return 0
  fi

  if docker_compose_active; then
    echo "docker"
    return 0
  fi

  echo "minikube"
}

check_port_conflicts() {
  local runtime="$1"
  local in_use=()

  for port in "${DEMO_PORTS[@]}"; do
    if port_in_use "$port"; then
      in_use+=("$port")
    fi
  done

  if ((${#in_use[@]} == 0)); then
    return 0
  fi

  if [[ "$runtime" == "minikube" ]] && banking_namespace_active; then
    return 0
  fi

  if [[ "$runtime" == "docker" ]] && docker_compose_active; then
    return 0
  fi

  echo "ERROR: Ports already in use: ${in_use[*]}" >&2
  echo "       Stop the other runtime first (npm run demo:down or docker compose down)." >&2
  return 1
}

ensure_env_file() {
  demo_cd_root
  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  fi
}

check_splunk_env() {
  local required="${1:-false}"
  demo_cd_root

  if [[ ! -f .env.splunk ]]; then
    if [[ "$required" == "true" ]]; then
      echo "ERROR: Missing .env.splunk — copy from .env.splunk.example and add Splunk tokens." >&2
      return 1
    fi
    echo "WARNING: .env.splunk not found — Splunk export will not work until configured."
    return 0
  fi

  # shellcheck disable=SC1091
  source .env.splunk
  local token="${SPLUNK_ACCESS_TOKEN:-}"
  if [[ -z "$token" || "$token" == "your-ingest-token-here" || ${#token} -le 25 ]]; then
    if [[ "$required" == "true" ]]; then
      echo "ERROR: SPLUNK_ACCESS_TOKEN in .env.splunk looks like a placeholder." >&2
      return 1
    fi
    echo "WARNING: SPLUNK_ACCESS_TOKEN may be a placeholder — verify Splunk ingest will work."
  fi
}

write_demo_state() {
  local runtime="$1"
  local profile="$2"
  shift 2
  local components=("$@")

  {
    echo "RUNTIME=${runtime}"
    echo "PROFILE=${profile}"
    echo "COMPONENTS=$(IFS=,; echo "${components[*]}")"
    echo "UPDATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } >"$DEMO_STATE_FILE"
}

read_demo_state() {
  local key="$1"
  if [[ ! -f "$DEMO_STATE_FILE" ]]; then
    return 1
  fi
  local value
  value="$(grep "^${key}=" "$DEMO_STATE_FILE" | head -1 | cut -d= -f2-)"
  if [[ -z "$value" ]]; then
    return 1
  fi
  echo "$value"
}

clear_demo_state() {
  rm -f "$DEMO_STATE_FILE"
}

merge_demo_state_component() {
  local component="$1"
  local runtime="${2:-}"
  local existing=""

  if [[ -f "$DEMO_STATE_FILE" ]]; then
    existing="$(grep '^COMPONENTS=' "$DEMO_STATE_FILE" | cut -d= -f2- || true)"
    runtime="${runtime:-$(grep '^RUNTIME=' "$DEMO_STATE_FILE" | cut -d= -f2- || true)}"
  fi

  local components=()
  if [[ -n "$existing" ]]; then
    IFS=',' read -r -a components <<<"$existing"
  fi

  local found=false
  for c in "${components[@]}"; do
    if [[ "$c" == "$component" ]]; then
      found=true
      break
    fi
  done
  if [[ "$found" == "false" ]]; then
    components+=("$component")
  fi

  write_demo_state "${runtime:-minikube}" "$component" "${components[@]}"
}

remove_demo_state_component() {
  local component="$1"
  if [[ ! -f "$DEMO_STATE_FILE" ]]; then
    return 0
  fi

  local runtime profile existing
  runtime="$(grep '^RUNTIME=' "$DEMO_STATE_FILE" | cut -d= -f2-)"
  profile="$(grep '^PROFILE=' "$DEMO_STATE_FILE" | cut -d= -f2-)"
  existing="$(grep '^COMPONENTS=' "$DEMO_STATE_FILE" | cut -d= -f2- || true)"

  local kept=()
  IFS=',' read -r -a components <<<"$existing"
  for c in "${components[@]}"; do
    [[ -z "$c" || "$c" == "$component" ]] && continue
    kept+=("$c")
  done

  if ((${#kept[@]} == 0)); then
    clear_demo_state
  else
    write_demo_state "$runtime" "$profile" "${kept[@]}"
  fi
}

demo_wait_http() {
  local url="$1"
  local label="${2:-service}"
  local attempts="${3:-60}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "ERROR: Timed out waiting for ${label} at ${url}" >&2
  return 1
}

demo_print_urls() {
  local runtime="$1"
  local profile="$2"

  echo ""
  echo "============================================"
  echo " SecureBank demo (${profile} / ${runtime})"
  echo "============================================"
  echo "  App:       http://localhost:5173"
  echo "  API:       http://localhost:8080"
  echo "  Workshop:  http://localhost:8090"
  echo "  Mailpit:   http://localhost:8025"
  echo "  OTEL:      http://localhost:13133"
  echo ""
  echo "  Demo login: admin@bank.demo / Demo1234!"
  echo ""
  echo "  Tear down: npm run demo:down"
  echo "  Stop O11y: npm run demo:down:o11y"
  echo "============================================"
}

demo_print_workshop_only() {
  echo ""
  echo "Workshop site: http://localhost:8090"
  echo "Teardown:      npm run demo:down:workshop"
}

k8s_patch_otel_disabled() {
  local disabled="$1"
  kubectl -n banking patch configmap banking-config --type merge \
    -p "{\"data\":{\"OTEL_SDK_DISABLED\":\"${disabled}\"}}"
}

k8s_scale_collector() {
  local replicas="$1"
  kubectl -n banking scale deployment/otel-collector --replicas="$replicas"
}

k8s_restart_app_deployments() {
  for dep in "${K8S_APP_DEPLOYMENTS[@]}"; do
    if kubectl -n banking get deployment "$dep" &>/dev/null; then
      kubectl -n banking rollout restart "deployment/${dep}" || true
    fi
  done
}

k8s_wait_core_rollouts() {
  kubectl -n banking rollout status statefulset/postgres --timeout=600s || true
  for dep in "${K8S_APP_DEPLOYMENTS[@]}" api-gateway frontend workshop-site otel-collector; do
    if kubectl -n banking get deployment "$dep" &>/dev/null; then
      kubectl -n banking rollout status "deployment/${dep}" --timeout=600s || true
    fi
  done
}

k8s_ensure_minikube_started() {
  local memory="${MINIKUBE_MEMORY:-6144}"
  local cpus="${MINIKUBE_CPUS:-4}"
  local driver="${MINIKUBE_DRIVER:-docker}"

  if ! command -v minikube &>/dev/null; then
    echo "Minikube not found. Install: https://minikube.sigs.k8s.io/docs/start/" >&2
    return 1
  fi

  if minikube status &>/dev/null; then
    echo "Minikube already running"
  else
    minikube start --memory="$memory" --cpus="$cpus" --driver="$driver"
  fi
}

k8s_stop_compose_if_running() {
  if docker compose ps -q 2>/dev/null | grep -q .; then
    echo "==> Stopping Docker Compose (conflicts with Minikube ports)"
    docker compose down
  fi
}

docker_compose_up_services() {
  local otel_disabled="${1:-false}"
  shift
  local services=("$@")

  local env_args=(--env-file .env)
  if [[ -f .env.splunk ]]; then
    env_args+=(--env-file .env.splunk)
  fi

  OTEL_SDK_DISABLED="$otel_disabled" docker compose "${env_args[@]}" up --build -d "${services[@]}"
}

docker_compose_stop_services() {
  local services=("$@")
  if ((${#services[@]} == 0)); then
    docker compose down
  else
    docker compose stop "${services[@]}"
  fi
}

docker_set_otel_disabled() {
  local disabled="$1"
  local env_args=(--env-file .env)
  if [[ -f .env.splunk ]]; then
    env_args+=(--env-file .env.splunk)
  fi

  OTEL_SDK_DISABLED="$disabled" docker compose "${env_args[@]}" up -d ${DEMO_APP}
}

docker_restart_o11y_stack() {
  local env_args=(--env-file .env)
  if [[ ! -f .env.splunk ]]; then
    echo "ERROR: .env.splunk required for O11y export" >&2
    return 1
  fi
  env_args+=(--env-file .env.splunk)

  OTEL_SDK_DISABLED=false docker compose "${env_args[@]}" up -d "$DEMO_O11Y"
  OTEL_SDK_DISABLED=false docker compose "${env_args[@]}" up -d ${DEMO_APP}
}

should_seed_docker() {
  if ! demo_wait_http "http://localhost:8080/health" "api-gateway" 10; then
    return 0
  fi
  if curl -sf "http://localhost:8080/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@bank.demo","password":"Demo1234!"}' >/dev/null 2>&1; then
    return 1
  fi
  return 0
}
