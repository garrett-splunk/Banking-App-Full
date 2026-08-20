# SecureBank — Banking Platform

A full-demo banking platform built with React, 10 Node.js microservices, and PostgreSQL.

## Architecture

```
React SPA → API Gateway → Microservices → PostgreSQL (database-per-service)
```

### Microservices

| Service | Port | Database | Purpose |
|---------|------|----------|---------|
| api-gateway | 8080 | — | JWT auth, routing, CORS |
| auth-service | 3001 | auth_db | Register, login, MFA (TOTP), JWT |
| user-service | 3002 | user_db | User profiles, KYC data |
| account-service | 3003 | account_db | Checking/savings accounts |
| transaction-service | 3004 | transaction_db | Transfers, bill pay, scheduled transfers |
| credit-card-service | 3005 | creditcard_db | CC applications & cards |
| loan-service | 3006 | loan_db | Loan applications & loans |
| document-service | 3007 | document_db | KYC document upload |
| notification-service | 3008 | notification_db | Email + in-app notifications |
| admin-service | 3009 | admin_db | Admin approvals, audit log |

### Supporting Infrastructure

- **PostgreSQL 16** — 9 databases (one per data service)
- **Mailpit** — Email capture UI at http://localhost:8025
- **OpenTelemetry Collector** — Receives traces/metrics/logs on ports 4317/4318; forwards to Splunk Observability Cloud
- **Workshop Site** — Step-by-step lab guide at https://garrett-splunk.github.io/Banking-App-Full/ (or http://localhost:8090 when running locally)

## Quick Start

```bash
cd ~/projects/banking-platform
cp .env.example .env
# Optional: configure Splunk export (see Observability section)
cp .env.splunk.example .env.splunk
docker compose up --build
```

Once all services are healthy:

```bash
npm install
npm run seed
```

Open the app:

- **Frontend:** http://localhost:5173
- **API Gateway:** http://localhost:8080
- **Workshop (step-by-step lab):** https://garrett-splunk.github.io/Banking-App-Full/ — O11y APM/RUM/logs demo + optional ITSI module ([workshop-site/WORKSHOP_GUIDE.md](workshop-site/WORKSHOP_GUIDE.md) for facilitators; http://localhost:8090 when running locally)
- **Mailpit (emails):** http://localhost:8025
- **OTEL Collector health:** http://localhost:13133

## Demo lifecycle (recommended)

Unified scripts auto-detect **Minikube** vs **Docker Compose** and support partial startup/teardown:

```bash
# Full demo (app + O11y + workshop + seed + port-forwards)
npm run demo:up

# App only — no Splunk export (OTEL_SDK_DISABLED)
npm run demo:up:app

# Enable Splunk O11y on a running stack
npm run demo:up:o11y

# Stop sending data to Splunk (keep app running)
npm run demo:down:o11y

# Workshop site only (:8090)
npm run demo:up:workshop

# One-shot: start stack + API + RUM traffic
npm run demo:run

# Generate traffic (API + browser RUM — linked APM traces)
npm run demo:traffic
npm run demo:traffic:api       # API only
npm run demo:traffic:rum       # browser RUM only
# First time for RUM: npx playwright install chromium

# Full teardown (+ stop Minikube VM)
bash scripts/demo-teardown.sh full --stop-minikube
```

Optional shell aliases — one script for everything:

```bash
source scripts/demo-aliases.sh   # or auto-loaded from ~/.zshrc
demo-help                        # list all commands
demo-run                         # demo-up + demo-traffic
demo-traffic                     # API + RUM combined
```

| Profile | Command | What it does |
|---------|---------|--------------|
| `full` | `npm run demo:up` | Entire stack with Splunk pipeline |
| `app` | `npm run demo:up:app` | Banking app, no O11y export |
| `o11y` | `npm run demo:up:o11y` | Turn on Splunk export only |
| `workshop` | `npm run demo:up:workshop` | Static lab guide on :8090 |
| `traffic` | `npm run demo:traffic` | API + RUM traffic (APM + linked sessions) |
| `run` | `npm run demo:run` | Full stack + both traffic types |

Legacy commands (`npm run minikube:up`, `docker compose up`) still work.

## Minikube (local Kubernetes)

Run the same stack on Minikube instead of Docker Compose:

```bash
docker compose down   # avoid port conflicts
npm run minikube:up
```

