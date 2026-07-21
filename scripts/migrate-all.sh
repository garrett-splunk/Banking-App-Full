#!/usr/bin/env bash
set -euo pipefail

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
)

for svc in "${SERVICES[@]}"; do
  echo "Migrating $svc..."
  npm run prisma:migrate -w "@banking/$svc" -- --name init || npm run prisma:push -w "@banking/$svc"
done

echo "All migrations complete."
