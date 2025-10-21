# JAMRA Manga Reader

Extensible manga reader powered by a Next.js App Router frontend, a SQLite-backed catalog service, and an Electron desktop shell that bundles everything into a single experience.

## Highlights

- **Extension-first architecture** — `packages/extension-sdk` and `packages/extension-host` let external sources plug into the catalog.
- **Shared persistence** — `packages/catalog-db` stores manifests, chapters, and cached images via `better-sqlite3`.
- **Full-stack mono repo** — `packages/catalog-service` + `packages/catalog-server` expose the API that both the web app and Electron shell consume.
- **Rich UI** — Mantine UI, Zustand stores, and a featureful reader component under `src/components/reader`.

## Quick Start

```bash
# prerequisites: Node 24.x, pnpm 10+
pnpm install       # bootstrap workspace and rebuild native deps
pnpm dev           # runs catalog server + Next.js at http://localhost:3000
pnpm test          # execute unit tests (see test/)
pnpm lint          # lint + typecheck the repo
```

All compound workflows live behind `scripts/run.ts`; `pnpm dev` already spins up the API and web app together, so no extra terminals are required for standard development.

### Handy Commands

| Use case              | Command |
| --------------------- | ------- |
| Build backend only    | `pnpm backend:build` |
| Full production build | `pnpm build` |
| Serve production app  | `pnpm start` |
| Launch Electron shell | `pnpm desktop:dev` |
| Extension smoke test  | `pnpm extension:demo` |
| Bundle analysis       | `pnpm analyze` |

## Documentation

- [`docs/README.md`](docs/README.md) — documentation map and quick entry points.
- [`docs/development.md`](docs/development.md) — setup, workflows, and coding standards.
- [`docs/operations.md`](docs/operations.md) — build, packaging, and native module guidance.
- [`docs/manga-reader.md`](docs/manga-reader.md) — reader behaviour and roadmap.
- [`docs/features/library-and-history.md`](docs/features/library-and-history.md) — persistence for library, history, and reading progress.

## Repository Layout

- `src/` — Next.js App Router UI, Zustand stores, shared hooks.
- `packages/` — catalog database/service/server, offline-storage manager, extension tooling.
- `electron/` — Electron main process entry (`main.cts`) and build config.
- `scripts/` — orchestration utilities used by the `pnpm run` wrapper.
- `docs/` — architecture and operational guides.

## Environment Variables

| Variable | Purpose |
| -------- | ------- |
| `JAMRA_API_PORT` | Override catalog server port (default `4545`). |
| `JAMRA_NEXT_PORT` | Override Next.js port when launched by Electron (default `3000`). |
| `JAMRA_EXTENSION_PATH` | Load a custom extension bundle path. |
| `JAMRA_EXTENSION_ID` | Force a specific extension manifest id on boot. |
| `JAMRA_DISABLE_SQLITE` | Set to `1` to fall back to in-memory catalog storage. |
| `JAMRA_DATA_DIR` | Change the persistence directory (defaults to `.jamra-data`). |
| `NEXT_PUBLIC_JAMRA_API_URL` | Custom API base URL for the web client. |
| `NEXT_BUNDLE_ANALYZE` | Enable Next.js bundle analyzer (`pnpm analyze`). |

See the development guide for detailed setup instructions, SQLite rebuild tips, and coding standards.
