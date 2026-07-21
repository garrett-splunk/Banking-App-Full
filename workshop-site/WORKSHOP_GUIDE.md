# SecureBank Workshop — Facilitator Guide

Hands-on workshop: run a 10-microservice banking demo, instrument with OpenTelemetry, demo Splunk Observability Cloud (APM, RUM, Log Observer), and optionally connect O11y detectors to Splunk ITSI.

**Participant site:** https://garrett-splunk.github.io/Banking-App-Full/ (or http://localhost:8090 when running the stack locally)

**Lab root:** directory where participants cloned `banking-platform`

---

## Timing (~75–90 min)

| Block | Duration | Section |
|-------|----------|---------|
| Intro + Concepts 101 | 10 min | Overview + Concepts |
| Prerequisites + start | 15 min | Steps 1–2 |
| App + logging + flags | 20 min | Steps 3–5 |
| OTEL + O11y demo | 25 min | Steps 6–7 |
| ITSI concepts | 10 min | Step 8 |
| ITSI optional lab | 20 min | Step 9 (skip if no ITSI) |
| Wrap-up + Q&A | 10 min | Teardown |

Adjust: skip Step 9 for O11y-only sessions; run transfer demo even if Splunk ingest is slow.

---

## Pre-workshop checklist

- [ ] Docker Desktop running (Compose path) **or** Minikube with 6 GB RAM
- [ ] Splunk O11y **ingest** token issued (not API-only)
- [ ] Splunk **RUM** token in `.env.splunk`
- [ ] Participants have cloned repo and copied `.env.example` / `.env.splunk.example`
- [ ] Facilitator stack verified: `curl http://localhost:8080/health`
- [ ] Optional ITSI: HEC token + index access confirmed with Splunk admin

---

## Facilitator demo script

1. **Start stack** — Docker Compose or Minikube (Step 2)
2. **Business traffic** — login as `alice@bank.demo`, transfer funds; run `npm run traffic`
3. **O11y service map** — filter `banking-app`; show `api-gateway → transaction-service → account-service → notification-service`
4. **RUM link** — open RUM session → View related trace
5. **Failure injection** — Trigger errors on workshop page → transfer fails → ERROR logs + 503 trace
6. **Optional ITSI** — show detector → notable → episode; or walk concepts only (Step 8)

---

## Facilitator cheat sheet

```bash
cd ~/projects/banking-platform

# Docker
docker compose up --build -d && npm run seed

# Minikube
npm run minikube:up && npm run minikube:port-forward

# Demo traffic
npm run traffic

# Flags
npm run flags -- enable fail_transaction_insert
npm run flags -- disable fail_transaction_insert

# Teardown
docker compose down
npm run minikube:port-forward -- stop && npm run minikube:down
```

---

## Key talking points

### Service map

- **Admin UI traffic** centers on `admin-service` — expected
- **Transfer traffic** shows business topology — use `npm run traffic` or UI transfer
- Frontend is **RUM**, not an APM node

### O11y vs ITSI

- O11y = span-level debugging, RUM, detectors
- ITSI = business service health, KPI rollups, episodes, MTTR
- Detectors in O11y → webhook → HEC → ITSI notables (Step 9)

---

## If ITSI is unavailable

Walk through Step 8 concepts only:

1. Map `transaction-service` to ITSI entity
2. Explain Funds Transfer as business service
3. Describe how feature-flag 503s would become notables
4. Show O11y detector + ERROR log correlation as the operational entry point
5. Reference customer's ITSI Service Analyzer / Episode Review in slides

---

## Common issues

| Symptom | Fix |
|---------|-----|
| Empty APM map | Filter `banking-app`; wait 2–3 min; run `npm run traffic` |
| Map shows admin hub | Use business traffic, not admin pages |
| No RUM | Set `SPLUNK_RUM_ACCESS_TOKEN`; restart frontend |
| Log Observer 404 | Ingest token; check `SPLUNK_LOG_INGEST_URL` |
| Workshop flags fail | Platform not up; run port-forward for Minikube |
| ITSI no notables | HEC token/index; verify Splunk platform integration in O11y |

---

## Screenshots (optional)

Add org-specific screenshots to `workshop-site/assets/`:

- `apm-service-map.png`
- `rum-related-trace.png`
- `itsi-service-analyzer.png`
- `itsi-episode-review.png`

Reference them in Step 7 and Step 9 when presenting.
