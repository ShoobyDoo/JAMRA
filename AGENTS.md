# Repository Guidelines

## Project Structure & Modules

- App root: `JAMRA/`
- Frontend (Vite + React): `src/`, entry `src/main.tsx`
- Desktop shell (Tauri): `src-tauri/` (Rust builder + `tauri.conf.json`)
- Backend (Express + better-sqlite3): `server/src/` → builds to `server/dist/`
- Packaging config: `src-tauri/tauri.conf.json`; release output: `src-tauri/target/release/`
- Docs: `docs/` (packaging, troubleshooting, structure)

## Build, Test, Development

- Dev frontend: `pnpm dev:frontend`
- Dev backend: `pnpm dev:server`
- Dev both (concurrently): `pnpm dev`
- Desktop shell (Tauri): `pnpm desktop`
- Production build (app + server): `pnpm build:app`
- Desktop bundle (all platforms): `pnpm build` (runs on host OS)

## Coding Style & Naming

- TypeScript strict across app and server
- Prettier + ESLint; run `pnpm lint`
- Indentation: 2 spaces; use explicit return types for public APIs
- Filenames: kebab-case for files, PascalCase for React components, camelCase for functions/vars

## Testing Guidelines

- Manual packaged run is required for native module/packaging checks
- Health endpoint: `GET http://localhost:3000/health` returns `{ status: 'ok' }`
- Verify DB path under `app.getPath('userData')` and that migrations run on first launch
- Packaged launch logs: `%APPDATA%/JAMRA/logs/main.log`

## Commit & PR Guidelines

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `build:`, `chore:`
- Keep commits scoped; one logical change per commit
- PRs include: overview, screenshots (UI), linked issues, and test notes (how you verified build/run)
- Avoid noise; remove dead config when migrating tooling

## Platform & Packaging Notes

- **Tauri** handles packaging (see `src-tauri/tauri.conf.json`)
  - `beforeDevCommand`: `pnpm dev` (frontend + server watchers)
  - `beforeBuildCommand`: `pnpm build:app && pnpm bundle:server`
  - Resources bundled with the app: `build/frontend`, `build/server-bundle`, `build/node-runtime`, `resources/`
- Packaged builds include a Node.js 24 runtime under `resources/node-runtime` so the host does not need a global Node install.
- Release artifacts land in `src-tauri/target/release/`

## Support & Troubleshooting

- Existing Electron docs (`docs/Windows-Electron-Packaging.md`, etc.) are considered legacy reference. New Tauri-specific notes live alongside `docs/manual-verification-checklist.md`.
- If the bundled server fails to start, inspect the Tauri stdout logs (the Rust host emits spawn errors) and ensure `resources/node-runtime/node.exe` was bundled correctly.
