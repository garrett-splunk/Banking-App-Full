# SecureBank demo lifecycle — single alias entry point.
# Usage: source scripts/demo-aliases.sh
#        demo-help
#
# Loaded automatically from ~/.zshrc when the repo exists at ~/projects/banking-platform.

_demo_script_dir() {
  if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "${0}" ]]; then
    dirname "${BASH_SOURCE[0]}"
  elif [[ -n "${ZSH_VERSION:-}" ]]; then
    dirname "${(%):-%x}"
  else
    dirname "$0"
  fi
}

_demo_root() {
  cd "$(_demo_script_dir)/.." && pwd
}

_demo_npm() {
  npm --prefix "$(_demo_root)" "$@"
}

# ---- Lifecycle ----
demo-up() { _demo_npm run demo:up "$@"; }
demo-down() { _demo_npm run demo:down "$@"; }
demo-up-full() { _demo_npm run demo:up:full "$@"; }
demo-up-app() { _demo_npm run demo:up:app "$@"; }
demo-up-workshop() { _demo_npm run demo:up:workshop "$@"; }

# ---- O11y export on/off ----
demo-o11y-on() { _demo_npm run demo:up:o11y "$@"; }
demo-o11y-off() { _demo_npm run demo:down:o11y "$@"; }

# ---- Traffic (API + RUM combined by default) ----
demo-traffic() { bash "$(_demo_script_dir)/run-demo-traffic.sh" all "$@"; }
demo-traffic-api() { bash "$(_demo_script_dir)/run-demo-traffic.sh" api "$@"; }
demo-traffic-rum() { bash "$(_demo_script_dir)/run-demo-traffic.sh" rum "$@"; }

# ---- Teardown variants ----
demo-down-full() { _demo_npm run demo:down:full "$@"; }
demo-down-app() { _demo_npm run demo:down:app "$@"; }
demo-down-workshop() { _demo_npm run demo:down:workshop "$@"; }
demo-down-minikube() { bash "$(_demo_script_dir)/demo-teardown.sh" full --stop-minikube "$@"; }

# ---- Full demo flow: up + both traffic types ----
demo-run() {
  demo-up "$@"
  demo-traffic
}

demo-help() {
  cat <<'EOF'
SecureBank demo aliases (source scripts/demo-aliases.sh)

  demo-up              Full stack (auto-detect Minikube / Docker)
  demo-down            Full teardown
  demo-run             demo-up + API traffic + RUM traffic

  demo-up-app          App only (no Splunk export)
  demo-up-workshop     Workshop site only (:8090)
  demo-o11y-on         Enable Splunk export on running stack
  demo-o11y-off        Stop Splunk export, keep app running

  demo-traffic         API + browser RUM (APM + linked RUM sessions)
  demo-traffic-api     API-only traffic (APM backend)
  demo-traffic-rum     Browser-only traffic (RUM + linked APM)

  demo-down-full       Full teardown
  demo-down-minikube   Teardown + stop Minikube VM

  demo-help            Show this help
EOF
}
