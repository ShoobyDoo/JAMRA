# Performance Monitoring & Profiling

JAMRA ships with lightweight instrumentation that helps flag expensive renders and inspect bundle weight. This document explains what's available and how to use it during development.

---

## Runtime Component Timing

### `usePerformanceMonitor`

- Location: `src/hooks/use-performance-monitor.ts`
- Opt-in hook that logs initial paint and total lifetime for a component.
- Logs are routed through `src/lib/logger.ts` so they follow existing log level controls.

```tsx
import { usePerformanceMonitor } from "@/hooks/use-performance-monitor";

export function DownloadsPage() {
  usePerformanceMonitor("DownloadsPage", { detail: { initialTab: "active" } });
  // …
}
```

**Log output example**

```
debug: Component paint {
  component: "MangaReader",
  durationMs: 42.5,
  mangaId: "one-piece",
  chapterId: "123"
}
```

Use this sparingly in hot paths (reader, downloads, marketplace). Remove or guard behind development toggles before shipping.

### Memoisation Guidelines

- Memoise heavy computation with `useMemo` (e.g. chapter navigation).
- Stabilise event handlers with `useCallback` when passing deep into component trees.
- Prefer `React.memo` for pure presentational components (`extensions` cards, downloads queue/history).

Reference: `docs/zustand-selectors.md` for store selector best practices.

---

## Bundle Analysis

### Tooling

- `@next/bundle-analyzer` is configured via `next.config.ts`.
- Use `pnpm analyze` to build with analyzer enabled.

```bash
NEXT_BUNDLE_ANALYZE=1 pnpm build   # equivalent to `pnpm analyze`
```

This emits `analyze/client.html` and `analyze/server.html` (Next.js default paths). Open them in a browser to inspect bundle size, DLL composition, and module duplication.

### Best Practices

- Prefer lazy loading (`next/dynamic`) for heavyweight routes or rarely used panels.
- Keep an eye on Mantine imports: the project uses `experimental.optimizePackageImports` to reduce bundle size, but new third-party dependencies should be evaluated.
- When adding stateful hooks/components, ensure memoisation to avoid cascading re-renders.

---

## Testing & CI Hooks

- Unit tests live under `test/` and run via `pnpm test`. These include readers, slug utilities, reading history, and downloads logic.
- Add high-value tests when refactoring hot code paths to prevent regressions.

Consider adding automated performance budgets (e.g. with Lighthouse CI) in future roadmap efforts.
