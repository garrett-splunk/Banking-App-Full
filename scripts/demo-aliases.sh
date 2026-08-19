# SecureBank demo lifecycle shortcuts.
# Usage: source scripts/demo-aliases.sh
# Loaded automatically from ~/.zshrc when the repo exists.

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

demo-up() { npm --prefix "$(_demo_root)" run demo:up "$@"; }
demo-down() { npm --prefix "$(_demo_root)" run demo:down "$@"; }
demo-up-full() { npm --prefix "$(_demo_root)" run demo:up:full "$@"; }
demo-up-app() { npm --prefix "$(_demo_root)" run demo:up:app "$@"; }
demo-up-workshop() { npm --prefix "$(_demo_root)" run demo:up:workshop "$@"; }
demo-o11y-on() { npm --prefix "$(_demo_root)" run demo:up:o11y "$@"; }
demo-o11y-off() { npm --prefix "$(_demo_root)" run demo:down:o11y "$@"; }
demo-traffic() { npm --prefix "$(_demo_root)" run demo:traffic "$@"; }
