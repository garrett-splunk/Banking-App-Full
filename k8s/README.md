# Minikube (local Kubernetes)

Run the full SecureBank stack on **Minikube** with the same localhost URLs as Docker Compose.

## Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) (Docker driver recommended)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- **6 GB RAM / 4 CPUs** minimum (`6144` — default in `minikube-up.sh`)
- Docker Desktop must allocate **more RAM than Minikube requests** (Settings → Resources). If you see `MK_USAGE`, lower `MINIKUBE_MEMORY` or increase Docker Desktop memory:

```bash
# Fits Docker Desktop with ~8GB allocated
MINIKUBE_MEMORY=6144 npm run minikube:up

# If you raised Docker Desktop to 12GB+
MINIKUBE_MEMORY=8192 npm run minikube:up
```

Stop Docker Compose first to avoid port conflicts on 5173, 8080, 8090, 8025:

```bash
docker compose down
```

## Quick start

```bash
cd ~/projects/banking-platform
cp .env.example .env
cp .env.splunk.example .env.splunk   # optional — Splunk ingest token

npm run minikube:up
```

This will:

1. Start Minikube (if not running)
2. Build all service images into Minikube's Docker daemon
3. Create Kubernetes secrets from `.env` and `.env.splunk`
4. Deploy Postgres, Mailpit, OTEL collector, 10 microservices, frontend, and workshop site
5. Seed demo data
6. Port-forward to localhost

## URLs (same as Docker Compose)

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| API | http://localhost:8080 |
| Workshop | http://localhost:8090 |
| Mailpit | http://localhost:8025 |
| OTEL collector | http://localhost:13133 |

**Demo login:** `admin@bank.demo` / `Demo1234!`

APM environment in Minikube is tagged **`banking-app`** (`DEPLOYMENT_ENVIRONMENT` in the overlay).

## Commands

```bash
npm run minikube:up              # Full deploy + port-forwards
npm run minikube:down            # Delete banking namespace
npm run minikube:build           # Rebuild images only
npm run minikube:port-forward    # Restart port-forwards
npm run minikube:port-forward -- stop

kubectl -n banking get pods      # Pod status
kubectl -n banking logs -f deployment/account-service
```

## Secrets

Secrets are loaded from gitignored files (never committed):

| File | Keys |
|------|------|
| `.env` | `JWT_*`, `INTERNAL_SERVICE_SECRET`, `POSTGRES_PASSWORD` |
| `.env.splunk` | `SPLUNK_ACCESS_TOKEN`, realm, ingest URLs, `SPLUNK_LOG_INGEST_URL` |

Regenerate after editing:

```bash
bash scripts/k8s-create-secrets.sh
kubectl -n banking rollout restart deployment/otel-collector
```

## Layout

```
k8s/
├── base/                 # Shared manifests
│   ├── postgres.yaml     # StatefulSet + init DBs
│   ├── infra.yaml        # Mailpit + OTEL collector
│   ├── app-services.yaml # All microservices + frontend + workshop
│   └── configmap.yaml
└── overlays/minikube/    # Minikube-specific env (deployment.environment=banking-app)
```

## Teardown

When the lab is finished:

```bash
# 1. Disable any active feature flags (optional)
npm run flags -- disable fail_transaction_insert

# 2. Stop port-forwards if running
npm run minikube:port-forward -- stop

# 3. Remove the banking stack
npm run minikube:down
```

To stop Minikube entirely:

```bash
minikube stop    # pause cluster
minikube delete  # remove cluster and all local images/volumes
```

If you also use Docker Compose, stop it before starting Minikube (and vice versa):

```bash
docker compose down        # stop containers
docker compose down -v   # stop + wipe database volumes
```

## Troubleshooting

**Pods stuck in ImagePullBackOff** — Images must be built inside Minikube:

```bash
eval $(minikube docker-env)
npm run minikube:build
kubectl -n banking rollout restart deployment --all
```

**Port already in use** — Stop Docker Compose or other port-forwards:

```bash
docker compose down
npm run minikube:port-forward -- stop
```

**Out of memory** — Increase Minikube resources:

```bash
minikube stop
minikube start --memory=10240 --cpus=4
```

**Re-seed data** (includes admin full banking demo):

```bash
npm run minikube:seed
npm run minikube:port-forward
```

**No logs in Log Observer** — Log Observer does not use a Splunk Platform index. Check collector export:

```bash
kubectl -n banking logs deploy/otel-collector --since=5m | grep -iE 'LogsExporter|splunk_hec|404'
```

- `LogsExporter` with log records = apps → collector OK
- `HTTP 404` on `splunk_hec/o11y` = ingest token, Log Observer entitlement, or wrong `SPLUNK_LOG_INGEST_URL`
- Use ingest token (not API-only); reapply: `bash scripts/k8s-create-secrets.sh`
- Search O11y Logs: `deployment.environment:banking-app service.name:api-gateway`