Requires [Minikube](https://minikube.sigs.k8s.io/docs/start/) with **6 GB RAM** (default). Uses the same localhost URLs. Secrets load from `.env` and `.env.splunk`. APM environment is tagged **`banking-app`**.

If Docker Desktop reports insufficient memory, use `MINIKUBE_MEMORY=6144 npm run minikube:up` or increase Docker Desktop RAM in Settings → Resources.

See [k8s/README.md](k8s/README.md) for full details, troubleshooting, and individual commands.

**Building more demos?** Copy-paste prompts for teammates: [docs/demo-build-playbook.md](docs/demo-build-playbook.md)  
Install the Cursor skill: copy `~/.cursor/skills/build-demo/` → teammate's `~/.cursor/skills/build-demo/`, then use **`/build demo`** in Agent chat.

## Teardown

Stop the platform when you're done. Config files (`.env`, `.env.splunk`) are **not** deleted.

**Quick path:** `npm run demo:down` (full teardown, auto-detects runtime) or `npm run demo:down:o11y` to stop Splunk ingest only.

### Docker Compose

```bash
# Stop containers (keeps database volumes — data persists)
docker compose down

# Full reset — removes Postgres data and document uploads
docker compose down -v
```

After `down -v`, run `npm run seed` on the next startup.

### Minikube

```bash
# Stop localhost port-forwards
npm run minikube:port-forward -- stop

# Remove the banking namespace (pods, services, PVCs)
npm run minikube:down

# Optional — stop or delete the Minikube cluster entirely
minikube stop
minikube delete
```

### Switching between Docker and Minikube

Both stacks use the same localhost ports. Tear down one before starting the other:

```bash
docker compose down && npm run minikube:up
# or
npm run minikube:down && docker compose up -d
```

## Demo Credentials

Password for all accounts: `Demo1234!`

| Email | Role | Notes |
|-------|------|-------|
| admin@bank.demo | Admin | Approve Bob's pending loan & card applications |
| alice@bank.demo | Customer | 4 accounts, active personal loan, rewards card, transaction history |
| bob@bank.demo | Customer | Checking + savings; pending auto loan & card applications |

## User Flows

1. **Register / Login** — Create account, optional MFA via Settings → Security
2. **Complete Profile** — Settings → Profile (required for CC/loan apps)
3. **Upload Documents** — Government ID + Proof of Income (auto-verified in demo)
4. **Apply for Credit Card / Loan** — Blocked until profile + docs complete
5. **Admin Approval** — Login as admin, review pending applications
6. **Transfers / Bill Pay / Scheduled Transfers** — Core banking operations
7. **Notifications** — In-app inbox + emails in Mailpit
8. **Feature Flags (Admin)** — Toggle simulated DB insert failures for demos (Admin → Feature Flags)

## Structured Logging (Splunk-compatible)

Every microservice emits **JSON logs to stdout** with fields designed for Splunk Observability Cloud parsing:

| Field | Purpose |
|-------|---------|
| `timestamp` | ISO-8601 UTC |
| `severityText` | `INFO`, `WARN`, `ERROR` (maps to Splunk severity) |
| `severityNumber` | OpenTelemetry severity number |
| `body` | Human-readable message |
| `service.name` | Microservice identifier |
| `deployment.environment` | From `DEPLOYMENT_ENVIRONMENT` (Splunk APM environment filter) |
| `deployment.environment.name` | Same value — OTEL semantic convention for APM |
| `correlation_id` | Request correlation ID (`X-Correlation-ID`) |
| `trace_id` / `span_id` | W3C trace context when OTEL is active |
| `http.method` / `http.route` / `http.status_code` | Request metadata |
| `feature_flag` | Set when a request is blocked by a feature flag |
| `error.message` / `error.stack` | Structured error details |

Example log line:

```json
{"timestamp":"2026-06-18T15:00:00.000Z","severityText":"ERROR","severityNumber":17,"body":"Request failed","service.name":"account-service","correlation_id":"abc-123","feature_flag":"fail_account_insert","error":{"message":"Database insert blocked..."}}
```

View logs locally:

```bash
docker compose logs -f account-service | jq .
```

In Splunk Observability Cloud, filter by `service.name`, `severityText`, or `feature_flag`.

## Feature Flags

Admin-controlled flags simulate database insert failures for observability demos. When enabled, the affected operation returns **503** with `code: FEATURE_FLAG_BLOCKED` and emits an **ERROR** log including the flag key.

| Flag | Effect |
|------|--------|
| `fail_account_insert` | Blocks new account creation |
| `fail_transaction_insert` | Blocks transfers and bill pay |
| `fail_notification_insert` | Blocks notification creation |
| `fail_card_application_insert` | Blocks credit card applications |
| `fail_loan_application_insert` | Blocks loan applications |
| `fail_user_profile_upsert` | Blocks profile updates |

**Admin UI:** Login as admin → **Feature Flags** (http://localhost:5173/admin/feature-flags)

**CLI:**

```bash
npm run flags -- list
npm run flags -- enable fail_account_insert
npm run flags -- disable fail_account_insert
```

After toggling, allow up to ~60 seconds for the in-memory cache to refresh before testing.

## OpenTelemetry → Splunk Observability Cloud

Each Node service calls `initObservability()` on startup and exports traces/metrics/logs via OTLP to the local collector. The collector forwards:

- **Traces** → Splunk OTLP ingest (`/v2/trace/otlp`)
- **Logs** → Splunk Log Observer (`/v1/log` via HEC-style ingest — **no Splunk Platform index**)
- **Metrics** → Splunk SignalFx ingest

### Log Observer (no index)

Log Observer stores logs in Splunk Observability Cloud. You do **not** set a Splunk Platform index (`main`, etc.) unless you also send logs to Splunk Cloud/Enterprise.

Search logs in O11y:

- **Logs** → `deployment.environment:banking-app service.name:api-gateway`
- **APM → Service → Logs tab** (trace-correlated when `trace_id` is present)

### Configure Splunk export (secrets file)

Splunk tokens live in a **separate gitignored file** so they are never committed with app config.

1. Copy the example and add your tokens locally:

```bash
cp .env.splunk.example .env.splunk
# Edit .env.splunk:
#   SPLUNK_ACCESS_TOKEN — ingest token (backend/collector)
#   SPLUNK_RUM_ACCESS_TOKEN — RUM token (browser agent; public by design)
#   SPLUNK_OPAMP_URL — Fleet Management enrollment (default: ${SPLUNK_INGEST_URL}/v1/opamp)
```

Get tokens from Splunk O11y → **Organization Settings → Access Tokens**:
- **Ingest token** for the otel-collector (traces, metrics, logs)
- **RUM token** (separate token type) for the browser agent

2. Restart services (Docker Compose):

```bash
docker compose --env-file .env --env-file .env.splunk up -d otel-collector frontend
```

For Minikube, run `bash scripts/k8s-create-secrets.sh` (patches the frontend ConfigMap with `VITE_SPLUNK_RUM_ACCESS_TOKEN`) and restart:

```bash
kubectl -n banking rollout restart deploy/frontend
```

3. To run locally without Splunk, set `OTEL_SDK_DISABLED=true` in `.env`.

### Verify telemetry

```bash
# Collector health
curl http://localhost:13133/

# Generate traffic, then inspect collector debug output
docker compose logs -f otel-collector
```

In Splunk Observability Cloud:

- **APM** → environment `banking-app`, filter by service name (e.g. `api-gateway`)
- **Logs (Log Observer)** → `deployment.environment:banking-app severityText:ERROR` — not a Platform index search
- **Infrastructure** → metrics from `signalfx` exporter
- **Fleet Management** → Settings → OpenTelemetry → Fleet Management — gateway collector enrolled via OpAMP (`deployment.environment.name: banking-app`, `otelcol.service.mode: gateway`). See [workshop Fleet Management guide](workshop-site/index.html#fleet-management).

The collector image is **Splunk OTel Collector** `0.154.2` with OpAMP enabled (`collector/otelcol-config.yaml`). If the collector is missing from Fleet, verify `SPLUNK_OPAMP_URL` and restart the collector; try `https://ingest.<realm>.observability.splunkcloud.com/v1/opamp` if the default signalfx.com URL fails.

### Splunk RUM (browser → APM linking)

The React frontend uses the **Splunk RUM browser agent** (`@splunk/otel-web`). RUM data goes directly to Splunk; backend services still export via the local collector.

**RUM token:** add `SPLUNK_RUM_ACCESS_TOKEN` to `.env.splunk` (same file as the ingest token). This is a **public** token by design — it is exposed to the browser via `VITE_SPLUNK_RUM_ACCESS_TOKEN`.

Backend services add a `Server-Timing: traceparent;desc="00-{traceId}-{spanId}-01"` response header so Splunk RUM sessions link to APM traces.

**Verify RUM → APM:**

1. Open http://localhost:5173, log in, transfer funds
2. **RUM → securebank-frontend** (environment `banking-app`) — sessions appear
3. Open a session → **View related trace** — jumps to APM through `api-gateway` → downstream services
4. DevTools → Network → `/api/*` responses include `Server-Timing: traceparent;desc="00-..."`

### APM service map

Background polling to `admin-service` for feature flags used to dominate the dependency graph (everything looked like a star around `admin-service`). That polling is removed; flags refresh lazily on write paths only, and health/feature-flag HTTP calls are excluded from trace instrumentation.

**Generate demo traffic** (after deploy):

```bash
npm run traffic
# or use the UI at http://localhost:5173 (login admin@bank.demo / Demo1234!)
```

**Expected APM map shape** (filter environment **`banking-app`**):

```
api-gateway → auth-service | account-service | transaction-service
transaction-service → account-service → notification-service
```

Use **Splunk RUM** for the browser entry point (`securebank-frontend`); RUM sessions link to backend APM traces via `Server-Timing`.

`admin-service` should appear only on admin UI/API calls or feature-flag checks during writes — not as a constant hub.

Open a linked RUM session or APM transfer trace to verify end-to-end: browser → `api-gateway` → `transaction-service` → `account-service` → `notification-service`.

### Troubleshooting Log Observer

1. **Collector receives logs** — look for `LogsExporter` in collector logs:
   ```bash
   kubectl -n banking logs deploy/otel-collector --since=5m | grep LogsExporter
   ```
2. **Export failures (HTTP 404 on `splunk_hec/o11y`)** — Log Observer ingest may be disabled on your org, or the token is not an ingest token. Fix:
   - Use an **ingest** token from Organization Settings → Access Tokens (not API-only)
   - Ensure token length is well over 25 characters (placeholders are ~22 chars)
   - Optionally set `SPLUNK_LOG_INGEST_URL=https://ingest.us1.observability.splunkcloud.com/v1/log` in `.env.splunk`
   - Reapply secrets: `bash scripts/k8s-create-secrets.sh && kubectl -n banking rollout restart deploy/otel-collector`
3. **Do not add `index:` to the O11y log exporter** — indexes only apply to Splunk Platform HEC (`:8088/services/collector`).

Follow the interactive walkthrough at **http://localhost:8090** for step-by-step demo instructions.

## Development (Local)

```bash
npm install
npm run build:shared

# Start postgres + mailpit
docker compose up postgres mailpit -d

# Run a service locally
npm run dev -w @banking/auth-service

# Run frontend
npm run dev -w @banking/frontend
```

## Testing

With the full stack running and seed data loaded:

```bash
cd tests && npm install && npm test
```

## Project Structure

```
banking-platform/
├── docker-compose.yml
├── collector/otelcol-config.yaml   # OTEL → Splunk collector config
├── packages/shared/                # Shared types, JWT, logging, OTEL, feature flags
├── services/                       # 10 microservices + api-gateway
├── frontend/                       # React + Vite SPA
├── workshop-site/                  # Splunk OTEL lab guide (nginx, port 8090)
├── k8s/                            # Kubernetes manifests (Minikube)
├── scripts/                        # Seed, migrations, feature-flag CLI, minikube
└── tests/                          # Integration tests
```

## Environment Variables

See `.env.example` and `.env.splunk.example` for all configuration. Key variables:

- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Token signing
- `INTERNAL_SERVICE_SECRET` — Service-to-service auth
- `POSTGRES_*` — Database connection
- `MAIL_HOST` / `MAIL_PORT` — Mailpit SMTP
- `OTEL_EXPORTER_OTLP_ENDPOINT` — Collector URL (default `http://otel-collector:4318`)
- `OTEL_SDK_DISABLED` — Set `true` to disable OTEL export
- `DEPLOYMENT_ENVIRONMENT` — Sets `deployment.environment` / `deployment.environment.name` on traces, metrics, and logs (Splunk APM environment dropdown)
- `SPLUNK_*` — Splunk Observability Cloud ingest (collector)
- `SPLUNK_LOG_INGEST_URL` — Log Observer endpoint (default `{SPLUNK_INGEST_URL}/v1/log`; no Platform index)

## Security Notes (Demo)

This is a demonstration platform. For production use:

- Rotate all secrets
- Enable TLS everywhere
- Add rate limiting and WAF
- Use proper KYC/AML verification
- Never use demo credentials in production
