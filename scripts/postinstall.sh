#!/usr/bin/env bash
set -euo pipefail

# Postinstall hook to ensure better-sqlite3 bindings are correct for both Node and Electron
# This runs automatically after every `pnpm install` to fix the binding issue

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find the better-sqlite3 module
MODULE_DIR="$(find "$REPO_ROOT/node_modules/.pnpm" -maxdepth 3 -type d -path "*/node_modules/better-sqlite3" 2>/dev/null | head -n 1)"

if [[ -z "$MODULE_DIR" ]]; then
  # better-sqlite3 not installed yet, skip
  exit 0
fi

BINDING_DIR="$MODULE_DIR/lib/binding"
BUILD_RELEASE="$MODULE_DIR/build/Release/better_sqlite3.node"

# Get the actual Node version being used
NODE_VERSION="$(node -p "process.versions.modules" 2>/dev/null || echo "")"

# Detect platform and arch
PLATFORM="$(node -p "process.platform" 2>/dev/null || echo "linux")"
ARCH="$(node -p "process.arch" 2>/dev/null || echo "x64")"
PLATFORM_ARCH="${PLATFORM}-${ARCH}"

# Check if we have Electron bindings
ELECTRON_BINDING=""
if [[ -d "$BINDING_DIR" ]]; then
  ELECTRON_BINDING="$(find "$BINDING_DIR" -type f -path "*/electron-v*/better_sqlite3.node" | head -n 1)"
fi

if [[ -z "$ELECTRON_BINDING" || ! -f "$ELECTRON_BINDING" ]]; then
  # No Electron binding found, nothing to fix
  exit 0
fi

# Extract ABI from the Electron binding path (e.g., electron-v139-linux-x64)
ELECTRON_DIR="$(dirname "$ELECTRON_BINDING")"
ELECTRON_DIR_NAME="$(basename "$ELECTRON_DIR")"

# Extract ABI number (e.g., 139 from electron-v139-linux-x64)
if [[ "$ELECTRON_DIR_NAME" =~ electron-v([0-9]+)- ]]; then
  ELECTRON_ABI="${BASH_REMATCH[1]}"
else
  # Can't parse ABI, skip
  exit 0
fi

# 1. Ensure the node-v{ELECTRON_ABI} directory exists with Electron binding
NODE_BINDING_DIR="$BINDING_DIR/node-v${ELECTRON_ABI}-${PLATFORM_ARCH}"
if [[ ! -d "$NODE_BINDING_DIR" ]]; then
  mkdir -p "$NODE_BINDING_DIR"
  cp "$ELECTRON_BINDING" "$NODE_BINDING_DIR/better_sqlite3.node"
  echo "✓ Created node-v${ELECTRON_ABI} binding for Electron compatibility"
elif [[ ! -f "$NODE_BINDING_DIR/better_sqlite3.node" ]]; then
  cp "$ELECTRON_BINDING" "$NODE_BINDING_DIR/better_sqlite3.node"
  echo "✓ Restored node-v${ELECTRON_ABI} binding for Electron compatibility"
fi

# 2. Ensure Node binding exists in lib/binding (copy from build/Release if present)
if [[ -f "$BUILD_RELEASE" && -n "$NODE_VERSION" ]]; then
  NODE_BINDING_FOR_NODE="$BINDING_DIR/node-v${NODE_VERSION}-${PLATFORM_ARCH}/better_sqlite3.node"
  if [[ ! -f "$NODE_BINDING_FOR_NODE" ]]; then
    mkdir -p "$(dirname "$NODE_BINDING_FOR_NODE")"
    cp "$BUILD_RELEASE" "$NODE_BINDING_FOR_NODE"
    echo "✓ Preserved node-v${NODE_VERSION} binding for web development"
  fi
fi

# 3. CRITICAL FIX: Remove build/Release to force better-sqlite3 to use lib/binding
# This prevents the ABI mismatch issue in Electron
if [[ -f "$BUILD_RELEASE" ]]; then
  rm -f "$BUILD_RELEASE"
  echo "✓ Removed build/Release binding to force library selection from lib/binding/"
fi

echo "✓ SQLite bindings configured for both Node ${NODE_VERSION} and Electron (ABI ${ELECTRON_ABI})"
