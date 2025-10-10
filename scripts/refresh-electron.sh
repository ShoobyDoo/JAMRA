#!/usr/bin/env bash
set -euo pipefail

# Refresh Electron environment for desktop:dev
# This ensures native modules and extensions are ready

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ">> Refreshing Electron environment..."

# 1. Rebuild native modules for Electron
echo "   Rebuilding native modules..."
cd "$ROOT_DIR"
pnpm exec electron-builder install-app-deps --arch=arm64 --platform=darwin 2>&1 | grep -v "deprecated" || true

# 2. Fix SQLite bindings (remove conflicting build/ directory)
node "$ROOT_DIR/scripts/fix-sqlite-bindings.mjs"

# 3. Rebuild WeebCentral extension
echo ">> Rebuilding WeebCentral extension..."
pnpm --filter @jamra/weebcentral-extension build

# 4. Update manifest checksum
BUNDLE_PATH="$ROOT_DIR/packages/weebcentral-extension/dist/bundle.cjs"
if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "⚠ Bundle not found at $BUNDLE_PATH" >&2
  exit 1
fi

CHECKSUM=$(shasum -a 256 "$BUNDLE_PATH" | awk '{print $1}')
echo "   Bundle SHA-256: $CHECKSUM"

MANIFEST_PATH="$ROOT_DIR/packages/catalog-server/src/extensions/registries/official.json"
if command -v jq &> /dev/null; then
  jq --arg checksum "$CHECKSUM" \
    '(.extensions[] | select(.id == "com.weebcentral.manga") | .versions[0].checksum.value) = $checksum' \
    "$MANIFEST_PATH" > "$MANIFEST_PATH.tmp" && mv "$MANIFEST_PATH.tmp" "$MANIFEST_PATH"
  echo "✓ Updated official.json checksum"
else
  echo "⚠ jq not found - manual checksum update required in $MANIFEST_PATH"
fi

echo ""
echo "✓ Electron environment ready"
