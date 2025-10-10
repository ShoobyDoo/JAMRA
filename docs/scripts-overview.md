# Scripts Overview

This document explains the streamlined script architecture for JAMRA.

## Core Scripts

### `fix-sqlite-bindings.mjs`
**Purpose:** Ensures SQLite works in both Node and Electron

**What it does:**
- Removes the `build/` directory from better-sqlite3
- Forces better-sqlite3 to use bindings from `lib/binding/`
- Prevents ABI mismatch errors

**When it runs:**
- After `pnpm install` (via postinstall hook)
- When you run `pnpm desktop:refresh`
- Can be run manually: `node scripts/fix-sqlite-bindings.mjs`

### `refresh-electron.sh`
**Purpose:** Prepares the Electron environment for `desktop:dev`

**What it does:**
1. Rebuilds native modules for Electron (ABI 139)
2. Fixes SQLite bindings
3. Rebuilds WeebCentral extension
4. Updates manifest checksum

**When to use:**
- Automatically runs via `pnpm desktop:dev`
- Run manually if you get ABI errors: `pnpm desktop:refresh`

### `refresh-sqlite.sh` (Advanced)
**Purpose:** Manual control over SQLite binding rebuilds

**When to use:**
- Switching Node versions
- Troubleshooting binding issues
- Advanced development workflows

**Usage:**
```bash
pnpm sqlite:refresh              # Rebuild for current Node version
pnpm sqlite:refresh --electron   # Rebuild for both Node + Electron
pnpm sqlite:refresh 20           # Rebuild for specific Node version
```

## Workflow

### First-time setup
```bash
pnpm install  # Automatically sets up all bindings
```

### Web development
```bash
pnpm dev  # Just works, uses Node bindings
```

### Desktop development
```bash
pnpm desktop:dev  # Automatically ensures Electron bindings are ready
```

### If you encounter ABI errors
```bash
pnpm desktop:refresh  # Resets everything
```

## How It Works

### The ABI Mismatch Problem
- Node 24 uses ABI 137
- Electron 38 uses ABI 139
- better-sqlite3 checks `build/Release/` first, which may have wrong ABI
- This causes "NODE_MODULE_VERSION mismatch" errors

### The Solution
1. **During install:** `electron-builder install-app-deps` creates correct bindings in `lib/binding/`
2. **After install:** `fix-sqlite-bindings.mjs` removes `build/` directory
3. **Result:** better-sqlite3 is forced to use `lib/binding/`, which has the right ABI for each runtime

### File Structure
```
node_modules/.pnpm/better-sqlite3@12.4.1/node_modules/better-sqlite3/
├── lib/binding/
│   ├── electron-v139-darwin-arm64/better_sqlite3.node  ✓ For Electron
│   ├── node-v137-darwin-arm64/better_sqlite3.node      ✓ For Node 24
│   └── node-v139-darwin-arm64/better_sqlite3.node      ✓ For Electron (fallback)
└── build/  ✗ REMOVED to prevent ABI mismatch
```

## Removed Scripts

The following scripts were removed to reduce complexity:
- `scripts/postinstall.sh` - Replaced by `fix-sqlite-bindings.mjs`
- `scripts/postinstall.mjs` - Replaced by `fix-sqlite-bindings.mjs`

## Troubleshooting

### "NODE_MODULE_VERSION mismatch" error
```bash
pnpm desktop:refresh  # This will fix it
```

### Extension not loading
```bash
pnpm desktop:refresh  # Rebuilds extension + updates checksum
```

### Database locked/unavailable
```bash
# Stop any running processes
pkill -f "pnpm.*dev"

# Refresh bindings
pnpm desktop:refresh

# Restart
pnpm desktop:dev
```

### Nuclear option
```bash
rm -rf node_modules .jamra-data
pnpm install
pnpm desktop:dev
```
