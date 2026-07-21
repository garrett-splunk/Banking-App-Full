#!/usr/bin/env bash
# Build all banking-platform images into the Minikube Docker daemon.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! minikube status &>/dev/null; then
  echo "Minikube is not running. Start it first: npm run minikube:up"
  echo "  (default 6144MB — set MINIKUBE_MEMORY if Docker Desktop has more RAM)"
  exit 1
fi

echo "==> Using Minikube Docker daemon"
eval "$(minikube docker-env)"

TAG="${IMAGE_TAG:-local}"
SERVICES=(
  auth-service
  user-service
  account-service
  transaction-service
  credit-card-service
  loan-service
  document-service
  notification-service
  admin-service
  api-gateway
)

for svc in "${SERVICES[@]}"; do
  echo "==> Building banking/${svc}:${TAG}"
  docker build -f "services/${svc}/Dockerfile" -t "banking/${svc}:${TAG}" .
done

echo "==> Building banking/frontend:${TAG}"
docker build -f frontend/Dockerfile -t "banking/frontend:${TAG}" .

echo "==> Building banking/workshop-site:${TAG}"
docker build -f workshop-site/Dockerfile -t "banking/workshop-site:${TAG}" workshop-site

echo "==> All images built in Minikube"
docker images | grep '^banking/' || true
