# Optional shell shortcuts for SecureBank demo lifecycle.
# Usage: source scripts/demo-aliases.sh

_demo_root() {
  cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd
}

demo-up() { npm --prefix "$(_demo_root)" run demo:up "$@"; }
demo-down() { npm --prefix "$(_demo_root)" run demo:down "$@"; }
demo-up-full() { npm --prefix "$(_demo_root)" run demo:up:full "$@"; }
demo-up-app() { npm --prefix "$(_demo_root)" run demo:up:app "$@"; }
demo-up-workshop() { npm --prefix "$(_demo_root)" run demo:up:workshop "$@"; }
demo-o11y-on() { npm --prefix "$(_demo_root)" run demo:up:o11y "$@"; }
demo-o11y-off() { npm --prefix "$(_demo_root)" run demo:down:o11y "$@"; }
demo-traffic() { npm --prefix "$(_demo_root)" run demo:traffic "$@"; }
