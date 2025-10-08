#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ">> Rebuilding native modules against Electron"
pnpm exec electron-rebuild

# Remove conflicting Node binding to force Electron to use correct ABI
rm -f "$ROOT_DIR/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
echo "✓ Removed conflicting SQLite binding"

echo ">> Rebuilding @jamra/weebcentral-extension bundle"
pnpm --filter @jamra/weebcentral-extension build

BUNDLE_PATH="$ROOT_DIR/packages/weebcentral-extension/dist/bundle.cjs"
if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "Bundle not found at $BUNDLE_PATH" >&2
  exit 1
fi

CHECKSUM=$(shasum -a 256 "$BUNDLE_PATH" | awk '{print $1}')
echo ">> bundle.cjs SHA-256: $CHECKSUM"

# Auto-update the official registry manifest
MANIFEST_PATH="$ROOT_DIR/packages/catalog-server/src/extensions/registries/official.json"
if command -v jq &> /dev/null; then
  # Update the checksum for com.weebcentral.manga extension
  jq --arg checksum "$CHECKSUM" \
    '(.extensions[] | select(.id == "com.weebcentral.manga") | .versions[0].checksum.value) = $checksum' \
    "$MANIFEST_PATH" > "$MANIFEST_PATH.tmp" && mv "$MANIFEST_PATH.tmp" "$MANIFEST_PATH"
  echo "✓ Updated official.json with new checksum"
else
  echo "⚠ jq not found - skipping manifest update. Manual update required."
  echo "Update the WeebCentral checksum in $MANIFEST_PATH to: $CHECKSUM"
fi
