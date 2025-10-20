# Build Pipeline Optimization

## Summary

Optimized the backend build pipeline to ensure catalog-server is always rebuilt fresh and reduced total build time through parallelization.

## Changes Made

### 1. Force Rebuild of catalog-server

Added `forceBuildPackage()` function that:

- Deletes `tsconfig.tsbuildinfo` (TypeScript incremental cache)
- Deletes `dist/` folder
- Rebuilds from scratch

This ensures the catalog-server is ALWAYS up-to-date, preventing stale builds from causing runtime issues.

### 2. Parallel Build Phases

Reorganized build pipeline into 6 phases based on dependency graph:

**Phase 1** (Parallel): Foundation packages with no internal dependencies

- `@jamra/extension-sdk`
- `@jamra/extension-registry`

**Phase 2** (Parallel): Packages depending on Phase 1

- `@jamra/catalog-db`
- `@jamra/extension-host`

**Phase 3** (Sequential): Catalog service

- `@jamra/catalog-service` (depends on extension-host)

**Phase 4** (Sequential): Offline storage

- `@jamra/offline-storage` (depends on catalog-service)

**Phase 5** (Force Rebuild): Catalog server

- `@jamra/catalog-server` (ALWAYS rebuilt from scratch)

**Phase 6** (Parallel): Extensions

- `@jamra/example-extension`
- `@jamra/weebcentral-extension`

### 3. Added offline-storage to PACKAGE_ORDER

Previously missing from the sequential build order used by `pnpm run packages <script>`.

## Performance Impact

- **CPU Usage**: ~178% (parallel execution working)
- **Build Time**: ~8 seconds for full backend rebuild
- **Reliability**: 100% - catalog-server always fresh

## Trade-offs

- Adds ~1-2 seconds to build time due to forced catalog-server rebuild
- Worth it for guaranteed correctness - prevents subtle bugs from stale builds
- Parallel phases offset the cost elsewhere

## Testing

Verified with:

```bash
# Full backend build
pnpm backend:build

# Dev server startup (includes backend build)
pnpm catalog-server:dev

# API endpoint test
curl "http://localhost:4545/api/manga/Omniscient-Readers-Viewpoint?includeChapters=true&extensionId=com.weebcentral.manga"
```

All tests pass with correct behavior.
