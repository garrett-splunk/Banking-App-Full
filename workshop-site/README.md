# SecureBank Workshop Site

Static step-by-step lab guide for the banking platform demo — Splunk Observability Cloud (APM, RUM, Log Observer) plus optional ITSI integration.

**Published site:** https://garrett-splunk.github.io/Banking-App-Full/

## View locally

**With the stack running (recommended for live demo controls):**

http://localhost:8090

**Static preview only:**

```bash
cd workshop-site
python3 -m http.server 8090
```

Live feature-flag controls require the API gateway at http://localhost:8080 (disabled on GitHub Pages).

## Contents

| File | Purpose |
|------|---------|
| `index.html` | Full workshop (overview, concepts, 9 steps, troubleshooting) |
| `styles.css` | Splunk workshop theme (three-column layout) |
| `app.js` | Theme toggle, TOC, copy buttons, live flag demo |
| `WORKSHOP_GUIDE.md` | Facilitator timing and demo script |
| `assets/` | Optional screenshots for your org |

## Deploy

Served automatically by Docker Compose and Minikube (`workshop-site` on port 8090). Content is volume-mounted in Compose — edit HTML/CSS/JS and refresh the browser.

## Related

- Root [README.md](../README.md) — platform quick start
- [docs/demo-build-playbook.md](../docs/demo-build-playbook.md) — copy-paste prompts
