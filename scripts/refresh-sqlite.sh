#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/refresh-sqlite.sh [options] [node_version]

Rebuilds better-sqlite3 for the specified Node.js release (defaults to 24) and
optionally also for Electron. Pass `--electron` to rebuild against the Electron
runtime (requires `@electron/rebuild`).

Options:
  --electron       Rebuild for Electron in addition to Node
  --no-electron    Skip the Electron rebuild even if Electron is detected
  --node <ver>     Explicit Node version (alias for the positional argument)
  -h, --help       Show this message
USAGE
}

TARGET_NODE=""
ELECTRON_MODE="auto"
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --electron)
      ELECTRON_MODE="1"
      ;;
    --no-electron)
      ELECTRON_MODE="0"
      ;;
    --node)
      shift
      TARGET_NODE="${1:-}"
      if [[ -z "$TARGET_NODE" ]]; then
        echo "error: --node expects a version" >&2
        exit 1
      fi
      ;;
    --node=*)
      TARGET_NODE="${1#*=}"
      ;;
    *)
      if [[ -z "$TARGET_NODE" && "$1" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]]; then
        TARGET_NODE="$1"
      else
        POSITIONAL+=("$1")
      fi
      ;;
  esac
  shift
done

if [[ ${#POSITIONAL[@]} -gt 0 ]]; then
  echo "error: unexpected argument(s): ${POSITIONAL[*]}" >&2
  usage
  exit 1
fi

TARGET_NODE="${TARGET_NODE:-24}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$REPO_ROOT/pnpm-lock.yaml" ]]; then
  echo "error: run this script from inside the repository (pnpm-lock.yaml not found)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is required but not on PATH." >&2
  exit 1
fi

MODULE_PACKAGE="$(node -p "require.resolve('better-sqlite3/package.json')" 2>/dev/null || true)"
if [[ -z "$MODULE_PACKAGE" ]]; then
  MODULE_DIR="$(find "$REPO_ROOT/node_modules/.pnpm" -maxdepth 3 -type d -path "*/node_modules/better-sqlite3" | head -n 1)"
  if [[ -z "${MODULE_DIR:-}" ]]; then
    echo "error: better-sqlite3 is not installed. Run 'pnpm install' first." >&2
    exit 1
  fi
  MODULE_PACKAGE="$MODULE_DIR/package.json"
else
  MODULE_DIR="${MODULE_PACKAGE%/package.json}"
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: missing required command '$1'" >&2
    exit 1
  fi
}

run_with_node() {
  if ((${#NODE_RUNNER[@]})); then
    "${NODE_RUNNER[@]}" "$@"
  else
    "$@"
  fi
}

choose_runner() {
  local requested="$1"

  if [[ -n "${NODE_VERSION_MANAGER:-}" ]]; then
    case "$NODE_VERSION_MANAGER" in
      nvm) configure_nvm "$requested"; return ;;
      mise|rtx) configure_mise "$requested"; return ;;
      fnm) configure_fnm "$requested"; return ;;
      volta) configure_volta "$requested"; return ;;
      none) NODE_RUNNER=(); return ;;
      *) echo "error: unsupported NODE_VERSION_MANAGER='$NODE_VERSION_MANAGER'" >&2; exit 1 ;;
    esac
  fi

  configure_nvm "$requested" && return
  configure_mise "$requested" && return
  configure_fnm "$requested" && return
  configure_volta "$requested" && return

  NODE_RUNNER=()
  warn_if_node_mismatch "$requested"
}

warn_if_node_mismatch() {
  local requested_major="${1%%.*}"
  local active_major
  active_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$requested_major" != "$active_major" ]]; then
    echo "warning: no version manager found; using Node $(node -v) instead of requested $1" >&2
  fi
}

