# JAMRA Manga Reader

Monorepo powering the JAMRA manga reader with extension-driven content, a shared SQLite cache, HTTP APIs, and a desktop shell built with Electron.

## Stack Overview

- **Next.js App Router** for the UI (`src/app`).
- **Mantine** as the component library.
- **Zustand** for UI state (sidebar collapse, etc.).
- **Extension SDK/Host** (`packages/extension-sdk`, `packages/extension-host`) defining how data sources plug into the app.
- **SQLite catalog** (`packages/catalog-db`) storing manifests, catalogue items, chapters, and cached pages.
- **Catalog service & server** (`packages/catalog-service`, `packages/catalog-server`) exposing HTTP endpoints consumed by the UI and Electron shell.
- **Electron shell** (`electron/main.ts`) that self-hosts both the API and the Next.js app.

## Requirements

- Node.js 24.x (the Electron shell and native rebuild scripts target this runtime).
- pnpm 8.x or newer.
- For alternative Node releases, install a native build toolchain and follow [`docs/sqlite-setup.md`](docs/sqlite-setup.md) to rebuild SQLite bindings.

## Workspace Commands

```bash
pnpm install                 # bootstrap the monorepo
pnpm dev                     # start Next.js on http://localhost:3000 (requires API server running separately)
pnpm catalog-server:dev      # run the catalog API on http://localhost:4545
pnpm backend:build           # build all backend packages plus the example extension
pnpm desktop:dev             # launch the Electron shell (starts API + Next internally)
pnpm extension:demo          # run the CLI smoke test against the example extension
```

> **Tip:** For web development run `pnpm catalog-server:dev` in one terminal and `pnpm dev` in another so the UI can talk to the API.

## Environment Variables

| Variable                    | Purpose                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| `JAMRA_API_PORT`            | Override the HTTP port for the catalog server (default `4545`).              |
| `JAMRA_NEXT_PORT`           | Override the Next.js server port when launched by Electron (default `3000`). |
| `JAMRA_EXTENSION_PATH`      | Path to an extension bundle to load instead of the example extension.        |
| `JAMRA_EXTENSION_ID`        | Enforce an expected extension id during startup.                             |
| `JAMRA_DISABLE_SQLITE`      | Set to `1` to disable SQLite and use the in-memory cache.                    |
| `JAMRA_DATA_DIR`            | Directory for the SQLite database (defaults to `.jamra-data`).               |
| `NEXT_PUBLIC_JAMRA_API_URL` | Override the API base URL used by the Next.js frontend.                      |

SQLite build/setup instructions live in [`docs/sqlite-setup.md`](docs/sqlite-setup.md).

## Desktop Shell

`pnpm desktop:dev` starts the catalog server, spins up a Next.js instance inside Electron, and opens a BrowserWindow pointed at `http://localhost:3000`. The same API remains available on the configured port so you can still open the app in a regular browser if desired.

## HTTP API

The catalog server exposes:

- `GET /api/catalog?page=1&query=` — Fetch catalogue items (persists them to SQLite when available).
- `GET /api/manga/:id` — Fetch manga details and chapters.
- `GET /api/manga/:id/chapters/:chapterId/pages` — Fetch chapter page metadata.
- `GET /api/filters` — Retrieve extension-defined filters.
- `GET /api/health` — Health probe with the active extension id.

These endpoints back both the web UI (via `src/lib/api.ts`) and the Electron shell.

## Example Extension

The sample extension (`packages/example-extension`) returns static data for validation. Build it with:

```bash
pnpm --filter @jamra/example-extension build
```

The CLI smoke test (`pnpm extension:demo`) exercises the host/catalog service pipeline end-to-end.

---

For more details about the extension pipeline and SQLite setup, check:

- [`docs/extension-pipeline.md`](docs/extension-pipeline.md)
- [`docs/sqlite-setup.md`](docs/sqlite-setup.md)
