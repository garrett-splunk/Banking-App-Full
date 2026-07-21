#!/usr/bin/env bash
# Seed demo data into Minikube Postgres (admin full banking + Alice + Bob).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! kubectl -n banking get svc postgres &>/dev/null; then
  echo "Postgres service not found. Run: npm run minikube:up"
  exit 1
fi

echo "==> Port-forwarding Postgres on localhost:5432"
bash scripts/minikube-port-forward.sh stop 2>/dev/null || true
kubectl -n banking port-forward svc/postgres 5432:5432 &>/dev/null &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null || true' EXIT

sleep 2
echo "==> Seeding demo data"
npm run seed
echo "==> Done. Restart port-forwards: npm run minikube:port-forward"
