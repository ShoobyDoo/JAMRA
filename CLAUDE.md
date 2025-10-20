# CLAUDE.md

Guidance for Claude Code when operating in this repository.

---

## Quick Start

- Follow the canonical development guide at [`docs/development.md`](docs/development.md).
- Use Node 24.x + pnpm 10+, and run `pnpm dev` for the combined API + Next.js dev environment.
- Leverage the typed request helpers in `src/lib/api/` when hitting backend endpoints.

## Product Context

- **Home (`/`)** — surfaces “Continue Reading” cards sourced from the reading progress store/API.
- **Discover (`/discover`)** — catalog browsing via extension-powered filters.
- **Library (`/library`)** — favourites, status tracking, and tag management.
- **History (`/history`)** — timeline of read/library/download events with stats at `/history/stats`.
- **Reader (`/read/...`)** — multi-mode manga reader detailed in [`docs/manga-reader.md`](docs/manga-reader.md).

## Architecture Notes

- Mono repo structure: see `packages/` for catalog database/service/server, `src/` for Next.js UI, `electron/` for desktop shell.
- Extension pipeline overview lives in [`docs/extension-pipeline.md`](docs/extension-pipeline.md).
- Reading progress + chunk loading details: [`READING_PROGRESS_IMPLEMENTATION.md`](READING_PROGRESS_IMPLEMENTATION.md), [`docs/architecture/lazy-page-loading.md`](docs/architecture/lazy-page-loading.md).

Keep responses aligned with these docs, and update them if workflows or behaviours change as part of a contribution.
