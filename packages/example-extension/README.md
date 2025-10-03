# Example JAMRA Extension

A minimal extension that exercises catalogue, search, manga details, chapters, and page handlers with static data. Useful for smoke testing the extension host before wiring in real sources.

```
pnpm --filter @jamra/example-extension build
```

After building, load the emitted bundle using `@jamra/extension-host`.
