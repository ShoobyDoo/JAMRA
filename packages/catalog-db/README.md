# JAMRA Catalog DB

SQLite persistence layer for JAMRA’s catalogue metadata, chapter listings, page assets, and extension-scoped caches.

## Features

- Opens a WAL-enabled SQLite database located under `JAMRA_DATA_DIR` (defaults to `.jamra-data/catalog.sqlite`).
- Applies schema migrations on first run, creating tables for extensions, manga, chapters, pages, and cache entries.
- Provides helper methods to upsert manifests, catalogue summaries, chapters, and chapter-page payloads.

## Usage

```ts
import { CatalogDatabase, CatalogRepository } from "@jamra/catalog-db";

const db = new CatalogDatabase();
const repo = new CatalogRepository(db.db);

repo.upsertExtension(manifest);
repo.upsertMangaSummaries(manifest.id, catalogue.items);
```

Future work will wire this package into the extension host to back the runtime cache and long-term catalogue storage.
