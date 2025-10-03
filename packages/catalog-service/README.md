# JAMRA Catalog Service

High-level orchestration layer that coordinates extensions via the `ExtensionHost`, persists catalogue data into the SQLite store provided by `@jamra/catalog-db`, and exposes simple sync helpers.

## Usage

```ts
import { CatalogDatabase } from "@jamra/catalog-db";
import { ExtensionHost } from "@jamra/extension-host";
import { CatalogService } from "@jamra/catalog-service";

const database = new CatalogDatabase();
const host = new ExtensionHost({ database });
const service = new CatalogService(host, { database });

await host.loadFromFile("/path/to/extension.mjs");
await service.syncCatalogue("com.example", { pageLimit: 2 });
```

## Responsibilities

- Fetch catalogue pages, manga details, chapters, and chapter pages from loaded extensions.
- Persist the resulting records into SQLite via the catalog repository utilities.
- Maintain sync timestamps to support incremental refresh strategies.
- Surface extension filters so UI layers can render user-configurable controls.

A follow-up milestone will expose job queues, conflict resolution, and renderer-friendly querying APIs.
