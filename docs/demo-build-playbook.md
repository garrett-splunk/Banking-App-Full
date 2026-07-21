# Demo Build Playbook — Copy-Paste Prompts for Cursor

Share this file with teammates. Each block is a **standalone Cursor prompt** — paste into Agent chat.  
For the full automated workflow, invoke the skill: **`/build demo`** or *"Use the build-demo skill to create..."*

---

## How to use

1. Copy **Prompt 0** first (customize bracketed fields).
2. Run phases in order, or use **Prompt A (all-in-one)** for experienced users.
3. After build, use **Prompt B–G** to add observability layers.
4. Share `~/.cursor/skills/build-demo/` folder so teammates get the same skill locally.

**Install skill for teammate:**

```bash
cp -r /path/to/build-demo ~/.cursor/skills/build-demo
# Restart Cursor or start new Agent chat
```

---

## Prompt 0 — Quick invoke (skill)

```
/build demo

App type: [banking | e-commerce | healthcare | inventory | custom]
App name: [e.g. SecureBank]
Key flows: [list 3-6 user journeys]
Stack: React frontend + Node.js microservices + PostgreSQL
Observability: Splunk Observability Cloud via OpenTelemetry
Include: feature flags, workshop site, seed data, Docker Compose, optional Minikube
Deployment environment tag for APM: [development | workshop | demo]
Do not commit secrets — use .env.splunk for Splunk tokens.
Reference style: ~/projects/banking-platform if helpful.
```

---

## Prompt A — All-in-one (full platform)

```
Build a full [APP TYPE] demo platform with:

Architecture:
- React SPA + API gateway + [N]+ Node.js microservices + PostgreSQL (database-per-service)
- Docker Compose for local run
- Realistic domain flows: [LIST FLOWS]

Observability (Splunk-ready):
- Structured JSON logs on every service (severityText, severityNumber, service.name, correlation_id, trace_id)
- OpenTelemetry instrumentation exporting to local otel-collector → Splunk Observability Cloud
- deployment.environment.name set for APM environment filter (value: [ENV NAME])
- Secrets in separate gitignored .env.splunk file (commit .env.splunk.example only)

Feature flags:
- Admin UI + CLI to toggle flags that simulate DB insert failures
- 503 + FEATURE_FLAG_BLOCKED when enabled; normal operation when disabled
- ERROR logs include feature_flag field

Workshop site:
- Static follow-along site on port 8090 (like otel-db-workshop on Desktop)
- Steps: start, app walkthrough, logging, feature flags, OTEL setup, Splunk demo, troubleshooting, teardown
- Live buttons on workshop to trigger/turn off error flags

Ops:
- Seed script with rich demo data (accounts, transactions, loans/cards as relevant)
- Integration tests
- README with quick start, teardown (docker compose down / minikube down)
- Optional Minikube manifests + npm run minikube:up

Demo credentials: admin@[domain].demo, alice@[domain].demo / Demo1234!
Do not edit any plan files unless I ask.
```

---

## Prompt B — App only (Phase 1)

```
Build a [APP TYPE] platform at ~/projects/[APP-NAME]:

- React + Vite frontend
- [N] Node.js microservices with Express, Prisma, PostgreSQL (one DB per service)
- API gateway with JWT auth and service routing
- Docker Compose, health checks, .env.example
- Seed script with demo users and sample data
- Integration tests for auth and main happy path
- README quick start

Domain flows: [LIST]
Demo login: admin@[domain].demo / Demo1234!
```

---

## Prompt C — Structured logging + Splunk OTEL

```
Add Splunk-compatible observability to [PROJECT PATH]:

1. Shared JSON logger (severityText, severityNumber, service.name, deployment.environment, correlation_id, trace_id/span_id)
2. OpenTelemetry Node SDK on every service → otel-collector:4318
3. Collector config exporting traces, metrics, logs to Splunk Observability Cloud
4. .env.splunk.example + gitignored .env.splunk for SPLUNK_ACCESS_TOKEN
5. DEPLOYMENT_ENVIRONMENT + deployment.environment.name on traces (APM environment filter)
6. Use splunk-otel-setup skill patterns

Verify collector health on :13133. Document APM environment name in README.
```

