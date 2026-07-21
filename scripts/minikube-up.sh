#!/usr/bin/env bash
# Deploy SecureBank to local Minikube.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MEMORY="${MINIKUBE_MEMORY:-6144}"
CPUS="${MINIKUBE_CPUS:-4}"
DRIVER="${MINIKUBE_DRIVER:-docker}"

if ! command -v minikube &>/dev/null; then
  echo "Minikube not found. Install: https://minikube.sigs.k8s.io/docs/start/"
  exit 1
fi

if ! command -v kubectl &>/dev/null; then
  echo "kubectl not found. Install via: minikube kubectl -- get pods"
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if docker compose ps -q 2>/dev/null | grep -q .; then
  echo "==> Stopping Docker Compose (same ports as Minikube: 5173, 8080, 8090, 8025)"
  docker compose down
fi

echo "==> Starting Minikube (memory=${MEMORY}MB cpus=${CPUS})"
if minikube status &>/dev/null; then
  echo "Minikube already running"
else
  minikube start --memory="$MEMORY" --cpus="$CPUS" --driver="$DRIVER"
fi

echo "==> Building images"
bash scripts/k8s-build-images.sh

echo "==> Creating secrets from .env / .env.splunk"
bash scripts/k8s-create-secrets.sh

echo "==> Applying Kubernetes manifests"
kubectl apply -k k8s/overlays/minikube

echo "==> Waiting for PostgreSQL"
kubectl -n banking rollout status statefulset/postgres --timeout=600s

echo "==> Waiting for core services (this may take several minutes on first boot)"
for dep in auth-service user-service account-service notification-service document-service \
  transaction-service credit-card-service loan-service admin-service api-gateway frontend workshop-site; do
  kubectl -n banking rollout status "deployment/${dep}" --timeout=600s || true
done

echo "==> Seeding demo data"
bash scripts/minikube-seed.sh
bash scripts/minikube-port-forward.sh stop 2>/dev/null || true

echo "==> Starting port-forwards"
bash scripts/minikube-port-forward.sh start

echo ""
echo "============================================"
echo " SecureBank is running on Minikube"
echo "============================================"
echo "  App:       http://localhost:5173"
echo "  API:       http://localhost:8080"
echo "  Workshop:  http://localhost:8090"
echo "  Mailpit:   http://localhost:8025"
echo "  OTEL:      http://localhost:13133"
echo ""
echo "  Demo login: admin@bank.demo / Demo1234!"
echo "  (Admin has full banking + admin panel — filter Splunk APM env: banking-app)"
echo ""
echo "  kubectl -n banking get pods"
echo "  npm run minikube:down     # tear down"
echo "============================================"

open http://localhost:8090 2>/dev/null || true
