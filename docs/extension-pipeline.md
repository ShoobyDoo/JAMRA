# Extension Pipeline Smoke Test

Follow these steps to validate that the SDK, host, and sample extension all wire together:

1. **Build the workspace packages**

   ```bash
   pnpm --filter @jamra/extension-sdk build
   pnpm --filter @jamra/extension-host build
   pnpm --filter @jamra/example-extension build
   ```

2. **Start the API (optional during smoke test)**

   ```bash
   pnpm catalog-server:dev
   ```

   This runs on http://localhost:4545 and stores catalogue data in SQLite when available.

3. **Run the example loader script**

   ```bash
   pnpm extension:demo
   ```

4. **Expected output**
   The console logs should confirm the extension manifest was loaded and list catalogue items, manga details, chapter counts, and page counts returned from the mock handlers.

5. **SQLite prerequisites**
   - See [`docs/operations.md`](docs/operations.md#sqlite--native-bindings) for
     rebuild guidance. After switching Node versions, run `pnpm sqlite:refresh`
     (add `--electron` if you rebuilt the desktop shell) so the native addon is
     compiled for each runtime.
   - Set `JAMRA_DISABLE_SQLITE=1` to temporarily skip SQLite. The demo script
     detects the flag (or missing native module) and switches to the in-memory
     cache automatically.

6. **Next steps**
   - Swap `packages/example-extension` with a real source implementation.
   - Replace the in-memory cache provided by the host context with the SQLite-backed cache layer.
   - Integrate the host into the Electron main process so the renderer can access catalogue data via IPC.