---

## Prompt D — Feature flags (failure injection)

```
Add admin-controlled feature flags to [PROJECT PATH]:

- Flags stored in admin-service DB, internal cache refresh ~3s
- Flags block specific DB inserts (configurable per service)
- When enabled: HTTP 503, code FEATURE_FLAG_BLOCKED, ERROR log with feature_flag field
- Admin UI page to toggle flags
- CLI: npm run flags -- list|enable|disable [key]
- Integration test: enable flag → operation fails → disable → works again
```

---

## Prompt E — Workshop site

```
Create a workshop site for [PROJECT PATH] at port 8090:

- Style like ~/Desktop/otel-db-workshop (Splunk-themed, sidebar steps, progress bar, dark/light)
- Three-column layout: sidebar nav | main content | on-this-page TOC (use CSS classes .page, .prose, .toc)
- Steps: overview, start platform, app walkthrough, logging, feature flags, OTEL/Splunk setup, APM demo, troubleshooting, teardown
- Live demo panel: "Trigger errors" / "Turn off errors" buttons calling admin feature-flag API
- Add CORS for localhost:8090 on API gateway
- Copy-paste code blocks with copy buttons
```

---

## Prompt F — Minikube local Kubernetes

```
Add Minikube deployment to [PROJECT PATH]:

- k8s/base manifests + k8s/overlays/minikube
- All services, postgres, mailpit, otel-collector, workshop-site
- Secrets from .env + .env.splunk via script
- npm run minikube:up (default 6144MB memory), minikube:down, port-forwards to same localhost URLs
- DEPLOYMENT_ENVIRONMENT=minikube in overlay
- k8s/README.md + teardown section in main README
```

---

## Prompt G — Seed data + teardown docs

```
Enhance [PROJECT PATH]:

Seed data:
- Rich demo data for [users, accounts, loans, cards, transactions, documents, notifications as relevant]
- Admin pending approvals for demo
- npm run seed idempotent

Teardown (README + workshop Step 8):
- docker compose down / docker compose down -v
- npm run minikube:down, minikube stop, minikube delete
- Note: .env and .env.splunk are never deleted
- npm run docker:down and docker:down:clean scripts
```

---

## Prompt H — Splunk secrets only

```
Set up Splunk OTEL with a separate secrets file for [PROJECT PATH]:
- Copy .env.splunk.example → .env.splunk (gitignored)
- Wire collector env_file; never hardcode tokens
- Use splunk-otel-setup skill
- Open .env.splunk in editor for me to paste ingest token
```

---

## Prompt I — Fix / extend existing demo

```
On [PROJECT PATH], [describe change].

Follow existing conventions. Minimal diff. Do not break docker compose or seed script.
Current stack: [docker compose | minikube | both]
```

---

## Standard URLs (after build)

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| API | http://localhost:8080 |
| Workshop | http://localhost:8090 |
| Mailpit | http://localhost:8025 |
| OTEL collector | http://localhost:13133 |

## Standard commands

```bash
# Start
cp .env.example .env && cp .env.splunk.example .env.splunk
docker compose up --build -d && npm install && npm run seed

# Feature flags
npm run flags -- list
npm run flags -- enable fail_transaction_insert
npm run flags -- disable fail_transaction_insert

# Teardown
npm run docker:down          # stop containers
npm run docker:down:clean    # stop + wipe DB volumes
npm run minikube:down        # remove k8s namespace

# Minikube
npm run minikube:up
```

## APM cheat sheet (Splunk)

| Setting | Value |
|---------|-------|
| Environment (Docker) | `development` (unless DEPLOYMENT_ENVIRONMENT set) |
| Environment (Minikube) | `minikube` |
| Filter | `deployment.environment:development` |
| Namespace | `service.namespace:securebank` (adapt per project) |
| Errors | `severityText:ERROR` or `feature_flag:*` |

---

## Reference repo

Clone or copy patterns from: `~/projects/banking-platform`  
Playbook also at: `docs/demo-build-playbook.md`
