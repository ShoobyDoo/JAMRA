# JAMRA Extension Host

Runtime helpers for loading, validating, and executing JAMRA extensions from Node/Electron environments.

## Quick Start

```ts
import { ExtensionHost } from "@jamra/extension-host";

const host = new ExtensionHost();
await host.loadFromFile("/path/to/extension.mjs");

const manifest = host.listManifests()[0];
const catalogue = await host.invokeCatalogue(manifest.id, { page: 1 });
console.log(catalogue.items);
```

## Responsibilities

- Dynamically imports extension bundles and validates their manifests.
- Provides shared context objects (logger, cache, HTTP client, runtime metadata).
- Exposes convenience methods to call catalogue, search, manga details, chapters, pages, filters, and settings handlers.
- Manages lifecycle hooks (`onInitialize`, `onShutdown`) to keep extensions tidy.

## Roadmap

- [ ] Swap the in-memory cache for the SQLite-backed cache layer.
- [ ] Allow host-wide middleware (rate limiting, retries) around handler invocations.
- [ ] Surface structured diagnostics when an extension throws during execution.
