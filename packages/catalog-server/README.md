# JAMRA Catalog Server

Thin Express server that wires the extension host, catalog service, and persistence layer into HTTP endpoints consumable by the Next.js frontend or the Electron shell.

## Endpoints

- `GET /api/health` — status probe with the active extension id.
- `GET /api/catalog?page=1&query=` — fetches a catalogue page (and persists it).
- `GET /api/manga/:id` — returns manga details, optionally including chapters.
- `GET /api/manga/:id/chapters/:chapterId/pages` — resolves chapter pages and caches them.
- `GET /api/filters` — exposes extension-defined filters (if present).

## Usage

```ts
import { startCatalogServer } from "@jamra/catalog-server";

const { close } = await startCatalogServer({ port: 4545 });
// ... later
await close();
```

Set `JAMRA_EXTENSION_PATH` to load a different extension bundle, `JAMRA_DISABLE_SQLITE=1` to force the in-memory cache, and `JAMRA_API_PORT` to change the listening port.
