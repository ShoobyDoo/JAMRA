# Repository Guidelines

For authoritative setup, workflow, and coding standards, see [`docs/development.md`](docs/development.md).

Quick reminders for automation agents:

- Use `pnpm` (never npm/yarn) and target Node 24.x.
- `pnpm dev` already launches both the catalog server and Next.js — no extra processes needed.
- Prefer the typed API helpers in `src/lib/api/` instead of ad-hoc fetches.
- Follow the existing alias structure (`@/`) and strict TypeScript conventions.
- Coordinate updates to docs when workflows change; this file is intentionally concise to avoid drift.
