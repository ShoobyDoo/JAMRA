# JAMRA Development Guide

Authoritative reference for setting up the workspace, running the app, and following house rules while touching the codebase.

---

## Environment & Tooling

- **Node.js 24.x** — required across web, API, and Electron.
- **pnpm 10+** — the repo relies on pnpm workspaces; other package managers are unsupported.
- **C/C++ toolchain** — only needed when rebuilding native `better-sqlite3` bindings (see _SQLite bindings_ below).
- Recommended extras: `jq` for build scripts, Chrome/Edge for web smoke tests.

Verify prerequisites:

```bash
node -v
pnpm -v
```

---

## Workspace Setup

```bash
pnpm install       # bootstrap monorepo, runs postinstall to fix native deps
pnpm dev           # starts API + Next.js together (http://localhost:3000)
```

The `pnpm dev` script wraps `pnpm run run bootstrap web`, which builds backend packages, boots the catalog server on port `4545`, and runs Next.js dev mode via Turbopack. No extra processes are required for standard web development.

### Core Commands

| Workflow              | Command |
| --------------------- | ------- |
| Lint & typecheck      | `pnpm lint` |
| Unit tests            | `pnpm test` |
| Build backend only    | `pnpm backend:build` |
| Full production build | `pnpm build` |
| Serve production app  | `pnpm start` |
| Bundle analysis       | `pnpm analyze` (sets `NEXT_BUNDLE_ANALYZE=1`) |

All scripts funnel through `scripts/run.ts`, which handles dependency ordering, concurrency, and catalog-server rebuilds.

---

## Desktop/Electron Workflows

```bash
pnpm desktop:dev      # rebuild native deps, then launch Electron shell
pnpm desktop:refresh  # rerun native rebuild + extension packaging without starting Electron
pnpm dist             # build production artifacts for the current platform
```

The Electron shell wraps the catalog server and Next.js build, exposing the same API endpoints for browser debugging while the desktop window is open.

---

## SQLite Bindings

`@jamra/catalog-db` depends on `better-sqlite3`. The postinstall hook prepares bindings for both Node 24 and Electron 38. When you change Node versions or tweak Electron headers, rebuild with:

```bash
pnpm sqlite:refresh              # rebuild for active Node version
pnpm sqlite:refresh --electron   # rebuild for Node + Electron
```

The helper script supports `nvm`, `mise/rtx`, `fnm`, and `volta`. If no manager is detected, set `NODE_VERSION_MANAGER=none` and ensure your shell already runs the desired `node`.

Temporary fallback:

```bash
JAMRA_DISABLE_SQLITE=1 pnpm extension:demo
```

This switches the catalog to in-memory storage for quick smoke tests.

---

## Extension Pipeline

```bash
pnpm --filter @jamra/extension-sdk build
pnpm --filter @jamra/extension-host build
pnpm --filter @jamra/example-extension build
pnpm extension:demo              # invokes scripts/run-example-extension.mjs
```

These commands exercise the extension SDK/host bridge and verify catalog ingestion without launching the UI.

---

## Coding Standards

- TypeScript strict mode everywhere. Declare component props and Zustand slices explicitly.
- Use the `@/` alias for imports under `src/`; avoid deep relative paths.
- Naming conventions: PascalCase for components, camelCase for variables/functions, kebab-case only when mirroring route segments.
- Tailwind utilities rely on tokens defined in `tailwind.config.ts`; extract repeated combinations into `src/components/ui`.
- Zustand: consume slices via selectors (`useStore((state) => state.slice)`) to avoid unnecessary re-renders. See `docs/zustand-selectors.md`.

---

## Testing & QA

- `pnpm test` runs the lightweight suite in `test/`; add new `.test.ts`/`.test.tsx` files alongside features.
- Manual smoke tests:
  1. `pnpm dev` — verify catalog browsing, manga detail pages, reader navigation.
  2. `pnpm desktop:dev` — confirm Electron shell launches and routes render correctly.
  3. Exercise notifications (extension enable/disable, cache clearing) to verify Mantine toasts.
- Document manual steps in PR descriptions until a full E2E harness lands.

---

## Useful References

- Architecture: `docs/architecture/manga-slugs.md`, `docs/architecture/offline-storage.md`
- Reader implementation details: `docs/manga-reader.md` (see consolidation notes)
- Backend packages: `packages/catalog-service`, `packages/catalog-server`, `packages/offline-storage`

Keep this guide authoritative—update it whenever setup steps or workflows change.
