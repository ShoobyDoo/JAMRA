# JAMRA Documentation Map

Concise entry point for the project docs. Everything here is source-controlled;
update this index whenever a guide moves or new material lands.

## Day-to-day

- [`development.md`](./development.md) – environment setup, common commands, and
  coding standards.
- [`operations.md`](./operations.md) – build, packaging, scripting, and
  SQLite/native binding workflows.
- [`extension-pipeline.md`](./extension-pipeline.md) – smoke test for the
  extension SDK/host bridge.

## Architecture notes

- [`architecture/manga-slugs.md`](./architecture/manga-slugs.md) – friendly URL
  handling and slug resolution.
- [`architecture/lazy-page-loading.md`](./architecture/lazy-page-loading.md) –
  reader chunk-loading roadmap.
- [`architecture/offline-storage.md`](./architecture/offline-storage.md) –
  local download layout and queue model.

## Feature breakdowns

- [`features/library-and-history.md`](./features/library-and-history.md) – library,
  history, and reading-progress data flows.
- [`manga-reader.md`](./manga-reader.md) – reader capabilities, shortcuts, and
  outstanding work.
- [`performance-monitoring.md`](./performance-monitoring.md) – profiling hooks
  and bundle analysis tips.
- [`zustand-selectors.md`](./zustand-selectors.md) – store subscription patterns.

## Reference & archive

- [`../README.md`](../README.md) – quick start and workspace overview.
- [`../AGENTS.md`](../AGENTS.md) – automation-specific reminders.
- [`../audit/`](../audit) – targeted investigations; only `loading-cleanup/` is
  currently active.
- [`archive/`](./archive) – historical notes kept for posterity; prefer the
  files above unless you are chasing regressions.
