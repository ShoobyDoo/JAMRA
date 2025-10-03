# JAMRA Extension SDK

Contracts and helpers that third-party manga source extensions implement so the JAMRA catalog and reader can talk to them in a consistent way.

## Getting Started

```ts
import { type ExtensionModule } from "@jamra/extension-sdk";

const extension: ExtensionModule = {
  manifest: {
    id: "com.example.manga",
    name: "Example Manga",
    version: "0.1.0",
    author: { name: "Example" },
    languageCodes: ["en"],
    capabilities: { catalogue: true, chapters: true, pages: true },
  },
  handlers: {
    async catalogue(ctx, request) {
      ctx.logger.info("Fetching catalogue", { page: request.page });
      return { items: [], hasMore: false };
    },
  },
};

export default extension;
```

## Key Building Blocks

- **Manifests** describe who made the extension, which languages it supports, and which features it provides.
- **Handlers** respond to catalogue, manga-details, chapter-list, and page-image requests.
- **Context** exposes logging, HTTP helpers, cached storage, and runtime metadata so extensions can run safely inside the host process.
- **Filters and settings schemas** allow the host app to render user-configurable options without patching the extension.

## Next Steps

- [ ] Wire the SDK into the extension host loader and provide concrete `ExtensionContext` utilities.
- [ ] Publish an example extension that exercises the catalogue and chapters handlers.
- [ ] Extend the HTTP helper with retry/backoff helpers tailored to manga sources.
