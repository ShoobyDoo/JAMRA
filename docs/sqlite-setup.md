# SQLite Setup

`@jamra/catalog-db` relies on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), which ships native bindings. Follow these steps to keep the persistent cache working across platforms:

1. **Preferred runtime** – install Node 22.x (current target for the JAMRA workspace and Electron shell). Prebuilt binaries are distributed for that toolchain so `pnpm install` will pick them up without extra work.
2. **Switching to another Node version** – install a C/C++ toolchain (`build-essential` on Debian/Ubuntu, Xcode CLT on macOS, MSVC Build Tools on Windows) and run the helper script so the native bindings are rebuilt under the requested runtime:
   ```bash
   pnpm sqlite:refresh 22
   ```
   The script (located at `scripts/refresh-sqlite.sh`) clears cached binaries, switches Node via your version manager (`nvm`, `mise`/`rtx`, `fnm`, or `volta`), and recompiles using `node-gyp`. Provide a different major/minor if you need another release, or omit the argument to use the default (22). If the version manager does not yet have that Node install, follow the prompt (`nvm install 22`, `mise install node@22`, etc.) and re-run the command. For environments without a supported manager, export `NODE_VERSION_MANAGER=none`, ensure the shell is already using the desired `node`, and invoke the script directly.
3. **Targeting Electron** – install `@electron/rebuild` (`pnpm add -D @electron/rebuild`) and re-run the helper with the Electron flag so both the Node and Electron bindings are produced:
   ```bash
   pnpm sqlite:refresh --electron
   ```
   Electron’s headers are fetched on demand, so the rebuild requires network access the first time for a given Electron release. After the command completes, the script restores the Node build so CLI tasks continue to work, while storing the Electron binary inside `lib/binding` for the desktop shell.
4. **Temporary fallback** – set `JAMRA_DISABLE_SQLITE=1` to disable the persistent cache. The host automatically falls back to the in-memory cache so you can continue testing features:
   ```bash
   JAMRA_DISABLE_SQLITE=1 pnpm extension:demo
   ```
5. **Re-enable persistence** – unset `JAMRA_DISABLE_SQLITE` and rebuild once your toolchain is ready.

With SQLite enabled, the catalog database lives at `.jamra-data/catalog.sqlite` by default. Adjust `JAMRA_DATA_DIR` or provide `filePath` when instantiating `CatalogDatabase` to override the location.
