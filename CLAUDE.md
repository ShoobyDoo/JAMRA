# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JAMRA is a monorepo for an extensible manga reader with:
- **Extension-driven architecture**: Extensions provide manga sources via a standardized SDK
- **SQLite-backed catalog**: Persistent caching of manifests, catalogue items, chapters, and pages
- **HTTP API layer**: Catalog server exposing REST endpoints for the UI
- **Desktop shell**: Electron app self-hosting both API and Next.js UI
- **Web UI**: Next.js App Router frontend with Mantine components and Zustand state

### Page Specifications

- **Home Page (`/`)**: Netflix-style "Continue Reading" interface showing manga the user is currently reading with progress bars (calculated as read chapters / total chapters)
- **Discover Page (`/discover`)**: Browse and explore new manga from catalog extensions

## Development Commands

### Package Manager
Always use `pnpm` (never npm). Node 24.x is required.

### Common Workflows

**Web development** (run in separate terminals):
```bash
pnpm catalog-server:dev    # Start API on :4545
pnpm dev                    # Start Next.js on :3000
```

**Desktop development**:
```bash
pnpm desktop:dev            # Electron shell (starts API + Next internally)
```

**Build commands**:
```bash
pnpm backend:build          # Build backend packages (optimized parallel build, catalog-server always rebuilt)
pnpm build                  # Build all (backend + Next.js)
pnpm lint                   # Run ESLint (always run after code changes)
```

> **Note**: `backend:build` uses an optimized parallel build pipeline. The catalog-server package is ALWAYS rebuilt from scratch (cache cleared) to ensure it's never stale. See [docs/build-optimization.md](docs/build-optimization.md) for details.

**Extension testing**:
```bash
pnpm extension:demo         # CLI smoke test for extension pipeline
```

**SQLite management**:
```bash
pnpm sqlite:refresh [version]     # Rebuild SQLite bindings for Node version
pnpm sqlite:refresh --electron    # Rebuild for both Node + Electron
```

## Architecture

### Monorepo Structure
Packages build in dependency order:
1. `@jamra/extension-sdk` - Extension interface definitions
2. `@jamra/catalog-db` - SQLite persistence layer
3. `@jamra/extension-host` - Extension runtime loader
4. `@jamra/catalog-service` - Business logic for catalog operations
5. `@jamra/catalog-server` - HTTP API server
6. `@jamra/example-extension` - Sample extension implementation
7. `@jamra/extension-registry` - Marketplace/registry types

### Data Flow
1. **Extension → Host**: Extensions implement SDK interfaces, loaded by extension-host
2. **Host → Service**: Catalog service orchestrates extension calls + SQLite caching
3. **Service → Server**: HTTP server exposes catalog operations via REST API
4. **Server → UI**: Next.js frontend consumes API via `src/lib/api.ts`
5. **Electron Shell**: Runs catalog server + Next.js in single process

### Key Entry Points
- Web UI: `src/app` (Next.js App Router pages)
- API routes: `packages/catalog-server/src/server.ts`
- Desktop shell: `electron/main.cts`
- Extension SDK: `packages/extension-sdk/src/types.ts`
- Shared API client: `src/lib/api.ts`

### Environment Variables
- `JAMRA_API_PORT` - Override API port (default 4545)
- `JAMRA_NEXT_PORT` - Override Next.js port for Electron (default 3000)
- `JAMRA_EXTENSION_PATH` - Path to custom extension bundle
- `JAMRA_DISABLE_SQLITE` - Set to `1` to use in-memory cache instead of SQLite
- `JAMRA_DATA_DIR` - SQLite database directory (default `.jamra-data`)
- `NEXT_PUBLIC_JAMRA_API_URL` - Override API base URL for frontend

## SQLite Native Bindings

The catalog database uses `better-sqlite3` which requires native bindings:

1. **Automatic setup** - `pnpm install` rebuilds bindings for both Node 24 and Electron 38
2. **Automatic cleanup** - Postinstall removes conflicting bindings that cause ABI mismatch
3. **Just works** - `pnpm desktop:dev` automatically ensures Electron bindings are ready
4. **Advanced rebuild** - Use `pnpm sqlite:refresh --electron` for manual control
5. **Fallback** - Set `JAMRA_DISABLE_SQLITE=1` to skip persistence during development

**How it works:**
- `electron-builder install-app-deps` rebuilds native modules for Electron (ABI 139)
- `scripts/fix-sqlite-bindings.mjs` removes `build/` directory to force `lib/binding/` usage
- This prevents the common ABI mismatch error when starting Electron

**Troubleshooting:**
- If you get ABI errors, run `pnpm desktop:refresh` to reset bindings
- See [docs/sqlite-setup.md](docs/sqlite-setup.md) for platform-specific toolchain requirements

## Coding Conventions

- **TypeScript strict mode** - explicit prop types, no implicit `any`
- **Path alias** - use `@/` imports instead of relative paths for `src/`
- **Naming**: PascalCase components, camelCase variables/functions
- **Styling**: Tailwind utilities via design tokens in `tailwind.config.js`
- **State**: Zustand store at `src/store/ui.ts` for UI-only state
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `chore:`)

## Testing

No automated test suite is configured yet. Validate manually:
1. Run `pnpm lint` to catch TypeScript/ESLint errors
2. Test in `pnpm dev` (web) or `pnpm desktop:dev` (Electron)
3. Use `pnpm extension:demo` to validate extension pipeline
4. Document manual test steps in PR descriptions

## Extension Pipeline

Extensions provide manga sources by implementing SDK interfaces:
- `getCatalogue()` - fetch paginated manga listings
- `getMangaDetails()` - fetch manga metadata + chapters
- `getChapterPages()` - fetch page URLs for reading

The extension host loads extensions, catalog service caches results to SQLite, and the HTTP server exposes this data to the UI.

Build order for extension development:
```bash
pnpm --filter @jamra/extension-sdk build
pnpm --filter @jamra/extension-host build
pnpm --filter @jamra/example-extension build
pnpm extension:demo
```

See [docs/extension-pipeline.md](docs/extension-pipeline.md) for detailed smoke test workflow.