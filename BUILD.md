# Building JAMRA

Short guide for packaging the Electron app. For broader operational details
(scripts, native bindings, troubleshooting) see [`docs/operations.md`](docs/operations.md).

## Prerequisites

- Node 24.x and pnpm 10+
- Platform toolchain with C/C++ support:
  - macOS – Xcode Command Line Tools
  - Windows – Visual Studio Build Tools (Desktop C++)
  - Linux – `build-essential` + `libsqlite3-dev` (or distro equivalent)
- Platform icons in `build/` (`icon.icns`, `icon.ico`, `icons/*.png`)

## Core commands

```bash
pnpm install        # ensure dependencies and native bindings are ready
pnpm desktop:dev    # refresh bindings then launch the Electron shell
pnpm dist           # package for the current platform (outputs in dist-electron/)
pnpm dist:mac       # macOS DMG + ZIP (needs macOS runner)
pnpm dist:win       # Windows NSIS installer + portable exe
pnpm dist:linux     # Linux AppImage + deb/rpm
```

`pnpm backend:build` and `pnpm build` already force a clean rebuild of
`@jamra/catalog-server` to avoid stale API handlers. Expect the same behaviour
when packaging the desktop app.

## Output

Artifacts land in `dist-electron/` (one folder per run). Typical files include:

- `JAMRA-<version>.dmg`, `JAMRA-<version>-mac.zip`
- `JAMRA Setup <version>.exe`, `JAMRA <version>.exe`
- `JAMRA-<version>.AppImage`, `jamra_<version>_amd64.deb`, `jamra-<version>.rpm`

## Troubleshooting quick hits

- `NODE_MODULE_VERSION mismatch` → run `pnpm desktop:refresh`
- macOS “app is damaged” → unsigned builds require `xattr -cr JAMRA.app`
- Windows SmartScreen → sign releases or instruct testers to choose “Run anyway”
- Linux AppImage not executable → `chmod +x JAMRA-<version>.AppImage`

Need more detail? See the dedicated sections in `docs/operations.md`.
