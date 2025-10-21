# Operations Handbook

Practical reference for running builds, packaging Electron releases, and keeping
native bindings healthy across Node and Electron runtimes.

## Core Commands

| Workflow | Command | Notes |
| --- | --- | --- |
| Install dependencies | `pnpm install` | Runs postinstall hooks that fix native modules. |
| Web + API dev loop | `pnpm dev` | Boots catalog server (port 4545) and Next.js (port 3000) together. |
| Backend rebuild | `pnpm backend:build` | Rebuilds packages in dependency order and forces a fresh `@jamra/catalog-server` dist. |
| Production build | `pnpm build` | Generates optimized Next.js output and rebuilds backend. |
| Lint & typecheck | `pnpm lint` | ESLint + TypeScript project references. |
| Unit tests | `pnpm test` | Executes suites under `test/`. |
| Electron dev shell | `pnpm desktop:dev` | Rebuilds native deps, refreshes the demo extension, then launches Electron. |
| Electron refresh only | `pnpm desktop:refresh` | Same prep as `desktop:dev` without opening the shell. |
| Electron distribution | `pnpm dist` | Packages for the current platform (`dist-electron/`). |
| Bundle analysis | `pnpm analyze` | Aliases `NEXT_BUNDLE_ANALYZE=1 pnpm build`. |

All run scripts funnel through `scripts/run.ts`, which handles dependency
ordering, concurrency limits, and cache invalidation.

## Build & Release

- **Prerequisites**: Node 24.x, pnpm 10+, and a C/C++ toolchain suited to your OS
  (Xcode Command Line Tools on macOS, Visual Studio Build Tools on Windows,
  `build-essential`/`libsqlite3-dev` on Debian/Ubuntu, etc.).
- **Icons**: Drop platform assets in `build/` (`icon.icns`, `icon.ico`,
  `icons/*.png`). The repo keeps a 1024x1024 master source in design assets.
- **Desktop packaging**: `pnpm dist` targets the host OS. Use `pnpm dist:mac`,
  `dist:win`, or `dist:linux` for cross-platform builds (macOS artifacts require
  macOS hardware). Outputs land in `dist-electron/`.
- **Forced rebuilds**: The backend pipeline intentionally deletes
  `packages/catalog-server/dist` and `tsconfig.tsbuildinfo` before each build to
  avoid stale HTTP handlers. Expect an extra 1-2s during `backend:build`.
- **CI hint**: GitHub Actions can run `pnpm dist` on each matrix OS after
  `pnpm install`; upload `dist-electron/*` artifacts for review.

## Script Utilities & Automation

- `pnpm desktop:refresh` → orchestrates native module rebuilds, runs the SQLite
  fixer, rebuilds the WeebCentral demo extension, and updates manifest checksums.
- `pnpm sqlite:refresh [version] [--electron]` → rebuilds `better-sqlite3`
  binaries for a specific Node major (defaults to the active version). When
  `--electron` is supplied the script produces both Node and Electron bindings
  before restoring the Node build.
- `JAMRA_DISABLE_SQLITE=1` → forces the catalog service into in-memory mode. Use
  for quick smoke tests while toolchains are installing.
- `scripts/fix-sqlite-bindings.mjs` → invoked automatically postinstall; deletes
  stale `build/Release` folders inside `better-sqlite3` so the runtime prefers
  the freshly rebuilt `lib/binding/*` binaries.

## SQLite & Native Bindings

1. **Stay on Node 24.x** — all prebuilt bindings target this runtime. Switching
   versions without a rebuild leads to ABI mismatch errors.
2. **Switching Node versions** — install or select the desired toolchain via
   `nvm`, `rtx/mise`, `fnm`, or `volta`, then run `pnpm sqlite:refresh <major>`.
   Set `NODE_VERSION_MANAGER=none` if your CI image already exposes `node`.
3. **Electron ABI** — Electron 38 requires ABI 139. `desktop:refresh` and
   `sqlite:refresh --electron` both rebuild the matching binary and place it in
   `lib/binding/electron-v139-*`.
4. **Fallback mode** — export `JAMRA_DISABLE_SQLITE=1` to bypass persistence
   while debugging; remember to unset it afterwards so reading progress,
   library, and history resume database writes.

## Troubleshooting

- **`NODE_MODULE_VERSION mismatch`** → run `pnpm desktop:refresh` (or
  `pnpm sqlite:refresh --electron`) after confirming Node/Electron versions.
- **Electron fails to start** → clear `.jamra-data` only if corrupt
  (`rm -rf .jamra-data`), then rerun `pnpm desktop:dev`.
- **macOS quarantine** → for unsigned builds, prompt users to run
  `xattr -cr JAMRA.app`.
- **Windows SmartScreen** → sign releases or instruct testers to choose "Run
  anyway" under "More info".
- **Large bundle regression** → run `pnpm analyze` and inspect `analyze/` output
  for duplicated dependencies or unexpectedly heavy routes.
