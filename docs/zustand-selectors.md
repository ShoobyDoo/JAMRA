# Zustand Selector Patterns

JAMRA keeps UI state in colocated Zustand stores (e.g. `useUIStore`, `useSettingsStore`).  
To avoid unnecessary re-renders in large components, prefer **selector functions** instead of reading the entire store.

## Why selectors?

- Components only re-render when the selected slice changes.
- Memoised selectors keep renders predictable inside frequently updated views (sidebar, downloads toast, reader overlays).
- It makes dependencies explicit and easier to refactor.

## Quick examples

```tsx
// ✅ Good – reader layout only re-renders when collapsed changes
const collapsed = useUIStore((state) => state.collapsed);
const sidebarWidth = useUIStore((state) => state.sidebarWidth);

// ❌ Avoid – subscribes to the whole store object
// const { collapsed, sidebarWidth } = useUIStore();
```

```tsx
// ✅ Combine state and actions with separate selectors
const sidebarWidth = useUIStore((state) => state.sidebarWidth);
const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
```

```tsx
// ✅ Selecting derived booleans keeps components simple
const hasActiveDownloads = useDownloadStore(
  (state) => state.queue.length > 0,
);
```

## Guidelines

1. **Use inline selectors** (`(state) => state.slice`) for simple fields.  
2. **Extract reusable selectors** when the same slice is consumed in multiple files.
3. **Memoise derived values inside the store** when they are used by many subscribers.
4. Avoid destructuring the entire store (`const { … } = useStore()`), unless you are inside a tiny component that will not re-render frequently.

See `src/components/nav/sidebar.tsx`, `src/components/downloads/global-download-status.tsx`, and `src/app/(app)/(account)/settings/page.tsx` for concrete selector usage.
