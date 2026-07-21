#!/usr/bin/env bash
# Remove banking platform from Minikube (keeps Minikube cluster running).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/minikube-port-forward.sh stop 2>/dev/null || true

echo "==> Deleting banking namespace"
kubectl delete namespace banking --ignore-not-found --timeout=120s

echo "==> Minikube banking stack removed"
echo "    To stop Minikube entirely: minikube stop"
echo "    To delete cluster:         minikube delete"
