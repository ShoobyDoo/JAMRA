# JAMRA Development Guide

Authoritative setup and workflow reference for contributors. Pair this guide
with the doc map in [`docs/README.md`](./README.md) when you need deeper context.

## Environment

- **Node.js 24.x** (required for web, API, and Electron targets)
- **pnpm 10+** (workspace manager; npm/yarn are unsupported)
- **C/C++ build tools** (only for rebuilding native `better-sqlite3` bindings)
- Nice to have: `jq` for scripts, Chrome/Edge for smoke tests

```bash
node -v
pnpm -v
```

## Install & First Run

```bash
pnpm install   # bootstraps packages, fixes native bindings
pnpm dev       # catalog server + Next.js at http://localhost:3000
```

`pnpm dev` delegates to the run harness, which builds backend packages, starts
the API (port `4545`), and launches Next.js in dev mode. No extra terminals
needed for standard UI work.

## Everyday Commands

| Workflow | Command | When to use |
| --- | --- | --- |
| Lint & types | `pnpm lint` | Run before pushing to keep CI green. |
| Unit tests | `pnpm test` | Executes suites under `test/`. |
| Backend rebuild | `pnpm backend:build` | Rebuild packages after touching shared logic. |
| Production build | `pnpm build` | Prepares optimized bundles for deployment. |
| Serve prod bundle | `pnpm start` | Runs the build output locally. |
| Bundle analysis | `pnpm analyze` | Opens `analyze/` reports when tuning bundles. |

More operational detail—including packaging and native module notes—lives in
[`docs/operations.md`](./operations.md).

## Desktop/Electron

```bash
pnpm desktop:dev      # refresh native deps + launch shell
pnpm desktop:refresh  # same prep without starting Electron
pnpm dist             # package for the current platform
```

The desktop runner bundles the same API as the web app, so browser devtools may
connect while the Electron window is open.

## SQLite & Native Modules

- Postinstall scripts rebuild `better-sqlite3` for Node 24 and Electron 38.
- Run `pnpm sqlite:refresh [--electron]` if you change Node versions or bump
  Electron headers.
- Set `JAMRA_DISABLE_SQLITE=1` for quick in-memory runs; unset once toolchains
  are ready and rebuild to restore persistence.
- Troubleshooting tips are collected in [`docs/operations.md`](./operations.md).

## Coding Standards

- TypeScript strict mode everywhere; define component props and Zustand slices
  explicitly.
- Use the `@/` alias when importing from `src/`; avoid deep relative paths.
- PascalCase components, camelCase functions/variables, kebab-case only when
  mirroring route segments.
- Tailwind utilities should come from tokens in `tailwind.config.ts`; move
  shared combinations into `src/components/ui`.
- Prefer selector-based store access—see `docs/zustand-selectors.md`.

## Testing & QA

- `pnpm test` runs the unit suites. Co-locate new tests beside the source they
  exercise.
- Manual smoke checks:
  - `pnpm dev` – browse catalog, open manga detail pages, confirm reader
    navigation.
  - `pnpm desktop:dev` – ensure Electron starts and routes render.
  - Trigger notifications (enabling extensions, clearing cache) to verify toast
    flows.
- Document bespoke manual steps in PRs until an automated E2E harness ships.

## Useful References

- Architecture: `docs/architecture/manga-slugs.md`,
  `docs/architecture/offline-storage.md`
- Reader specifics: `docs/manga-reader.md`
- Operations & release: `docs/operations.md`
- Native bindings: `docs/operations.md#sqlite--native-bindings`

Keep this guide authoritative—update it whenever workflows change.
