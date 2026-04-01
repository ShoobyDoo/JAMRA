# JAMRA Extension Development Guide

Complete guide for developing manga source extensions for JAMRA.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Extension Structure](#extension-structure)
- [Development Workflow](#development-workflow)
- [Extension Contract](#extension-contract)
- [Extension SDK](#extension-sdk)
- [Manifest Reference](#manifest-reference)
- [Settings & Configuration](#settings--configuration)
- [Testing & Validation](#testing--validation)
- [Best Practices](#best-practices)
- [Publishing](#publishing)
- [Troubleshooting](#troubleshooting)

---

## Overview

JAMRA extensions are TypeScript or JavaScript modules that enable the app to fetch manga from different sources. Extensions run in a sandboxed Node.js environment with access to HTTP clients, logging, and user settings.

### Key Features

- **TypeScript or JavaScript**: Choose your preferred language
- **Hot Reload**: Instant updates during development
- **Sandboxed Runtime**: Secure execution with limited API access
- **Comprehensive SDK**: Helper utilities for common tasks
- **Type Safety**: Full TypeScript support with IntelliSense
- **Local Development**: Extensions never bundled with production builds

---

## Quick Start

### 1. Create a New Extension

```bash
pnpm create-extension my-manga-source
```

Follow the prompts:
- Choose TypeScript (recommended) or JavaScript
- Extension will be created in `resources/extensions/my-manga-source/`

### 2. Edit the Extension

Open `resources/extensions/my-manga-source/src/index.ts` (or `.js`) and implement the required methods.

### 3. Test Your Extension

```bash
pnpm dev
```

The app will auto-detect and hot-reload your extension.

### 4. Validate Your Extension

```bash
pnpm test:extensions
```

This validates manifest, code structure, and compilation.

---

## Extension Structure

After scaffolding, your extension will have this structure:

```
resources/extensions/my-manga-source/
├── manifest.json          # Extension metadata
├── package.json           # Dependencies
├── src/
│   └── index.ts           # Main entry point
├── tsconfig.json          # TypeScript config (TS only)
└── .gitignore
```

### Optional Files

You can add:
- `src/client.ts` - HTTP client and scraping logic
- `src/lib/` - Helper utilities
- `assets/icon.png` - Extension icon
- Additional TypeScript files as needed

---

## Development Workflow

### 1. Create Extension

```bash
pnpm create-extension my-source
```

### 2. Implement Required Methods

Edit `src/index.ts` or `src/index.js`:

```typescript
import type { ExtensionModule } from '@jamra/extension-sdk';

const extension: ExtensionModule = {
  async search(payload, context) {
    // Implement search
  },

  async getMangaDetails(payload, context) {
    // Implement manga details
  },

  async getChapters(payload, context) {
    // Implement chapters list
  },

  async getPages(payload, context) {
    // Implement pages/images
  },
};

export default extension;
```

### 3. Run Development Server

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Extensions hot-reload on file changes

### 4. Test in App

Use the JAMRA UI to search, browse, and read from your extension.

### 5. Validate

```bash
pnpm test:extensions
```

Validates:
- Manifest schema
- Code compilation
- Required exports
- SDK usage

---

## Extension Contract

Every extension must export a default object implementing `ExtensionModule`.

### Required Methods

#### `search(payload, context)`

Search for manga by query and filters.

```typescript
async search(
  payload: MangaSearchPayload,
  context: ExtensionContext
): Promise<MangaSearchResult> {
  const { query, filters } = payload;

  // Fetch search results from source
  const results = await fetchSearchResults(query, filters);

  return {
    items: results.map(item => ({
      id: item.id,
      title: item.title,
      coverUrl: item.coverUrl,
      // ... other fields
    })),
    hasNextPage: results.hasMore,
    nextCursor: results.nextPageToken,
  };
}
```

**Payload:**
- `query: string` - Search query
- `filters: object` - Optional filters (language, status, tags, etc.)
- `cursor?: string` - Pagination cursor

**Response:**
- `items: Manga[]` - Array of manga items
- `hasNextPage: boolean` - Whether more results exist
- `nextCursor?: string` - Cursor for next page

---

#### `getMangaDetails(payload, context)`

Get detailed information about a specific manga.

```typescript
async getMangaDetails(
  payload: MangaDetailsPayload,
  context: ExtensionContext
): Promise<MangaDetailsResult> {
  const { mangaId } = payload;

  // Fetch manga details from source
  const details = await fetchMangaDetails(mangaId);

  return {
    id: details.id,
    title: details.title,
    description: details.description,
    coverUrl: details.coverUrl,
    authors: details.authors,
    artists: details.artists,
    status: details.status,
    tags: details.tags,
    // ... other fields
  };
}
```

**Payload:**
- `mangaId: string` - Manga identifier

**Response:**
- Full manga details including metadata, description, tags, etc.

---

#### `getChapters(payload, context)`

Get list of chapters for a manga.

```typescript
async getChapters(
  payload: ChaptersPayload,
  context: ExtensionContext
): Promise<Chapter[]> {
  const { mangaId } = payload;

  // Fetch chapters from source
  const chapters = await fetchChapters(mangaId);

  return chapters.map(ch => ({
    id: ch.id,
    mangaId: mangaId,
    title: ch.title,
    chapterNumber: ch.number,
    volumeNumber: ch.volume,
    publishedAt: ch.date,
    language: ch.language,
  }));
}
```

**Payload:**
- `mangaId: string` - Manga identifier

**Response:**
- `Chapter[]` - Array of chapters

---

#### `getPages(payload, context)`

Get pages/images for a chapter.

```typescript
async getPages(
  payload: PagesPayload,
  context: ExtensionContext
): Promise<PagesResult> {
  const { mangaId, chapterId } = payload;

  // Fetch page URLs from source
  const pages = await fetchPages(mangaId, chapterId);

  return {
    pages: pages.map((url, index) => ({
      index: index,
      url: url,
    })),
  };
}
```

**Payload:**
- `mangaId: string` - Manga identifier
- `chapterId: string` - Chapter identifier

**Response:**
- `pages: Page[]` - Array of page objects with index and URL

---

### Optional Lifecycle Methods

#### `init(context)`

Called once when extension is first loaded.

```typescript
async init(context: ExtensionContext): Promise<void> {
  context.logger.info('Extension initialized');
  // Setup code here
}
```

#### `dispose(context)`

Called when extension is unloaded (hot reload, app shutdown).

```typescript
async dispose(context: ExtensionContext): Promise<void> {
  context.logger.info('Extension disposed');
  // Cleanup code here
}
```

---

## Extension SDK

The `@jamra/extension-sdk` provides utilities and types for extension development.

### Extension Context

Every method receives a `context` object:

```typescript
interface ExtensionContext {
  settings: ExtensionSettingsValues;
  http: HttpClient;
  logger: Logger;
}
```

#### `context.settings`

User-configurable settings for your extension.

```typescript
const cdnHost = context.settings['image.cdnHost'] || 'default.cdn.com';
```

#### `context.http`

HTTP client with host allowlist.

```typescript
const response = await context.http.get<SearchResponse>(
  'https://api.mangasource.com/search',
  {
    params: { q: query },
    headers: { 'User-Agent': 'JAMRA/1.0' },
  }
);
```

#### `context.logger`

Structured logging.

```typescript
context.logger.info('Fetching manga details', { mangaId });
context.logger.warn('Rate limit approaching', { remaining: 10 });
context.logger.error('Failed to fetch', { error: err.message });
context.logger.debug('Debug info', { data });
```

---

### SDK Helpers

#### Search Controller

Normalizes search filters and query.

```typescript
import { createSearchController } from '@jamra/extension-sdk';

const controller = createSearchController(payload);
const { query, filters } = controller.getSearchParams();
```

#### Settings Binder

Type-safe settings access.

```typescript
import { SettingsBinder } from '@jamra/extension-sdk';

const settings = new SettingsBinder(context.settings);
const cdnHost = settings.getString('image.cdnHost', 'default.cdn.com');
const maxRetries = settings.getNumber('http.maxRetries', 3);
```

#### HTML Scraper Client

HTML fetching with Cheerio integration.

```typescript
import { HtmlScraperClient } from '@jamra/extension-sdk';

const client = new HtmlScraperClient(context);
const $ = await client.fetchHtml('https://mangasource.com/manga/123');

const title = $('h1.title').text();
const coverUrl = $('img.cover').attr('src');
```

#### Cheerio Extractor

Declarative DOM extraction.

```typescript
import { CheerioExtractor } from '@jamra/extension-sdk';

const extractor = new CheerioExtractor($);
const manga = extractor.extract({
  title: 'h1.title',
  description: 'div.description',
  coverUrl: { selector: 'img.cover', attr: 'src' },
  tags: { selector: 'a.tag', multiple: true, attr: 'text' },
});
```

#### Chapter List Builder

Constructs chapter arrays with normalization.

```typescript
import { ChapterListBuilder } from '@jamra/extension-sdk';

const builder = new ChapterListBuilder(mangaId);
chapters.forEach(ch => {
  builder.addChapter({
    id: ch.id,
    title: ch.title,
    number: ch.number,
    volume: ch.volume,
    publishedAt: ch.date,
  });
});

return builder.build();
```

#### Utilities

```typescript
import {
  toAbsoluteUrl,
  normalizeStatusValue,
  extractChapterNumber,
} from '@jamra/extension-sdk';

const fullUrl = toAbsoluteUrl('https://base.com', '/path/to/image.jpg');
const status = normalizeStatusValue('Ongoing'); // 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
const chapterNum = extractChapterNumber('Chapter 123.5'); // 123.5
```

---

## Manifest Reference

The `manifest.json` defines extension metadata and capabilities.

### Example

```json
{
  "id": "my-manga-source",
  "name": "My Manga Source",
  "version": "1.0.0",
  "language": "en",
  "entry": "src/index.ts",
  "capabilities": {
    "filters": {
      "language": true,
      "contentRating": false,
      "status": true,
      "includeTags": true,
      "excludeTags": true
    }
  },
  "settingsSchema": {
    "version": 1,
    "fields": [
      {
        "key": "image.cdnHost",
        "label": "Image CDN Host",
        "type": "string",
        "default": "cdn.example.com",
        "description": "CDN host for loading images"
      }
    ]
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique extension identifier (lowercase, alphanumeric + hyphens) |
| `name` | string | Display name |
| `version` | string | Semver version (e.g., "1.0.0") |
| `language` | string | Language code (e.g., "en", "ja") |
| `entry` | string | Path to entry file (e.g., "src/index.ts") |

### Optional Fields

#### `capabilities.filters`

Declares which search filters the extension supports.

```json
{
  "capabilities": {
    "filters": {
      "language": true,        // Language filter
      "contentRating": false,  // Content rating filter
      "status": true,          // Publication status filter
      "includeTags": true,     // Include tags filter
      "excludeTags": true      // Exclude tags filter
    }
  }
}
```

#### `settingsSchema`

Defines user-configurable settings.

```json
{
  "settingsSchema": {
    "version": 1,
    "fields": [
      {
        "key": "setting.key",
        "label": "Setting Label",
        "type": "string",
        "default": "default value",
        "description": "Setting description"
      }
    ]
  }
}
```

**Field Types:**
- `string` - Text input
- `number` - Numeric input
- `boolean` - Checkbox
- `select` - Dropdown (requires `options` array)

---

## Settings & Configuration

Extensions can define user-configurable settings via `settingsSchema` in the manifest.

### Define Settings

```json
{
  "settingsSchema": {
    "version": 1,
    "fields": [
      {
        "key": "image.quality",
        "label": "Image Quality",
        "type": "select",
        "default": "high",
        "options": [
          { "value": "low", "label": "Low" },
          { "value": "medium", "label": "Medium" },
          { "value": "high", "label": "High" }
        ]
      },
      {
        "key": "http.useProxy",
        "label": "Use Proxy",
        "type": "boolean",
        "default": false
      }
    ]
  }
}
```

### Access Settings

```typescript
const quality = context.settings['image.quality'] || 'high';
const useProxy = context.settings['http.useProxy'] === true;
```

### Settings Lifecycle

#### `getSettings(current, context)`

Optional method to dynamically generate settings schema.

```typescript
async getSettings(
  current: ExtensionSettingsValues,
  context: ExtensionContext
): Promise<ExtensionSettingsSchema | null> {
  // Return dynamic schema based on current settings
  return {
    version: 1,
    fields: [...],
  };
}
```

#### `onSettingsChange(next, context)`

Optional method called when user updates settings.

```typescript
async onSettingsChange(
  next: ExtensionSettingsValues,
  context: ExtensionContext
): Promise<void> {
  context.logger.info('Settings updated', { next });
  // React to settings changes
}
```

---

## Testing & Validation

### Manual Testing

Run the development server and test via the UI:

```bash
pnpm dev
```

1. Open the app
2. Search for manga using your extension
3. View manga details
4. Browse chapters
5. Read pages

### Automated Validation

Validate manifest, code, and exports:

```bash
pnpm test:extensions
```

This checks:
- ✅ Manifest schema validity
- ✅ Required fields present
- ✅ Entry file exists
- ✅ Code compiles successfully
- ✅ Required methods exported
- ✅ SDK dependency installed
- ✅ TypeScript config (if applicable)

### HTTP Testing

Test API endpoints directly:

```bash
# Search
curl "http://localhost:3000/api/extensions/my-source/search?query=naruto"

# Manga details
curl "http://localhost:3000/api/extensions/my-source/manga/123"

# Chapters
curl "http://localhost:3000/api/extensions/my-source/manga/123/chapters"

# Pages
curl "http://localhost:3000/api/extensions/my-source/manga/123/chapters/456/pages"
```

---

## Best Practices

### Code Organization

```
src/
├── index.ts              # Main entry point (exports ExtensionModule)
├── client.ts             # HTTP client and scraping logic
├── mappers.ts            # Data transformation functions
├── lib/
│   ├── parser.ts         # HTML parsing utilities
│   └── normalizer.ts     # Data normalization
└── types.ts              # Custom TypeScript types
```

### Error Handling

Always handle errors gracefully:

```typescript
async search(payload, context) {
  try {
    const results = await fetchResults(payload.query);
    return { items: results, hasNextPage: false };
  } catch (error) {
    context.logger.error('Search failed', {
      query: payload.query,
      error: error.message,
    });
    throw new Error(`Search failed: ${error.message}`);
  }
}
```

### Logging

Use structured logging for debugging:

```typescript
context.logger.info('Fetching manga details', {
  mangaId: payload.mangaId,
  source: 'mangasource.com',
});

context.logger.debug('Raw API response', {
  mangaId: payload.mangaId,
  response: rawData,
});
```

### Performance

- **Cache responses** when appropriate
- **Batch requests** to reduce API calls
- **Use pagination** for large result sets
- **Lazy load** images and metadata

### Security

- **Validate input** from API responses
- **Sanitize URLs** before fetching
- **Never execute** untrusted code
- **Respect rate limits** of source APIs

### Type Safety (TypeScript)

```typescript
import type {
  ExtensionModule,
  MangaSearchPayload,
  MangaSearchResult,
} from '@jamra/extension-sdk';

interface SourceApiResponse {
  data: {
    id: string;
    title: string;
    // ...
  }[];
}

const extension: ExtensionModule = {
  async search(
    payload: MangaSearchPayload,
    context
  ): Promise<MangaSearchResult> {
    const response = await context.http.get<SourceApiResponse>('/api/search');
    // TypeScript validates response structure
  },
};
```

---

## Publishing

### Before Publishing

1. **Validate**: `pnpm test:extensions`
2. **Test thoroughly** in the app
3. **Document** any special requirements
4. **Add examples** of search queries, manga IDs

### Publication Process

Extensions are **NOT** bundled with JAMRA. To publish:

1. **Create a repository** for your extension(s)
2. **Copy your extension** directory structure
3. **Create a PR** to the community extensions repository
4. **Document** installation instructions for users

### Publishing Checklist

- [ ] Extension validated with `pnpm test:extensions`
- [ ] Tested search, details, chapters, pages
- [ ] Manifest complete with accurate metadata
- [ ] README included with usage instructions
- [ ] Examples provided
- [ ] License file included
- [ ] No hardcoded credentials or secrets

---

## Troubleshooting

### Extension Not Detected

**Problem**: Extension doesn't appear in the app.

**Solutions**:
- Check `manifest.json` is valid JSON
- Ensure `manifest.id` matches directory name
- Verify extension is in `resources/extensions/`
- Restart dev server (`pnpm dev`)

---

### Compilation Errors

**Problem**: TypeScript/JavaScript compilation fails.

**Solutions**:
- Run `pnpm test:extensions` to see errors
- Check syntax errors in `src/index.ts`
- Ensure `@jamra/extension-sdk` is installed
- Verify `tsconfig.json` is valid (TS only)

---

### Hot Reload Not Working

**Problem**: Changes don't reflect in the app.

**Solutions**:
- Check file watcher is enabled
- Ensure dev server is running
- Look for errors in terminal output
- Try manual refresh in app

---

### HTTP Requests Failing

**Problem**: `context.http.get()` throws errors.

**Solutions**:
- Verify URL is accessible
- Check network connectivity
- Look for CORS issues
- Ensure host is allowed (check logs)
- Verify API response format matches types

---

### Settings Not Appearing

**Problem**: Settings UI doesn't show configured fields.

**Solutions**:
- Validate `settingsSchema` JSON structure
- Ensure `version` is set to `1`
- Check field types are valid
- Verify `key` naming convention

---

## Examples

### Complete TypeScript Extension

```typescript
import type {
  ExtensionModule,
  ExtensionContext,
  MangaSearchPayload,
  MangaSearchResult,
} from '@jamra/extension-sdk';
import { HtmlScraperClient, toAbsoluteUrl } from '@jamra/extension-sdk';

const BASE_URL = 'https://mangasource.com';

const extension: ExtensionModule = {
  async search(
    payload: MangaSearchPayload,
    context: ExtensionContext
  ): Promise<MangaSearchResult> {
    const scraper = new HtmlScraperClient(context);
    const $ = await scraper.fetchHtml(
      `${BASE_URL}/search?q=${encodeURIComponent(payload.query)}`
    );

    const items = $('.manga-card')
      .map((i, el) => ({
        id: $(el).attr('data-id') || '',
        title: $(el).find('.title').text(),
        coverUrl: toAbsoluteUrl(BASE_URL, $(el).find('img').attr('src') || ''),
      }))
      .get();

    return {
      items,
      hasNextPage: $('.next-page').length > 0,
    };
  },

  async getMangaDetails(payload, context) {
    const scraper = new HtmlScraperClient(context);
    const $ = await scraper.fetchHtml(`${BASE_URL}/manga/${payload.mangaId}`);

    return {
      id: payload.mangaId,
      title: $('h1.title').text(),
      description: $('.description').text(),
      coverUrl: toAbsoluteUrl(BASE_URL, $('img.cover').attr('src') || ''),
      authors: $('.author')
        .map((i, el) => $(el).text())
        .get(),
      status: 'ongoing',
      tags: $('.tag')
        .map((i, el) => $(el).text())
        .get(),
    };
  },

  async getChapters(payload, context) {
    const scraper = new HtmlScraperClient(context);
    const $ = await scraper.fetchHtml(
      `${BASE_URL}/manga/${payload.mangaId}/chapters`
    );

    return $('.chapter-item')
      .map((i, el) => ({
        id: $(el).attr('data-id') || '',
        mangaId: payload.mangaId,
        title: $(el).find('.chapter-title').text(),
        chapterNumber: parseFloat($(el).attr('data-number') || '0'),
        publishedAt: $(el).find('.date').text(),
        language: 'en',
      }))
      .get();
  },

  async getPages(payload, context) {
    const scraper = new HtmlScraperClient(context);
    const $ = await scraper.fetchHtml(
      `${BASE_URL}/read/${payload.mangaId}/${payload.chapterId}`
    );

    const pages = $('img.page')
      .map((i, el) => ({
        index: i,
        url: toAbsoluteUrl(BASE_URL, $(el).attr('src') || ''),
      }))
      .get();

    return { pages };
  },
};

export default extension;
```

### Complete JavaScript Extension

```javascript
import { HtmlScraperClient, toAbsoluteUrl } from '@jamra/extension-sdk';

const BASE_URL = 'https://mangasource.com';

/**
 * @param {import('@jamra/extension-sdk').MangaSearchPayload} payload
 * @param {import('@jamra/extension-sdk').ExtensionContext} context
 * @returns {Promise<import('@jamra/extension-sdk').MangaSearchResult>}
 */
async function search(payload, context) {
  const scraper = new HtmlScraperClient(context);
  const $ = await scraper.fetchHtml(
    `${BASE_URL}/search?q=${encodeURIComponent(payload.query)}`
  );

  const items = $('.manga-card')
    .map((i, el) => ({
      id: $(el).attr('data-id') || '',
      title: $(el).find('.title').text(),
      coverUrl: toAbsoluteUrl(BASE_URL, $(el).find('img').attr('src') || ''),
    }))
    .get();

  return {
    items,
    hasNextPage: $('.next-page').length > 0,
  };
}

// ... other methods

const extension = {
  search,
  getMangaDetails,
  getChapters,
  getPages,
};

export default extension;
```

---

## Additional Resources

- **SDK Reference**: [packages/extension-sdk/README.md](../packages/extension-sdk/README.md)
- **Quick Start**: [resources/extensions/README.md](../resources/extensions/README.md)
- **Contracts**: [packages/contracts/src/extension-sdk.ts](../packages/contracts/src/extension-sdk.ts)
- **Example Extensions**: Check community repositories

---

## Support

- **Issues**: Open an issue in the JAMRA repository
- **Discussions**: Join the community discussions
- **Examples**: Review existing extensions for reference

---

**Happy Extension Development! 🚀**