configure_nvm() {
  local version="$1"
  if [[ -z "${NVM_DIR:-}" && -d "$HOME/.nvm" ]]; then
    export NVM_DIR="$HOME/.nvm"
  fi
  if [[ -n "${NVM_DIR:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$NVM_DIR/nvm.sh"
  fi
  if ! command -v nvm >/dev/null 2>&1; then
    return 1
  fi
  if ! nvm exec --silent "$version" node -v >/dev/null 2>&1; then
    echo "error: nvm does not have Node $version installed. Run 'nvm install $version' and re-run this script." >&2
    exit 1
  fi
  NODE_RUNNER=(nvm exec "$version")
}

configure_mise() {
  local version="$1"
  local shim
  if command -v mise >/dev/null 2>&1; then
    shim="mise"
  elif command -v rtx >/dev/null 2>&1; then
    shim="rtx"
  else
    return 1
  fi
  if ! "$shim" exec "node@$version" -- node -v >/dev/null 2>&1; then
    echo "error: $shim does not have node@$version installed. Run '$shim install node@$version' first." >&2
    exit 1
  fi
  NODE_RUNNER=("$shim" exec "node@$version" --)
}

configure_fnm() {
  local version="$1"
  if ! command -v fnm >/dev/null 2>&1; then
    return 1
  fi
  if ! fnm exec --using "$version" -- node -v >/dev/null 2>&1; then
    echo "error: fnm does not have Node $version installed. Run 'fnm install $version' first." >&2
    exit 1
  fi
  NODE_RUNNER=(fnm exec --using "$version" --)
}

configure_volta() {
  local version="$1"
  if ! command -v volta >/dev/null 2>&1; then
    return 1
  fi
  if ! volta run --node "$version" node -v >/dev/null 2>&1; then
    echo "error: volta cannot resolve Node $version. Run 'volta install node@$version' first." >&2
    exit 1
  fi
  NODE_RUNNER=(volta run --node "$version")
}

TAIL_VALUE() {
  local value
  value="$($@ 2>/dev/null || true)"
  printf '%s\n' "$value" | tail -n 1 | tr -d '\r'
}

get_runtime_value() {
  local expr="$1"
  TAIL_VALUE run_with_node node -p "$expr"
}

NODE_RUNNER=()
choose_runner "$TARGET_NODE"

PNPM_STORE_PATH="$(cd "$REPO_ROOT" && pnpm store path)"

prune_cached_binary() {
  local label="$1"
  local dir="$2"
  if [[ ! -d "$dir" ]]; then
    return
  fi
  local binaries=()
  while IFS= read -r line; do
    binaries+=("$line")
  done < <(find "$dir" -type f -name 'better_sqlite3.node' 2>/dev/null | sort -u)
  if ((${#binaries[@]})); then
    echo "- removing cached binaries from $label"
    rm -f "${binaries[@]}"
  fi
}

echo ">> Cleaning stale better-sqlite3 binaries"
prune_cached_binary "node_modules/.pnpm" "$REPO_ROOT/node_modules/.pnpm"
prune_cached_binary "pnpm store" "$PNPM_STORE_PATH"

build_native_module() {
  echo ">> Rebuilding better-sqlite3 for Node $TARGET_NODE"
  run_with_node pnpm --dir "$MODULE_DIR" exec node-gyp rebuild --release
}

ensure_binary_exists() {
  local path="$MODULE_DIR/build/Release/better_sqlite3.node"
  if [[ ! -f "$path" ]]; then
    echo "error: expected binary missing at $path" >&2
    exit 1
  fi
}

install_node_binding_copy() {
  local platform="$1"
  local arch="$2"
  local abi="$3"
  local dest="$MODULE_DIR/lib/binding/node-v${abi}-${platform}-${arch}"
  mkdir -p "$dest"
  cp "$MODULE_DIR/build/Release/better_sqlite3.node" "$dest/better_sqlite3.node"
  echo "$dest/better_sqlite3.node"
}

restore_node_binding() {
  local source="$1"
  if [[ -f "$source" ]]; then
    cp "$source" "$MODULE_DIR/build/Release/better_sqlite3.node"
  fi
}

maybe_rebuild_for_electron() {
  local platform="$1"
  local arch="$2"
  local node_binding_backup="$3"

  if [[ "$ELECTRON_MODE" == "0" ]]; then
    return
  fi

  local electron_present=0
  if node -p "require.resolve('electron/package.json')" >/dev/null 2>&1; then
    electron_present=1
  fi

  if [[ "$ELECTRON_MODE" == "auto" ]]; then
    ELECTRON_MODE="$electron_present"
  fi

  if [[ "$ELECTRON_MODE" != "1" ]]; then
    return
  fi

  local electron_rebuild_pkg
  electron_rebuild_pkg="$(node -p "(() => { const path = require('path'); try { return require.resolve('@electron/rebuild/package.json'); } catch (error) { try { const entry = require.resolve('@electron/rebuild'); return path.join(path.dirname(entry), 'package.json'); } catch { return ''; } } })()" 2>/dev/null || true)"
  if [[ -z "$electron_rebuild_pkg" ]]; then
    echo "warning: @electron/rebuild is not installed; skipping Electron rebuild." >&2
    echo "         Install it with 'pnpm add -D @electron/rebuild' and re-run with --electron." >&2
    return
  fi

  echo ">> Rebuilding better-sqlite3 for Electron (using @electron/rebuild)"
  if ! run_with_node pnpm exec electron-rebuild --force --only better-sqlite3; then
    echo "warning: electron-rebuild failed. The Node binding was restored; rerun with network access or see docs/sqlite-setup.md." >&2
    restore_node_binding "$node_binding_backup"
    return
  fi

  local electron_version
  electron_version="$(TAIL_VALUE node -p "require('electron/package.json').version")"
  local electron_abi=""
  if [[ -n "$electron_version" ]]; then
    electron_abi="$(ELECTRON_VERSION="$electron_version" run_with_node node -e "const nodeAbi = require('node-abi'); const version = process.env.ELECTRON_VERSION; if (version) process.stdout.write(nodeAbi.getAbi(version, 'electron'));" 2>/dev/null || true)"
    electron_abi="$(printf '%s\n' "$electron_abi" | tail -n 1 | tr -d '\r')"
  fi

  if [[ -z "$electron_abi" ]]; then
    electron_abi="$(run_with_node node -e "const electronPath = require('electron'); const { spawnSync } = require('node:child_process'); const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }; const result = spawnSync(electronPath, ['-p', 'process.versions.modules'], { encoding: 'utf8', env }); if (result.status === 0 && result.stdout) { process.stdout.write(result.stdout.trim()); }" 2>/dev/null || true)"
    electron_abi="$(printf '%s\n' "$electron_abi" | tail -n 1 | tr -d '\r')"
  fi

  if [[ -n "$electron_abi" ]] && [[ -n "$electron_version" ]]; then
    echo ">> Electron ABI ${electron_abi} (${electron_version})"
  elif [[ -n "$electron_version" ]]; then
    echo "warning: unable to determine Electron ABI for version ${electron_version}; skipping dedicated binding copy." >&2
  else
    echo "warning: unable to determine Electron version; skipping dedicated binding copy." >&2
  fi

  if [[ -n "$electron_abi" && -f "$MODULE_DIR/build/Release/better_sqlite3.node" ]]; then
    local dest="$MODULE_DIR/lib/binding/electron-v${electron_abi}-${platform}-${arch}"
    mkdir -p "$dest"
    cp "$MODULE_DIR/build/Release/better_sqlite3.node" "$dest/better_sqlite3.node"

    # Also copy to node-v{ABI} location since better-sqlite3 looks there when running in Electron
    local node_dest="$MODULE_DIR/lib/binding/node-v${electron_abi}-${platform}-${arch}"
    mkdir -p "$node_dest"
    cp "$MODULE_DIR/build/Release/better_sqlite3.node" "$node_dest/better_sqlite3.node"
  fi

  restore_node_binding "$node_binding_backup"
}

build_native_module
ensure_binary_exists

PLATFORM="$(get_runtime_value "process.platform")"
ARCH="$(get_runtime_value "process.arch")"
ABI="$(get_runtime_value "process.versions.modules")"

NODE_BINDING_COPY="$(install_node_binding_copy "$PLATFORM" "$ARCH" "$ABI")"

maybe_rebuild_for_electron "$PLATFORM" "$ARCH" "$NODE_BINDING_COPY"

if ((${#NODE_RUNNER[@]})); then
  echo ">> Verifying native binding via @jamra/catalog-db"
  run_with_node node -e "require('@jamra/catalog-db')"
fi

echo "All done."
